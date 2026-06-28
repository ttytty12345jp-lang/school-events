import { supabase, USE_SUPABASE } from './supabase'
import { subscribeSchoolNotices, markPending, onVisibilityReload } from './schoolNoticesRealtime'

// DriveWidget の表示/非表示・URL を全端末で共有する。
// school_notices の 1 行（date=type='drive_widget'）に JSON でまとめて保存し、
// Realtime で他端末の変更を受信して反映する。
const DATE = 'drive_widget'
const TYPE = 'drive_widget'
const LS_KEY = 'dw_store'
const DEFAULT_URL = 'https://drive.google.com/drive/folders/1F4P52HsK3hJMAGxwxjZ3sLT3lMeVovfv'

let cache = { vis: {}, url: {} }
let loaded = false
const subscribers = new Set()

function notify() { subscribers.forEach(fn => fn()) }
function visField(storeId, dateKey) { return `${storeId}_${dateKey || 'global'}` }

function applyContent(content) {
  try {
    const parsed = JSON.parse(content)
    cache = { vis: parsed.vis || {}, url: parsed.url || {} }
    return true
  } catch { return false }
}

function loadLocal() {
  try { const p = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (p) cache = { vis: p.vis || {}, url: p.url || {} } }
  catch {}
}

async function reload() {
  if (!USE_SUPABASE) return
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', DATE).eq('type', TYPE).maybeSingle()
  if (data?.content && applyContent(data.content)) notify()
}

// 初回ロード（lazy）。Realtime 購読もここで開始する。
export function ensureLoaded() {
  if (loaded) return
  loaded = true
  if (!USE_SUPABASE) { loadLocal(); notify(); return }
  reload()
  subscribeSchoolNotices(row => { if (row.type === TYPE) reload() })
  onVisibilityReload(reload)
}

async function persist() {
  if (!USE_SUPABASE) { localStorage.setItem(LS_KEY, JSON.stringify(cache)); return }
  markPending(DATE, TYPE)
  await supabase.from('school_notices')
    .upsert({ date: DATE, type: TYPE, content: JSON.stringify(cache), updated_at: new Date().toISOString() },
            { onConflict: 'date,type' })
}

export function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn) }

export function getShown(storeId, dateKey) {
  return cache.vis[visField(storeId, dateKey)] === '1'
}
export function setShown(storeId, dateKey, val) {
  cache = { ...cache, vis: { ...cache.vis, [visField(storeId, dateKey)]: val ? '1' : '0' } }
  notify()
  persist()
}

export function getUrl(storeId) { return cache.url[storeId] || DEFAULT_URL }
export function setUrl(storeId, val) {
  cache = { ...cache, url: { ...cache.url, [storeId]: val } }
  notify()
  persist()
}
