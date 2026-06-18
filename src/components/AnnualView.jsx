import { useState, useMemo } from 'react'
import { exportAnnualExcel } from '../utils/exportExcel'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function getFiscalYear(date) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export default function AnnualView({ events, onMonthClick }) {
  const today = new Date()
  const [fiscalYear, setFiscalYear] = useState(getFiscalYear(today))

  const eventsByMonth = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      const mk = ev.date.slice(0, 7)
      if (!m.has(mk)) m.set(mk, [])
      m.get(mk).push(ev)
    }
    return m
  }, [events])

  // 4月〜翌3月
  const months = []
  for (let i = 4; i <= 15; i++) {
    const y = i <= 12 ? fiscalYear : fiscalYear + 1
    const mo = i <= 12 ? i : i - 12
    months.push({ year: y, month: mo, key: monthKey(y, mo) })
  }

  return (
    <div>
      <div className="annual-header">
        <button className="btn-nav no-print" onClick={() => setFiscalYear(y => y - 1)}>‹</button>
        <div className="annual-title">{fiscalYear}年度（{fiscalYear}年4月〜{fiscalYear + 1}年3月）</div>
        <button className="btn-nav no-print" onClick={() => setFiscalYear(y => y + 1)}>›</button>
        <div className="no-print" style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => exportAnnualExcel(fiscalYear, events)}>
            📊 年間Excel出力
          </button>
          <button className="btn-secondary" onClick={() => window.print()}>
            🖨️ 印刷・PDF
          </button>
        </div>
      </div>

      <div className="annual-grid">
        {months.map(({ year, month, key }) => {
          const monthEvents = (eventsByMonth.get(key) || []).sort((a, b) => a.date > b.date ? 1 : -1)
          return (
            <div
              key={key}
              className="annual-month-card"
              onClick={() => onMonthClick && onMonthClick(year, month)}
            >
              <div className="annual-month-header">
                <span>{month}月</span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>{monthEvents.length}件</span>
              </div>
              <div className="annual-month-events">
                {monthEvents.length === 0
                  ? <div className="annual-no-events">行事なし</div>
                  : monthEvents.slice(0, 8).map(ev => {
                    const d = new Date(ev.date)
                    const dow = DAYS_JA[d.getDay()]
                    return (
                      <div key={ev.id} className="annual-event-row">
                        <span className="annual-event-date">{d.getDate()}日({dow})</span>
                        <span className="annual-event-title">{ev.title}</span>
                      </div>
                    )
                  })}
                {monthEvents.length > 8 && (
                  <div className="annual-no-events" style={{ marginTop: 4 }}>他{monthEvents.length - 8}件…</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
