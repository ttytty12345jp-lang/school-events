import { supabase, USE_SUPABASE } from './supabase'

const TEMPLATE_DATE = 'watch_template'
const TEMPLATE_TYPE = 'watch_template'
const LS_KEY = 'watch_template'

export async function loadWatchTemplate() {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', TEMPLATE_DATE).eq('type', TEMPLATE_TYPE).maybeSingle()
  return data?.content ? JSON.parse(data.content) : {}
}

export async function saveWatchTemplate(template) {
  const json = JSON.stringify(template)
  if (!USE_SUPABASE) { localStorage.setItem(LS_KEY, json); return }
  await supabase.from('school_notices')
    .upsert({ date: TEMPLATE_DATE, type: TEMPLATE_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}
