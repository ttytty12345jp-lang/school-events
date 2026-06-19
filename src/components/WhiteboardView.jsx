import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useHeaderControls } from '../HeaderControlsContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const HIGHLIGHTS_TYPE = 'row_highlights'

function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
}

const LEAVE_TYPES_LEFT  = ['年休', '時休', '前半休', '後半休', '職免', '育児']
const LEAVE_TYPES_RIGHT = ['特休', '病休', '休職', '産休', '育休', '介護']

const ROOM_COUNT = 9
const TRIP_COUNT = 7

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function dateFromKey(k) { return new Date(k + 'T00:00:00') }
function navKey(key, delta) {
  const d = dateFromKey(key)
  d.setDate(d.getDate() + delta)
  return toDateKey(d)
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
  try { return JSON.parse(data.content) } catch { return null }
}

async function saveWhiteboard(dateKey, data) {
  const json = JSON.stringify(data)
  if (!USE_SUPABASE) { localStorage.setItem(`whiteboard_${dateKey}`, json); return }
  await supabase.from('school_notices')
    .upsert({ date: dateKey, type: 'whiteboard', content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}

function detectDow(month, day) {
  const m = parseInt(month), d = parseInt(day)
  if (!m || !d || m < 1 || m > 12 || d < 1 || d > 31) return ''
  return DAYS_JA[new Date(new Date().getFullYear(), m - 1, d).getDay()]
}

function formatShort(d) {
  return `${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`
}

// ── Inline editable cell ───────────────────────────────────
function EditCell({ value, onChange, placeholder = '', className = '', align = 'left', listId }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  return (
    <input
      className={`wb-input ${className}`}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onChange(local) }}
      placeholder={placeholder}
      style={{ textAlign: align }}
      list={listId}
    />
  )
}

// ── Time range: two HH:MM inputs with ～ between ──────────
function TimeRange({ startVal, endVal, onStartChange, onEndChange }) {
  const [ls, setLs] = useState(startVal)
  const [le, setLe] = useState(endVal)
  useEffect(() => { setLs(startVal) }, [startVal])
  useEffect(() => { setLe(endVal) }, [endVal])
  return (
    <div className="wb-time-range">
      <input className="wb-time-input" value={ls}
        onChange={e => setLs(e.target.value)}
        onBlur={() => { if (ls !== startVal) onStartChange(ls) }}
        placeholder="--:--" maxLength={5} />
      <span className="wb-tilde">～</span>
      <input className="wb-time-input" value={le}
        onChange={e => setLe(e.target.value)}
        onBlur={() => { if (le !== endVal) onEndChange(le) }}
        placeholder="--:--" maxLength={5} />
    </div>
  )
}

// ── Row clear button ───────────────────────────────────────
function ClearBtn({ onClick }) {
  return (
    <button className="wb-clear-btn" onClick={onClick} title="この行をクリア">×</button>
  )
}

// selectedKeyの次の登校日（土日・グレー日を飛ばす）を求めるhook
function useNextSchoolDay(selectedKey) {
  const [overrides, setOverrides] = useState({})

  useEffect(() => {
    // 当月・翌月・翌々月のhighlightsを取得（月またぎ対応）
    const base = dateFromKey(selectedKey)
    const mkeys = []
    for (let i = 0; i <= 2; i++) {
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
    for (let delta = 1; delta <= 14; delta++) {
      const d = dateFromKey(selectedKey)
      d.setDate(d.getDate() + delta)
      const key = toDateKey(d)
      const dow = d.getDay()
      const isWeekend = dow === 0 || dow === 6
      const mk = monthKey(d.getFullYear(), d.getMonth() + 1)
      const override = (overrides[mk] || {})[key]
      const isGray = override === 'gray' ? true : override === 'none' ? false : isWeekend
      if (!isGray) return key
    }
    return navKey(selectedKey, 1)
  }, [selectedKey, overrides])
}

export default function WhiteboardView({ events, db = {} }) {
  const todayKey = toDateKey(new Date())
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const tomorrowKey = useNextSchoolDay(selectedKey)

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
  const debounceRef = useRef(null)
  const { setControls } = useHeaderControls()

  useEffect(() => {
    setData(emptyData())
    loadWhiteboard(selectedKey).then(saved => {
      if (saved) {
        const merged = { ...emptyData(), ...saved }
        // migrate legacy weekEvent → weekEventToday
        if (saved.weekEvent && !saved.weekEventToday) merged.weekEventToday = saved.weekEvent
        setData(merged)
      }
    })
  }, [selectedKey])

  const scheduleSave = useCallback((next) => {
    setData(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      await saveWhiteboard(selectedKey, next)
      setSaving(false)
    }, 800)
  }, [selectedKey])

  // Header controls
  useEffect(() => {
    setControls(
      <div className="hc-row">
        <button className="hc-btn-nav" onClick={() => setSelectedKey(k => navKey(k, -1))}>‹</button>
        <input type="date" value={selectedKey} onChange={e => setSelectedKey(e.target.value)} className="hc-date-input" />
        <button className="hc-btn-nav" onClick={() => setSelectedKey(k => navKey(k, 1))}>›</button>
        {selectedKey !== todayKey && (
          <button className="hc-btn" onClick={() => setSelectedKey(todayKey)}>今日に戻る</button>
        )}
        {saving && <span className="hc-saving">保存中…</span>}
        <button className="hc-btn" onClick={() => window.print()}>🖨️ 印刷</button>
      </div>
    )
    return () => setControls(null)
  }, [selectedKey, todayKey, saving])

  // Update helpers
  function updateRoom(i, field, val) {
    const rooms = data.rooms.map((r, idx) => {
      if (idx !== i) return r
      const updated = { ...r, [field]: val }
      if (field === 'month' || field === 'day')
        updated.dow = detectDow(field === 'month' ? val : r.month, field === 'day' ? val : r.day)
      return updated
    })
    scheduleSave({ ...data, rooms })
  }
  function clearRoom(i) {
    const rooms = data.rooms.map((r, idx) => idx === i ? emptyRoom() : r)
    scheduleSave({ ...data, rooms })
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

  return (
    <div className="wb-wrap">
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
                <col style={{width:'15.5%'}} />
                <col style={{width:'4.2%'}} />
                <col style={{width:'4.2%'}} />
                <col style={{width:'4.2%'}} />
                <col style={{width:'21.6%'}} />
                <col style={{width:'20.4%'}} />
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
                {data.rooms.map((r, i) => (
                  <tr key={i} className="wb-row">
                    <td className="wb-td">
                      <EditCell value={r.place} onChange={v => updateRoom(i, 'place', v)} listId="wb-rooms-list" />
                    </td>
                    <td className="wb-td wb-td-center">
                      <EditCell value={r.month} onChange={v => updateRoom(i, 'month', v)} align="center" />
                    </td>
                    <td className="wb-td wb-td-center">
                      <EditCell value={r.day} onChange={v => updateRoom(i, 'day', v)} align="center" />
                    </td>
                    <td className="wb-td wb-td-center">
                      <EditCell value={r.dow} onChange={v => updateRoom(i, 'dow', v)} align="center" />
                    </td>
                    <td className="wb-td">
                      <TimeRange
                        startVal={r.timeStart} endVal={r.timeEnd}
                        onStartChange={v => updateRoom(i, 'timeStart', v)}
                        onEndChange={v => updateRoom(i, 'timeEnd', v)}
                      />
                    </td>
                    <td className="wb-td">
                      <EditCell value={r.users} onChange={v => updateRoom(i, 'users', v)} listId="wb-names-list" />
                    </td>
                    <td className="wb-td">
                      <EditCell value={r.purpose} onChange={v => updateRoom(i, 'purpose', v)} />
                    </td>
                    <td className="wb-td wb-td-clear">
                      <ClearBtn onClick={() => clearRoom(i)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 出張 */}
          <div className="wb-section">
            <table className="wb-table">
              <colgroup>
                <col style={{width:'22px'}} />
                <col style={{width:'15.5%'}} />
                <col style={{width:'34.1%'}} />
                <col style={{width:'20.4%'}} />
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
                {data.trips.map((t, i) => (
                  <tr key={i} className="wb-row">
                    <td className="wb-td">
                      <EditCell value={t.name} onChange={v => updateTrip(i, 'name', v)} listId="wb-names-list" />
                    </td>
                    <td className="wb-td">
                      <EditCell value={t.destination} onChange={v => updateTrip(i, 'destination', v)} />
                    </td>
                    <td className="wb-td">
                      <EditCell value={t.purpose} onChange={v => updateTrip(i, 'purpose', v)} />
                    </td>
                    <td className="wb-td">
                      <TimeRange
                        startVal={t.timeStart} endVal={t.timeEnd}
                        onStartChange={v => updateTrip(i, 'timeStart', v)}
                        onEndChange={v => updateTrip(i, 'timeEnd', v)}
                      />
                    </td>
                    <td className="wb-td wb-td-clear">
                      <ClearBtn onClick={() => clearTrip(i)} />
                    </td>
                  </tr>
                ))}
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
                <col />
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
                      <EditCell value={data.leave[LEAVE_TYPES_RIGHT[i]]} onChange={v => updateLeave(LEAVE_TYPES_RIGHT[i], v)} />
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
              <span className="wb-panel-date">{formatShort(selectedDate)}</span>
              <span className="wb-duty-inline">
                <input
                  className="wb-team-input"
                  type="number" min="1" max="4"
                  value={data.teamToday || ''}
                  onChange={e => updateTeamToday(e.target.value)}
                  placeholder="□"
                />
                <span className="wb-duty-label">班　看護当番</span>
                <EditCell value={data.dutyToday} onChange={v => updateField('dutyToday', v)}
                  placeholder="" className="wb-duty-input" listId="wb-duty-today-list" />
              </span>
            </div>
            <div className="wb-week-event">
              <EditCell value={data.weekEventToday} onChange={v => updateField('weekEventToday', v)}
                placeholder="" className="wb-week-input" />
            </div>
            <div className="wb-schedule-list">
              {selEvents.length === 0
                ? <div className="wb-no-events">（行事なし）</div>
                : selEvents.map(ev => (
                  <div key={ev.id} className={`wb-event-item${ev.color === 'red' ? ' wb-event-red' : ''}`}>
                    {ev.start_time && <span className="wb-event-time">{ev.start_time}</span>}
                    <span className="wb-event-title">{ev.title}</span>
                    {ev.note && <span className="wb-event-note">{ev.note}</span>}
                  </div>
                ))
              }
            </div>
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
                <span className="wb-duty-label">班　看護当番</span>
                <EditCell value={data.dutyTomorrow} onChange={v => updateField('dutyTomorrow', v)}
                  placeholder="" className="wb-duty-input" listId="wb-duty-tomorrow-list" />
              </span>
            </div>
            <div className="wb-week-event">
              <EditCell value={data.weekEventTomorrow} onChange={v => updateField('weekEventTomorrow', v)}
                placeholder="" className="wb-week-input" />
            </div>
            <div className="wb-schedule-list">
              {nextEvents.length === 0
                ? <div className="wb-no-events">（行事なし）</div>
                : nextEvents.map(ev => (
                  <div key={ev.id} className={`wb-event-item${ev.color === 'red' ? ' wb-event-red' : ''}`}>
                    {ev.start_time && <span className="wb-event-time">{ev.start_time}</span>}
                    <span className="wb-event-title">{ev.title}</span>
                    {ev.note && <span className="wb-event-note">{ev.note}</span>}
                  </div>
                ))
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
