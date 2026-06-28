import { supabase, USE_SUPABASE } from './supabase'

const TEMPLATE_DATE = 'watch_template'
const TEMPLATE_TYPE = 'watch_template'
const LS_KEY = 'watch_template'

// 木曜の特殊テンプレート：左の「学校行事」欄に下記キーワードが含まれる場合、
// 通常の木曜テンプレートの代わりに対応するテンプレートを使う。
export const WATCH_THU_SPECIAL = [
  { keyword: 'クラブ活動', key: '木_クラブ活動', label: '木曜（クラブ活動）' },
  { keyword: '委員会活動', key: '木_委員会活動', label: '木曜（委員会活動）' },
]

// 曜日（'月'〜'金'）と当日の学校行事テキストから、使用するテンプレートキーを返す。
// 木曜だけ、行事テキストにキーワードが含まれれば特殊キーを返す。
export function watchTemplateKey(dayJa, schoolEventText) {
  if (dayJa === '木' && schoolEventText) {
    for (const s of WATCH_THU_SPECIAL) {
      if (schoolEventText.includes(s.keyword)) return s.key
    }
  }
  return dayJa
}

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
