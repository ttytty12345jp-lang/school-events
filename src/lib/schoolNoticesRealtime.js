import { supabase, USE_SUPABASE } from './supabase'

// 自端末の保存を Realtime で受信してしまうのを防ぐためのキーセット
// キー形式: "${date}__${type}"
const pendingKeys = new Set()

// Realtime イベントリスナー: (row) => void
const listeners = new Set()

// 画面復帰時の再ロードリスナー: () => void
const reloadListeners = new Set()

let channel = null

function ensureChannel() {
  if (channel || !USE_SUPABASE) return
  channel = supabase
    .channel('school_notices_realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'school_notices' },
      ({ new: rec, old: oldRec }) => {
        const r = rec?.date ? rec : oldRec
        if (!r) return
        const key = `${r.date}__${r.type}`
        if (pendingKeys.has(key)) return
        listeners.forEach(fn => fn(r))
      }
    )
    .subscribe()
}

// スマホでバックグラウンドから復帰したとき、WebSocket が切れていた分を
// 全コンポーネントが再ロードして補う
function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  // チャンネルを再接続
  if (channel && USE_SUPABASE) {
    supabase.removeChannel(channel)
    channel = null
    ensureChannel()
  }
  // 各コンポーネントにデータ再ロードを要求
  reloadListeners.forEach(fn => fn())
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', handleVisibilityChange)
}

// 保存前に呼ぶ — 自分の変更を Realtime で再受信しない
export function markPending(date, type) {
  const key = `${date}__${type}`
  pendingKeys.add(key)
  setTimeout(() => pendingKeys.delete(key), 3000)
}

// Realtime イベントを購読。戻り値はクリーンアップ関数
export function subscribeSchoolNotices(fn) {
  listeners.add(fn)
  ensureChannel()
  return () => listeners.delete(fn)
}

// 画面復帰時の再ロード関数を登録。戻り値はクリーンアップ関数
export function onVisibilityReload(fn) {
  reloadListeners.add(fn)
  return () => reloadListeners.delete(fn)
}
