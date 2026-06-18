import { useState } from 'react'
import Header from './components/Header'
import MonthlyCalendar from './components/MonthlyCalendar'
import TodayTomorrowView from './components/TodayTomorrowView'
import AnnualView from './components/AnnualView'
import { ToastContainer, useToast } from './components/Toast'
import { useEvents } from './hooks/useEvents'

export default function App() {
  const [view, setView] = useState('today')
  const { toasts, addToast } = useToast()
  const { events, loading, addEvent, updateEvent, deleteEvent } = useEvents()

  function handleMonthClick(year, month) {
    setView('monthly')
    // MonthlyCalendar manages its own month state, so just switch view
    // (future: could pass year/month down)
  }

  return (
    <>
      <Header view={view} setView={setView} />
      <main className="main-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>読み込み中…</div>
        ) : view === 'today' ? (
          <TodayTomorrowView events={events} />
        ) : view === 'monthly' ? (
          <MonthlyCalendar
            events={events}
            onAdd={addEvent}
            onUpdate={updateEvent}
            onDelete={deleteEvent}
            addToast={addToast}
          />
        ) : (
          <AnnualView
            events={events}
            onMonthClick={handleMonthClick}
          />
        )}
      </main>
      <ToastContainer toasts={toasts} />
    </>
  )
}
