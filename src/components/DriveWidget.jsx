import { useState, useRef } from 'react'

const PREFIX = 'dw2_'
function loadLinks(id) {
  try { return JSON.parse(localStorage.getItem(PREFIX + 'links_' + id) || '[]') } catch { return [] }
}
function saveLinks(id, ls) { localStorage.setItem(PREFIX + 'links_' + id, JSON.stringify(ls)) }
function loadVisible(id) {
  const v = localStorage.getItem(PREFIX + 'vis_' + id)
  return v === null ? true : v === '1'
}
function saveVisible(id, v) { localStorage.setItem(PREFIX + 'vis_' + id, v ? '1' : '0') }

// ── DriveWidget ──────────────────────────────────────────────────────────────
// パネルの最下部 (右寄せ) に配置。
// storeId ごとにリンク一覧・表示状態を localStorage に保存 (日付不問でグローバル)
export default function DriveWidget({ storeId = 'default' }) {
  const [links, setLinks] = useState(() => loadLinks(storeId))
  const [visible, setVisible] = useState(() => loadVisible(storeId))

  function toggleVisible() {
    const next = !visible
    setVisible(next)
    saveVisible(storeId, next)
  }

  function addLink() {
    const url = window.prompt('Google Drive の URL を入力してください:')
    if (!url || !url.trim()) return
    const fullUrl = url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim()
    const title = window.prompt('名前を入力してください (省略可):') || 'Drive'
    const next = [...links, { id: crypto.randomUUID(), url: fullUrl, title: title.trim() || 'Drive' }]
    setLinks(next)
    saveLinks(storeId, next)
  }

  function deleteLink(id) {
    if (!window.confirm('このリンクを削除しますか？')) return
    const next = links.filter(l => l.id !== id)
    setLinks(next)
    saveLinks(storeId, next)
  }

  // 長押し削除 (モバイル向け)
  const pressRef = useRef(null)
  function onTouchStart(id) {
    pressRef.current = setTimeout(() => { pressRef.current = null; deleteLink(id) }, 700)
  }
  function onTouchEnd() {
    if (pressRef.current) { clearTimeout(pressRef.current); pressRef.current = null }
  }

  return (
    <div className="dw-bar">
      {/* 展開/折りたたみトグル */}
      <button className="dw-toggle" onClick={toggleVisible}
        title={visible ? 'Drive アイコンを非表示' : 'Drive アイコンを表示'}>
        <DriveIcon size={18} />
        <span className="dw-toggle-arrow">{visible ? '▾' : '◂'}</span>
      </button>

      {visible && (
        <div className="dw-icons">
          {links.map(l => (
            <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
              className="dw-icon-link" title={l.title}
              onContextMenu={e => { e.preventDefault(); deleteLink(l.id) }}
              onTouchStart={() => onTouchStart(l.id)}
              onTouchEnd={onTouchEnd}
              onTouchMove={onTouchEnd}>
              <DriveIcon size={30} />
              <span className="dw-icon-label">{l.title}</span>
            </a>
          ))}
          <button className="dw-add-icon" onClick={addLink} title="Drive リンクを追加">＋</button>
        </div>
      )}
    </div>
  )
}

// Google Drive カラーの三角形アイコン (SVG)
function DriveIcon({ size = 24 }) {
  return (
    <svg width={size} height={size * 0.87} viewBox="0 0 87 78" fill="none" aria-hidden="true">
      {/* 左下 青 */}
      <polygon points="0,78 29,78 43.5,52 14.5,0" fill="#4285F4" />
      {/* 右下 緑 */}
      <polygon points="29,78 87,78 72.5,52 43.5,52" fill="#34A853" />
      {/* 上 黄 */}
      <polygon points="14.5,0 43.5,52 72.5,52 43.5,0" fill="#FBBC04" />
    </svg>
  )
}
