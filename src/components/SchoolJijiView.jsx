import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { useHeaderControls } from '../HeaderControlsContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

const GRADES = ['1年', '2年', '3年', '4年', '5年', '6年']
const LS_KEY = 'jiji_master'
const SUPABASE_TYPE = 'jiji_master'
const SUPABASE_DATE = 'master'
const MAX_THIRDS = 18

export function thirdsDisplay(n) {
  n = Math.max(0, Math.round(n))
  const w = Math.floor(n / 3)
  const r = n % 3
  if (r === 0) return String(w)
  return w === 0 ? `${r}/3` : `${w} ${r}/3`
}

export async function loadJijiMaster() {
  if (!USE_SUPABASE) {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
  }
  const { data } = await supabase.from('school_notices').select('content')
    .eq('date', SUPABASE_DATE).eq('type', SUPABASE_TYPE).maybeSingle()
  if (!data?.content) return []
  try { return JSON.parse(data.content) } catch { return [] }
}

async function saveJijiMaster(list) {
  const json = JSON.stringify(list)
  if (!USE_SUPABASE) { localStorage.setItem(LS_KEY, json); return }
  await supabase.from('school_notices')
    .upsert({ date: SUPABASE_DATE, type: SUPABASE_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
}

function newEntry() {
  return {
    id: crypto.randomUUID(),
    date: '',
    title: '',
    grades: Object.fromEntries(GRADES.map(g => [g, 0])),
  }
}

function ThirdsStepper({ value, onChange }) {
  return (
    <div className="thirds-stepper">
      <button className="thirds-btn" onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0}>−</button>
      <span className="thirds-val">{thirdsDisplay(value)}</span>
      <button className="thirds-btn" onClick={() => onChange(Math.min(MAX_THIRDS, value + 1))} disabled={value >= MAX_THIRDS}>＋</button>
    </div>
  )
}

export default function SchoolJijiView() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    loadJijiMaster().then(data => {
      setList(data.length > 0 ? data : [newEntry()])
      setLoading(false)
    })
  }, [])

  function save(next) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      await saveJijiMaster(next)
      setSaving(false)
    }, 800)
  }

  function sortedByDate(arr) {
    return [...arr].sort((a, b) => {
      if (!a.date && !b.date) return 0
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0
    })
  }

  function updateDate(id, date) {
    const next = sortedByDate(list.map(e => e.id === id ? { ...e, date } : e))
    setList(next); save(next)
  }

  function updateTitle(id, title) {
    const next = list.map(e => e.id === id ? { ...e, title } : e)
    setList(next); save(next)
  }

  function updateGrade(id, grade, thirds) {
    const next = list.map(e => e.id === id ? { ...e, grades: { ...e.grades, [grade]: thirds } } : e)
    setList(next); save(next)
  }

  const addRow = useCallback(() => {
    const next = [...list, newEntry()]
    setList(next); save(next)
  }, [list])

  function removeRow(id) {
    const next = list.filter(e => e.id !== id)
    setList(next.length > 0 ? next : [newEntry()]); save(next.length > 0 ? next : [newEntry()])
  }

  const { setControls } = useHeaderControls()

  useEffect(() => {
    setControls(
      <div className="hc-row">
        {saving && <span className="hc-saving">保存中…</span>}
        <button className="hc-btn hc-btn-primary" onClick={addRow}>＋ 行事を追加</button>
      </div>
    )
    return () => setControls(null)
  }, [saving, addRow])

  if (loading) return <div style={{ padding: 40, color: '#64748b', textAlign: 'center' }}>読み込み中…</div>

  return (
    <div className="jiji-wrap">
      <p className="jiji-desc">
        朝会記録簿の行事と名前が一致すると、その日の「学校行事時数」の「今日」欄に時数を自動計上します。
      </p>
      <div className="jiji-table-wrap">
        <table className="jiji-table">
          <thead>
            <tr>
              <th className="jiji-th-date">日付</th>
              <th className="jiji-th-title">行事名</th>
              {GRADES.map(g => <th key={g} className="jiji-th-grade">{g}</th>)}
              <th className="jiji-th-del"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(entry => (
              <tr key={entry.id} className="jiji-row">
                <td className="jiji-td-date">
                  <input
                    type="date"
                    className="jiji-input-date"
                    value={entry.date || ''}
                    onChange={e => updateDate(entry.id, e.target.value)}
                  />
                </td>
                <td className="jiji-td-title">
                  <input
                    type="text"
                    className="jiji-input-title"
                    value={entry.title}
                    onChange={e => updateTitle(entry.id, e.target.value)}
                    placeholder="行事名"
                  />
                </td>
                {GRADES.map(g => (
                  <td key={g} className="jiji-td-grade">
                    <ThirdsStepper
                      value={entry.grades?.[g] || 0}
                      onChange={v => updateGrade(entry.id, g, v)}
                    />
                  </td>
                ))}
                <td className="jiji-td-del">
                  <button className="btn-danger jiji-del-btn" onClick={() => removeRow(entry.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
