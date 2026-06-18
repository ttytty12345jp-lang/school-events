import { useState, useMemo } from 'react'
import EventEditModal from './EventEditModal'
import { exportMonthlyExcel } from '../utils/exportExcel'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const CATEGORIES = ['学校行事', '教職員関係行事', 'その他']

function toDateKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function MonthlyCalendar({ events, onAdd, onUpdate, onDelete, addToast }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(null)

  // date → category → events[]
  const eventMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      if (!m.has(ev.date)) m.set(ev.date, new Map())
      const catMap = m.get(ev.date)
      const cat = ev.category || '学校行事'
      if (!catMap.has(cat)) catMap.set(cat, [])
      catMap.get(cat).push(ev)
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

  const daysInMonth = new Date(year, month, 0).getDate()
  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const selectedEvents = selectedDate
    ? (events.filter(e => e.date === selectedDate))
    : []

  return (
    <div>
      <div className="calendar-header">
        <button className="btn-nav no-print" onClick={prevMonth}>‹</button>
        <div className="calendar-title">{year}年{month}月</div>
        <button className="btn-nav no-print" onClick={nextMonth}>›</button>
        <div className="no-print" style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => exportMonthlyExcel(year, month, events.filter(e => {
            const [y, m2] = e.date.split('-').map(Number)
            return y === year && m2 === month
          }))}>📊 Excel出力</button>
          <button className="btn-secondary" onClick={() => window.print()}>🖨️ 印刷・PDF</button>
        </div>
      </div>

      <div className="monthly-table-wrap">
        <table className="monthly-table">
          <thead>
            <tr>
              <th className="col-date">日付</th>
              <th className="col-day">曜日</th>
              {CATEGORIES.map(cat => (
                <th key={cat} className="col-cat">{cat}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateKey = toDateKey(year, month, day)
              const dow = new Date(dateKey).getDay()
              const catMap = eventMap.get(dateKey) || new Map()
              const isToday = dateKey === todayKey
              const isSun = dow === 0
              const isSat = dow === 6
              return (
                <tr
                  key={day}
                  className={`monthly-row${isToday ? ' row-today' : ''}${isSun ? ' row-sun' : isSat ? ' row-sat' : ''}`}
                  onClick={() => setSelectedDate(dateKey)}
                >
                  <td className="col-date">{month}/{day}</td>
                  <td className="col-day">{DAYS_JA[dow]}</td>
                  {CATEGORIES.map(cat => {
                    const catEvents = catMap.get(cat) || []
                    return (
                      <td key={cat} className="col-cat-cell">
                        {catEvents.map(ev => (
                          <div key={ev.id} className="table-event-chip">
                            {ev.start_time && <span className="chip-time">{ev.start_time}</span>}
                            {ev.title}
                            {ev.note && <span className="chip-note">　{ev.note}</span>}
                          </div>
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
