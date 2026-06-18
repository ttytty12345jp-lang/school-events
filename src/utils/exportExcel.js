import * as XLSX from 'xlsx'

const DAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

function dateStr(dateText) {
  const d = new Date(dateText)
  return `${d.getMonth() + 1}/${d.getDate()}(${DAYS_JA[d.getDay()]})`
}

export function exportMonthlyExcel(year, month, events) {
  const wb = XLSX.utils.book_new()

  const title = `${year}年${month}月 行事予定表`
  const headers = ['日付', '曜日', '行事名', '開始', '終了', '備考']

  const rows = [[title], [], headers]

  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dayOfWeek = DAYS_JA[new Date(dateKey).getDay()]
    const dayEvents = events.filter(e => e.date === dateKey)
    if (dayEvents.length === 0) {
      rows.push([`${month}/${d}`, dayOfWeek, '', '', '', ''])
    } else {
      dayEvents.forEach((ev, i) => {
        rows.push([
          i === 0 ? `${month}/${d}` : '',
          i === 0 ? dayOfWeek : '',
          ev.title,
          ev.start_time || '',
          ev.end_time || '',
          ev.note || '',
        ])
      })
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)

  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }]

  ws['!cols'] = [{ wch: 10 }, { wch: 5 }, { wch: 24 }, { wch: 8 }, { wch: 8 }, { wch: 24 }]

  if (ws['A1']) {
    ws['A1'].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } }
  }
  if (ws['A3']) {
    headers.forEach((_, i) => {
      const cell = XLSX.utils.encode_cell({ r: 2, c: i })
      if (ws[cell]) ws[cell].s = { fill: { fgColor: { rgb: 'E2E8F0' } }, font: { bold: true } }
    })
  }

  XLSX.utils.book_append_sheet(wb, ws, `${month}月`)
  XLSX.writeFile(wb, `行事予定_${year}年${month}月.xlsx`)
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
