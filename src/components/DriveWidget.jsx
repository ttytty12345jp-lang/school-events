import { useState, useRef } from 'react'

const PREFIX = 'dw3_'
function load(id, key, def) {
  try { return JSON.parse(localStorage.getItem(PREFIX + key + '_' + id) ?? 'null') ?? def } catch { return def }
}
function save(id, key, val) { localStorage.setItem(PREFIX + key + '_' + id, JSON.stringify(val)) }

export default function DriveWidget({ storeId = 'default' }) {
  const [shown, setShown] = useState(() => load(storeId, 'shown', true))
  const [url, setUrl] = useState(() => load(storeId, 'url', 'https://drive.google.com'))

  function toggle() {
    const next = !shown
    setShown(next)
    save(storeId, 'shown', next)
  }

  function setLink() {
    const next = window.prompt('Google Drive の URL:', url)
    if (next === null) return
    const full = next.trim().startsWith('http') ? next.trim() : 'https://' + next.trim()
    setUrl(full)
    save(storeId, 'url', full)
  }

  // 長押しで URL 変更 (モバイル向け)
  const tRef = useRef(null)
  function onTouchStart() { tRef.current = setTimeout(setLink, 700) }
  function onTouchEnd() { clearTimeout(tRef.current) }

  return (
    <div className="dw-widget">
      <button className="dw-vis-btn" onClick={toggle} title={shown ? '非表示' : '表示'}>
        {shown ? '▾' : '◂'}
      </button>
      {shown && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="dw-drive-link"
          onContextMenu={e => { e.preventDefault(); setLink() }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onTouchMove={onTouchEnd}
          title="Google Drive（右クリック / 長押しで URL 変更）">
          <DriveIcon size={44} />
        </a>
      )}
    </div>
  )
}

function DriveIcon({ size = 44 }) {
  return (
    <svg width={size} height={size * 0.87} viewBox="0 0 87 78" fill="none" aria-hidden="true">
      <polygon points="0,78 29,78 43.5,52 14.5,0" fill="#4285F4" />
      <polygon points="29,78 87,78 72.5,52 43.5,52" fill="#34A853" />
      <polygon points="14.5,0 43.5,52 72.5,52 43.5,0" fill="#FBBC04" />
    </svg>
  )
}
