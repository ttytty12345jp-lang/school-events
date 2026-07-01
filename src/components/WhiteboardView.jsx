import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase, USE_SUPABASE } from '../lib/supabase'
import { useHeaderControls } from '../HeaderControlsContext'
import MorningAgenda from './MorningAgenda'
import StickyNotes from './StickyNotes'
import DriveWidget from './DriveWidget'
import { DAYS_JA, dateKey as toDateKey, monthKey } from '../utils/date'
import { loadSpanEvents, getActiveSpans } from '../lib/spanEvents'
import { subscribeSchoolNotices, markPending, onVisibilityReload } from '../lib/schoolNoticesRealtime'

const HIGHLIGHTS_TYPE = 'row_highlights'

const LEAVE_TYPES_LEFT  = ['年休', '時休', '前半休', '後半休', '職免', '育児']
const LEAVE_TYPES_RIGHT = ['特休', '病休', '休職', '産休', '育休', '介護']
const LONG_LEAVE_TYPES = new Set(['病休', '休職', '産休', '育休'])
const LONG_LEAVE_TYPE = 'long_leave'
const LONG_LEAVE_DATE = 'long_leave'

const ROOM_RES_TYPE = 'room_reservations'
const ROOM_RES_DATE = 'room_reservations'

async function loadRoomReservations() {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(ROOM_RES_DATE) || '[]') } catch { return [] }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', ROOM_RES_DATE).eq('type', ROOM_RES_TYPE).maybeSingle()
  if (!data?.content) return []
  try { return JSON.parse(data.content) } catch { return [] }
}

async function saveRoomReservations(list) {
  const json = JSON.stringify(list)
  if (!USE_SUPABASE) { localStorage.setItem(ROOM_RES_DATE, json); return }
  await supabase.from('school_notices')
    .upsert({ date: ROOM_RES_DATE, type: ROOM_RES_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}

// 月・日 → 年付きの日付キー（入力日基準で近未来を推定）
function getTargetDateKey(month, day, entryDateKey) {
  const m = parseInt(month), d = parseInt(day)
  if (!m || !d) return null
  const entry = new Date(entryDateKey + 'T00:00:00')
  let year = entry.getFullYear()
  const target = new Date(year, m - 1, d)
  if (target < entry) year++
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

async function loadLongLeave() {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem('long_leave') || '[]') } catch { return [] }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', LONG_LEAVE_DATE).eq('type', LONG_LEAVE_TYPE).maybeSingle()
  if (!data?.content) return []
  try { return JSON.parse(data.content) } catch { return [] }
}

async function saveLongLeave(list) {
  const json = JSON.stringify(list)
  if (!USE_SUPABASE) { localStorage.setItem('long_leave', json); return }
  await supabase.from('school_notices')
    .upsert({ date: LONG_LEAVE_DATE, type: LONG_LEAVE_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}

function LongLeaveModal({ leaveType, entry, onSave, onDelete, onClose }) {
  const [name, setName] = useState(entry?.name || '')
  const [startDate, setStartDate] = useState(entry?.startDate || '')
  const [endDate, setEndDate] = useState(entry?.endDate || '')
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function handleSave() {
    if (!name.trim() || !startDate || !endDate) return
    onSave({ id: entry?.id || crypto.randomUUID(), type: leaveType, name: name.trim(), startDate, endDate })
    onClose()
  }

  return (
    <div className="span-modal" ref={ref}>
      <div className="span-modal-header">
        <span>{leaveType} — {entry ? '編集' : '追加'}</span>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>
      <div className="span-modal-body">
        <input className="span-modal-input" value={name} onChange={e => setName(e.target.value)} placeholder="氏名" autoFocus />
        <div className="span-modal-row">
          <input type="date" className="span-modal-date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span>〜</span>
          <input type="date" className="span-modal-date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="span-modal-actions">
          <button className="hc-btn hc-btn-primary" onClick={handleSave}>保存</button>
          {entry && <button className="btn-danger" onClick={() => { onDelete(entry.id); onClose() }}>削除</button>}
        </div>
      </div>
    </div>
  )
}

const ROOM_COUNT = 9
const TRIP_COUNT = 7

function dateFromKey(k) { return new Date(k + 'T00:00:00') }
function navKey(key, delta) {
  const d = dateFromKey(key)
  d.setDate(d.getDate() + delta)
  return toDateKey(d)
}

// 2つの日付キーが属するISO週の月曜日を返す
function mondayOf(dateKey) {
  const d = dateFromKey(dateKey)
  const day = d.getDay() // 0=日,1=月,...
  const diff = (day + 6) % 7 // 月曜起点
  d.setDate(d.getDate() - diff)
  return toDateKey(d)
}
// 週差（正=currが後）
function weekDiff(prevKey, currKey) {
  const ms = dateFromKey(mondayOf(currKey)) - dateFromKey(mondayOf(prevKey))
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000))
}
// 直近の teamToday から dateKey に対応する班番号を推定（1〜4, なければ ''）
async function inferTeam(dateKey) {
  let lastDate = null, lastTeam = 0
  if (!USE_SUPABASE) {
    for (let i = 1; i <= 90; i++) {
      const d = dateFromKey(dateKey); d.setDate(d.getDate() - i)
      const k = toDateKey(d)
      try {
        const saved = JSON.parse(localStorage.getItem(`whiteboard_${k}`) || 'null')
        if (saved?.teamToday) { lastDate = k; lastTeam = parseInt(saved.teamToday); break }
      } catch {}
    }
  } else {
    const { data } = await supabase.from('school_notices').select('date, content')
      .eq('type', 'whiteboard').lt('date', dateKey).order('date', { ascending: false }).limit(90)
    for (const row of (data || [])) {
      try {
        const parsed = JSON.parse(row.content)
        if (parsed?.teamToday) { lastDate = row.date; lastTeam = parseInt(parsed.teamToday); break }
      } catch {}
    }
  }
  if (!lastDate || isNaN(lastTeam) || lastTeam < 1 || lastTeam > 4) return ''
  const weeks = weekDiff(lastDate, dateKey)
  return String(((lastTeam - 1 + weeks) % 4) + 1)
}

function emptyRoom() { return { place: '', month: '', day: '', dow: '', timeStart: '', timeEnd: '', users: '', purpose: '' } }
function emptyTrip() { return { name: '', destination: '', purpose: '', timeStart: '', timeEnd: '' } }
function emptyLeave() {
  const obj = {}
  ;[...LEAVE_TYPES_LEFT, ...LEAVE_TYPES_RIGHT].forEach(t => { obj[t] = '' })
  return obj
}
function emptyData() {
  return {
    rooms: Array.from({ length: ROOM_COUNT }, emptyRoom),
    trips: Array.from({ length: TRIP_COUNT }, emptyTrip),
    leave: emptyLeave(),
    dutyToday: '',
    dutyTomorrow: '',
    teamToday: '',
    teamTomorrow: '',
    weekEventToday: '',
    weekEventTomorrow: '',
  }
}

async function loadWhiteboard(dateKey) {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(`whiteboard_${dateKey}`) || 'null') } catch { return null }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', dateKey).eq('type', 'whiteboard').maybeSingle()
  if (!data?.content) return null
  try {
    const parsed = JSON.parse(data.content)
    // 定数変更時に古いデータの行数が足りない場合を補正
    if (parsed && Array.isArray(parsed.trips) && parsed.trips.length < TRIP_COUNT) {
      parsed.trips = [...parsed.trips, ...Array.from({ length: TRIP_COUNT - parsed.trips.length }, emptyTrip)]
    }
    if (parsed && Array.isArray(parsed.rooms) && parsed.rooms.length < ROOM_COUNT) {
      parsed.rooms = [...parsed.rooms, ...Array.from({ length: ROOM_COUNT - parsed.rooms.length }, emptyRoom)]
    }
    return parsed
  } catch { return null }
}

async function saveWhiteboard(dateKey, data) {
  const json = JSON.stringify(data)
  if (!USE_SUPABASE) { localStorage.setItem(`whiteboard_${dateKey}`, json); return }
  await supabase.from('school_notices')
    .upsert({ date: dateKey, type: 'whiteboard', content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}


function formatShort(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`
}

// 幅に収まるよう font-size を自動縮小（テキスト入力用）
const CELL_FONT_MAX = 20
const CELL_FONT_MIN = 10
function autoScaleWidth(el) {
  if (!el) return
  el.style.fontSize = ''
  const base = parseFloat(getComputedStyle(el).fontSize) || CELL_FONT_MAX
  let size = Math.min(base, CELL_FONT_MAX)
  el.style.fontSize = size + 'px'
  while (el.scrollWidth > el.clientWidth && size > CELL_FONT_MIN) {
    size -= 1
    el.style.fontSize = size + 'px'
  }
}

// ── Inline editable cell ───────────────────────────────────
function EditCell({ value, onChange, placeholder = '', className = '', align, listId, options, live = false, onNext, cellKey, tripKey, noTab = false }) {
  const [local, setLocal] = useState(value)
  const [dropPos, setDropPos] = useState(null) // { top, left, width } or null
  const ref = useRef(null)
  const dropRef = useRef(null)
  useEffect(() => { setLocal(value) }, [value])
  useEffect(() => { autoScaleWidth(ref.current) }, [local])

  const opts = options || []
  const hasOpts = opts.length > 0

  useEffect(() => {
    if (!dropPos) return
    function handler(e) {
      const inInput = ref.current?.contains(e.target)
      const inDrop = dropRef.current?.contains(e.target)
      if (!inInput && !inDrop) setDropPos(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropPos])

  function handleChange(e) {
    setLocal(e.target.value)
    if (live) onChange(e.target.value)
  }
  function handleBlur() {
    if (!live && local !== value) onChange(local)
  }
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      setDropPos(null)
      ref.current?.blur()           // handleBlur が onChange を担う
      if (onNext) setTimeout(onNext, 0)  // 再レンダー後に次セルへ
    }
  }
  function handleFocus() {
    if (!hasOpts) return
    const rect = ref.current?.getBoundingClientRect()
    if (rect) setDropPos({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: Math.max(rect.width, 120) })
  }
  function handleSelect(opt) {
    setLocal(opt)
    onChange(opt)
    setDropPos(null)
    autoScaleWidth(ref.current)
    if (onNext) setTimeout(onNext, 0)  // 再レンダー後に次セルへ
  }

  return (
    <>
      <input
        ref={ref}
        className={`wb-input ${className}`}
        value={local}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={align ? { textAlign: align } : undefined}
        list={hasOpts ? undefined : (listId || undefined)}
        autoComplete="off"
        {...(noTab ? { tabIndex: -1 } : {})}
        {...(cellKey ? { 'data-room-cell': cellKey } : {})}
        {...(tripKey ? { 'data-trip-cell': tripKey } : {})}
      />
      {hasOpts && dropPos && (
        <ul ref={dropRef} className="wb-dropdown" style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}>
          {opts.map(opt => (
            <li key={opt} className="wb-dropdown-item" onMouseDown={() => handleSelect(opt)}>{opt}</li>
          ))}
        </ul>
      )}
    </>
  )
}

// ── 自由テキスト＋時計ボタンでネイティブピッカー ─────────
function TimeInput({ val, onChange, cellKey, tripCellKey, onNext, inputClass = '', comboClass = '' }) {
  const [text, setText] = useState(val)
  const pickerRef = useRef(null)
  useEffect(() => { setText(val) }, [val])
  return (
    <span className={`wb-time-combo${comboClass ? ' ' + comboClass : ''}`}>
      <input type="text" className={`wb-time-input${inputClass ? ' ' + inputClass : ''}`} value={text}
        onChange={e => { setText(e.target.value); onChange(e.target.value) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur(); if (onNext) setTimeout(onNext, 0) } }}
        onDoubleClick={() => pickerRef.current?.showPicker()}
        title="ダブルクリックで時刻ピッカーを開く"
        {...(cellKey ? { 'data-room-cell': cellKey } : {})}
        {...(tripCellKey ? { 'data-trip-cell': tripCellKey } : {})}
      />
      <input type="time" className="wb-time-picker-hidden" ref={pickerRef}
        onChange={e => { setText(e.target.value); onChange(e.target.value) }}
        tabIndex={-1} />
    </span>
  )
}

// ── Time range ────────────────────────────────────────────
function TimeRange({ startVal, endVal, onStartChange, onEndChange, startCellKey, endCellKey, onEndNext, startTripKey, endTripKey }) {
  const endAttr = endCellKey ? `input[data-room-cell="${endCellKey}"]`
    : endTripKey ? `input[data-trip-cell="${endTripKey}"]` : null
  return (
    <div className="wb-time-range">
      <TimeInput val={startVal} onChange={onStartChange} cellKey={startCellKey} tripCellKey={startTripKey}
        onNext={endAttr ? () => document.querySelector(endAttr)?.focus() : undefined}
        inputClass="wb-time-input-c" comboClass="wb-time-combo-c" />
      <span className="wb-tilde">～</span>
      <TimeInput val={endVal} onChange={onEndChange} cellKey={endCellKey} tripCellKey={endTripKey} onNext={onEndNext} inputClass="wb-time-input-c" comboClass="wb-time-combo-c" />
    </div>
  )
}

// ── Row clear button ───────────────────────────────────────
function ClearBtn({ onClick }) {
  return (
    <button className="wb-clear-btn" onClick={onClick} title="この行をクリア">×</button>
  )
}

// selectedKeyの前後の登校日（土日・グレー日を飛ばす）を求めるhook
// { prev: 前の登校日key, next: 次の登校日key } を返す
function useAdjacentSchoolDays(selectedKey) {
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    const base = dateFromKey(selectedKey)
    const mkeys = []
    for (let i = -2; i <= 2; i++) {
      const d = new Date(base)
      d.setDate(1)
      d.setMonth(d.getMonth() + i)
      mkeys.push(monthKey(d.getFullYear(), d.getMonth() + 1))
    }
    if (!USE_SUPABASE) {
      const r = {}
      mkeys.forEach(mk => {
        try { r[mk] = JSON.parse(localStorage.getItem(`row_highlights_${mk}`) || '{}') } catch { r[mk] = {} }
      })
      setOverrides(r); return
    }
    supabase.from('school_notices').select('date, content')
      .in('date', mkeys).eq('type', HIGHLIGHTS_TYPE)
      .then(({ data }) => {
        const r = {}
        mkeys.forEach(mk => { r[mk] = {} })
        ;(data || []).forEach(row => { try { r[row.date] = JSON.parse(row.content) } catch {} })
        setOverrides(r)
      })
  }, [selectedKey])

  return useMemo(() => {
    const isSchoolDay = (key) => {
      const d = dateFromKey(key)
      const dow = d.getDay()
      const isWeekend = dow === 0 || dow === 6
      const mk = monthKey(d.getFullYear(), d.getMonth() + 1)
      const override = (overrides[mk] || {})[key]
      return override === 'none' ? true : override === 'gray' ? false : !isWeekend
    }
    let next = navKey(selectedKey, 1)
    for (let delta = 1; delta <= 14; delta++) {
      const k = navKey(selectedKey, delta)
      if (isSchoolDay(k)) { next = k; break }
    }
    let prev = navKey(selectedKey, -1)
    for (let delta = 1; delta <= 14; delta++) {
      const k = navKey(selectedKey, -delta)
      if (isSchoolDay(k)) { prev = k; break }
    }
    return { next, prev }
  }, [selectedKey, overrides])
}

export default function WhiteboardView({ events, db = {} }) {
  const todayKey = toDateKey(new Date())
  const [selectedKey, setSelectedKey] = useState(() => sessionStorage.getItem('wb_date') || todayKey)
  function changeDate(k) {
    sessionStorage.setItem('wb_date', k)
    setSelectedKey(k)
  }
  const { next: tomorrowKey, prev: prevSchoolDay } = useAdjacentSchoolDays(selectedKey)

  const selectedDate = dateFromKey(selectedKey)
  const tomorrowDate = dateFromKey(tomorrowKey)

  const DAYS_JA_WEEK = ['日', '月', '火', '水', '木', '金', '土']

  // 班+曜日 → 名前（入力値 "1"〜"4" を "班1"〜"班4" に変換）
  function nursingName(team, dateKey) {
    if (!team) return ''
    const key = team.startsWith('班') ? team : `班${team}`
    const dow = DAYS_JA_WEEK[dateFromKey(dateKey).getDay()]
    return (db.nursing || {})[key]?.[dow] || ''
  }

  // 班入力時に当番名を自動反映
  function updateTeamToday(team) {
    scheduleSave({ ...data, teamToday: team, dutyToday: nursingName(team, selectedKey) })
  }
  function updateTeamTomorrow(team) {
    scheduleSave({ ...data, teamTomorrow: team, dutyTomorrow: nursingName(team, tomorrowKey) })
  }

  // 看護当番のドロップダウン候補（曜日別に全班の名前を集める）
  const nursingForDay = useMemo(() => {
    const nursing = db.nursing || {}
    const getNames = (dateKey) => {
      const dow = DAYS_JA_WEEK[dateFromKey(dateKey).getDay()]
      return Object.values(nursing).map(t => t[dow]).filter(Boolean)
    }
    return { today: getNames(selectedKey), tomorrow: getNames(tomorrowKey) }
  }, [db.nursing, selectedKey, tomorrowKey])

  const [data, setData] = useState(emptyData)
  const [saving, setSaving] = useState(false)
  const [spanEvents, setSpanEvents] = useState([])
  const [longLeave, setLongLeave] = useState([])
  const [longLeaveModal, setLongLeaveModal] = useState(null) // { leaveType, entry|null }
  const [roomReservations, setRoomReservations] = useState([])
  const roomResDebounceRef = useRef(null)

  useEffect(() => { loadSpanEvents().then(setSpanEvents) }, [])
  useEffect(() => { loadLongLeave().then(setLongLeave) }, [])
  useEffect(() => { loadRoomReservations().then(setRoomReservations) }, [])

  // 他端末の変更をリアルタイムで受信
  const selectedKeyRef = useRef(selectedKey)
  useEffect(() => { selectedKeyRef.current = selectedKey }, [selectedKey])
  useEffect(() => {
    return subscribeSchoolNotices(row => {
      if (row.type === 'whiteboard' && row.date === selectedKeyRef.current) {
        try { setData({ ...emptyData(), ...JSON.parse(row.content) }) } catch {}
      } else if (row.type === ROOM_RES_TYPE) {
        loadRoomReservations().then(setRoomReservations)
      } else if (row.type === LONG_LEAVE_TYPE) {
        loadLongLeave().then(setLongLeave)
      }
    })
  }, [])

  // スマホ復帰時に全データを再ロード
  useEffect(() => {
    return onVisibilityReload(() => {
      loadWhiteboard(selectedKeyRef.current).then(saved => {
        if (saved) setData({ ...emptyData(), ...saved })
      })
      loadRoomReservations().then(setRoomReservations)
      loadLongLeave().then(setLongLeave)
    })
  }, [])

  function getActiveLongLeave(leaveType) {
    return longLeave.filter(e => e.type === leaveType && e.startDate <= selectedKey && selectedKey <= e.endDate)
  }

  async function handleSaveLongLeave(entry) {
    const next = longLeave.some(e => e.id === entry.id)
      ? longLeave.map(e => e.id === entry.id ? entry : e)
      : [...longLeave, entry]
    setLongLeave(next)
    await saveLongLeave(next)
  }

  async function handleDeleteLongLeave(id) {
    const next = longLeave.filter(e => e.id !== id)
    setLongLeave(next)
    await saveLongLeave(next)
  }
  const debounceRef = useRef(null)
  const { setControls } = useHeaderControls()

  useEffect(() => {
    setData(emptyData())
    loadWhiteboard(selectedKey).then(async saved => {
      const merged = { ...emptyData(), ...(saved || {}) }
      if (saved?.weekEvent && !saved.weekEventToday) merged.weekEventToday = saved.weekEvent
      if (!Array.isArray(merged.trips) || merged.trips.length < TRIP_COUNT)
        merged.trips = [...(merged.trips || []), ...Array.from({ length: TRIP_COUNT - (merged.trips?.length || 0) }, emptyTrip)]
      if (!Array.isArray(merged.rooms) || merged.rooms.length < ROOM_COUNT)
        merged.rooms = [...(merged.rooms || []), ...Array.from({ length: ROOM_COUNT - (merged.rooms?.length || 0) }, emptyRoom)]

      // 未保存の日は直近の班から自動推定
      if (!saved) {
        const team = await inferTeam(selectedKey)
        if (team) {
          merged.teamToday = team
          const key = `班${team}`
          const dow = DAYS_JA[dateFromKey(selectedKey).getDay()]
          merged.dutyToday = (db.nursing || {})[key]?.[dow] || ''
        }
        const teamTom = await inferTeam(tomorrowKey)
        if (teamTom) {
          merged.teamTomorrow = teamTom
          const key = `班${teamTom}`
          const dow = DAYS_JA[dateFromKey(tomorrowKey).getDay()]
          merged.dutyTomorrow = (db.nursing || {})[key]?.[dow] || ''
        }
      }

      setData(merged)
    })
  }, [selectedKey])

  const scheduleSave = useCallback((next) => {
    setData(next)
    markPending(selectedKey, 'whiteboard')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      await saveWhiteboard(selectedKey, next)
      setSaving(false)
      debounceRef.current = null // 保存完了 → ポーリングを再開できるように戻す
    }, 800)
  }, [selectedKey])

  // Realtime 取りこぼし対策のポーリング。モバイルは WebSocket が切れやすく
  // 他端末の変更が届かないことがあるため、数秒ごとに現在の日付を再取得して補う。
  // 編集中（入力にフォーカス）や未保存の変更がある間は上書きしない。
  useEffect(() => {
    if (!USE_SUPABASE) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (debounceRef.current) return // ローカルに未保存の変更あり
      const ae = document.activeElement
      if (ae && ae.closest && ae.closest('.wb-wrap')) return // 入力中
      loadWhiteboard(selectedKeyRef.current).then(saved => {
        if (!saved) return
        const next = { ...emptyData(), ...saved }
        if (!Array.isArray(next.trips) || next.trips.length < TRIP_COUNT)
          next.trips = [...(next.trips || []), ...Array.from({ length: TRIP_COUNT - (next.trips?.length || 0) }, emptyTrip)]
        if (!Array.isArray(next.rooms) || next.rooms.length < ROOM_COUNT)
          next.rooms = [...(next.rooms || []), ...Array.from({ length: ROOM_COUNT - (next.rooms?.length || 0) }, emptyRoom)]
        setData(prev => JSON.stringify(prev) === JSON.stringify(next) ? prev : next)
      })
    }, 5000)
    return () => clearInterval(id)
  }, [])

  // Header controls
  useEffect(() => {
    setControls(
      <div className="hc-row">
        <button className="hc-btn-nav" onClick={() => changeDate(navKey(selectedKey, -1))}>‹</button>
        <input type="date" value={selectedKey} onChange={e => changeDate(e.target.value)} className="hc-date-input" />
        <button className="hc-btn-nav" onClick={() => changeDate(navKey(selectedKey, 1))}>›</button>
        {selectedKey !== todayKey && (
          <button className="hc-btn" onClick={() => changeDate(todayKey)}>今日に戻る</button>
        )}
        {saving && <span className="hc-saving">保存中…</span>}
        <button className="hc-btn" onClick={() => window.print()}>🖨️ 印刷</button>
      </div>
    )
    return () => setControls(null)
  }, [selectedKey, todayKey, saving])

  // Update helpers
  function toHalf(s) { return String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)) }

  // selectedKey に表示すべき予約（entryDate〜targetDate の期間内）
  const activeRoomReservations = useMemo(() => {
    return roomReservations.filter(r => {
      if (!r.entryDate) return false
      const targetKey = getTargetDateKey(r.month, r.day, r.entryDate)
      if (!targetKey) return r.entryDate <= selectedKey
      return r.entryDate <= selectedKey && selectedKey <= targetKey
    })
  }, [roomReservations, selectedKey])

  // ROOM_COUNT 個の固定スロットに、各予約を slot 位置で配置（入力した段に留める）
  const displayedRooms = useMemo(() => {
    const slots = Array.from({ length: ROOM_COUNT }, (_, i) => ({
      id: null, entryDate: selectedKey, slot: i,
      place: '', month: '', day: '', dow: '', timeStart: '', timeEnd: '', users: '', purpose: '',
    }))
    const overflow = []
    activeRoomReservations.forEach(r => {
      const s = Number.isInteger(r.slot) ? r.slot : -1
      if (s >= 0 && s < ROOM_COUNT && slots[s].id === null) slots[s] = r
      else overflow.push(r) // slot 未設定（旧データ）や衝突分は空きへ
    })
    // 端末間で配置が一致するよう、空き段へ詰める順序を決定的に（entryDate→id）
    overflow.sort((a, b) => (a.entryDate || '').localeCompare(b.entryDate || '') || (a.id || '').localeCompare(b.id || ''))
    overflow.forEach(r => {
      const free = slots.findIndex(x => x.id === null)
      if (free >= 0) slots[free] = r
    })
    return slots
  }, [activeRoomReservations, selectedKey])

  function scheduleRoomResSave(next) {
    setRoomReservations(next)
    markPending(ROOM_RES_DATE, ROOM_RES_TYPE)
    if (roomResDebounceRef.current) clearTimeout(roomResDebounceRef.current)
    roomResDebounceRef.current = setTimeout(() => saveRoomReservations(next), 800)
  }

  function updateRoom(i, field, val) {
    const v = (field === 'month' || field === 'day') ? toHalf(val) : val
    const row = displayedRooms[i]
    const updated = { ...row, [field]: v }
    if (field === 'month' || field === 'day') {
      // 年度管理：1〜3月は翌年。getTargetDateKey が「entryより前なら翌年」で
      // 正しい暦年を返すので、その日付から曜日を決定する
      const m = field === 'month' ? v : row.month
      const d = field === 'day' ? v : row.day
      const targetKey = getTargetDateKey(m, d, row.entryDate || selectedKey)
      updated.dow = targetKey ? DAYS_JA[new Date(targetKey + 'T00:00:00').getDay()] : ''
    }
    // slot 未設定の旧データは、編集時に現在の段へ固定して端末間のズレを解消
    if (!Number.isInteger(updated.slot)) updated.slot = i
    let next
    if (row.id) {
      next = roomReservations.map(r => r.id === row.id ? updated : r)
    } else {
      updated.id = crypto.randomUUID()
      updated.entryDate = selectedKey
      updated.slot = i // 入力した段の位置を保持
      next = [...roomReservations, updated]
    }
    scheduleRoomResSave(next)
  }
  function clearRoom(i) {
    const row = displayedRooms[i]
    if (!row.id) return
    const next = roomReservations.filter(r => r.id !== row.id)
    scheduleRoomResSave(next)
  }
  function updateTrip(i, field, val) {
    const trips = data.trips.map((t, idx) => idx === i ? { ...t, [field]: val } : t)
    scheduleSave({ ...data, trips })
  }
  function clearTrip(i) {
    const trips = data.trips.map((t, idx) => idx === i ? emptyTrip() : t)
    scheduleSave({ ...data, trips })
  }
  function updateLeave(type, val) {
    scheduleSave({ ...data, leave: { ...data.leave, [type]: val } })
  }
  function updateField(field, val) {
    scheduleSave({ ...data, [field]: val })
  }

  // Events for right panel
  const selEvents = useMemo(() =>
    events.filter(e => e.date === selectedKey).sort((a, b) => (a.start_time || '99:99') > (b.start_time || '99:99') ? 1 : -1),
    [events, selectedKey])
  const nextEvents = useMemo(() =>
    events.filter(e => e.date === tomorrowKey).sort((a, b) => (a.start_time || '99:99') > (b.start_time || '99:99') ? 1 : -1),
    [events, tomorrowKey])

  // 月中行事と同期（保存データを消して再マウント）
  const [agendaResetToday, setAgendaResetToday] = useState(0)
  const [agendaResetTomorrow, setAgendaResetTomorrow] = useState(0)

  async function syncAgenda(dateKey, setReset) {
    if (USE_SUPABASE) {
      await supabase.from('school_notices').delete()
        .eq('date', dateKey).eq('type', 'morning_agenda')
    } else {
      localStorage.removeItem(`agenda_${dateKey}`)
    }
    setReset(n => n + 1)
  }

  return (
    <div className="wb-wrap">
      {longLeaveModal && (
        <LongLeaveModal
          leaveType={longLeaveModal.leaveType}
          entry={longLeaveModal.entry}
          onSave={handleSaveLongLeave}
          onDelete={handleDeleteLongLeave}
          onClose={() => setLongLeaveModal(null)}
        />
      )}
      <datalist id="wb-rooms-list">
        {(db.rooms || []).map(r => <option key={r} value={r} />)}
      </datalist>
      <datalist id="wb-names-list">
        {(db.names || []).map(n => <option key={n} value={n} />)}
      </datalist>
      <datalist id="wb-duty-today-list">
        {nursingForDay.today.map(n => <option key={n} value={n} />)}
      </datalist>
      <datalist id="wb-duty-tomorrow-list">
        {nursingForDay.tomorrow.map(n => <option key={n} value={n} />)}
      </datalist>
      <div className="wb-layout">

        {/* ── 左パネル ── */}
        <div className="wb-left">

          {/* 特別教室等使用予定 */}
          <div className="wb-section">
            <table className="wb-table">
              <colgroup>
                <col style={{width:'22px'}} />
                <col style={{width:'15%'}} />
                <col style={{width:'4.5%'}} />
                <col style={{width:'4.5%'}} />
                <col style={{width:'4.5%'}} />
                <col style={{width:'22%'}} />
                <col style={{width:'19%'}} />
                <col />
                <col style={{width:'22px'}} />
              </colgroup>
              <tbody>
                <tr className="wb-header-row">
                  <td className="wb-th-section" rowSpan={ROOM_COUNT + 1}>特別教室等使用予定</td>
                  <td className="wb-th">場所</td>
                  <td className="wb-th">月</td>
                  <td className="wb-th">日</td>
                  <td className="wb-th">曜</td>
                  <td className="wb-th">時間</td>
                  <td className="wb-th">使用者</td>
                  <td className="wb-th">使用目的</td>
                  <td className="wb-th wb-th-clear"></td>
                </tr>
                {displayedRooms.map((r, i) => {
                  const goTo = field => () =>
                    document.querySelector(`input[data-room-cell="${i}-${field}"]`)?.focus()
                  return (
                  <tr key={r.id || `slot-${i}`} className="wb-row">
                    <td className="wb-td">
                      <EditCell value={r.place} onChange={v => updateRoom(i, 'place', v)} options={db.rooms || []} onNext={goTo('month')} cellKey={`${i}-place`} />
                    </td>
                    <td className="wb-td wb-td-center">
                      <EditCell value={r.month} onChange={v => updateRoom(i, 'month', v)} align="center" onNext={goTo('day')} cellKey={`${i}-month`} />
                    </td>
                    <td className="wb-td wb-td-center">
                      <EditCell value={r.day} onChange={v => updateRoom(i, 'day', v)} align="center" onNext={goTo('time-start')} cellKey={`${i}-day`} />
                    </td>
                    <td className="wb-td wb-td-center">
                      <EditCell value={r.dow} onChange={v => updateRoom(i, 'dow', v)} align="center" cellKey={`${i}-dow`} noTab />
                    </td>
                    <td className="wb-td">
                      <TimeRange
                        startVal={r.timeStart} endVal={r.timeEnd}
                        onStartChange={v => updateRoom(i, 'timeStart', v)}
                        onEndChange={v => updateRoom(i, 'timeEnd', v)}
                        startCellKey={`${i}-time-start`}
                        endCellKey={`${i}-time-end`}
                        onEndNext={goTo('users')}
                      />
                    </td>
                    <td className="wb-td">
                      <EditCell value={r.users} onChange={v => updateRoom(i, 'users', v)} options={db.names || []} onNext={goTo('purpose')} cellKey={`${i}-users`} />
                    </td>
                    <td className="wb-td">
                      <EditCell value={r.purpose} onChange={v => updateRoom(i, 'purpose', v)} cellKey={`${i}-purpose`} />
                    </td>
                    <td className="wb-td wb-td-clear">
                      <ClearBtn onClick={() => clearRoom(i)} />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 出張 */}
          <div className="wb-section">
            <table className="wb-table">
              <colgroup>
                <col style={{width:'22px'}} />
                <col style={{width:'15.5%'}} />
                <col style={{width:'27.25%'}} />
                <col style={{width:'27.25%'}} />
                <col />
                <col style={{width:'22px'}} />
              </colgroup>
              <tbody>
                <tr className="wb-header-row">
                  <td className="wb-th-section" rowSpan={TRIP_COUNT + 1}>出張</td>
                  <td className="wb-th">名前</td>
                  <td className="wb-th">行き先</td>
                  <td className="wb-th">用件</td>
                  <td className="wb-th">時間</td>
                  <td className="wb-th wb-th-clear"></td>
                </tr>
                {data.trips.map((t, i) => {
                  const goTo = field => () =>
                    document.querySelector(`input[data-trip-cell="${i}-${field}"]`)?.focus()
                  return (
                  <tr key={i} className="wb-row">
                    <td className="wb-td">
                      <EditCell value={t.name} onChange={v => updateTrip(i, 'name', v)} options={db.names || []} onNext={goTo('destination')} tripKey={`${i}-name`} />
                    </td>
                    <td className="wb-td">
                      <EditCell value={t.destination} onChange={v => updateTrip(i, 'destination', v)} onNext={goTo('purpose')} tripKey={`${i}-destination`} />
                    </td>
                    <td className="wb-td">
                      <EditCell value={t.purpose} onChange={v => updateTrip(i, 'purpose', v)} onNext={goTo('time-start')} tripKey={`${i}-purpose`} />
                    </td>
                    <td className="wb-td">
                      <TimeRange
                        startVal={t.timeStart} endVal={t.timeEnd}
                        onStartChange={v => updateTrip(i, 'timeStart', v)}
                        onEndChange={v => updateTrip(i, 'timeEnd', v)}
                        startTripKey={`${i}-time-start`}
                        endTripKey={`${i}-time-end`}
                      />
                    </td>
                    <td className="wb-td wb-td-clear">
                      <ClearBtn onClick={() => clearTrip(i)} />
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 休暇等 */}
          <div className="wb-section">
            <table className="wb-table">
              <colgroup>
                <col style={{width:'22px'}} />
                <col style={{width:'8%'}} />
                <col style={{width:'43%'}} />
                <col style={{width:'8%'}} />
                <col style={{width:'43%'}} />
              </colgroup>
              <tbody>
                {LEAVE_TYPES_LEFT.map((lt, i) => (
                  <tr key={lt} className="wb-row">
                    {i === 0 && (
                      <td className="wb-th-section wb-th-section-h" rowSpan={LEAVE_TYPES_LEFT.length}>休暇等</td>
                    )}
                    <td className="wb-td-leave-type">{lt}</td>
                    <td className="wb-td">
                      <EditCell value={data.leave[lt]} onChange={v => updateLeave(lt, v)} />
                    </td>
                    <td className="wb-td-leave-type">{LEAVE_TYPES_RIGHT[i]}</td>
                    <td className="wb-td">
                      {LONG_LEAVE_TYPES.has(LEAVE_TYPES_RIGHT[i]) ? (
                        <div className="wb-long-leave-cell" onClick={() => setLongLeaveModal({ leaveType: LEAVE_TYPES_RIGHT[i], entry: null })}>
                          {getActiveLongLeave(LEAVE_TYPES_RIGHT[i]).map(e => (
                            <span key={e.id} className="wb-long-leave-entry"
                              onClick={ev => { ev.stopPropagation(); setLongLeaveModal({ leaveType: LEAVE_TYPES_RIGHT[i], entry: e }) }}>
                              {e.name}
                            </span>
                          ))}
                          <span className="wb-long-leave-add">＋</span>
                        </div>
                      ) : (
                        <EditCell value={data.leave[LEAVE_TYPES_RIGHT[i]]} onChange={v => updateLeave(LEAVE_TYPES_RIGHT[i], v)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 右パネル ── */}
        <div className="wb-right">

          {/* 今日 */}
          <div className="wb-panel wb-today">
            <div className="wb-panel-title">
              <span className="wb-panel-label">今日</span>
              <span className="wb-date-nav">
                <button className="wb-date-nav-btn" onClick={() => changeDate(prevSchoolDay)} title="前の登校日">＜</button>
                <span className="wb-panel-date">{formatShort(selectedDate)}</span>
                <button className="wb-date-nav-btn" onClick={() => changeDate(tomorrowKey)} title="次の登校日">＞</button>
              </span>
              <span className="wb-duty-inline">
                <input
                  className="wb-team-input"
                  type="number" min="1" max="4"
                  value={data.teamToday || ''}
                  onChange={e => updateTeamToday(e.target.value)}
                  placeholder="□"
                />
                <span className="wb-duty-label">班　当番</span>
                <EditCell value={data.dutyToday} onChange={v => updateField('dutyToday', v)}
                  placeholder="" className="wb-duty-input" listId="wb-duty-today-list" />
              </span>
            </div>
            <div className="wb-week-event">
              {getActiveSpans(spanEvents, selectedKey).map(s => (
                <span key={s.id} className="span-label-chip" style={{ background: s.color }}>{s.title}</span>
              ))}
              <EditCell value={data.weekEventToday} onChange={v => updateField('weekEventToday', v)}
                placeholder="" className="wb-week-input" />
              <button className="wb-sync-btn" onClick={() => syncAgenda(selectedKey, setAgendaResetToday)} title="月中行事と同期">↺ 同期</button>
            </div>
            <div className="wb-schedule-list">
              <MorningAgenda key={`today-${selectedKey}-${agendaResetToday}`} dateKey={selectedKey} calendarEvents={selEvents} rich defaultSize={24} />
            </div>
            <DriveWidget key={`dw-today-${selectedKey}`} storeId="wb" dateKey={selectedKey} />
            <StickyNotes storageKey={`wb_sticky_${selectedKey}`} tabTop="25%" label="今日" region="top" />
          </div>

          {/* 明日 */}
          <div className="wb-panel wb-tomorrow">
            <div className="wb-panel-title">
              <span className="wb-panel-label">明日</span>
              <span className="wb-panel-date">{formatShort(tomorrowDate)}</span>
              <span className="wb-duty-inline">
                <input
                  className="wb-team-input"
                  type="number" min="1" max="4"
                  value={data.teamTomorrow || ''}
                  onChange={e => updateTeamTomorrow(e.target.value)}
                  placeholder="□"
                />
                <span className="wb-duty-label">班　当番</span>
                <EditCell value={data.dutyTomorrow} onChange={v => updateField('dutyTomorrow', v)}
                  placeholder="" className="wb-duty-input" listId="wb-duty-tomorrow-list" />
              </span>
            </div>
            <div className="wb-week-event">
              {getActiveSpans(spanEvents, tomorrowKey).map(s => (
                <span key={s.id} className="span-label-chip" style={{ background: s.color }}>{s.title}</span>
              ))}
              <EditCell value={data.weekEventTomorrow} onChange={v => updateField('weekEventTomorrow', v)}
                placeholder="" className="wb-week-input" />
              <button className="wb-sync-btn" onClick={() => syncAgenda(tomorrowKey, setAgendaResetTomorrow)} title="月中行事と同期">↺ 同期</button>
            </div>
            <div className="wb-schedule-list">
              <MorningAgenda key={`tomorrow-${tomorrowKey}-${agendaResetTomorrow}`} dateKey={tomorrowKey} calendarEvents={nextEvents} rich defaultSize={24} />
            </div>
            <DriveWidget key={`dw-tomorrow-${tomorrowKey}`} storeId="wb" dateKey={tomorrowKey} />
            <StickyNotes storageKey={`wb_sticky_${tomorrowKey}`} tabTop="75%" label="明日" region="bottom" />
          </div>

        </div>
      </div>
    </div>
  )
}
