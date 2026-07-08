import { useState, useEffect, useRef } from 'react'
import { useNotice } from '../hooks/useNotice'
import { NURSING_DAYS, NURSING_TEAMS } from '../hooks/useDatabaseLists'
import { loadAnchors, setAnchorForWeek, subscribeAssemblyDuty } from '../lib/assemblyDuty'
import { dateKey as toDateKey } from '../utils/date'

// 看護当番表を「左上から縦（班1→班4）に進み、下まで行ったら右の列（曜日）へ、
// 一番右下の後は左上に戻る」順（＝列優先）で、手入力された名前のみを並べる。
function nursingRoster(nursing) {
  const list = []
  for (const day of NURSING_DAYS) {
    for (const team of NURSING_TEAMS) {
      const name = (nursing?.[team]?.[day] || '').trim()
      if (name) list.push(name)
    }
  }
  return list
}

// dateKey が属する週の月曜日キーを返す（toISOString はUTC変換で日付がずれるため使わない）
function mondayKeyOf(dateKey) {
  const d = new Date(dateKey + 'T00:00:00')
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return toDateKey(d)
}
// 2つの月曜日キーの週差
function weeksBetween(fromMonday, toMonday) {
  const a = new Date(fromMonday + 'T00:00:00')
  const b = new Date(toMonday + 'T00:00:00')
  return Math.round((b - a) / (7 * 86400000))
}

// 手入力された週（アンカー）を起点に、それ以降だけ看護当番表の並び順で自動ローテーションする。
// 手入力が一つも無い（対象週より前にアンカーが無い）場合は空文字＝非表示。
// その週ちょうどにアンカーがあれば、その手入力値をそのまま優先表示する。
function computeDutyName(nursing, anchors, dateKey) {
  const targetWeek = mondayKeyOf(dateKey)
  const exact = anchors.find(a => a.week === targetWeek)
  if (exact) return exact.name
  let best = null
  for (const a of anchors) {
    if (a.week < targetWeek && (!best || a.week > best.week)) best = a
  }
  if (!best) return ''
  const roster = nursingRoster(nursing)
  const idx = roster.indexOf(best.name)
  if (idx === -1 || roster.length === 0) return best.name // ローテーション不能時は直前の値を維持
  const wb = weeksBetween(best.week, targetWeek)
  const newIdx = ((idx + wb) % roster.length + roster.length) % roster.length
  return roster[newIdx]
}

// 曜日限定の「ラベル＋選択」行の共通部品。朝会記録簿・ホワイトボード両方から使う。
//   水曜：「職員打ち合わせ」（15：35～ / なし / 職会兼）
//   金曜：「児童集会」（あり / なし → 運動場 / 講堂）
//   月曜：「全校朝会」（あり / なし → 運動場 / 講堂 / meet）
function DowOptionRow({ dateKey, noticeType, label, options, targetDow, className = 'ttv-staff-meeting' }) {
  const { content, handleChange } = useNotice(dateKey, noticeType)
  const dow = new Date(dateKey + 'T00:00:00').getDay()
  if (dow !== targetDow) return null
  const value = content || options[0]
  return (
    <div className={className}>
      <span className={`${className}-label`}>{label}</span>
      <select className={`${className}-select`} value={value} onChange={e => handleChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

const STAFF_MEETING_OPTIONS = ['14：35～', 'なし', '職会兼']

// 職員打ち合わせ：常にテキスト欄を表示し、直接編集できる。横の候補ボタンを押すと
// その場でテキストが入る（datalist は Safari/iOS で候補が出ないため不使用、
// select は選んだ後に直接編集できないため不使用）。
// content(サーバー値)が空文字だと「未設定」と区別できず既定値に戻ってしまうため、
// 一度でも編集を始めたら local を優先し、空にしても既定値へ戻さない。
export function StaffMeetingRow({ dateKey }) {
  const { content, handleChange } = useNotice(dateKey, 'staff_meeting')
  const dow = new Date(dateKey + 'T00:00:00').getDay()
  const [local, setLocal] = useState(null) // null = 未編集（content から表示値を導出）
  useEffect(() => { setLocal(null) }, [dateKey]) // 日付が変わったら未編集状態に戻す
  if (dow !== 3) return null
  const value = local != null ? local : (content || STAFF_MEETING_OPTIONS[0])
  function onInput(v) { setLocal(v); handleChange(v) }
  return (
    <div className="ttv-staff-meeting">
      <span className="ttv-staff-meeting-label">職員打ち合わせ</span>
      <input
        className="ttv-staff-meeting-duty-input"
        value={value}
        placeholder="時刻・内容を入力"
        onChange={e => onInput(e.target.value)}
      />
      <span className="ttv-staff-meeting-quick">
        {STAFF_MEETING_OPTIONS.map(o => (
          <button key={o} type="button" className="ttv-staff-meeting-quick-btn" onClick={() => onInput(o)}>{o}</button>
        ))}
      </span>
    </div>
  )
}

// 曜日限定の「ラベル＋あり/なし＋場所」の2段階選択行（金：児童集会、月：全校朝会）。
// 場所選択は「あり」を実際に選んだときだけ表示する（未編集時は出さない）。
// 値は notice に "あり|運動場" のように保存。
function DowPlaceRow({ dateKey, noticeType, label, places, targetDow, DutyField }) {
  const { content, handleChange } = useNotice(dateKey, noticeType)
  const dow = new Date(dateKey + 'T00:00:00').getDay()
  if (dow !== targetDow) return null
  const [savedHas, savedPlace] = (content || '').split('|')
  const has = savedHas || 'あり'
  const place = savedPlace || ''
  function changeHas(v) { handleChange(v === 'あり' ? (savedPlace ? `${v}|${savedPlace}` : v) : v) }
  function changePlace(v) { handleChange(`${has}|${v}`) }
  return (
    <div className="ttv-staff-meeting">
      <span className="ttv-staff-meeting-label">{label}</span>
      <select className="ttv-staff-meeting-select" value={has} onChange={e => changeHas(e.target.value)}>
        <option value="あり">あり</option>
        <option value="なし">なし</option>
      </select>
      {has === 'あり' && (
        <select className="ttv-staff-meeting-select" value={place} onChange={e => changePlace(e.target.value)}>
          <option value="" disabled hidden></option>
          {places.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      {has === 'あり' && DutyField}
    </div>
  )
}

export function ChildAssemblyRow({ dateKey }) {
  return <DowPlaceRow dateKey={dateKey} noticeType="child_assembly" label="児童集会" places={['運動場', '講堂']} targetDow={5} />
}

// 月曜「全校朝会」：右に担当者枠（看護当番表の名前を、手入力した週を起点に自動ローテーション）
export function AllSchoolMeetingRow({ dateKey, db = {} }) {
  const dow = new Date(dateKey + 'T00:00:00').getDay()
  const [anchors, setAnchors] = useState([])
  const [local, setLocal] = useState(null) // null = 未編集（computed値を表示）
  const debounceRef = useRef(null)

  useEffect(() => {
    if (dow !== 1) return
    let cancel = false
    loadAnchors().then(a => { if (!cancel) setAnchors(a) })
    const unsub = subscribeAssemblyDuty(a => { if (!cancel) setAnchors(a) })
    return () => { cancel = true; unsub() }
  }, [dow])

  useEffect(() => { setLocal(null) }, [dateKey]) // 日付が変わったら未編集状態に戻す

  if (dow !== 1) return null
  const computed = computeDutyName(db.nursing, anchors, dateKey)
  const value = local != null ? local : computed

  // 入力のたびにデバウンス保存（他の入力欄と同様。blur待ちにしない）
  function handleInput(v) {
    setLocal(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const weekKey = mondayKeyOf(dateKey)
      setAnchorForWeek(weekKey, v).then(setAnchors)
    }, 600)
  }

  const dutyField = (
    <input
      className="ttv-staff-meeting-duty-input"
      value={value}
      placeholder=""
      onChange={e => handleInput(e.target.value)}
    />
  )
  return <DowPlaceRow dateKey={dateKey} noticeType="all_school_meeting" label="全校朝会"
    places={['運動場', '講堂', 'meet']} targetDow={1} DutyField={dutyField} />
}
