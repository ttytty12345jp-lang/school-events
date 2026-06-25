// 日付まわりの共通ヘルパー（各ファイルに散らばっていた定義を集約）

export const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

export const pad2 = n => String(n).padStart(2, '0')

// 年・月・日 → "YYYY-MM-DD"
export const ymdKey = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`

// Date → "YYYY-MM-DD"
export const dateKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

// 年・月 → "YYYY-MM"
export const monthKey = (y, m) => `${y}-${pad2(m)}`
