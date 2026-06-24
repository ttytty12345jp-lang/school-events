import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { exportAnnualExcel } from '../utils/exportExcel'
import { useHeaderControls } from '../HeaderControlsContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const HIGHLIGHTS_TYPE = 'row_highlights'
const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function getFiscalYear(date) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

function toDateKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function monthKey(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`
}

export default function AnnualView({ events, onMonthClick }) {
  const today = new Date()
  const [fiscalYear, setFiscalYear] = useState(getFiscalYear(today))

  // 4月〜翌3月の12ヶ月
  const months = useMemo(() => {
    const arr = []
    for (let i = 4; i <= 15; i++) {
      const y = i <= 12 ? fiscalYear : fiscalYear + 1
      const mo = i <= 12 ? i : i - 12
      arr.push({ year: y, month: mo })
    }
    return arr
  }, [fiscalYear])

  // date → events[] のマップ
  const eventMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      if (!m.has(ev.date)) m.set(ev.date, [])
      m.get(ev.date).push(ev)
    }
    return m
  }, [events])

  // monthKey → { date: 'gray'|'none' } のオーバーライドマップ
  const [allOverrides, setAllOverrides] = useState({})
  const debounceRefs = useRef({})

  useEffect(() => {
    const mkeys = months.map(({ year, month }) => monthKey(year, month))
    if (!USE_SUPABASE) {
      const result = {}
      mkeys.forEach(mk => {
        try { result[mk] = JSON.parse(localStorage.getItem(`row_highlights_${mk}`) || '{}') } catch { result[mk] = {} }
      })
      setAllOverrides(result)
      return
    }
    supabase.from('school_notices').select('date, content')
      .in('date', mkeys).eq('type', HIGHLIGHTS_TYPE)
      .then(({ data }) => {
        const result = {}
        mkeys.forEach(mk => { result[mk] = {} })
        ;(data || []).forEach(row => {
          try { result[row.date] = JSON.parse(row.content) } catch {}
        })
        setAllOverrides(result)
      })
  }, [fiscalYear])

  function saveMonthHighlights(mk, overrides) {
    const json = JSON.stringify(overrides)
    if (!USE_SUPABASE) { localStorage.setItem(`row_highlights_${mk}`, json); return }
    if (debounceRefs.current[mk]) clearTimeout(debounceRefs.current[mk])
    debounceRefs.current[mk] = setTimeout(() => {
      supabase.from('school_notices')
        .upsert({ date: mk, type: HIGHLIGHTS_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
    }, 600)
  }

  function toggleCell(year, month, dateKey, isWeekend) {
    const mk = monthKey(year, month)
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

  function isCellGray(year, month, dateKey, isWeekend) {
    const override = (allOverrides[monthKey(year, month)] || {})[dateKey]
    if (override === 'gray') return true
    if (override === 'none') return false
    return isWeekend
  }

  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const { setControls } = useHeaderControls()
  const eventsRef = useRef(events)
  useEffect(() => { eventsRef.current = events }, [events])

  useEffect(() => {
    setControls(
      <div className="hc-row">
        <button className="hc-btn-nav" onClick={() => setFiscalYear(y => y - 1)}>‹</button>
        <span className="hc-label">{fiscalYear}年度</span>
        <button className="hc-btn-nav" onClick={() => setFiscalYear(y => y + 1)}>›</button>
        <button className="hc-btn" onClick={() => exportAnnualExcel(fiscalYear, eventsRef.current)}>📊 年間Excel出力</button>
        <button className="hc-btn" onClick={() => {
          const style = document.createElement('style')
          style.id = 'annual-print-override'
          style.textContent = '@page { size: A3 landscape; margin: 8mm; }'
          document.head.appendChild(style)
          window.print()
          document.getElementById('annual-print-override')?.remove()
        }}>🖨️ 印刷</button>
      </div>
    )
    return () => setControls(null)
  }, [fiscalYear])

  return (
    <div>
      <div className="annual-print-header">
        <span>2026年度　年間行事予定</span>
        <span>大阪市立北中島小学校</span>
      </div>
      <div className="annual-table-wrap">
        <table className="annual-table">
          <thead>
            <tr>
              <th className="annual-col-day">日</th>
              <th className="annual-col-dow">曜</th>
              {months.map(({ year, month }) => (
                <th key={`${year}-${month}`} className="annual-col-month">
                  {month}月
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 31 }, (_, i) => {
              const day = i + 1
              const hasAnyDate = months.some(({ year, month }) => {
                return day <= new Date(year, month, 0).getDate()
              })
              if (!hasAnyDate) return null

              return (
                <tr key={day} className="annual-row">
                  <td className="annual-col-day">{day}</td>
                  <td className="annual-col-dow annual-dows">&nbsp;</td>
                  {months.map(({ year, month }) => {
                    const daysInMonth = new Date(year, month, 0).getDate()
                    if (day > daysInMonth) {
                      return <td key={`${year}-${month}`} className="annual-cell annual-cell-empty" />
                    }
                    const dateKey = toDateKey(year, month, day)
                    const dow = new Date(dateKey).getDay()
                    const dayEvs = eventMap.get(dateKey) || []
                    const isToday = dateKey === todayKey
                    const isSun = dow === 0
                    const isSat = dow === 6
                    const isWeekend = isSun || isSat
                    const gray = isCellGray(year, month, dateKey, isWeekend)
                    return (
                      <td
                        key={`${year}-${month}`}
                        className={[
                          'annual-cell',
                          isToday ? 'annual-cell-today' : '',
                          gray ? 'annual-cell-gray' : '',
                          isSun ? 'annual-cell-sun' : isSat ? 'annual-cell-sat' : '',
                          dayEvs.length > 0 ? 'annual-cell-has-event' : '',
                        ].filter(Boolean).join(' ')}
                        title={dayEvs.map(e => e.title).join('、')}
                      >
                        <span
                          className="annual-dow-label annual-dow-toggle"
                          title="クリックで塗りつぶし切り替え"
                          onClick={e => { e.stopPropagation(); toggleCell(year, month, dateKey, isWeekend) }}
                        >{DAYS_JA[dow]}</span>
                        {dayEvs.map(ev => (
                          <span key={ev.id} className="annual-event-chip" style={{ color: ev.color === 'red' ? '#dc2626' : 'inherit' }}>{ev.title}</span>
                        ))}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
