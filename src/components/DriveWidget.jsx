import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const PREFIX = 'dw_'
function loadLinks(id) {
  try { return JSON.parse(localStorage.getItem(PREFIX + id) || '[]') } catch { return [] }
}
function saveLinks(id, links) { localStorage.setItem(PREFIX + id, JSON.stringify(links)) }

// ── DriveWidget ──────────────────────────────────────────────────────────────
// storeId: ウィジェット配置ごとの識別子（"wb_today" / "wb_tomorrow" / "ttv" など）
// リンクはグローバル保存なので日付が変わっても同じリンクが常に表示される
export default function DriveWidget({ storeId = 'default' }) {
  const [links, setLinks] = useState(() => loadLinks(storeId))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newUrl, setNewUrl] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const popupRef = useRef(null)

  useEffect(() => { saveLinks(storeId, links) }, [storeId, links])

  // 外クリックで閉じる
  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!popupRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) {
        setOpen(false); setEditing(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
    if (open) setEditing(false)
  }

  function add() {
    const raw = newUrl.trim()
    if (!raw) return
    const url = raw.startsWith('http') ? raw : 'https://' + raw
    setLinks(ls => [...ls, { id: crypto.randomUUID(), url, title: newTitle.trim() || 'Drive' }])
    setNewUrl(''); setNewTitle('')
  }

  function del(id) { setLinks(ls => ls.filter(l => l.id !== id)) }

  const popup = open && pos && createPortal(
    <div ref={popupRef} className="dw-popup" style={{ top: pos.top, right: pos.right }}>
      <div className="dw-popup-header">
        <span className="dw-popup-title">Drive ショートカット</span>
        <button className="dw-close" onClick={() => { setOpen(false); setEditing(false) }}>✕</button>
      </div>

      <div className="dw-links">
        {links.length === 0 && !editing && (
          <p className="dw-empty">リンクがありません</p>
        )}
        {links.map(l => (
          <div key={l.id} className="dw-link-row">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="dw-link-a" title={l.url}>
              <DriveIcon />
              <span className="dw-link-name">{l.title}</span>
            </a>
            {editing && (
              <button className="dw-del" onClick={() => del(l.id)} title="削除">✕</button>
            )}
          </div>
        ))}
      </div>

      {editing ? (
        <div className="dw-form">
          <input className="dw-input" placeholder="https://drive.google.com/..." value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }} />
          <input className="dw-input" placeholder="名前" value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }} />
          <div className="dw-form-row">
            <button className="dw-add-btn" onClick={add}>追加</button>
            <button className="dw-done-btn" onClick={() => setEditing(false)}>完了</button>
          </div>
        </div>
      ) : (
        <button className="dw-edit-btn" onClick={() => setEditing(true)}>＋ リンクを追加 / 編集</button>
      )}
    </div>,
    document.body
  )

  return (
    <>
      <button ref={btnRef} className={`dw-btn${open ? ' is-open' : ''}`}
        onClick={toggle} title="Drive ショートカット">
        <DriveIcon size={14} />
        {links.length > 0 && <span className="dw-badge">{links.length}</span>}
      </button>
      {popup}
    </>
  )
}

// Google Drive カラーの三角形アイコン（SVG）
function DriveIcon({ size = 16 }) {
  const h = size * 0.87
  return (
    <svg width={size} height={h} viewBox="0 0 24 21" fill="none" aria-hidden="true">
      <polygon points="9,0 0,15.75 4.5,21 13.5,21 9,13.5" fill="#4285F4" />
      <polygon points="9,0 18,0 24,10.5 19.5,21 13.5,21 9,13.5" fill="#34A853" />
      <polygon points="0,15.75 4.5,21 19.5,21 24,10.5" fill="#FBBC04" />
    </svg>
  )
}
