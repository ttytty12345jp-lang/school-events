import { useState, useEffect, useRef } from 'react'
import { loadWatchTemplate, saveWatchTemplate, WATCH_RULE_DAYS, newWatchRule } from '../lib/watchTemplate'

const WEEK_DAYS = ['月', '火', '水', '木', '金']
const GRADES = ['1年', '2年', '3年', '4年', '5年', '6年']

export default function WatchTemplateEditor() {
  const [template, setTemplate] = useState(null)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { loadWatchTemplate().then(t => setTemplate(t || { rules: [] })) }, [])

  // 変更をデバウンス保存（template 全体を渡す）
  function commit(next) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setSaving(true)
      await saveWatchTemplate(next)
      setSaving(false)
    }, 600)
  }

  function update(day, grade, val) {
    setTemplate(prev => {
      const next = { ...prev, [day]: { ...prev[day], [grade]: val } }
      commit(next)
      return next
    })
  }

  function addRule() {
    setTemplate(prev => {
      const next = { ...prev, rules: [...(prev.rules || []), newWatchRule()] }
      commit(next)
      return next
    })
  }

  function updateRule(id, patch) {
    setTemplate(prev => {
      const next = { ...prev, rules: (prev.rules || []).map(r => r.id === id ? { ...r, ...patch } : r) }
      commit(next)
      return next
    })
  }

  function updateRuleTime(id, grade, val) {
    setTemplate(prev => {
      const next = {
        ...prev,
        rules: (prev.rules || []).map(r => r.id === id ? { ...r, times: { ...r.times, [grade]: val } } : r),
      }
      commit(next)
      return next
    })
  }

  function deleteRule(id) {
    setTemplate(prev => {
      const next = { ...prev, rules: (prev.rules || []).filter(r => r.id !== id) }
      commit(next)
      return next
    })
  }

  if (!template) return <div style={{ padding: 20, color: '#64748b' }}>読み込み中…</div>

  const rules = template.rules || []

  return (
    <div className="db-section">
      <div className="db-section-title">
        見守り隊テンプレート（曜日別下校時刻）
        {saving && <span className="db-saving"> 保存中…</span>}
      </div>
      <p className="db-section-note">ここで設定した時刻が月中行事（見守り隊用）に自動で挿入されます。変更がある日のみ月中行事側で上書きしてください。</p>
      <div className="db-wt-scroll">
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

      {/* 文字列ルール */}
      <div className="db-section-title" style={{ marginTop: 18 }}>文字列ルール（特定の行事名で時刻を上書き）</div>
      <p className="db-section-note">左の「学校行事」欄が条件に合う日は、曜日テンプレートの代わりにこの下校時刻が使われます。一致は「部分一致」（文字列が含まれれば適用）か「完全一致」（欄全体が一致したときだけ適用）を選べます。曜日を指定するとその曜日だけに適用されます（上の行から順に判定）。</p>
      <div className="db-wt-scroll">
      <table className="db-watch-template-table db-watch-rule-table">
        <thead>
          <tr>
            <th className="db-wt-th-rule">文字列</th>
            <th className="db-wt-th-ruleday">一致</th>
            <th className="db-wt-th-ruleday">曜日</th>
            {GRADES.map(g => <th key={g} className="db-wt-th">{g}</th>)}
            <th className="db-wt-th-del"></th>
          </tr>
        </thead>
        <tbody>
          {rules.length === 0 && (
            <tr><td className="db-wt-empty" colSpan={GRADES.length + 4}>ルールがありません。「＋ ルールを追加」で登録してください。</td></tr>
          )}
          {rules.map(rule => (
            <tr key={rule.id} className="db-wt-row-special">
              <td className="db-wt-td">
                <input
                  type="text"
                  className="db-wt-input db-wt-input-text"
                  placeholder="例: クラブ活動"
                  value={rule.keyword || ''}
                  onChange={e => updateRule(rule.id, { keyword: e.target.value })}
                />
              </td>
              <td className="db-wt-td">
                <select
                  className="db-wt-input db-wt-select"
                  value={rule.match || 'partial'}
                  onChange={e => updateRule(rule.id, { match: e.target.value })}
                >
                  <option value="partial">部分一致</option>
                  <option value="exact">完全一致</option>
                </select>
              </td>
              <td className="db-wt-td">
                <select
                  className="db-wt-input db-wt-select"
                  value={rule.day || 'すべて'}
                  onChange={e => updateRule(rule.id, { day: e.target.value })}
                >
                  {WATCH_RULE_DAYS.map(d => <option key={d} value={d}>{d === 'すべて' ? 'すべて' : d + '曜'}</option>)}
                </select>
              </td>
              {GRADES.map(grade => (
                <td key={grade} className="db-wt-td">
                  <input
                    type="time"
                    className="db-wt-input"
                    value={rule.times?.[grade] || ''}
                    onChange={e => updateRuleTime(rule.id, grade, e.target.value)}
                  />
                </td>
              ))}
              <td className="db-wt-td db-wt-td-del">
                <button className="db-wt-del-btn" onClick={() => deleteRule(rule.id)} title="このルールを削除">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <button className="db-wt-add-btn" onClick={addRule}>＋ ルールを追加</button>
    </div>
  )
}
