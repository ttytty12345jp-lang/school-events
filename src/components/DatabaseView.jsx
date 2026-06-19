import { useState } from 'react'
import SchoolJijiView from './SchoolJijiView'
import { NURSING_DAYS, NURSING_TEAMS } from '../hooks/useDatabaseLists'

function TagListEditor({ label, items, onSave }) {
  const [input, setInput] = useState('')

  function add() {
    const v = input.trim()
    if (!v || items.includes(v)) { setInput(''); return }
    onSave([...items, v])
    setInput('')
  }

  function remove(item) {
    onSave(items.filter(i => i !== item))
  }

  return (
    <div className="db-section">
      <div className="db-section-title">{label}</div>
      <div className="db-tags">
        {items.map(item => (
          <span key={item} className="db-tag">
            {item}
            <button className="db-tag-del" onClick={() => remove(item)}>×</button>
          </span>
        ))}
      </div>
      <div className="db-add-row">
        <input
          className="db-add-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="追加…"
        />
        <button className="db-add-btn" onClick={add}>追加</button>
      </div>
    </div>
  )
}

function NursingTable({ nursing, onSave }) {
  function update(team, day, val) {
    onSave({ ...nursing, [team]: { ...nursing[team], [day]: val } })
  }

  return (
    <div className="db-section">
      <div className="db-section-title">看護当番</div>
      <table className="db-nursing-table">
        <thead>
          <tr>
            <th className="db-nursing-th"></th>
            {NURSING_DAYS.map(d => <th key={d} className="db-nursing-th">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {NURSING_TEAMS.map(team => (
            <tr key={team}>
              <td className="db-nursing-td-label">{team}</td>
              {NURSING_DAYS.map(day => (
                <td key={day} className="db-nursing-td">
                  <input
                    className="db-nursing-input"
                    value={nursing[team]?.[day] ?? ''}
                    onChange={e => update(team, day, e.target.value)}
                    placeholder=""
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

export default function DatabaseView({ rooms, names, nursing, saveRooms, saveNames, saveNursing }) {
  const [tab, setTab] = useState('jiji')

  return (
    <div className="db-wrap">
      <div className="db-tabs">
        <button className={`db-tab${tab === 'jiji' ? ' active' : ''}`} onClick={() => setTab('jiji')}>学校行事マスター</button>
        <button className={`db-tab${tab === 'lists' ? ' active' : ''}`} onClick={() => setTab('lists')}>リスト管理</button>
      </div>

      {tab === 'jiji' && <SchoolJijiView />}

      {tab === 'lists' && (
        <div className="db-lists">
          <TagListEditor label="特別教室" items={rooms} onSave={saveRooms} />
          <TagListEditor label="名前" items={names} onSave={saveNames} />
          <NursingTable nursing={nursing} onSave={saveNursing} />
        </div>
      )}
    </div>
  )
}
