import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const LS_KEY = 'kirara_events'
function lsLoad() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] } }
function lsSave(arr) { localStorage.setItem(LS_KEY, JSON.stringify(arr)) }

// IDs currently being mutated by this client — skip realtime echo for these
const pendingIds = new Set()

export function useEvents() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!USE_SUPABASE) { setEvents(lsLoad()); setLoading(false); return }
    let all = [], from = 0
    while (true) {
      const { data, error } = await supabase
        .from('school_events').select('*')
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'school_events' },
        ({ new: rec }) => {
          if (pendingIds.has(rec.id)) return  // own insert, already applied
          setEvents(prev => prev.some(e => e.id === rec.id) ? prev : [...prev, rec])
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'school_events' },
        ({ new: rec }) => {
          if (pendingIds.has(rec.id)) return  // own update, already applied
          setEvents(prev => prev.map(e => e.id === rec.id ? rec : e))
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'school_events' },
        ({ old: rec }) => {
          if (pendingIds.has(rec.id)) return  // own delete, already applied
          setEvents(prev => prev.filter(e => e.id !== rec.id))
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load])

  const addEvent = useCallback(async (ev) => {
    const record = {
      date: ev.date, title: ev.title,
      start_time: ev.start_time || null, end_time: ev.end_time || null,
      note: ev.note || null, category: ev.category || '学校行事',
      color: ev.color || 'black',
    }
    if (!USE_SUPABASE) {
      const newRec = { ...record, id: crypto.randomUUID(), created_at: new Date().toISOString() }
      const updated = [...lsLoad(), newRec]; lsSave(updated); setEvents(updated)
      return newRec
    }
    const { data, error } = await supabase.from('school_events').insert(record).select().single()
    if (error) throw error
    pendingIds.add(data.id)
    setEvents(prev => [...prev, data])
    setTimeout(() => pendingIds.delete(data.id), 3000)
    return data
  }, [])

  const updateEvent = useCallback(async (id, patch) => {
    if (!USE_SUPABASE) {
      const updated = lsLoad().map(e => e.id === id ? { ...e, ...patch } : e)
      lsSave(updated); setEvents(updated); return
    }
    pendingIds.add(id)
    setEvents(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))  // optimistic
    const { error } = await supabase.from('school_events').update(patch).eq('id', id)
    if (error) { load(); throw error }  // rollback on error
    setTimeout(() => pendingIds.delete(id), 3000)
  }, [load])

  const deleteEvent = useCallback(async (id) => {
    if (!USE_SUPABASE) {
      const updated = lsLoad().filter(e => e.id !== id); lsSave(updated); setEvents(updated); return
    }
    pendingIds.add(id)
    setEvents(prev => prev.filter(e => e.id !== id))  // optimistic
    const { error } = await supabase.from('school_events').delete().eq('id', id)
    if (error) { load(); throw error }  // rollback on error
    setTimeout(() => pendingIds.delete(id), 3000)
  }, [load])

  return { events, loading, addEvent, updateEvent, deleteEvent, reload: load }
}
