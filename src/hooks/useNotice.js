import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

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

export function useNotice(date, type = 'notice') {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!date) return
    if (!USE_SUPABASE) { setContent(lsGet(date, type)); return }
    supabase.from('school_notices').select('content').eq('date', date).eq('type', type).maybeSingle()
      .then(({ data }) => setContent(data?.content || ''))
  }, [date, type])

  const save = useCallback(async (value) => {
    if (!USE_SUPABASE) { lsSet(date, type, value); return }
    setSaving(true)
    await supabase.from('school_notices')
      .upsert({ date, type, content: value, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
    setSaving(false)
  }, [date, type])

  function handleChange(value) {
    setContent(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(value), 800)
  }

  return { content, handleChange, saving }
}
