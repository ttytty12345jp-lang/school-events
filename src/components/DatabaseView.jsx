import { useState } from 'react'
import SchoolJijiView from './SchoolJijiView'
import LifeGoalsEditor from './LifeGoalsEditor'
import WatchTemplateEditor from './WatchTemplateEditor'
import { NURSING_DAYS, NURSING_TEAMS } from '../hooks/useDatabaseLists'
import { dateKey as toDateKey } from '../utils/date'

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

// 休み期間の平日日付を日付順に列挙
function vacationWeekdays(vacations) {
  const dates = []
  for (const v of vacations) {
    if (!v.start || !v.end) continue
    const d = new Date(v.start + 'T00:00:00')
    const end = new Date(v.end + 'T00:00:00')
    while (d <= end) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6) dates.push(toDateKey(d))
      d.setDate(d.getDate() + 1)
    }
  }
  return [...new Set(dates)].sort()
}

// 基本の順番（名前）。ループする。
function HolidayDutyOrderEditor({ order, onSave }) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (!v) return
    onSave([...order, v])
    setInput('')
  }
  function remove(i) {
    onSave(order.filter((_, idx) => idx !== i))
  }
  function move(i, dir) {
    const j = i + dir
    if (j < 0 || j >= order.length) return
    const next = [...order]
    ;[next[i], next[j]] = [next[j], next[i]]
    onSave(next)
  }
  return (
    <div className="db-section">
      <div className="db-section-title">日番の基本の順番</div>
      <p className="db-section-note">この順番で名前がループして日番表に割り当てられます。</p>
      <div className="db-tags">
        {order.map((name, i) => (
          <span key={i} className="db-tag">
            <button className="db-order-btn" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button className="db-order-btn" onClick={() => move(i, 1)} disabled={i === order.length - 1}>↓</button>
            {name}
            <button className="db-tag-del" onClick={() => remove(i)}>×</button>
          </span>
        ))}
      </div>
      <div className="db-add-row">
        <input className="db-add-input" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()} placeholder="追加…" />
        <button className="db-add-btn" onClick={add}>追加</button>
      </div>
    </div>
  )
}

// 休み期間の日付ごとの日番表。基本の順番から自動生成し、手入力で個別上書き・その日を除外できる。
function HolidayDutyTable({ vacations, order, holidayDuty, onSave }) {
  function regenerate() {
    const allDates = vacationWeekdays(vacations)
    const byDate = Object.fromEntries(holidayDuty.map(v => [v.date, v]))
    let idx = 0
    const next = []
    for (const date of allDates) {
      const existing = byDate[date]
      if (existing?.excluded) { next.push(existing); continue }
      if (existing?.manual) { next.push(existing); idx++; continue }
      if (order.length) next.push({ id: date, date, name: order[idx % order.length], manual: false, excluded: false })
      idx++
    }
    onSave(next)
  }
  function updateName(date, name) {
    const exists = holidayDuty.some(v => v.date === date)
    const next = exists
      ? holidayDuty.map(v => v.date === date ? { ...v, name, manual: true } : v)
      : [...holidayDuty, { id: date, date, name, manual: true, excluded: false }]
    onSave(next)
  }
  function excludeDate(date) {
    const exists = holidayDuty.some(v => v.date === date)
    const next = exists
      ? holidayDuty.map(v => v.date === date ? { ...v, excluded: true, name: '' } : v)
      : [...holidayDuty, { id: date, date, name: '', manual: false, excluded: true }]
    onSave(next)
  }
  const visible = holidayDuty.filter(v => !v.excluded).sort((a, b) => a.date.localeCompare(b.date))
  return (
    <div className="db-section">
      <div className="db-section-title">日番表（休み期間）</div>
      <p className="db-section-note">
        「順番を反映」で休み期間の平日に基本の順番を割り当てます。個別に名前を書き換えると以後その行は上書きされません。
        お盆など当番が無い日は×で消せます（次に「順番を反映」しても復活しません）。
      </p>
      <button className="db-add-btn" onClick={regenerate}>順番を反映して生成・更新</button>
      <table className="db-vacation-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>名前</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map(v => (
            <tr key={v.date}>
              <td>{v.date}</td>
              <td>
                <input className="db-vacation-input" value={v.name} placeholder="名前"
                  onChange={e => updateName(v.date, e.target.value)} />
              </td>
              <td>
                <button className="db-tag-del" onClick={() => excludeDate(v.date)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function DatabaseView({
  rooms, names, nursing, vacations = [], holidayDutyOrder = [], holidayDuty = [],
  saveRooms, saveNames, saveNursing, saveVacations, saveHolidayDutyOrder, saveHolidayDuty,
}) {
  const [tab, setTab] = useState('jiji')

  return (
    <div className="db-wrap">
      <div className="db-tabs">
        <button className={`db-tab${tab === 'jiji' ? ' active' : ''}`} onClick={() => setTab('jiji')}>学校行事マスター</button>
        <button className={`db-tab${tab === 'goals' ? ' active' : ''}`} onClick={() => setTab('goals')}>生活目標</button>
        <button className={`db-tab${tab === 'watch' ? ' active' : ''}`} onClick={() => setTab('watch')}>見守り隊</button>
        <button className={`db-tab${tab === 'duty' ? ' active' : ''}`} onClick={() => setTab('duty')}>当番</button>
        <button className={`db-tab${tab === 'lists' ? ' active' : ''}`} onClick={() => setTab('lists')}>リスト管理</button>
      </div>

      {tab === 'jiji' && <SchoolJijiView />}

      {tab === 'goals' && <LifeGoalsEditor />}

      {tab === 'watch' && <WatchTemplateEditor />}

      {tab === 'duty' && (
        <div className="db-lists">
          <NursingTable nursing={nursing} onSave={saveNursing} />
          <VacationEditor vacations={vacations} onSave={saveVacations} />
          <HolidayDutyOrderEditor order={holidayDutyOrder} onSave={saveHolidayDutyOrder} />
          <HolidayDutyTable vacations={vacations} order={holidayDutyOrder} holidayDuty={holidayDuty} onSave={saveHolidayDuty} />
        </div>
      )}

      {tab === 'lists' && (
        <div className="db-lists">
          <TagListEditor label="特別教室" items={rooms} onSave={saveRooms} />
          <TagListEditor label="名前" items={names} onSave={saveNames} />
        </div>
      )}
    </div>
  )
}
