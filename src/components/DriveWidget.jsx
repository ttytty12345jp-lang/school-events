import { useState, useRef } from 'react'

const PREFIX = 'dw3_'

function urlKey(panelId) { return PREFIX + 'url_' + panelId }
function visKey(panelId, dateKey) { return PREFIX + 'vis_' + panelId + '_' + (dateKey || 'global') }

const DEFAULT_URL = 'https://drive.google.com/drive/folders/1F4P52HsK3hJMAGxwxjZ3sLT3lMeVovfv'
function loadUrl(panelId) {
  try { return JSON.parse(localStorage.getItem(urlKey(panelId)) ?? 'null') ?? DEFAULT_URL }
  catch { return DEFAULT_URL }
}
function saveUrl(panelId, val) { localStorage.setItem(urlKey(panelId), JSON.stringify(val)) }

// 表示/非表示を決定（既定は非表示・日ごとに独立）:
//   その日付に「表示」を明示的に設定したときだけ表示。引き継ぎ・過去参照は一切しない。
// ホワイトボードは today/tomorrow が同じ panelId("wb") を共有し dateKey だけ違うので、
// 「明日」でONにした日が翌日「今日」になったとき自動的にONとして表示される。
function loadShown(panelId, dateKey) {
  return localStorage.getItem(visKey(panelId, dateKey)) === '1'
}
function saveShown(panelId, dateKey, val) {
  localStorage.setItem(visKey(panelId, dateKey), val ? '1' : '0')
}

// storeId: パネル識別子（ホワイトボードは today/tomorrow とも "wb" を共有）
// dateKey: 日付文字列（"2026-06-28"）— 表示/非表示はこの日付に紐づく
export default function DriveWidget({ storeId = 'default', dateKey = '' }) {
  const [shown, setShown] = useState(() => loadShown(storeId, dateKey))
  const [url, setUrl] = useState(() => loadUrl(storeId))

  function toggle() {
    const next = !shown
    setShown(next)
    saveShown(storeId, dateKey, next)
  }

  function changeUrl(e) {
    e.preventDefault()
    const next = window.prompt('Google Drive の URL:', url)
    if (next === null) return
    const full = next.trim().startsWith('http') ? next.trim() : 'https://' + next.trim()
    setUrl(full)
    saveUrl(storeId, full)
  }

  // 長押しで URL 変更（モバイル向け）
  const pressTimer = useRef(null)
  function onTouchStart(e) {
    pressTimer.current = setTimeout(() => { pressTimer.current = null; changeUrl(e) }, 700)
  }
  function onTouchEnd() {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  return (
    <div className="dw-widget">
      {shown ? (
        <>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="dw-drive-link"
            onContextMenu={changeUrl}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchMove={onTouchEnd}
            title="Google Drive（右クリック / 長押しで URL 変更）">
            <DriveIcon size={46} />
          </a>
          <button className="dw-vis-btn" onClick={toggle} title="非表示にする">✕</button>
        </>
      ) : (
        // 非表示のときも薄い Drive アイコンを残し、タップで表示できるようにする
        <button className="dw-show-btn" onClick={toggle} title="Google Drive を表示">
          <DriveIcon size={30} />
        </button>
      )}
    </div>
  )
}

// 公式 Google Drive アイコン SVG
function DriveIcon({ size = 46 }) {
  const h = size * (78 / 87.3)
  return (
    <svg width={size} height={h} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
      <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
    </svg>
  )
}
