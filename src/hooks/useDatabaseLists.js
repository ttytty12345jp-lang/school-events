import { useState, useEffect, useCallback } from 'react'
import { supabase, USE_SUPABASE } from '../lib/supabase'

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

// 夏休み・冬休みなどの長期休み期間。[{ id, label, start:'YYYY-MM-DD', end:'YYYY-MM-DD' }]
// この期間中は、月中行事でグレー塗りつぶしにしていても「明日」等の登校日判定では
// 土日以外はスキップしない（グレー＝長期休み中の平日、という運用を想定）。
export function useDatabaseLists() {
  const [rooms, setRoomsState] = useState([])
  const [names, setNamesState] = useState([])
  const [nursing, setNursingState] = useState(emptyNursing())
  const [vacations, setVacationsState] = useState([])
  // 休業期間中の「日番」表。班のローテーションではなく、日付ごとに直接名前を割り当てる単純なリスト。
  // [{ id, date:'YYYY-MM-DD', name }]
  const [holidayDuty, setHolidayDutyState] = useState([])

  const [currentTeam, setCurrentTeamState] = useState('')

  useEffect(() => {
    load('rooms').then(d => { if (d) setRoomsState(d) })
    load('names').then(d => { if (d) setNamesState(d) })
    load('nursing').then(d => { if (d) setNursingState({ ...emptyNursing(), ...d }) })
    load('vacations').then(d => { if (d) setVacationsState(d) })
    load('holidayDuty').then(d => { if (d) setHolidayDutyState(d) })
    load('team').then(d => { if (d) setCurrentTeamState(d) })
  }, [])

  const saveRooms = useCallback((next) => { setRoomsState(next); save('rooms', next) }, [])
  const saveNames = useCallback((next) => { setNamesState(next); save('names', next) }, [])
  const saveNursing = useCallback((next) => { setNursingState(next); save('nursing', next) }, [])
  const saveVacations = useCallback((next) => { setVacationsState(next); save('vacations', next) }, [])
  const saveHolidayDuty = useCallback((next) => { setHolidayDutyState(next); save('holidayDuty', next) }, [])
  const saveCurrentTeam = useCallback((next) => { setCurrentTeamState(next); save('team', next) }, [])

  return {
    rooms, names, nursing, vacations, holidayDuty, currentTeam,
    saveRooms, saveNames, saveNursing, saveVacations, saveHolidayDuty, saveCurrentTeam,
  }
}
