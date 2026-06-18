export default function Header({ view, setView }) {
  const tabs = [
    { key: 'today', label: '📌 今日・明日' },
    { key: 'monthly', label: '📅 月間' },
    { key: 'annual', label: '📆 年間' },
  ]
  return (
    <header className="app-header">
      <h1>行事予定表</h1>
      <nav className="header-tabs no-print">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`header-tab${view === t.key ? ' active' : ''}`}
            onClick={() => setView(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
