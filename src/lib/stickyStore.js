import { supabase, USE_SUPABASE } from './supabase'
import { subscribeSchoolNotices, markPending } from './schoolNoticesRealtime'

// 付箋（ストック）を全端末で共有する。
// school_notices に date=storageKey（例 "wb_sticky_2026-06-29"）, type='sticky' で
// 1キー1行として保存し、Realtime で他端末の変更を反映する。
const TYPE = 'sticky'

const cache = {}      // key -> items[]
const fetched = {}    // key -> true（リモート取得済み）
const subs = {}       // key -> Set<cb>
const timers = {}     // key -> debounce timer

function lsLoad(key) { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null } }
function lsSave(key, items) { localStorage.setItem(key, JSON.stringify(items)) }

// 同期的に現在値を返す（キャッシュ → localStorage）
export function getCached(key) {
  if (cache[key]) return cache[key]
  cache[key] = lsLoad(key) || []
  return cache[key]
}

export function subscribe(key, cb) {
  (subs[key] || (subs[key] = new Set())).add(cb)
  return () => subs[key] && subs[key].delete(cb)
}
function notify(key) { if (subs[key]) subs[key].forEach(cb => cb(cache[key])) }

async function fetchFromRemote(key) {
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', key).eq('type', TYPE).maybeSingle()
  if (!data || !data.content) return null
  try { return JSON.parse(data.content) } catch { return null }
}

// リモート優先で items を解決して返す（無ければ inheritKey から引き継ぐ）。
//   1. リモートにデータあり → それを採用（他端末の内容を反映）
//   2. リモート空 & ローカルにデータあり → ローカルをリモートへ push（初回同期）
//   3. リモート空 & ローカル空 & inheritKey にデータ → 引き継いでリモート保存
//   それ以外（全部空）→ null（呼び出し側はデフォルト表示のまま・保存しない）
export async function resolveRemote(key, localItems, inheritKey) {
  if (!USE_SUPABASE) return null
  const remote = await fetchFromRemote(key)
  fetched[key] = true
  if (remote && remote.length) { cache[key] = remote; lsSave(key, remote); return remote }
  if (localItems && localItems.length) { save(key, localItems); return null }
  if (inheritKey) {
    let inh = await fetchFromRemote(inheritKey)
    if (!(inh && inh.length)) inh = lsLoad(inheritKey)
    if (inh && inh.length) { cache[key] = inh; lsSave(key, inh); save(key, inh); return inh }
  }
  return null
}

export function save(key, items) {
  cache[key] = items
  fetched[key] = true
  lsSave(key, items)
  if (!USE_SUPABASE) return
  clearTimeout(timers[key])
  timers[key] = setTimeout(() => {
    markPending(key, TYPE)
    // supabase-js は .then()/await で初めてリクエストが飛ぶ（遅延実行）。
    // 投げっぱなしだと送信されないため、必ず .then() で実行＆エラーを拾う。
    supabase.from('school_notices')
      .upsert({ date: key, type: TYPE, content: JSON.stringify(items), updated_at: new Date().toISOString() },
              { onConflict: 'date,type' })
      .then(({ error }) => { if (error) console.warn('[sticky] save failed', error) })
  }, 600)
}

// Realtime 購読は一度だけ初期化
let inited = false
export function initStickyRealtime() {
  if (inited || !USE_SUPABASE) return
  inited = true
  subscribeSchoolNotices(async (row) => {
    if (row.type !== TYPE || !row.date) return
    const key = row.date
    // この端末が関心を持つキーのみ更新（購読中 or 取得済み）
    if (!subs[key] && !fetched[key]) return
    const items = await fetchFromRemote(key)
    if (items) { cache[key] = items; lsSave(key, items); notify(key) }
  })
}
