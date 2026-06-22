import { useMemo, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useNotice } from '../hooks/useNotice'
import MorningAgenda from './MorningAgenda'
import { loadJijiMaster, thirdsDisplay } from './SchoolJijiView'
import { useHeaderControls } from '../HeaderControlsContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
const HIGHLIGHTS_TYPE = 'row_highlights'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}（${DAYS_JA[d.getDay()]}）`
}

function formatDateLong(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`
}

// 左上：朝会アジェンダ（月中行事 + 自由追記が同一リスト）
function TodaySection({ date, events, dateKey }) {
  const { content: weekEvent, handleChange: setWeekEvent } = useNotice(dateKey, 'week_event')
  return (
    <div className="ttv-panel">
      <div className="ttv-header ttv-header-today">
        <span className="ttv-header-date-large">{formatDateLong(date)}</span>
      </div>
      <div className="ttv-week-event-row">
        <input
          className="ttv-week-event-input"
          value={weekEvent}
          onChange={e => setWeekEvent(e.target.value)}
          placeholder=""
        />
      </div>
      <MorningAgenda dateKey={dateKey} calendarEvents={events} />
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
      <div className="ttv-body ttv-textarea-body">
        <textarea
          className="notice-textarea"
          value={content}
          onChange={e => handleChange(e.target.value)}
          placeholder=""
        />
      </div>
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
      <div className="ttv-body ttv-textarea-body">
        <textarea
          className="notice-textarea"
          value={content}
          onChange={e => handleChange(e.target.value)}
          placeholder=""
        />
      </div>
    </div>
  )
}

function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
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
    debounceRefs.current[mk] = setTimeout(() => {
      supabase.from('school_notices')
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
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const rows = el.querySelectorAll('.upcoming-day')
    if (!rows.length) return
    const MAX = 14, MIN = 8
    // リセット
    rows.forEach(r => { r.style.fontSize = MAX + 'px' })
    let size = MAX
    while (size > MIN) {
      const overflow = [...rows].some(r => r.scrollHeight > r.clientHeight)
      if (!overflow) break
      size -= 1
      rows.forEach(r => { r.style.fontSize = size + 'px' })
    }
  }, [days])

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
function computeKyou(calendarEvents, jijiMaster, dateKey) {
  const result = emptyThirds()
  const calTitles = new Set(calendarEvents.map(e => e.title?.trim().toLowerCase()).filter(Boolean))
  for (const entry of jijiMaster) {
    if (!entry.title) continue
    const byDate = entry.date && entry.date === dateKey
    const byTitle = !entry.date && calTitles.has(entry.title.trim().toLowerCase())
    if (byDate || byTitle) {
      GRADES.forEach(g => {
        result[g] = (result[g] || 0) + (entry.grades?.[g] || 0)
      })
    }
  }
  return result
}

// 最大90日遡って最後に保存されたレコードの累計を返す
async function findLastCumulative(dateKey) {
  let key = prevDateKey(dateKey)
  for (let i = 0; i < 90; i++) {
    const rec = await loadHoursRecord(key)
    if (rec) {
      const cum = emptyThirds()
      GRADES.forEach(g => { cum[g] = (rec.kinou?.[g] || 0) + (rec.kyou?.[g] || 0) })
      return cum
    }
    key = prevDateKey(key)
  }
  return emptyThirds()
}

async function saveHoursRecord(date, kinou, kyou, setSaving) {
  const record = { kinou, kyou }
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
  const kinouRef = useRef(emptyThirds())

  useEffect(() => {
    Promise.all([loadHoursRecord(date), findLastCumulative(date), loadJijiMaster()])
      .then(([today, lastCum, master]) => {
        // 今日のレコードがあればその kinou を使い、なければ直近の累計を使う
        const resolvedKinou = today ? (today.kinou || emptyThirds()) : lastCum
        const resolvedKyou = computeKyou(calendarEvents, master, date)
        kinouRef.current = resolvedKinou
        setKinou(resolvedKinou)
        setKyou(resolvedKyou)
        saveHoursRecord(date, resolvedKinou, resolvedKyou, null)
      })
  }, [date, calendarEvents])

  function saveKinou(nextKinou) {
    kinouRef.current = nextKinou
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveHoursRecord(date, nextKinou, kyou, setSaving)
    }, 800)
  }

  function stepKinou(grade, delta) {
    setKinou(prev => {
      const next = { ...prev, [grade]: Math.max(0, (prev[grade] || 0) + delta) }
      saveKinou(next)
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
                <td key={g} className="hours-td-cell">
                  <div className="thirds-stepper">
                    <button className="thirds-btn" onClick={() => stepKinou(g, -1)} disabled={!kinou[g]}>−</button>
                    <span className="thirds-val">{thirdsDisplay(kinou[g] || 0)}</span>
                    <button className="thirds-btn" onClick={() => stepKinou(g, 1)}>＋</button>
                  </div>
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
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const { setControls } = useHeaderControls()

  const selectedDate = new Date(selectedKey + 'T00:00:00')
  const selectedEvents = useMemo(() => events.filter(e => e.date === selectedKey), [events, selectedKey])
  const isToday = selectedKey === todayKey

  useEffect(() => {
    setControls(
      <div className="hc-row">
        <button className="hc-btn-nav" onClick={() => {
          const d = new Date(selectedKey + 'T00:00:00'); d.setDate(d.getDate() - 1); setSelectedKey(toDateKey(d))
        }}>‹</button>
        <input type="date" value={selectedKey} onChange={e => setSelectedKey(e.target.value)} className="hc-date-input" />
        <button className="hc-btn-nav" onClick={() => {
          const d = new Date(selectedKey + 'T00:00:00'); d.setDate(d.getDate() + 1); setSelectedKey(toDateKey(d))
        }}>›</button>
        {!isToday && <button className="hc-btn" onClick={() => setSelectedKey(todayKey)}>今日に戻る</button>}
        <button className="hc-btn" onClick={() => window.print()}>🖨️ 印刷</button>
      </div>
    )
    return () => setControls(null)
  }, [selectedKey, isToday])

  return (
    <div className="ttv-wrap">
      <div className="ttv-layout">
        {/* 左2/3 */}
        <div className="ttv-left">
          <TodaySection date={selectedDate} events={selectedEvents} dateKey={selectedKey} />
          <NoticeSection date={selectedKey} />
        </div>
        {/* 右1/3 */}
        <div className="ttv-right">
          <DistributionSection date={selectedKey} />
          <SchoolHoursSection date={selectedKey} calendarEvents={selectedEvents} />
          <UpcomingSection todayDate={selectedDate} events={events} />
        </div>
      </div>
    </div>
  )
}
