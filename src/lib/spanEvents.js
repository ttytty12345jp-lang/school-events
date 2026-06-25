import { supabase, USE_SUPABASE } from './supabase'

// 期間付きイベント（span_events）の共通ロジック。
// 月中行事・朝会記録簿・ホワイトボードで同じ読み書きをしていたため集約。
const SPAN_KEY = 'span_events' // school_notices の date / type 兼用キー

export async function loadSpanEvents() {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(SPAN_KEY) || '[]') } catch { return [] }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', SPAN_KEY).eq('type', SPAN_KEY).maybeSingle()
  if (!data?.content) return []
  try { return JSON.parse(data.content) } catch { return [] }
}

export async function saveSpanEvents(list) {
  const json = JSON.stringify(list)
  if (!USE_SUPABASE) { localStorage.setItem(SPAN_KEY, json); return }
  await supabase.from('school_notices')
    .upsert({ date: SPAN_KEY, type: SPAN_KEY, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}

// 指定日に有効な span を返す
export function getActiveSpans(spanEvents, dateKey) {
  return spanEvents.filter(s => s.startDate <= dateKey && dateKey <= s.endDate)
}
