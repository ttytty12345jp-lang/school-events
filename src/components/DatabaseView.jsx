import { useState } from 'react'
import SchoolJijiView from './SchoolJijiView'
import LifeGoalsEditor from './LifeGoalsEditor'
import WatchTemplateEditor from './WatchTemplateEditor'
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

function VacationEditor({ vacations, onSave }) {
  function genId() { return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()) }
  function add() {
    onSave([...vacations, { id: genId(), label: '', start: '', end: '' }])
  }
  function update(id, patch) {
    onSave(vacations.map(v => v.id === id ? { ...v, ...patch } : v))
  }
  function remove(id) {
    onSave(vacations.filter(v => v.id !== id))
  }
  return (
    <div className="db-section">
      <div className="db-section-title">休み期間（夏休み・冬休みなど）</div>
      <p className="db-section-note">
        この期間中は、月中行事でグレー塗りつぶしにしていても、ホワイトボードの「明日」等の
        登校日判定では土日以外はスキップしません（グレー＝長期休み中の平日、という扱いになります）。
      </p>
      <table className="db-vacation-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>開始日</th>
            <th>終了日</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vacations.map(v => (
            <tr key={v.id}>
              <td>
                <input className="db-vacation-input" value={v.label} placeholder="夏休み"
                  onChange={e => update(v.id, { label: e.target.value })} />
              </td>
              <td>
                <input className="db-vacation-input" type="date" value={v.start}
                  onChange={e => update(v.id, { start: e.target.value })} />
              </td>
              <td>
                <input className="db-vacation-input" type="date" value={v.end}
                  onChange={e => update(v.id, { end: e.target.value })} />
              </td>
              <td>
                <button className="db-tag-del" onClick={() => remove(v.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="db-add-btn" onClick={add}>＋ 期間を追加</button>
    </div>
  )
}

function HolidayDutyEditor({ holidayDuty, onSave }) {
  function genId() { return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()) }
  function add() {
    onSave([...holidayDuty, { id: genId(), date: '', name: '' }])
  }
  function update(id, patch) {
    onSave(holidayDuty.map(v => v.id === id ? { ...v, ...patch } : v))
  }
  function remove(id) {
    onSave(holidayDuty.filter(v => v.id !== id))
  }
  const sorted = [...holidayDuty].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return (
    <div className="db-section">
      <div className="db-section-title">日番（休み期間中の当番）</div>
      <p className="db-section-note">
        休み期間中は当番欄の表示が「日番」になり、看護当番表の代わりにここで日付ごとに割り当てた名前を表示します。
      </p>
      <table className="db-vacation-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>名前</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(v => (
            <tr key={v.id}>
              <td>
                <input className="db-vacation-input" type="date" value={v.date}
                  onChange={e => update(v.id, { date: e.target.value })} />
              </td>
              <td>
                <input className="db-vacation-input" value={v.name} placeholder="名前"
                  onChange={e => update(v.id, { name: e.target.value })} />
              </td>
              <td>
                <button className="db-tag-del" onClick={() => remove(v.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="db-add-btn" onClick={add}>＋ 日付を追加</button>
    </div>
  )
}

export default function DatabaseView({ rooms, names, nursing, vacations = [], holidayDuty = [], saveRooms, saveNames, saveNursing, saveVacations, saveHolidayDuty }) {
  const [tab, setTab] = useState('jiji')

  return (
    <div className="db-wrap">
      <div className="db-tabs">
        <button className={`db-tab${tab === 'jiji' ? ' active' : ''}`} onClick={() => setTab('jiji')}>学校行事マスター</button>
        <button className={`db-tab${tab === 'goals' ? ' active' : ''}`} onClick={() => setTab('goals')}>生活目標</button>
        <button className={`db-tab${tab === 'watch' ? ' active' : ''}`} onClick={() => setTab('watch')}>見守り隊</button>
        <button className={`db-tab${tab === 'lists' ? ' active' : ''}`} onClick={() => setTab('lists')}>リスト管理</button>
      </div>

      {tab === 'jiji' && <SchoolJijiView />}

      {tab === 'goals' && <LifeGoalsEditor />}

      {tab === 'watch' && <WatchTemplateEditor />}

      {tab === 'lists' && (
        <div className="db-lists">
          <TagListEditor label="特別教室" items={rooms} onSave={saveRooms} />
          <TagListEditor label="名前" items={names} onSave={saveNames} />
          <NursingTable nursing={nursing} onSave={saveNursing} />
          <VacationEditor vacations={vacations} onSave={saveVacations} />
          <HolidayDutyEditor holidayDuty={holidayDuty} onSave={saveHolidayDuty} />
        </div>
      )}
    </div>
  )
}
