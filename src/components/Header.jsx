export default function Header({ view, setView, controls }) {
  const tabs = [
    { key: 'today', label: '📋 朝会記録簿' },
    { key: 'monthly', label: '📅 月中行事' },
    { key: 'annual', label: '📆 年間' },
    { key: 'jiji', label: '🏫 学校行事' },
    { key: 'whiteboard', label: '📌 ホワイトボード' },
  ]
  return (
    <header className="app-header">
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
      {controls && <div className="header-controls no-print">{controls}</div>}
    </header>
  )
}
