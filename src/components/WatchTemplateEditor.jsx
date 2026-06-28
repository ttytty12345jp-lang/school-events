import { useState, useEffect, useRef } from 'react'
import { loadWatchTemplate, saveWatchTemplate } from '../lib/watchTemplate'

const WEEK_DAYS = ['月', '火', '水', '木', '金']
const GRADES = ['1年', '2年', '3年', '4年', '5年', '6年']

export default function WatchTemplateEditor() {
  const [template, setTemplate] = useState(null)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { loadWatchTemplate().then(t => setTemplate(t || {})) }, [])

  function update(day, grade, val) {
    setTemplate(prev => {
      const next = { ...prev, [day]: { ...prev[day], [grade]: val } }
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(async () => {
        setSaving(true)
        await saveWatchTemplate(next)
        setSaving(false)
      }, 600)
      return next
    })
  }

  if (!template) return <div style={{ padding: 20, color: '#64748b' }}>読み込み中…</div>

  return (
    <div className="db-section">
      <div className="db-section-title">
        見守り隊テンプレート（曜日別下校時刻）
        {saving && <span className="db-saving"> 保存中…</span>}
      </div>
      <p className="db-section-note">ここで設定した時刻が月中行事（見守り隊用）に自動で挿入されます。変更がある日のみ月中行事側で上書きしてください。</p>
      <table className="db-watch-template-table">
        <thead>
          <tr>
            <th className="db-wt-th-day"></th>
            {GRADES.map(g => <th key={g} className="db-wt-th">{g}</th>)}
          </tr>
        </thead>
        <tbody>
          {WEEK_DAYS.map(day => (
            <tr key={day}>
              <td className="db-wt-td-label">{day}曜</td>
              {GRADES.map(grade => (
                <td key={grade} className="db-wt-td">
                  <input
                    type="time"
                    className="db-wt-input"
                    value={template[day]?.[grade] || ''}
                    onChange={e => update(day, grade, e.target.value)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
