// 端末間のキャッシュずれ対策。
// ビルド時に埋め込んだ __BUILD_ID__ と、サーバー上の最新 version.json を比較し、
// 異なれば（＝古いキャッシュを表示している）クエリ付きで再読み込みして最新版を強制取得する。

const CURRENT = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
const TRIES_KEY = 'vcheck_tries'
const MAX_TRIES = 2 // 念のためリロードループを防ぐ上限

let busy = false

async function fetchLatestId() {
  try {
    // no-store + クエリバスターで CDN/ブラウザ両方のキャッシュを確実に回避
    const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()
    return json?.id ?? null
  } catch {
    return null
  }
}

async function check() {
  if (busy) return
  busy = true
  try {
    const latest = await fetchLatestId()
    if (!latest) return
    if (latest === CURRENT) {
      // 最新版に追いついたのでカウンタをリセット
      sessionStorage.removeItem(TRIES_KEY)
      return
    }
    // 古いキャッシュを表示している → 最新版を強制取得
    const tries = Number(sessionStorage.getItem(TRIES_KEY) || 0)
    if (tries >= MAX_TRIES) return // ループ防止：これ以上は自動リロードしない
    sessionStorage.setItem(TRIES_KEY, String(tries + 1))
    const u = new URL(window.location.href)
    u.searchParams.set('v', latest) // クエリを変えて HTML のキャッシュキーを更新
    window.location.replace(u.toString())
  } finally {
    busy = false
  }
}

export function startVersionCheck() {
  // 開発時（dev）は version.json が無いので何も起きない
  check()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check()
  })
  window.addEventListener('focus', check)
}
