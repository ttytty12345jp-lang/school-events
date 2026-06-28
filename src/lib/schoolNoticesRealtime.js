import { supabase, USE_SUPABASE } from './supabase'

// 自端末の保存を Realtime で受信してしまうのを防ぐためのキーセット
// キー形式: "${date}__${type}"
const pendingKeys = new Set()

// コンポーネントが登録するリスナー: (row) => void
const listeners = new Set()

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

// 保存前に呼ぶ — 自分の変更を Realtime で再受信しない
export function markPending(date, type) {
  const key = `${date}__${type}`
  pendingKeys.add(key)
  setTimeout(() => pendingKeys.delete(key), 3000)
}

// コンポーネントから useEffect で呼ぶ。戻り値はクリーンアップ関数
export function subscribeSchoolNotices(fn) {
  listeners.add(fn)
  ensureChannel()
  return () => listeners.delete(fn)
}
