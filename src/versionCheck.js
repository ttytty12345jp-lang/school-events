// 端末間のキャッシュずれ対策。
// ビルド時に埋め込んだ __BUILD_ID__ と、サーバー上の最新 version.json を比較し、
// 異なれば（＝古いキャッシュを表示している）最新版を強制取得する。
//
// 確実性のための方針:
//  - 起動時だけでなく「定期（3分毎）」「タブ復帰（visibilitychange）」でも再チェック。
//    → エッジ/ブラウザのキャッシュ期限が切れたタイミングで自動的に追いつく。
//  - 自動リロードは「時間ベースの間隔ガード」で最大でも約2分に1回に制限（無限ループ防止）。
//    ハード回数上限で諦めないので、サーバーが新HTMLを配れば必ず復帰する。
//  - それでも追いつけない場合に備え、画面上部に「更新」バナーを常時出して手動更新も可能に。

const CURRENT = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
const LAST_RELOAD_KEY = 'vcheck_last_reload'
const RELOAD_GUARD_MS = 120_000 // 直近リロードから120秒はもう一度自動リロードしない
const CHECK_INTERVAL_MS = 180_000 // 3分毎に再チェック

let busy = false
let bannerShown = false

async function fetchLatestId() {
  try {
    const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json?.id ?? null
  } catch {
    return null
  }
}

function hardReloadToLatest(latest) {
  sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()))
  const u = new URL(window.location.href)
  u.searchParams.set('v', latest) // クエリを変えて HTML のキャッシュキーを更新
  window.location.replace(u.toString())
}

function showUpdateBanner(latest) {
  if (bannerShown || typeof document === 'undefined') return
  bannerShown = true
  const bar = document.createElement('div')
  bar.setAttribute('role', 'button')
  bar.textContent = '新しいバージョンがあります。タップして更新'
  Object.assign(bar.style, {
    position: 'fixed', top: '0', left: '0', right: '0', zIndex: '99999',
    background: '#2563eb', color: '#fff', textAlign: 'center',
    padding: '10px 12px', font: '600 14px system-ui, sans-serif',
    cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  })
  bar.addEventListener('click', () => hardReloadToLatest(latest))
  document.body.appendChild(bar)
}

async function check() {
  if (busy) return
  busy = true
  try {
    const latest = await fetchLatestId()
    if (!latest || latest === CURRENT) return // 最新に追いついている
    // 古いキャッシュを表示している
    const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) || 0)
    if (Date.now() - last > RELOAD_GUARD_MS) {
      // 間隔が空いていれば自動リロードで最新取得を試みる
      hardReloadToLatest(latest)
    } else {
      // 直近で自動リロード済み（まだ追いつけていない）→ 手動更新バナーを提示
      showUpdateBanner(latest)
    }
  } finally {
    busy = false
  }
}

export function startVersionCheck() {
  // 開発時（dev）は version.json が無いので何も起きない
  check()
  setInterval(check, CHECK_INTERVAL_MS)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  }
}
