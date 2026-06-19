import * as XLSX from 'xlsx'

const CATEGORIES = ['学校行事', '教職員関係行事', 'その他']
const IMPORT_HEADERS = ['日付', '区分', '行事名', '開始時刻', '備考', '色']

// インポート用テンプレートをダウンロード
export function downloadMonthlyTemplate(year, month) {
  const wb = XLSX.utils.book_new()
  const daysInMonth = new Date(year, month, 0).getDate()
  const DAYS_JA_L = ['日', '月', '火', '水', '木', '金', '土']

  const rows = [
    [`${year}年${month}月 行事予定 入力テンプレート`],
    ['※ 区分: 学校行事 / 教職員関係行事 / その他　　色: 黒 / 赤'],
    [],
    IMPORT_HEADERS,
  ]

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    rows.push([dateKey, '学校行事', '', '', '', '黒'])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 24 }, { wch: 6 }]
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }]
  XLSX.utils.book_append_sheet(wb, ws, 'テンプレート')
  XLSX.writeFile(wb, `入力テンプレート_${year}年${month}月.xlsx`)
}

// 全角数字→半角
function toHalf(s) {
  return String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
}

// 令和→西暦
function reiwaToWestern(n) { return 2018 + n }

// カテゴリ名の正規化
const CAT_SYNONYMS = [
  [['現職教育', '教職員'], '教職員関係行事'],
  [['PTA', 'その他'], 'その他'],
  [['学校行事'], '学校行事'],
]
function normalizeCategory(raw) {
  const s = String(raw)
  for (const [keys, val] of CAT_SYNONYMS) {
    if (keys.some(k => s.includes(k))) return val
  }
  return '学校行事'
}

// Excelシリアル値 → YYYY-MM-DD
function serialToDateKey(serial) {
  const parsed = XLSX.SSF.parse_date_code(serial)
  return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
}

// Excelファイルをパースしてイベントオブジェクトのリストを返す
// フォーマットA: 日付・区分・行事名・開始時刻・備考・色（テンプレート形式）
// フォーマットB: 日・曜・学校行事・現職教育関係行事・PTA・その他（既存行事予定表形式）
export function parseImportExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' })
        const pad = n => String(n).padStart(2, '0')
        const allEvents = []

        // 全シートを処理
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

          const headerIdx = rows.findIndex(r => {
            const cells = r.map(c => String(c).trim())
            return cells.includes('日付') || cells.includes('日') || cells.some(c => c === '行事名')
          })
          if (headerIdx === -1) continue  // このシートにはヘッダーなし → スキップ

          const header = rows[headerIdx].map(c => String(c).trim())
          const isFormatA = header.includes('日付') || header.includes('区分') || header.includes('行事名')

          if (isFormatA) {
            // ── フォーマットA（テンプレート形式） ──
            const ci = {
              date:       header.findIndex(h => h === '日付'),
              category:   header.findIndex(h => h === '区分'),
              title:      header.findIndex(h => h === '行事名'),
              start_time: header.findIndex(h => h.includes('開始')),
              note:       header.findIndex(h => h === '備考'),
              color:      header.findIndex(h => h === '色'),
            }
            for (let i = headerIdx + 1; i < rows.length; i++) {
              const row = rows[i]
              const title = String(row[ci.title] ?? '').trim()
              if (!title) continue
              let date = row[ci.date]
              if (typeof date === 'number') date = serialToDateKey(date)
              else date = String(date).trim()
              if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) continue
              const category = ci.category >= 0 ? normalizeCategory(row[ci.category]) : '学校行事'
              const start_time = ci.start_time >= 0 ? String(row[ci.start_time] ?? '').trim() || null : null
              const note = ci.note >= 0 ? String(row[ci.note] ?? '').trim() || null : null
              const color = ci.color >= 0 && String(row[ci.color] ?? '').includes('赤') ? 'red' : 'black'
              allEvents.push({ date, category, title, start_time, end_time: null, note, color })
            }
            continue
          }

          // ── フォーマットB（月別シート形式: 日・曜・学校行事・現職教育…・PTA） ──

          // 年をヘッダー前の行から取得（令和 or 西暦）
          let year = new Date().getFullYear()
          for (let i = 0; i < Math.min(headerIdx, 5); i++) {
            const cells = rows[i]
            // 西暦が直接入っているセルを探す（例: 2026）
            for (const c of cells) {
              const n = Number(c)
              if (n >= 2020 && n <= 2100) { year = n; break }
            }
            // 令和表記
            const text = toHalf(cells.join(''))
            const reiwa = text.match(/令和\s*(\d+)/)
            if (reiwa) year = reiwaToWestern(parseInt(reiwa[1]))
          }

          // 月をシート名から取得（全角 "４月" → 4）
          const snMonth = toHalf(sheetName).match(/(\d+)月/)
          if (!snMonth) continue  // 月が特定できないシートはスキップ
          const month = parseInt(snMonth[1])

          const dayColIdx = header.findIndex(h => h === '日' || h === '日付')
          if (dayColIdx === -1) continue

          // カテゴリ列を検出（日・曜 以降の非空ヘッダー列）
          const catCols = []
          header.forEach((h, idx) => {
            if (idx <= 1) return
            if (h) catCols.push({ idx, category: normalizeCategory(h) })
          })

          for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i]
            let dayRaw = toHalf(String(row[dayColIdx] ?? '')).trim()
            if (!isNaN(dayRaw) && dayRaw !== '' && Number(dayRaw) > 31) {
              const parsed = XLSX.SSF.parse_date_code(Number(dayRaw))
              dayRaw = String(parsed.d)
            }
            const day = parseInt(dayRaw)
            if (!day || day < 1 || day > 31) continue

            const dateKey = `${year}-${pad(month)}-${pad(day)}`

            for (const { idx, category } of catCols) {
              const cellText = String(row[idx] ?? '').trim()
              if (!cellText) continue
              const lines = cellText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
              for (const title of lines) {
                allEvents.push({ date: dateKey, category, title, start_time: null, end_time: null, note: null, color: 'black' })
              }
            }
          }
        }

        if (allEvents.length === 0) {
          reject(new Error('インポートできる行事データが見つかりませんでした'))
          return
        }
        resolve(allEvents)
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('ファイル読み込み失敗'))
    reader.readAsBinaryString(file)
  })
}

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function dateStr(dateText) {
  const d = new Date(dateText)
  return `${d.getMonth() + 1}/${d.getDate()}(${DAYS_JA[d.getDay()]})`
}

const EXPORT_CATS = [
  { key: '学校行事',     label: '学校行事' },
  { key: '教職員関係行事', label: '現職教育関係行事' },
  { key: 'その他',       label: 'PTA・その他' },
]

export function exportMonthlyExcel(year, month, events) {
  const wb = XLSX.utils.book_new()
  const reiwa = year - 2018
  const daysInMonth = new Date(year, month, 0).getDate()

  // 日付→カテゴリ→行事タイトル[] のマップ
  const eventMap = {}
  for (const ev of events) {
    if (!eventMap[ev.date]) eventMap[ev.date] = {}
    const cat = ev.category || '学校行事'
    if (!eventMap[ev.date][cat]) eventMap[ev.date][cat] = []
    eventMap[ev.date][cat].push(ev.title)
  }

  const rows = [
    // タイトル行・年度行
    [`${month}月行事予定表`, '', '', '', ''],
    [`令和　${reiwa}　年度`, '', '', '', ''],
    // ヘッダー行
    ['日', '曜', ...EXPORT_CATS.map(c => c.label)],
  ]

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dow = DAYS_JA[new Date(dateKey).getDay()]
    const dayData = eventMap[dateKey] || {}
    rows.push([
      d,
      dow,
      ...EXPORT_CATS.map(c => (dayData[c.key] || []).join('\n')),
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  // タイトル行をマージ
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
  ]

  // 列幅
  ws['!cols'] = [{ wch: 4 }, { wch: 4 }, { wch: 32 }, { wch: 28 }, { wch: 22 }]

  // 行高：データ行は複数行の行事があり得るので折り返し対応（pt単位）
  ws['!rows'] = [{ hpt: 22 }, { hpt: 16 }, { hpt: 18 }]
  for (let d = 0; d < daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`
    const dayData = eventMap[dateKey] || {}
    const maxLines = Math.max(1, ...EXPORT_CATS.map(c => (dayData[c.key] || []).length))
    ws['!rows'].push({ hpt: Math.max(18, maxLines * 16) })
  }

  // セルの折り返し設定
  const range = XLSX.utils.decode_range(ws['!ref'])
  for (let R = 2; R <= range.e.r; R++) {
    for (let C = 0; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      if (!ws[addr]) ws[addr] = { t: 's', v: '' }
      ws[addr].s = {
        alignment: { wrapText: true, vertical: 'top' },
        ...(R === 2 ? { font: { bold: true } } : {}),
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, `${month}月`)
  XLSX.writeFile(wb, `${month}月行事予定表.xlsx`)
}

export function exportAnnualExcel(fiscalYear, events) {
  const wb = XLSX.utils.book_new()

  const headers = ['月', '日付', '曜日', '行事名', '開始', '終了', '備考']
  const allRows = [[`${fiscalYear}年度 年間行事予定表`], [], headers]

  // 4月〜翌3月
  for (let m = 4; m <= 15; m++) {
    const year = m <= 12 ? fiscalYear : fiscalYear + 1
    const month = m <= 12 ? m : m - 12
    const daysInMonth = new Date(year, month, 0).getDate()
    let monthLabel = `${month}月`
    let firstInMonth = true
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayOfWeek = DAYS_JA[new Date(dateKey).getDay()]
      const dayEvents = events.filter(e => e.date === dateKey)
      if (dayEvents.length === 0) continue
      dayEvents.forEach((ev, i) => {
        allRows.push([
          firstInMonth && i === 0 ? monthLabel : '',
          i === 0 ? `${month}/${d}` : '',
          i === 0 ? dayOfWeek : '',
          ev.title,
          ev.start_time || '',
          ev.end_time || '',
          ev.note || '',
        ])
        firstInMonth = false
      })
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(allRows)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]
  ws['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 5 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 24 }]

  XLSX.utils.book_append_sheet(wb, ws, '年間行事')
  XLSX.writeFile(wb, `年間行事予定_${fiscalYear}年度.xlsx`)
}
