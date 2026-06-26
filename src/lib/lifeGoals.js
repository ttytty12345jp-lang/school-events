import { supabase, USE_SUPABASE } from './supabase'

// 月別の生活目標。school_notices に date='life_goals' / type='life_goals' で
// { "4": "...", "5": "...", ... } の JSON を1レコードで保存。
const KEY = 'life_goals'

export async function loadLifeGoals() {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', KEY).eq('type', KEY).maybeSingle()
  if (!data?.content) return {}
  try { return JSON.parse(data.content) } catch { return {} }
}

export async function saveLifeGoals(map) {
  const json = JSON.stringify(map)
  if (!USE_SUPABASE) { localStorage.setItem(KEY, json); return }
  await supabase.from('school_notices')
    .upsert({ date: KEY, type: KEY, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}
