import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

export const NURSING_DAYS = ['月', '火', '水', '木', '金']
export const NURSING_TEAMS = ['班1', '班2', '班3', '班4']

export function emptyNursing() {
  return Object.fromEntries(
    NURSING_TEAMS.map(t => [t, Object.fromEntries(NURSING_DAYS.map(d => [d, '']))])
  )
}

async function load(type) {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(`db_${type}`) || 'null') } catch { return null }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', `db_${type}`).eq('type', 'database').maybeSingle()
  if (!data?.content) return null
  try { return JSON.parse(data.content) } catch { return null }
}

async function save(type, value) {
  const json = JSON.stringify(value)
  if (!USE_SUPABASE) { localStorage.setItem(`db_${type}`, json); return }
  await supabase.from('school_notices')
    .upsert({ date: `db_${type}`, type: 'database', content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}

export function useDatabaseLists() {
  const [rooms, setRoomsState] = useState([])
  const [names, setNamesState] = useState([])
  const [nursing, setNursingState] = useState(emptyNursing())

  const [currentTeam, setCurrentTeamState] = useState('')

  useEffect(() => {
    load('rooms').then(d => { if (d) setRoomsState(d) })
    load('names').then(d => { if (d) setNamesState(d) })
    load('nursing').then(d => { if (d) setNursingState({ ...emptyNursing(), ...d }) })
    load('team').then(d => { if (d) setCurrentTeamState(d) })
  }, [])

  const saveRooms = useCallback((next) => { setRoomsState(next); save('rooms', next) }, [])
  const saveNames = useCallback((next) => { setNamesState(next); save('names', next) }, [])
  const saveNursing = useCallback((next) => { setNursingState(next); save('nursing', next) }, [])
  const saveCurrentTeam = useCallback((next) => { setCurrentTeamState(next); save('team', next) }, [])

  return { rooms, names, nursing, currentTeam, saveRooms, saveNames, saveNursing, saveCurrentTeam }
}
