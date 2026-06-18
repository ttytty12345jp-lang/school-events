import { useState, useMemo, useRef, useEffect } from 'react'
import { exportMonthlyExcel } from '../utils/exportExcel'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']
const CATEGORIES = ['学校行事', '教職員関係行事', 'その他']

function toDateKey(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

// ── セル内ポップオーバー ──────────────────────────────────
function CellPopover({ date, category, events, onAdd, onUpdate, onDelete, onClose, addToast }) {
  const ref = useRef(null)
  const [items, setItems] = useState(events.map(e => ({ ...e })))
  const [newTitle, setNewTitle] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  // 外クリックで閉じる
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  async function handleAdd() {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      await onAdd({ date, category, title: newTitle.trim(), start_time: newTime || null, end_time: null, note: newNote.trim() || null })
      setNewTitle('')
      setNewTime('')
      setNewNote('')
      addToast('追加しました', 'success')
    } catch { addToast('保存失敗', 'error') }
    setSaving(false)
  }

  async function handleUpdate(id, field, value) {
    try {
      await onUpdate(id, { [field]: value || null })
    } catch { addToast('更新失敗', 'error') }
  }

  async function handleDelete(id) {
    try {
      await onDelete(id)
      addToast('削除しました', 'info')
    } catch { addToast('削除失敗', 'error') }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="cell-popover" ref={ref}>
      <div className="cell-popover-header">
        <span>{date.slice(5).replace('-', '/')} {category}</span>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>

      {/* 既存行事の編集 */}
      {events.map(ev => (
        <ExistingEventRow key={ev.id} ev={ev} onUpdate={handleUpdate} onDelete={handleDelete} />
      ))}

      {/* 新規追加行 */}
      <div className="popover-new-row">
        <input
          type="text"
          placeholder="行事名を入力"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          className="popover-input-title"
        />
        <input
          type="time"
          value={newTime}
          onChange={e => setNewTime(e.target.value)}
          className="popover-input-time"
        />
        <input
          type="text"
          placeholder="備考"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          className="popover-input-note"
        />
        <button className="btn-primary popover-add-btn" onClick={handleAdd} disabled={saving || !newTitle.trim()}>
          追加
        </button>
      </div>
    </div>
  )
}

function ExistingEventRow({ ev, onUpdate, onDelete }) {
  const [title, setTitle] = useState(ev.title)
  const [time, setTime] = useState(ev.start_time || '')
  const [note, setNote] = useState(ev.note || '')

  function blur(field, value) {
    const current = field === 'title' ? ev.title : field === 'start_time' ? (ev.start_time || '') : (ev.note || '')
    if (value !== current) onUpdate(ev.id, field, value)
  }

  return (
    <div className="popover-existing-row">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={() => blur('title', title)}
        className="popover-input-title"
      />
      <input
        type="time"
        value={time}
        onChange={e => setTime(e.target.value)}
        onBlur={() => blur('start_time', time)}
        className="popover-input-time"
      />
      <input
        type="text"
        placeholder="備考"
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => blur('note', note)}
        className="popover-input-note"
      />
      <button className="btn-danger popover-del-btn" onClick={() => onDelete(ev.id)}>✕</button>
    </div>
  )
}

// ── メインカレンダー ──────────────────────────────────────
export default function MonthlyCalendar({ events, onAdd, onUpdate, onDelete, addToast }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [activeCell, setActiveCell] = useState(null) // { date, category }

  const eventMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      const key = `${ev.date}__${ev.category || '学校行事'}`
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(ev)
    }
    return m
  }, [events])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate())

  const activeCellEvents = activeCell
    ? (eventMap.get(`${activeCell.date}__${activeCell.category}`) || [])
    : []

  return (
    <div style={{ position: 'relative' }}>
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
              const isToday = dateKey === todayKey
              const isSun = dow === 0
              const isSat = dow === 6
              return (
                <tr key={day} className={[
                  'monthly-row',
                  isToday ? 'row-today' : '',
                  isSun ? 'row-sun' : isSat ? 'row-sat' : '',
                ].filter(Boolean).join(' ')}>
                  <td className="col-date">{month}/{day}</td>
                  <td className="col-day">{DAYS_JA[dow]}</td>
                  {CATEGORIES.map(cat => {
                    const cellKey = `${dateKey}__${cat}`
                    const cellEvents = eventMap.get(cellKey) || []
                    const isActive = activeCell?.date === dateKey && activeCell?.category === cat
                    return (
                      <td
                        key={cat}
                        className={`col-cat-cell${isActive ? ' cell-active' : ''}`}
                        style={{ position: 'relative' }}
                        onClick={() => setActiveCell({ date: dateKey, category: cat })}
                      >
                        {cellEvents.map(ev => (
                          <div key={ev.id} className="table-event-chip">
                            {ev.start_time && <span className="chip-time">{ev.start_time}</span>}
                            {ev.title}
                            {ev.note && <span className="chip-note">　{ev.note}</span>}
                          </div>
                        ))}
                        {isActive && (
                          <CellPopover
                            date={dateKey}
                            category={cat}
                            events={activeCellEvents}
                            onAdd={onAdd}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            onClose={() => setActiveCell(null)}
                            addToast={addToast}
                          />
                        )}
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
