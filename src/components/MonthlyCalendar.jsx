import { useState, useMemo } from 'react'
import EventEditModal from './EventEditModal'
import { exportMonthlyExcel } from '../utils/exportExcel'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function toDateKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function MonthlyCalendar({ events, onAdd, onUpdate, onDelete, addToast }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(null)

  const eventMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      if (!m.has(ev.date)) m.set(ev.date, [])
      m.get(ev.date).push(ev)
    }
    return m
  }, [events])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const selectedEvents = selectedDate ? (eventMap.get(selectedDate) || []) : []

  function handlePrint() {
    window.print()
  }

  function handleExcel() {
    exportMonthlyExcel(year, month, events.filter(e => {
      const [y, m] = e.date.split('-').map(Number)
      return y === year && m === month
    }))
  }

  return (
    <div>
      <div className="calendar-header">
        <button className="btn-nav no-print" onClick={prevMonth}>‹</button>
        <div className="calendar-title">{year}年{month}月</div>
        <button className="btn-nav no-print" onClick={nextMonth}>›</button>
        <div className="no-print" style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={handleExcel}>📊 Excel出力</button>
          <button className="btn-secondary" onClick={handlePrint}>🖨️ 印刷・PDF</button>
        </div>
      </div>

      <div className="calendar-grid">
        {DAYS_JA.map((d, i) => (
          <div key={d} className={`calendar-day-header${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}`}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} className="calendar-cell empty" />
          const dateKey = toDateKey(year, month, day)
          const dayEvents = eventMap.get(dateKey) || []
          const dow = (firstDay + day - 1) % 7
          const cls = [
            'calendar-cell',
            dateKey === todayKey ? 'today' : '',
            dow === 0 ? 'sunday' : dow === 6 ? 'saturday' : '',
          ].filter(Boolean).join(' ')
          return (
            <div key={day} className={cls} onClick={() => setSelectedDate(dateKey)}>
              <div className="cell-date">{day}</div>
              {dayEvents.slice(0, 3).map(ev => (
                <div key={ev.id} className={`cell-event${ev.start_time ? ' has-time' : ''}`} title={ev.title}>
                  {ev.start_time ? `${ev.start_time} ` : ''}{ev.title}
                </div>
              ))}
              {dayEvents.length > 3 && <div className="cell-more">他{dayEvents.length - 3}件</div>}
            </div>
          )
        })}
      </div>

      {selectedDate && (
        <EventEditModal
          date={selectedDate}
          events={selectedEvents}
          onClose={() => setSelectedDate(null)}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
          addToast={addToast}
        />
      )}
    </div>
  )
}
