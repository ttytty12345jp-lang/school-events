import { useState } from 'react'
import Header from './components/Header'
import MonthlyCalendar from './components/MonthlyCalendar'
import TodayTomorrowView from './components/TodayTomorrowView'
import AnnualView from './components/AnnualView'
import DatabaseView from './components/DatabaseView'
import WhiteboardView from './components/WhiteboardView'
import { ToastContainer, useToast } from './components/Toast'
import { useEvents } from './hooks/useEvents'
import { useDatabaseLists } from './hooks/useDatabaseLists'
import { HeaderControlsContext } from './HeaderControlsContext'
import StickyNotes from './components/StickyNotes'

export default function App() {
  const [view, setView] = useState('today')
  const [headerControls, setHeaderControls] = useState(null)
  const { toasts, addToast } = useToast()
  const { events, loading, addEvent, updateEvent, deleteEvent } = useEvents()
  const db = useDatabaseLists()

  return (
    <HeaderControlsContext.Provider value={{ setControls: setHeaderControls }}>
      <Header view={view} setView={setView} controls={headerControls} />
      <main className={`main-content${view === 'whiteboard' ? ' main-full-width' : ''}`}>
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
        ) : view === 'annual' ? (
          <AnnualView events={events} />
        ) : view === 'jiji' ? (
          <DatabaseView {...db} />
        ) : (
          <WhiteboardView events={events} db={db} />
        )}
      </main>
      <ToastContainer toasts={toasts} />
      {view === 'whiteboard' && <StickyNotes />}
    </HeaderControlsContext.Provider>
  )
}
