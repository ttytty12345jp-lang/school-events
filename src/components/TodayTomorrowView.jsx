import { useMemo } from 'react'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(d) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`
}

function DaySection({ label, date, events, className }) {
  const sorted = [...events].sort((a, b) => (a.start_time || '99:99') > (b.start_time || '99:99') ? 1 : -1)
  return (
    <div className="day-section">
      <div className={`day-section-header ${className}`}>
        <span>{label}</span>
        <span style={{ fontSize: '14px', fontWeight: 400 }}>{formatDate(date)}</span>
      </div>
      <div className="day-events-list">
        {sorted.length === 0
          ? <div className="no-events">行事なし</div>
          : sorted.map(ev => (
            <div key={ev.id} className="day-event-row">
              <div className="day-event-time">
                {ev.start_time
                  ? `${ev.start_time}${ev.end_time ? ` ～ ${ev.end_time}` : ''}`
                  : '終日'}
              </div>
              <div className="day-event-title">{ev.title}</div>
              {ev.note && <div className="day-event-note">{ev.note}</div>}
            </div>
          ))}
      </div>
    </div>
  )
}

export default function TodayTomorrowView({ events }) {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const todayKey = toDateKey(today)
  const tomorrowKey = toDateKey(tomorrow)

  const todayEvents = useMemo(() => events.filter(e => e.date === todayKey), [events, todayKey])
  const tomorrowEvents = useMemo(() => events.filter(e => e.date === tomorrowKey), [events, tomorrowKey])

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <button className="btn-secondary" onClick={() => window.print()}>🖨️ 印刷・PDF出力</button>
      </div>
      <div className="today-tomorrow">
        <DaySection label="今日" date={today} events={todayEvents} className="today" />
        <DaySection label="明日" date={tomorrow} events={tomorrowEvents} className="tomorrow" />
      </div>
    </div>
  )
}
