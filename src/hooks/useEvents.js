import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const LS_KEY = 'kirara_events'

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function lsSave(arr) {
  localStorage.setItem(LS_KEY, JSON.stringify(arr))
}

export function useEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!USE_SUPABASE) {
      setEvents(lsLoad())
      setLoading(false)
      return
    }
    let all = []
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('school_events')
        .select('*')
        .order('date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: true })
        .range(from, from + 999)
      if (error) break
      all = all.concat(data)
      if (data.length < 1000) break
      from += 1000
    }
    setEvents(all)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    if (!USE_SUPABASE) return
    const channel = supabase
      .channel('school_events_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_events' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const addEvent = useCallback(async (ev) => {
    const record = { date: ev.date, title: ev.title, start_time: ev.start_time || null, end_time: ev.end_time || null, note: ev.note || null }
    if (!USE_SUPABASE) {
      const newRec = { ...record, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      const updated = [...lsLoad(), newRec]
      lsSave(updated)
      setEvents(updated)
      return newRec
    }
    const { data, error } = await supabase.from('school_events').insert(record).select().single()
    if (error) throw error
    return data
  }, [])

  const updateEvent = useCallback(async (id, patch) => {
    if (!USE_SUPABASE) {
      const updated = lsLoad().map(e => e.id === id ? { ...e, ...patch } : e)
      lsSave(updated)
      setEvents(updated)
      return
    }
    const { error } = await supabase.from('school_events').update(patch).eq('id', id)
    if (error) throw error
  }, [])

  const deleteEvent = useCallback(async (id) => {
    if (!USE_SUPABASE) {
      const updated = lsLoad().filter(e => e.id !== id)
      lsSave(updated)
      setEvents(updated)
      return
    }
    const { error } = await supabase.from('school_events').delete().eq('id', id)
    if (error) throw error
  }, [])

  return { events, loading, addEvent, updateEvent, deleteEvent, reload: load }
}
