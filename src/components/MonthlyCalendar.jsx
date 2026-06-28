import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { supabase, USE_SUPABASE } from '../lib/supabase'
import { exportMonthlyExcel, downloadMonthlyTemplate, parseImportExcel } from '../utils/exportExcel'
import { useHeaderControls } from '../HeaderControlsContext'
import { DAYS_JA, ymdKey as toDateKey } from '../utils/date'
import { loadSpanEvents, saveSpanEvents, getActiveSpans } from '../lib/spanEvents'
import { loadWatchTemplate } from '../lib/watchTemplate'

const HIGHLIGHTS_TYPE = 'row_highlights'
const SPAN_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b']

const CATEGORIES = ['学校行事', '教職員関係行事', 'その他']
const GRADES = ['1年', '2年', '3年', '4年', '5年', '6年']
const WATCH_TYPE = 'watch_team' // 見守り隊バージョンの学年別入力

function SpanEventModal({ span, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(span?.title || '')
  const [startDate, setStartDate] = useState(span?.startDate || '')
  const [endDate, setEndDate] = useState(span?.endDate || '')
  const [color, setColor] = useState(span?.color || SPAN_COLORS[0])
  const ref = useRef(null)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  function handleSave() {
    if (!title.trim() || !startDate || !endDate) return
    onSave({ id: span?.id || crypto.randomUUID(), title: title.trim(), startDate, endDate, color })
    onClose()
  }

  return (
    <div className="span-modal" ref={ref}>
      <div className="span-modal-header">
        <span>{span ? '期間行事を編集' : '期間行事を追加'}</span>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>
      <div className="span-modal-body">
        <input className="span-modal-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="行事名（例：水泳指導期間）" />
        <div className="span-modal-row">
          <input type="date" className="span-modal-date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <span>〜</span>
          <input type="date" className="span-modal-date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="span-color-picker">
          {SPAN_COLORS.map(c => (
            <button key={c} className={['span-color-btn', color === c ? 'selected' : ''].join(' ')}
              style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
        <div className="span-modal-actions">
          <button className="hc-btn hc-btn-primary" onClick={handleSave}>保存</button>
          {span && <button className="btn-danger" onClick={() => { onDelete(span.id); onClose() }}>削除</button>}
        </div>
      </div>
    </div>
  )
}


function sortedEvents(evs) {
  return [...evs].sort((a, b) => {
    const so = (a.sort_order ?? 9999) - (b.sort_order ?? 9999)
    if (so !== 0) return so
    return (a.created_at || '') < (b.created_at || '') ? -1 : 1
  })
}

// ── セル内ポップオーバー ──────────────────────────────────
function CellPopover({ date, category, events, onAdd, onUpdate, onDelete, onClose, addToast }) {
  const ref = useRef(null)
  const [newTitle, setNewTitle] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newColor, setNewColor] = useState('black')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  async function handleAdd() {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      await onAdd({ date, category, title: newTitle.trim(), start_time: newTime || null, end_time: null, note: newNote.trim() || null, color: newColor })
      setNewTitle('')
      setNewTime('')
      setNewNote('')
      setNewColor('black')
      addToast('追加しました', 'success')
    } catch { addToast('保存失敗', 'error') }
    setSaving(false)
  }

  async function handleUpdate(id, field, value) {
    try { await onUpdate(id, { [field]: value || null }) }
    catch { addToast('更新失敗', 'error') }
  }

  async function handleDelete(id) {
    try { await onDelete(id); addToast('削除しました', 'info') }
    catch { addToast('削除失敗', 'error') }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <div className="cell-popover" ref={ref} onClick={e => e.stopPropagation()}>
      <div className="cell-popover-header">
        <span>{date.slice(5).replace('-', '/')} {category}</span>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>
      {events.map(ev => (
        <ExistingEventRow key={ev.id} ev={ev} onUpdate={handleUpdate} onDelete={handleDelete} />
      ))}
      <div className="popover-new-row">
        <ColorToggle color={newColor} onChange={setNewColor} />
        <input type="text" placeholder="行事名を入力" value={newTitle}
          onChange={e => setNewTitle(e.target.value)} onKeyDown={handleKeyDown}
          autoFocus className="popover-input-title"
          style={{ color: newColor === 'red' ? '#dc2626' : 'inherit' }} />
        <input type="time" value={newTime}
          onChange={e => setNewTime(e.target.value)} className="popover-input-time" />
        <input type="text" placeholder="備考" value={newNote}
          onChange={e => setNewNote(e.target.value)} onKeyDown={handleKeyDown}
          className="popover-input-note" />
        <button className="btn-primary popover-add-btn" onClick={handleAdd} disabled={saving || !newTitle.trim()}>
          追加
        </button>
      </div>
    </div>
  )
}

function ColorToggle({ color, onChange }) {
  return (
    <div className="color-toggle">
      <button
        className={`color-btn color-black${color !== 'red' ? ' active' : ''}`}
        onClick={() => onChange('black')}
        title="黒"
      >黒</button>
      <button
        className={`color-btn color-red${color === 'red' ? ' active' : ''}`}
        onClick={() => onChange('red')}
        title="赤"
      >赤</button>
    </div>
  )
}

function ExistingEventRow({ ev, onUpdate, onDelete }) {
  const [title, setTitle] = useState(ev.title)
  const [time, setTime] = useState(ev.start_time || '')
  const [note, setNote] = useState(ev.note || '')

  useEffect(() => { setTitle(ev.title); setTime(ev.start_time || ''); setNote(ev.note || '') }, [ev])

  function blur(field, value) {
    const cur = field === 'title' ? ev.title : field === 'start_time' ? (ev.start_time || '') : (ev.note || '')
    if (value !== cur) onUpdate(ev.id, field, value)
  }

  return (
    <div className="popover-existing-row">
      <ColorToggle color={ev.color || 'black'} onChange={c => onUpdate(ev.id, 'color', c)} />
      <input type="text" value={title} onChange={e => setTitle(e.target.value)}
        onBlur={() => blur('title', title)} className="popover-input-title"
        style={{ color: ev.color === 'red' ? '#dc2626' : 'inherit' }} />
      <span className="time-clear-wrap">
        <input type="time" value={time} onChange={e => setTime(e.target.value)}
          onBlur={() => blur('start_time', time)} className="popover-input-time" />
        {time && (
          <button className="time-clear-btn" onMouseDown={e => {
            e.preventDefault()
            setTime('')
            onUpdate(ev.id, 'start_time', '')
          }}>×</button>
        )}
      </span>
      <input type="text" placeholder="備考" value={note} onChange={e => setNote(e.target.value)}
        onBlur={() => blur('note', note)} className="popover-input-note" />
      <button className="btn-danger popover-del-btn" onClick={() => onDelete(ev.id)}>✕</button>
    </div>
  )
}

// ── ドロップゾーン（イベント間の挿入位置） ────────────────
function DropZone({ onDrop, isOver, setIsOver }) {
  return (
    <div
      className={`drop-zone${isOver ? ' drop-zone-over' : ''}`}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); setIsOver(false); onDrop() }}
    />
  )
}

// ── ドラッグ可能なイベントチップ ──────────────────────────
function DraggableChip({ ev, onDragStart }) {
  return (
    <div
      className="table-event-chip draggable-chip"
      draggable
      onDragStart={e => { e.stopPropagation(); onDragStart(e, ev) }}
      style={{ color: ev.color === 'red' ? '#dc2626' : 'inherit' }}
    >
      {ev.title}
      {ev.start_time && <span className="chip-time">　{ev.start_time}{ev.end_time ? `～${ev.end_time}` : ''}</span>}
      {ev.note && <span className="chip-note">　{ev.note}</span>}
    </div>
  )
}

// ── セル（ドロップターゲット） ────────────────────────────
function DroppableCell({ dateKey, cat, cellEvents, isActive, onCellClick, onAdd, onUpdate, onDelete, addToast, dragState, onDropToCell, onDropBetween, startSpans = [] }) {
  const [cellOver, setCellOver] = useState(false)
  const [zoneOver, setZoneOver] = useState({}) // index → bool

  function handleCellDrop(e) {
    e.preventDefault()
    setCellOver(false)
    if (!dragState.current) return
    // セル末尾にドロップ
    onDropToCell(dateKey, cat, cellEvents.length)
  }

  const activeCellEvents = isActive ? cellEvents : []

  return (
    <td
      className={[
        'col-cat-cell',
        isActive ? 'cell-active' : '',
        cellOver && dragState.current ? 'cell-drop-over' : '',
      ].filter(Boolean).join(' ')}
      style={{ position: 'relative' }}
      onClick={() => !dragState.current && onCellClick()}
      onDragOver={e => { e.preventDefault(); setCellOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setCellOver(false) }}
      onDrop={handleCellDrop}
    >
      {startSpans.map(s => (
        <span key={s.id} className="span-label-chip span-label-chip-edit" style={{ background: s.color }}
          onClick={e => { e.stopPropagation(); setSpanModal(s) }}>
          {s.title}
        </span>
      ))}

      {/* 先頭ドロップゾーン */}
      <DropZone
        isOver={!!zoneOver[-1]}
        setIsOver={v => setZoneOver(z => ({ ...z, [-1]: v }))}
        onDrop={() => onDropBetween(dateKey, cat, 0)}
      />

      {cellEvents.map((ev, i) => (
        <span key={ev.id} className="chip-wrapper">
          <DraggableChip ev={ev} onDragStart={(e, ev) => { dragState.current = { ev, sourceDateKey: dateKey, sourceCat: cat } }} />
          <DropZone
            isOver={!!zoneOver[i]}
            setIsOver={v => setZoneOver(z => ({ ...z, [i]: v }))}
            onDrop={() => onDropBetween(dateKey, cat, i + 1)}
          />
        </span>
      ))}

      {isActive && (
        <CellPopover
          date={dateKey}
          category={cat}
          events={activeCellEvents}
          onAdd={onAdd}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onClose={() => onCellClick(true)}
          addToast={addToast}
        />
      )}
    </td>
  )
}

// ── メインカレンダー ──────────────────────────────────────
export default function MonthlyCalendar({ events, onAdd, onUpdate, onDelete, addToast }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [activeCell, setActiveCell] = useState(null)
  const dragState = useRef(null)

  // 行の塗りつぶしオーバーライド: date → 'gray' | 'none'
  // null = auto（土日は自動グレー、平日は白）
  const [rowOverrides, setRowOverrides] = useState({})
  const highlightDebounce = useRef(null)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  // 表示バージョン: 'normal' | 'pta' | 'watch'
  const [viewMode, setViewMode] = useState('normal')
  // 見守り隊バージョンの学年別入力: { dateKey: { '1年': text, ... } }
  // null = 明示的に消去（斜線表示）、undefined = テンプレート使用
  const [watchData, setWatchData] = useState({})
  const watchDebounce = useRef(null)
  // 曜日別テンプレート: { '月': { '1年': '14:50', ... }, ... }
  const [watchTemplate, setWatchTemplate] = useState({})
  const [watchRowEdit, setWatchRowEdit] = useState(null) // 編集中の dateKey
  const watchTableRef = useRef(null)

  // 期間行事
  const [spanEvents, setSpanEvents] = useState([])
  const [spanModal, setSpanModal] = useState(null) // null | 'new' | {span object}

  useEffect(() => { loadSpanEvents().then(setSpanEvents) }, [])
  useEffect(() => { loadWatchTemplate().then(t => setWatchTemplate(t || {})) }, [])

  // 見守り隊編集: テーブル外クリックで編集モードを閉じる
  useEffect(() => {
    if (!watchRowEdit) return
    function handler(e) {
      if (watchTableRef.current && !watchTableRef.current.contains(e.target)) {
        setWatchRowEdit(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [watchRowEdit])

  async function handleSaveSpan(entry) {
    const next = spanEvents.some(s => s.id === entry.id)
      ? spanEvents.map(s => s.id === entry.id ? entry : s)
      : [...spanEvents, entry]
    setSpanEvents(next)
    await saveSpanEvents(next)
  }

  async function handleDeleteSpan(id) {
    const next = spanEvents.filter(s => s.id !== id)
    setSpanEvents(next)
    await saveSpanEvents(next)
  }

  // 月が変わったら対応するオーバーライドをロード
  useEffect(() => {
    if (!USE_SUPABASE) {
      try {
        const saved = JSON.parse(localStorage.getItem(`row_highlights_${monthKey}`) || '{}')
        setRowOverrides(saved)
      } catch { setRowOverrides({}) }
      return
    }
    supabase.from('school_notices').select('content')
      .eq('date', monthKey).eq('type', HIGHLIGHTS_TYPE).maybeSingle()
      .then(({ data }) => {
        setRowOverrides(data?.content ? JSON.parse(data.content) : {})
      })
  }, [monthKey])

  function saveHighlights(overrides) {
    const json = JSON.stringify(overrides)
    if (!USE_SUPABASE) {
      localStorage.setItem(`row_highlights_${monthKey}`, json)
      return
    }
    if (highlightDebounce.current) clearTimeout(highlightDebounce.current)
    highlightDebounce.current = setTimeout(async () => {
      await supabase.from('school_notices')
        .upsert({ date: monthKey, type: HIGHLIGHTS_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
    }, 600)
  }

  function toggleRowHighlight(dateKey, isWeekend) {
    setRowOverrides(prev => {
      const cur = prev[dateKey]
      let next
      if (cur === undefined) {
        // auto → 手動で反転
        next = { ...prev, [dateKey]: isWeekend ? 'none' : 'gray' }
      } else if (cur === 'gray') {
        next = { ...prev, [dateKey]: 'none' }
      } else {
        // 'none' → autoに戻す（キー削除）
        next = { ...prev }
        delete next[dateKey]
      }
      saveHighlights(next)
      return next
    })
  }

  function isRowGray(dateKey, isWeekend) {
    const override = rowOverrides[dateKey]
    if (override === 'gray') return true
    if (override === 'none') return false
    return isWeekend
  }

  // 見守り隊データを月ごとにロード
  useEffect(() => {
    if (!USE_SUPABASE) {
      try { setWatchData(JSON.parse(localStorage.getItem(`watch_team_${monthKey}`) || '{}')) } catch { setWatchData({}) }
      return
    }
    supabase.from('school_notices').select('content')
      .eq('date', monthKey).eq('type', WATCH_TYPE).maybeSingle()
      .then(({ data }) => setWatchData(data?.content ? JSON.parse(data.content) : {}))
  }, [monthKey])

  function saveWatch(next) {
    const json = JSON.stringify(next)
    if (!USE_SUPABASE) { localStorage.setItem(`watch_team_${monthKey}`, json); return }
    if (watchDebounce.current) clearTimeout(watchDebounce.current)
    watchDebounce.current = setTimeout(() => {
      supabase.from('school_notices')
        .upsert({ date: monthKey, type: WATCH_TYPE, content: json, updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
    }, 600)
  }

  function updateWatch(dateKey, grade, val) {
    setWatchData(prev => {
      const next = { ...prev, [dateKey]: { ...prev[dateKey], [grade]: val } }
      saveWatch(next)
      return next
    })
  }

  function updateWatchGrades(dateKey, grades, val) {
    setWatchData(prev => {
      const dayData = { ...prev[dateKey] }
      for (const g of grades) dayData[g] = val
      const next = { ...prev, [dateKey]: dayData }
      saveWatch(next)
      return next
    })
  }

  // テンプレート値と上書きデータから表示値を取得
  // 戻り値: { displayValue, isTemplate, isCleared }
  // isCleared: 明示的に消去（null）→ 斜線表示
  // isTemplate: テンプレートから自動挿入
  function getWatchCellInfo(dateKey, grade, dow) {
    const dayName = DAYS_JA[dow]
    const explicit = watchData[dateKey]?.[grade]
    if (explicit === null) return { displayValue: '', isTemplate: false, isCleared: true }
    if (explicit !== undefined) return { displayValue: explicit, isTemplate: false, isCleared: false }
    const tplVal = watchTemplate[dayName]?.[grade] || ''
    return { displayValue: tplVal, isTemplate: true, isCleared: false }
  }

  // 学年配列のセル結合グループを計算
  function computeWatchGroups(dateKey, dow) {
    const infos = GRADES.map(g => ({ grade: g, ...getWatchCellInfo(dateKey, g, dow) }))
    const groups = []
    let i = 0
    while (i < infos.length) {
      const cur = infos[i]
      if (!cur.isCleared && cur.displayValue) {
        let j = i + 1
        while (j < infos.length && !infos[j].isCleared && infos[j].displayValue === cur.displayValue) j++
        groups.push({ grades: infos.slice(i, j).map(x => x.grade), colspan: j - i, ...cur })
        i = j
      } else {
        groups.push({ grades: [cur.grade], colspan: 1, ...cur })
        i++
      }
    }
    return groups
  }

  const eventMap = useMemo(() => {
    const m = new Map()
    for (const ev of events) {
      const key = `${ev.date}__${ev.category || '学校行事'}`
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(ev)
    }
    // 各セル内をソート
    for (const [k, arr] of m) m.set(k, sortedEvents(arr))
    return m
  }, [events])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  // insertIndex: ドロップ先のセル内での挿入位置
  const handleDrop = useCallback(async (targetDate, targetCat, insertIndex) => {
    const state = dragState.current
    dragState.current = null
    if (!state) return

    const { ev, sourceDateKey, sourceCat } = state
    const isSameCell = sourceDateKey === targetDate && sourceCat === targetCat

    // ドロップ先セルの現在のイベント一覧
    const targetKey = `${targetDate}__${targetCat}`
    const targetEvs = (eventMap.get(targetKey) || []).filter(e => e.id !== ev.id)

    // 挿入位置を確定（同一セル内なら元位置を除いたあとのインデックス）
    const clampedIndex = Math.min(insertIndex, targetEvs.length)
    targetEvs.splice(clampedIndex, 0, ev)

    // sort_order を 0,1,2... で更新
    const updates = targetEvs.map((e, i) => ({ id: e.id, sort_order: i }))

    try {
      const cellPatch = { date: targetDate, category: targetCat }
      const promises = []
      if (!isSameCell) {
        // 元セルの sort_order を並列で整理
        const sourceEvs = (eventMap.get(`${sourceDateKey}__${sourceCat}`) || []).filter(e => e.id !== ev.id)
        sourceEvs.forEach((e, i) => promises.push(onUpdate(e.id, { sort_order: i })))
      }
      // 移動先の sort_order + 必要なら date/category を並列更新
      updates.forEach(u => promises.push(
        onUpdate(u.id, { sort_order: u.sort_order, ...(u.id === ev.id && !isSameCell ? cellPatch : {}) })
      ))
      await Promise.all(promises)
      addToast('移動しました', 'success')
    } catch {
      addToast('移動に失敗しました', 'error')
    }
  }, [eventMap, onUpdate, addToast])

  const daysInMonth = new Date(year, month, 0).getDate()
  const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate())
  const importRef = useRef(null)
  const { setControls } = useHeaderControls()
  // ref で最新の events を保持 → useEffect の依存配列から除外してヘッダー再登録を防ぐ
  const eventsRef = useRef(events)
  useEffect(() => { eventsRef.current = events }, [events])

  useEffect(() => {
    setControls(
      <div className="hc-row">
        <select className="hc-select" value={viewMode} onChange={e => setViewMode(e.target.value)} title="表示バージョン">
          <option value="normal">標準</option>
          <option value="pta">PTA用</option>
          <option value="watch">見守り隊用</option>
        </select>
        <button className="hc-btn-nav" onClick={prevMonth}>‹</button>
        <span className="hc-label">{year}年{month}月</span>
        <button className="hc-btn-nav" onClick={nextMonth}>›</button>
        <button className="hc-btn" onClick={() => downloadMonthlyTemplate(year, month)}>📋 テンプレートDL</button>
        <button className="hc-btn" onClick={() => importRef.current?.click()}>📥 インポート</button>
        <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImport} />
        <button className="hc-btn" onClick={() => {
          const [y, m] = [year, month]
          exportMonthlyExcel(y, m, eventsRef.current.filter(e => {
            const [ey, em] = e.date.split('-').map(Number)
            return ey === y && em === m
          }))
        }}>📊 Excel出力</button>
        <button className="hc-btn" onClick={() => {
          const style = document.createElement('style')
          style.id = 'monthly-print-override'
          style.textContent = '@page { size: A4 portrait; margin: 6mm; }'
          document.head.appendChild(style)
          // 表の実寸を測り、A4縦1枚（余白6mm）に収まる倍率を計算（全バージョン対応）
          const wrap = document.querySelector('.monthly-table-wrap')
          const table = wrap?.querySelector('.monthly-table')
          let prevZoom
          if (wrap && table) {
            const mm = n => n / 25.4 * 96
            const pageW = mm(210 - 12)       // 印刷可能幅
            const pageH = mm(297 - 12) - 34  // 印刷可能高さ − 見出し帯ぶん
            const z = Math.min(1, pageW / table.scrollWidth, pageH / table.scrollHeight)
            prevZoom = wrap.style.zoom
            wrap.style.zoom = String(z)
          }
          window.print()
          if (wrap) wrap.style.zoom = prevZoom || ''
          document.getElementById('monthly-print-override')?.remove()
        }}>🖨️ 印刷</button>
        <button className="hc-btn" onClick={() => setSpanModal('new')}>＋ 期間行事</button>
      </div>
    )
    return () => setControls(null)
  }, [year, month, viewMode])

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const evs = await parseImportExcel(file)
      if (evs.length === 0) { addToast('インポートできる行事がありませんでした', 'info'); return }
      let count = 0
      for (const ev of evs) {
        try { await onAdd(ev); count++ } catch {}
      }
      addToast(`${count}件をインポートしました`, 'success')
    } catch (err) {
      addToast(`インポート失敗: ${err.message}`, 'error')
    }
  }

  // PTA用は「教職員関係行事」列を除外
  const visibleCats = viewMode === 'pta' ? CATEGORIES.filter(c => c !== '教職員関係行事') : CATEGORIES

  return (
    <div
      style={{ position: 'relative' }}
      onDragEnd={() => { dragState.current = null }}
    >
      {spanModal && (
        <SpanEventModal
          span={spanModal === 'new' ? null : spanModal}
          onSave={handleSaveSpan}
          onDelete={handleDeleteSpan}
          onClose={() => setSpanModal(null)}
        />
      )}
      <div className="monthly-print-header">
        <span>2026年度　{month}月　月中行事</span>
        <span>大阪市立北中島小学校</span>
      </div>
      <div className="monthly-table-wrap" ref={watchTableRef}>
        <table className={`monthly-table${viewMode === 'watch' ? ' monthly-watch' : ''}`}>
          <thead>
            <tr>
              <th className="col-date">日付</th>
              <th className="col-day">曜日</th>
              {viewMode === 'watch' ? (
                <>
                  <th className="col-cat">学校行事</th>
                  {GRADES.map(g => <th key={g} className="col-grade">{g}</th>)}
                </>
              ) : (
                visibleCats.map(cat => (
                  <th key={cat} className="col-cat">{cat}</th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateKey = toDateKey(year, month, day)
              const dow = new Date(dateKey).getDay()
              const isToday = dateKey === todayKey
              const isSun = dow === 0
              const isSat = dow === 6
              const isWeekend = isSun || isSat
              const gray = isRowGray(dateKey, isWeekend)
              const activeSpans = getActiveSpans(spanEvents, dateKey)
              const BAR_W = 4, BAR_GAP = 2
              const spanStyle = activeSpans.length ? {
                backgroundImage: activeSpans.map(s => `linear-gradient(${s.color},${s.color})`).join(','),
                backgroundSize: activeSpans.map((_, i) => `${BAR_W}px 100%`).join(','),
                backgroundPosition: activeSpans.map((_, i) => `${i * (BAR_W + BAR_GAP)}px 0`).join(','),
                backgroundRepeat: 'no-repeat',
                paddingLeft: activeSpans.length * (BAR_W + BAR_GAP) + 6 + 'px',
              } : undefined
              const renderCatCell = (cat, isFirst) => {
                const cellKey = `${dateKey}__${cat}`
                const cellEvents = eventMap.get(cellKey) || []
                const isActive = activeCell?.date === dateKey && activeCell?.category === cat
                const startSpans = isFirst ? spanEvents.filter(s => s.startDate === dateKey) : []
                return (
                  <DroppableCell
                    key={cat}
                    dateKey={dateKey}
                    cat={cat}
                    cellEvents={cellEvents}
                    isActive={isActive}
                    onCellClick={(close) => setActiveCell(close ? null : { date: dateKey, category: cat })}
                    onAdd={onAdd}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    addToast={addToast}
                    dragState={dragState}
                    onDropToCell={(d, c, idx) => handleDrop(d, c, idx)}
                    onDropBetween={(d, c, idx) => handleDrop(d, c, idx)}
                    startSpans={startSpans}
                  />
                )
              }
              // 見守り隊用では塗りつぶし行（土日・祝日等）を非表示
              if (viewMode === 'watch' && gray) return null

              const isWatchEditing = viewMode === 'watch' && watchRowEdit === dateKey

              return (
                <tr key={day} className={[
                  'monthly-row',
                  isToday ? 'row-today' : '',
                  gray ? 'row-gray' : '',
                  isSun ? 'row-sun' : isSat ? 'row-sat' : '',
                ].filter(Boolean).join(' ')}>
                  <td
                    className="col-date"
                    style={spanStyle}
                    title={activeSpans.map(s => s.title).join(' / ') || undefined}
                    onClick={activeSpans.length ? () => setSpanModal(activeSpans[0]) : undefined}
                  >{month}/{day}</td>
                  <td
                    className="col-day col-day-toggle"
                    title="クリックで塗りつぶし切り替え"
                    onClick={() => toggleRowHighlight(dateKey, isWeekend)}
                  >{DAYS_JA[dow]}</td>
                  {viewMode === 'watch' ? (
                    <>
                      {renderCatCell('学校行事', true)}
                      {isWatchEditing ? (
                        // 編集モード: 全学年を個別 input で表示
                        GRADES.map((g, idx) => {
                          const explicit = watchData[dateKey]?.[g]
                          const inputVal = explicit === null ? '' : explicit !== undefined ? explicit : (watchTemplate[DAYS_JA[dow]]?.[g] || '')
                          return (
                            <td key={g} className="col-grade">
                              <input
                                type="time"
                                className="watch-input watch-input-edit"
                                value={inputVal}
                                autoFocus={idx === 0}
                                onChange={e => updateWatch(dateKey, g, e.target.value === '' ? null : e.target.value)}
                                onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') setWatchRowEdit(null) }}
                              />
                            </td>
                          )
                        })
                      ) : (
                        // 表示モード: 結合表示
                        computeWatchGroups(dateKey, dow).map(group => {
                          const groupKey = group.grades.join(',')
                          if (group.isCleared) {
                            return (
                              <td key={groupKey} className="col-grade watch-cell-cleared" colSpan={group.colspan}
                                title="クリックで編集"
                                onClick={() => setWatchRowEdit(dateKey)} />
                            )
                          }
                          return (
                            <td key={groupKey} className={`col-grade watch-cell-merged${group.isTemplate ? ' watch-cell-template' : ''}`}
                              colSpan={group.colspan}
                              title="クリックで編集"
                              onClick={() => setWatchRowEdit(dateKey)}>
                              <span className="watch-merged-label">{group.displayValue}</span>
                            </td>
                          )
                        })
                      )}
                    </>
                  ) : (
                    visibleCats.map((cat, catIdx) => renderCatCell(cat, catIdx === 0))
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
