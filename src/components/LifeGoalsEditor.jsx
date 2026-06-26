import { useState, useEffect, useRef } from 'react'
import { loadLifeGoals, saveLifeGoals } from '../lib/lifeGoals'

const MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]

export default function LifeGoalsEditor() {
  const [goals, setGoals] = useState(null)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { loadLifeGoals().then(g => setGoals(g || {})) }, [])

  function update(m, val) {
    const next = { ...goals, [m]: val }
    setGoals(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      await saveLifeGoals(next)
      setSaving(false)
    }, 800)
  }

  if (!goals) return <div style={{ padding: 20, color: '#64748b' }}>読み込み中…</div>

  return (
    <div className="db-section">
      <div className="db-section-title">今月の生活目標{saving && <span className="db-saving"> 保存中…</span>}</div>
      <table className="db-goals-table">
        <tbody>
          {MONTHS.map(m => (
            <tr key={m}>
              <td className="db-goals-month">{m}月</td>
              <td>
                <textarea
                  className="db-goals-input"
                  value={goals[m] || ''}
                  onChange={e => update(m, e.target.value)}
                  rows={2}
                  placeholder=""
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
