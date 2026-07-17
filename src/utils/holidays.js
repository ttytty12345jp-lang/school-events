// 日本の国民の祝日名。カレンダー行事のタイトルと突き合わせて「本当の祝日」かどうかを判定する。
// 休み期間（夏休み・冬休み等）中の「学校閉庁日」等は含まない — あくまで法定の祝日のみ。
export const JP_HOLIDAY_NAMES = new Set([
  '元日', '成人の日', '建国記念の日', '天皇誕生日', '春分の日', '昭和の日',
  '憲法記念日', 'みどりの日', 'こどもの日', '海の日', '山の日', '敬老の日',
  '秋分の日', 'スポーツの日', '体育の日', '文化の日', '勤労感謝の日',
  '振替休日', '国民の休日',
])

export function isHolidayTitle(title) {
  if (!title) return false
  const t = title.trim()
  return JP_HOLIDAY_NAMES.has(t)
}
