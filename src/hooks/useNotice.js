import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, USE_SUPABASE } from '../lib/supabase'
import { subscribeSchoolNotices, markPending, onVisibilityReload } from '../lib/schoolNoticesRealtime'

const LS_KEY = 'school_notices'

function lsGet(date, type) {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}')[`${date}__${type}`] || '' } catch { return '' }
}
function lsSet(date, type, content) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
    all[`${date}__${type}`] = content
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  } catch {}
}

// 明示的な date/type/value で保存（クロージャに依存しない）
async function persist(date, type, value, setSaving) {
  if (!USE_SUPABASE) { lsSet(date, type, value); return }
  setSaving?.(true)
  markPending(date, type) // 自分の保存が Realtime で戻ってくるのを無視するため
  await supabase.from('school_notices')
    .upsert({ date, type, content: value, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
  setSaving?.(false)
}

export function useNotice(date, type = 'notice') {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)
  const pendingRef = useRef(null) // 未保存の最新値 { date, type, value }
  const reqRef = useRef(0)        // 最新の読み込みリクエスト番号（古い応答を無視）

  // 未保存分を即時保存（日付移動・アンマウント時に呼ぶ）
  const flush = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
    const p = pendingRef.current
    if (p) { pendingRef.current = null; persist(p.date, p.type, p.value, setSaving) }
  }, [])

  useEffect(() => {
    if (!date) return
    const myReq = ++reqRef.current
    if (!USE_SUPABASE) { setContent(lsGet(date, type)); }
    else {
      supabase.from('school_notices').select('content').eq('date', date).eq('type', type).maybeSingle()
        .then(({ data }) => {
          if (reqRef.current !== myReq) return                       // 古い応答は無視
          const p = pendingRef.current
          if (p && p.date === date && p.type === type) return        // 編集中は上書きしない
          setContent(data?.content || '')
        })
    }
    // 日付/種別が変わる直前・アンマウント時に未保存分を確実に保存
    return () => flush()
  }, [date, type, flush])

  // 他端末の変更をリアルタイム反映＋タブ復帰時に再読み込み（上の欄と同じ仕組み）。
  // 編集中（未保存の pending あり）は上書きしない。
  useEffect(() => {
    if (!date || !USE_SUPABASE) return
    const applyRemote = () => {
      const p = pendingRef.current
      if (p && p.date === date && p.type === type) return // 編集中は無視
      supabase.from('school_notices').select('content').eq('date', date).eq('type', type).maybeSingle()
        .then(({ data }) => {
          const q = pendingRef.current
          if (q && q.date === date && q.type === type) return
          setContent(data?.content || '')
        })
    }
    const unsub = subscribeSchoolNotices(row => {
      if (row.type !== type || row.date !== date) return
      applyRemote()
    })
    const unvis = onVisibilityReload(applyRemote)
    return () => { unsub(); unvis() }
  }, [date, type])

  function handleChange(value) {
    setContent(value)
    pendingRef.current = { date, type, value }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const p = pendingRef.current
      pendingRef.current = null
      debounceRef.current = null
      if (p) persist(p.date, p.type, p.value, setSaving)
    }, 800)
  }

  return { content, handleChange, saving }
}
