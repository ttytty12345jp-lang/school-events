import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { supabase, USE_SUPABASE } from '../lib/supabase'
import { useNotice } from '../hooks/useNotice'
import MorningAgenda from './MorningAgenda'
import NoteLines from './NoteLines'
import StickyNotes from './StickyNotes'
import DriveWidget from './DriveWidget'
import { loadLifeGoals } from '../lib/lifeGoals'
import { loadJijiMaster, thirdsDisplay } from './SchoolJijiView'
import { useHeaderControls } from '../HeaderControlsContext'
import { DAYS_JA, dateKey as toDateKey, monthKey } from '../utils/date'
import { loadSpanEvents, getActiveSpans } from '../lib/spanEvents'

const HIGHLIGHTS_TYPE = 'row_highlights'

function formatDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}（${DAYS_JA[d.getDay()]}）`
}

function formatDateLong(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`
}

// 左上：朝会アジェンダ（月中行事 + 自由追記が同一リスト）
function TodaySection({ date, events, dateKey, spanEvents = [] }) {
  const { content: weekEvent, handleChange: setWeekEvent } = useNotice(dateKey, 'week_event')
  const activeSpans = getActiveSpans(spanEvents, dateKey)
  return (
    <div className="ttv-panel">
      <div className="ttv-header ttv-header-today">
        <span className="ttv-header-date-large">{formatDateLong(date)}</span>
      </div>
      <div className="ttv-week-event-row">
        {activeSpans.map(s => (
          <span key={s.id} className="span-label-chip" style={{ background: s.color }}>{s.title}</span>
        ))}
        <input
          className="ttv-week-event-input"
          value={weekEvent}
          onChange={e => setWeekEvent(e.target.value)}
          placeholder=""
        />
      </div>
      <MorningAgenda dateKey={dateKey} calendarEvents={events} rich />
      <DriveWidget key={`dw-ttv-${dateKey}`} storeId="ttv" dateKey={dateKey} />
    </div>
  )
}

// 左下：諸連絡
function NoticeSection({ date }) {
  const { content, handleChange, saving } = useNotice(date, 'notice')
  return (
    <div className="ttv-panel">
      <div className="ttv-header ttv-header-notice">
        <span>諸連絡</span>
        {saving && <span className="ttv-saving">保存中…</span>}
      </div>
      <div className="ttv-body ttv-notelines-body">
        <NoteLines content={content} onChange={handleChange} />
      </div>
    </div>
  )
}

// 諸連絡の下：今月の生活目標（データベースの月別表から表示）
function LifeGoalSection({ date }) {
  const month = new Date(date + 'T00:00:00').getMonth() + 1
  const [goal, setGoal] = useState('')
  useEffect(() => { loadLifeGoals().then(g => setGoal(g?.[month] || '')) }, [month])
  return (
    <div className="ttv-panel ttv-goal-panel">
      <div className="ttv-header ttv-header-goal"><span>{month}月の生活目標</span></div>
      <div className="ttv-body ttv-goal-body">{goal}</div>
    </div>
  )
}

// 右上：配付物
function DistributionSection({ date }) {
  const { content, handleChange, saving } = useNotice(date, 'distribution')
  return (
    <div className="ttv-panel">
      <div className="ttv-header ttv-header-dist">
        <span>配付物</span>
        {saving && <span className="ttv-saving">保存中…</span>}
      </div>
      <div className="ttv-body ttv-notelines-body">
        <NoteLines content={content} onChange={handleChange} />
      </div>
    </div>
  )
}


// 右下：明日以降5日分
function UpcomingSection({ todayDate, events }) {

  const days = useMemo(() => {
    const arr = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date(todayDate)
      d.setDate(d.getDate() + i)
      const key = toDateKey(d)
      const dayEvs = events.filter(e => e.date === key)
        .sort((a, b) => (a.start_time || '99:99') > (b.start_time || '99:99') ? 1 : -1)
      arr.push({ date: d, key, events: dayEvs, dow: d.getDay() })
    }
    return arr
  }, [todayDate, events])

  // 対象月キーの一覧（重複除去）
  const monthKeys = useMemo(() => {
    const s = new Set(days.map(({ date }) => monthKey(date.getFullYear(), date.getMonth() + 1)))
    return [...s]
  }, [days])

  const [allOverrides, setAllOverrides] = useState({})
  const debounceRefs = useRef({})

  useEffect(() => {
    if (!USE_SUPABASE) {
      const result = {}
      monthKeys.forEach(mk => {
        try { result[mk] = JSON.parse(localStorage.getItem(`row_highlights_${mk}`) || '{}') } catch { result[mk] = {} }
      })
      setAllOverrides(result)
      return
    }
    if (monthKeys.length === 0) return
    supabase.from('school_notices').select('date, content')
      .in('date', monthKeys).eq('type', HIGHLIGHTS_TYPE)
      .then(({ data }) => {
        const result = {}
        monthKeys.forEach(mk => { result[mk] = {} })
        ;(data || []).forEach(row => {
          try { result[row.date] = JSON.parse(row.content) } catch {}
        })
        setAllOverrides(result)
      })
  }, [monthKeys.join(',')])

  function saveMonthHighlights(mk, overrides) {
    const json = JSON.stringify(overrides)
    if (!USE_SUPABASE) { localStorage.setItem(`row_highlights_${mk}`, json); return }
    if (debounceRefs.current[mk]) clearTimeout(debounceRefs.current[mk])
    debounceRefs.current[mk] = setTimeout(async () => {
      await supabase.from('school_notices')
        .upsert({ date: mk, type: HIGHLIGHTS_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
    }, 600)
  }

  function toggleDay(date, dateKey, isWeekend) {
    const mk = monthKey(date.getFullYear(), date.getMonth() + 1)
    setAllOverrides(prev => {
      const monthOverrides = { ...(prev[mk] || {}) }
      const cur = monthOverrides[dateKey]
      if (cur === undefined) {
        monthOverrides[dateKey] = isWeekend ? 'none' : 'gray'
      } else if (cur === 'gray') {
        monthOverrides[dateKey] = 'none'
      } else {
        delete monthOverrides[dateKey]
      }
      saveMonthHighlights(mk, monthOverrides)
      return { ...prev, [mk]: monthOverrides }
    })
  }

  function isDayGray(date, dateKey, isWeekend) {
    const mk = monthKey(date.getFullYear(), date.getMonth() + 1)
    const override = (allOverrides[mk] || {})[dateKey]
    if (override === 'gray') return true
    if (override === 'none') return false
    return isWeekend
  }

  const bodyRef = useRef(null)
  // 全体を統一サイズで、枠に収まる最大まで実測拡大（行ごとのばらつきをなくす）。
  // パネル高さが確定してから測れるよう ResizeObserver でも再調整する。
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    function fit() {
      const rows = Array.from(el.querySelectorAll('.upcoming-day'))
      if (!rows.length) return
      let size = 30
      el.style.fontSize = size + 'px'
      const overflows = () => rows.some(r => r.scrollHeight > r.clientHeight + 1)
      while (overflows() && size > 9) {
        size -= 1
        el.style.fontSize = size + 'px'
      }
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    window.addEventListener('resize', fit)
    if (document.fonts?.ready) document.fonts.ready.then(fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [days, allOverrides])

  return (
    <div className="ttv-panel">
      <div className="ttv-header ttv-header-upcoming">
        <span>明日以降の予定</span>
      </div>
      <div className="ttv-body ttv-upcoming-body" ref={bodyRef}>
        {days.map(({ date, key, events: dayEvs, dow }) => {
          const isWeekend = dow === 0 || dow === 6
          const gray = isDayGray(date, key, isWeekend)
          const isSun = dow === 0
          const isSat = dow === 6
          return (
            <div key={key} className={['upcoming-day', gray ? 'upcoming-day-gray' : ''].filter(Boolean).join(' ')}>
              <div
                className={['upcoming-day-label', isSun ? 'upcoming-sun' : isSat ? 'upcoming-sat' : ''].filter(Boolean).join(' ')}
                title="クリックで塗りつぶし切り替え"
                onClick={() => toggleDay(date, key, isWeekend)}
                style={{ cursor: 'pointer' }}
              >{formatDate(date)}</div>
              <div className="upcoming-day-events">
                {dayEvs.map(ev => (
                    <span key={ev.id} className="upcoming-chip" style={{ color: ev.color === 'red' ? '#dc2626' : 'inherit' }}>
                      {ev.start_time && <span className="upcoming-time">{ev.start_time}</span>}
                      {ev.title}
                    </span>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const GRADES = ['1年', '2年', '3年', '4年', '5年', '6年']
function emptyThirds() { return Object.fromEntries(GRADES.map(g => [g, 0])) }

async function loadHoursRecord(dateKey) {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(`school_hours_${dateKey}`) || 'null') } catch { return null }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', dateKey).eq('type', 'school_hours').maybeSingle()
  if (!data?.content) return null
  try { return JSON.parse(data.content) } catch { return null }
}

function prevDateKey(dateKey) {
  const d = new Date(dateKey + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return toDateKey(d)
}

// 学校行事マスターと照合し、学年ごとの時数合計（整数thirds）を返す
// ・日付あり → その日付が一致するエントリを計上
// ・日付なし → カレンダー行事のタイトルと一致するエントリを計上（空白・大小無視）
function computeKyou(calendarEvents, agendaItems, jijiMaster, dateKey) {
  const result = emptyThirds()
  const allTitles = [
    ...calendarEvents.map(e => e.title?.trim().toLowerCase()),
    ...agendaItems.map(e => e.title?.trim().toLowerCase()),
  ].filter(Boolean)
  for (const entry of jijiMaster) {
    if (!entry.title) continue
    const entryTitle = entry.title.trim().toLowerCase()
    const byDate = entry.date && entry.date === dateKey
    const byTitle = !entry.date && allTitles.some(t => t.includes(entryTitle) || entryTitle.includes(t))
    if (byDate || byTitle) {
      GRADES.forEach(g => {
        result[g] = (result[g] || 0) + (entry.grades?.[g] || 0)
      })
    }
  }
  return result
}

async function loadAgendaItems(dateKey) {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(`agenda_${dateKey}`) || 'null') || [] } catch { return [] }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', dateKey).eq('type', 'morning_agenda').maybeSingle()
  if (!data?.content) return []
  try { return JSON.parse(data.content) } catch { return [] }
}

// jiji_master 変更時: 全期間の school_hours を再計算して累計チェーンを再構築
async function recalculateAllSchoolHours() {
  if (!USE_SUPABASE) return
  const [jijiMaster, agendaRes, calRes, hoursRes] = await Promise.all([
    loadJijiMaster(),
    supabase.from('school_notices').select('date, content').eq('type', 'morning_agenda'),
    supabase.from('school_events').select('date, title, start_time, end_time'),
    supabase.from('school_notices').select('date, content').eq('type', 'school_hours').order('date'),
  ])

  const agendaByDate = {}
  for (const row of agendaRes.data || []) {
    try { agendaByDate[row.date] = JSON.parse(row.content) } catch {}
  }
  const calByDate = {}
  for (const ev of calRes.data || []) {
    if (!calByDate[ev.date]) calByDate[ev.date] = []
    calByDate[ev.date].push(ev)
  }
  const hoursMap = {}
  for (const row of hoursRes.data || []) {
    try { hoursMap[row.date] = JSON.parse(row.content) } catch {}
  }

  const sortedDates = Object.keys(hoursMap).sort()
  let cumulative = emptyThirds()
  const upserts = []

  for (const date of sortedDates) {
    const agendaItems = agendaByDate[date] || []
    const calEvents = calByDate[date] || []
    const kyou = computeKyou(calEvents, agendaItems, jijiMaster, date)
    const existing = hoursMap[date]
    const kinou = existing?.kinouManual ? (existing.kinou || cumulative) : cumulative
    upserts.push({ date, record: { kinou, kyou, ...(existing?.kinouManual ? { kinouManual: true } : {}) } })
    const newCum = emptyThirds()
    GRADES.forEach(g => { newCum[g] = (kinou[g] || 0) + (kyou[g] || 0) })
    cumulative = newCum
  }

  for (const { date, record } of upserts) {
    await supabase.from('school_notices')
      .upsert({ date, type: 'school_hours', content: JSON.stringify(record), updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
  }
}

// 直近180日の school_hours レコードを一括取得し、dateKey より前で最新の累計を返す
async function findLastCumulative(dateKey) {
  const d = new Date(dateKey + 'T00:00:00')
  d.setDate(d.getDate() - 180)
  const since = toDateKey(d)

  let rows = []
  if (!USE_SUPABASE) {
    // localStorage: 全キーを走査
    for (let i = 1; i <= 180; i++) {
      const k = prevDateKey(dateKey)
      try {
        const r = JSON.parse(localStorage.getItem(`school_hours_${k}`) || 'null')
        if (r) { rows.push({ date: k, ...r }); break }
      } catch {}
    }
  } else {
    const { data } = await supabase.from('school_notices')
      .select('date, content')
      .eq('type', 'school_hours')
      .gte('date', since)
      .lt('date', dateKey)
      .order('date', { ascending: false })
      .limit(1)
    rows = data || []
  }

  if (!rows.length) return emptyThirds()
  try {
    const rec = JSON.parse(rows[0].content)
    const cum = emptyThirds()
    GRADES.forEach(g => { cum[g] = (rec.kinou?.[g] || 0) + (rec.kyou?.[g] || 0) })
    return cum
  } catch { return emptyThirds() }
}

async function saveHoursRecord(date, kinou, kyou, manual, setSaving) {
  const record = { kinou, kyou, ...(manual ? { kinouManual: true } : {}) }
  const json = JSON.stringify(record)
  if (!USE_SUPABASE) { localStorage.setItem(`school_hours_${date}`, json); return }
  if (setSaving) setSaving(true)
  await supabase.from('school_notices')
    .upsert({ date, type: 'school_hours', content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
  if (setSaving) setSaving(false)
}

function SchoolHoursSection({ date, calendarEvents }) {
  const [kinou, setKinou] = useState(emptyThirds())
  const [kyou, setKyou] = useState(emptyThirds())
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)
  const kyouRef = useRef(emptyThirds())

  useEffect(() => {
    Promise.all([loadHoursRecord(date), findLastCumulative(date), loadJijiMaster(), loadAgendaItems(date)])
      .then(([today, lastCum, master, agendaItems]) => {
        const resolvedKinou = today?.kinouManual ? (today.kinou || lastCum) : lastCum
        const resolvedKyou = computeKyou(calendarEvents, agendaItems, master, date)
        kyouRef.current = resolvedKyou
        setKinou(resolvedKinou)
        setKyou(resolvedKyou)
        saveHoursRecord(date, resolvedKinou, resolvedKyou, false, null)
      })
  }, [date, calendarEvents])

  // morning_agenda の変更をリアルタイムで検知して当日分を再計算
  useEffect(() => {
    if (!USE_SUPABASE) return
    const channel = supabase.channel(`school_hours_agenda_${date}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'school_notices',
        filter: `date=eq.${date}`,
      }, payload => {
        const rec = payload.new || payload.old
        if (rec?.type !== 'morning_agenda') return
        Promise.all([loadJijiMaster(), loadAgendaItems(date)]).then(([master, agendaItems]) => {
          const resolvedKyou = computeKyou(calendarEvents, agendaItems, master, date)
          kyouRef.current = resolvedKyou
          setKyou(resolvedKyou)
          setKinou(prev => {
            saveHoursRecord(date, prev, resolvedKyou, false, null)
            return prev
          })
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [date, calendarEvents])

  // 全期間再計算後に school_hours が外部更新されたら表示をリロード
  useEffect(() => {
    if (!USE_SUPABASE) return
    const channel = supabase.channel(`school_hours_ext_${date}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'school_notices',
        filter: `date=eq.${date}`,
      }, payload => {
        if (payload.new?.type !== 'school_hours') return
        try {
          const rec = JSON.parse(payload.new.content)
          if (rec.kinou) setKinou(rec.kinou)
          if (rec.kyou) { setKyou(rec.kyou); kyouRef.current = rec.kyou }
        } catch {}
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [date])

  function stepKinou(grade, delta) {
    setKinou(prev => {
      const next = { ...prev, [grade]: Math.max(0, (prev[grade] || 0) + delta) }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        saveHoursRecord(date, next, kyouRef.current, true, setSaving)
      }, 800)
      return next
    })
  }

  return (
    <div className="ttv-panel">
      <div className="ttv-header ttv-header-hours">
        <span>学校行事時数</span>
        {saving && <span className="ttv-saving">保存中…</span>}
      </div>
      <div className="ttv-body hours-body">
        <table className="hours-table">
          <thead>
            <tr>
              <th className="hours-th-label"></th>
              {GRADES.map(g => <th key={g} className="hours-th-grade">{g}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="hours-td-label">昨日まで</td>
              {GRADES.map(g => (
                <td key={g} className="hours-td-cell hours-td-total">
                  {thirdsDisplay(kinou[g] || 0)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="hours-td-label">今日</td>
              {GRADES.map(g => (
                <td key={g} className="hours-td-cell hours-td-total">
                  {kyou[g] ? thirdsDisplay(kyou[g]) : '—'}
                </td>
              ))}
            </tr>
            <tr className="hours-tr-total">
              <td className="hours-td-label">累計</td>
              {GRADES.map(g => (
                <td key={g} className="hours-td-cell hours-td-total">
                  {thirdsDisplay((kinou[g] || 0) + (kyou[g] || 0))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function TodayTomorrowView({ events }) {
  const today = new Date()
  const todayKey = toDateKey(today)
  const [selectedKey, setSelectedKey] = useState(() => sessionStorage.getItem('ttv_date') || todayKey)
  // 直前に表示していた日付。付箋を新しい日付へ引き継ぐ（日付移動に追従）ために保持
  const [prevSelectedKey, setPrevSelectedKey] = useState(null)
  function changeDate(k) { sessionStorage.setItem('ttv_date', k); setPrevSelectedKey(selectedKey); setSelectedKey(k) }
  const { setControls } = useHeaderControls()
  const [spanEvents, setSpanEvents] = useState([])
  useEffect(() => { loadSpanEvents().then(setSpanEvents) }, [])

  // 朝会記録簿の印刷はデフォルトでA4縦
  useEffect(() => {
    if (!document.getElementById('ttv-print-override')) {
      const s = document.createElement('style')
      s.id = 'ttv-print-override'
      s.textContent = '@page { size: A4 portrait; margin: 8mm; }'
      document.head.appendChild(s)
    }
    return () => { document.getElementById('ttv-print-override')?.remove() }
  }, [])

  // jiji_master が変更されたら全期間の school_hours を再計算
  useEffect(() => {
    if (!USE_SUPABASE) return
    const channel = supabase.channel('jiji_master_watch')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'school_notices',
        filter: 'date=eq.master',
      }, payload => {
        if ((payload.new || payload.old)?.type !== 'jiji_master') return
        recalculateAllSchoolHours()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const selectedDate = new Date(selectedKey + 'T00:00:00')
  const selectedEvents = useMemo(() => events.filter(e => e.date === selectedKey), [events, selectedKey])
  const isToday = selectedKey === todayKey

  useEffect(() => {
    setControls(
      <div className="hc-row">
        <button className="hc-btn-nav" onClick={() => {
          const d = new Date(selectedKey + 'T00:00:00'); d.setDate(d.getDate() - 1); changeDate(toDateKey(d))
        }}>‹</button>
        <input type="date" value={selectedKey} onChange={e => changeDate(e.target.value)} className="hc-date-input" />
        <button className="hc-btn-nav" onClick={() => {
          const d = new Date(selectedKey + 'T00:00:00'); d.setDate(d.getDate() + 1); changeDate(toDateKey(d))
        }}>›</button>
        {!isToday && <button className="hc-btn" onClick={() => changeDate(todayKey)}>今日に戻る</button>}
        <button className="hc-btn" onClick={() => {
          const wrap = document.querySelector('.ttv-wrap')
          const clone = wrap.cloneNode(true)
          clone.classList.add('ttv-print-clone')
          wrap.parentNode.insertBefore(clone, wrap.nextSibling)
          window.print()
          clone.remove()
        }}>🖨️ 印刷</button>
      </div>
    )
    return () => setControls(null)
  }, [selectedKey, isToday])

  // 固定サイズページの「高さ」を画面に合わせて拡大縮小（縦スクロールなし・幅は結果に任せる）
  const wrapRef = useRef(null)
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    function rescale() {
      // zoomを一旦1に戻して実際の開始位置を測り、ウィンドウ高に収まる倍率を計算
      el.style.zoom = '1'
      const top = el.getBoundingClientRect().top
      const avail = window.innerHeight - top - 6
      if (avail > 0) el.style.zoom = String(avail / 760)
    }
    rescale()
    window.addEventListener('resize', rescale)
    // Webフォント読み込み完了で文字幅が変わるため再調整
    if (document.fonts?.ready) document.fonts.ready.then(rescale)
    return () => window.removeEventListener('resize', rescale)
  }, [])

  return (
    <>
      <div className="ttv-wrap" ref={wrapRef}>
        <div className="ttv-layout">
          {/* 左2/3 */}
          <div className="ttv-left">
            <TodaySection date={selectedDate} events={selectedEvents} dateKey={selectedKey} spanEvents={spanEvents} />
            <NoticeSection date={selectedKey} />
            <LifeGoalSection date={selectedKey} />
          </div>
          {/* 右1/3 */}
          <div className="ttv-right">
            <DistributionSection date={selectedKey} />
            <SchoolHoursSection date={selectedKey} calendarEvents={selectedEvents} />
            <UpcomingSection todayDate={selectedDate} events={events} />
          </div>
        </div>
      </div>
      <StickyNotes storageKey={`ttv_sticky_${selectedKey}`}
        inheritFrom={prevSelectedKey ? `ttv_sticky_${prevSelectedKey}` : null} />
    </>
  )
}
