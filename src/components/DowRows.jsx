import { useNotice } from '../hooks/useNotice'

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

const STAFF_MEETING_OPTIONS = ['15：35～', 'なし', '職会兼']
export function StaffMeetingRow({ dateKey }) {
  return <DowOptionRow dateKey={dateKey} noticeType="staff_meeting" label="職員打ち合わせ" options={STAFF_MEETING_OPTIONS} targetDow={3} />
}

// 曜日限定の「ラベル＋あり/なし＋場所」の2段階選択行（金：児童集会、月：全校朝会）。
// 場所選択は「あり」を実際に選んだときだけ表示する（未編集時は出さない）。
// 値は notice に "あり|運動場" のように保存。
function DowPlaceRow({ dateKey, noticeType, label, places, targetDow }) {
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
    </div>
  )
}

export function ChildAssemblyRow({ dateKey }) {
  return <DowPlaceRow dateKey={dateKey} noticeType="child_assembly" label="児童集会" places={['運動場', '講堂']} targetDow={5} />
}

export function AllSchoolMeetingRow({ dateKey }) {
  return <DowPlaceRow dateKey={dateKey} noticeType="all_school_meeting" label="全校朝会" places={['運動場', '講堂', 'meet']} targetDow={1} />
}
