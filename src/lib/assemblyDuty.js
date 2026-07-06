import { supabase, USE_SUPABASE } from './supabase'
import { subscribeSchoolNotices, markPending } from './schoolNoticesRealtime'

// 全校朝会の担当者を「手入力した週を起点に、それ以降だけ自動ローテーション」させるための保存。
// anchors: [{ week: '月曜のdateKey', name: '手入力された名前' }]
// 手入力の無い週（アンカーが一つも無い期間）はデフォルトで非表示。
const DATE = 'assembly_duty'
const TYPE = 'assembly_duty'
const LS_KEY = 'assembly_duty'

export async function loadAnchors() {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', DATE).eq('type', TYPE).maybeSingle()
  if (!data?.content) return []
  try { return JSON.parse(data.content) || [] } catch { return [] }
}

export async function saveAnchors(anchors) {
  const json = JSON.stringify(anchors)
  if (!USE_SUPABASE) { localStorage.setItem(LS_KEY, json); return }
  markPending(DATE, TYPE)
  await supabase.from('school_notices')
    .upsert({ date: DATE, type: TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}

// 指定の週（weekKey）のアンカーを追加・上書きする（同じ週の既存分は置き換え）
export async function setAnchorForWeek(weekKey, name) {
  const anchors = await loadAnchors()
  const next = anchors.filter(a => a.week !== weekKey)
  if (name) next.push({ week: weekKey, name })
  await saveAnchors(next)
  return next
}

export function subscribeAssemblyDuty(fn) {
  return subscribeSchoolNotices(row => {
    if (row.type !== TYPE || row.date !== DATE) return
    try { fn(JSON.parse(row.content) || []) } catch { fn([]) }
  })
}
