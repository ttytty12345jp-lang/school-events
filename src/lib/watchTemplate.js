import { supabase, USE_SUPABASE } from './supabase'

const TEMPLATE_DATE = 'watch_template'
const TEMPLATE_TYPE = 'watch_template'
const LS_KEY = 'watch_template'

export const WATCH_RULE_DAYS = ['すべて', '月', '火', '水', '木', '金']

// 旧バージョンの木曜固定キー → 文字列ルールへの移行用
const LEGACY_SPECIAL = [
  { key: '木_クラブ活動', keyword: 'クラブ活動', day: '木' },
  { key: '木_委員会活動', keyword: '委員会活動', day: '木' },
]

function genId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'r' + Math.random().toString(36).slice(2)
}

// 旧データ（木_クラブ活動 等の固定キー）を rules 配列に移行する。
function migrate(t) {
  if (!t || typeof t !== 'object') return {}
  if (Array.isArray(t.rules)) return t
  const rules = []
  for (const s of LEGACY_SPECIAL) {
    const times = t[s.key]
    if (times && Object.values(times).some(v => v)) {
      rules.push({ id: genId(), keyword: s.keyword, day: s.day, times })
    }
  }
  return { ...t, rules }
}

export async function loadWatchTemplate() {
  if (!USE_SUPABASE) {
    try { return migrate(JSON.parse(localStorage.getItem(LS_KEY) || '{}')) } catch { return { rules: [] } }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', TEMPLATE_DATE).eq('type', TEMPLATE_TYPE).maybeSingle()
  return data?.content ? migrate(JSON.parse(data.content)) : { rules: [] }
}

export async function saveWatchTemplate(template) {
  const json = JSON.stringify(template)
  if (!USE_SUPABASE) { localStorage.setItem(LS_KEY, json); return }
  await supabase.from('school_notices')
    .upsert({ date: TEMPLATE_DATE, type: TEMPLATE_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}

// 学校行事テキスト・曜日に合致する文字列ルールを返す（なければ null）。
// ルールは上から順に評価し、最初に一致したものを採用する。
export function matchWatchRule(template, dayJa, schoolEventText) {
  const rules = (template && template.rules) || []
  if (!schoolEventText) return null
  for (const r of rules) {
    if (!r.keyword) continue
    if (r.day && r.day !== 'すべて' && r.day !== dayJa) continue
    if (schoolEventText.includes(r.keyword)) return r
  }
  return null
}

// その日・学年の下校時刻テンプレート値を返す。
// 文字列ルールが一致すればそのルールの時刻、なければ曜日テンプレートの時刻。
export function getWatchTemplateTime(template, dayJa, schoolEventText, grade) {
  const rule = matchWatchRule(template, dayJa, schoolEventText)
  if (rule) return rule.times?.[grade] || ''
  return (template && template[dayJa]?.[grade]) || ''
}

export function newWatchRule() {
  return { id: genId(), keyword: '', day: 'すべて', times: {} }
}
