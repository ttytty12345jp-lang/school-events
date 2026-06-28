import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { supabase, USE_SUPABASE } from '../lib/supabase'
import { FormatToolbar, lineStyle } from './formatToolbar'
import { subscribeSchoolNotices, markPending, onVisibilityReload } from '../lib/schoolNoticesRealtime'

function lsGet(date) {
  try { return JSON.parse(localStorage.getItem(`agenda_${date}`) || 'null') } catch { return null }
}
function lsSet(date, items) {
  localStorage.setItem(`agenda_${date}`, JSON.stringify(items))
}

function newItem(title = '') {
  return { id: crypto.randomUUID(), title, fromCalendar: false }
}

const FONT_MAX = 22
const FONT_MIN = 11
function autoScaleContainer(container) {
  if (!container) return
  const inputs = container.querySelectorAll('.agenda-title-input')
  if (!inputs.length) return
  // リセット
  inputs.forEach(el => { el.style.fontSize = FONT_MAX + 'px' })
  // コンテナの高さに収まるまで縮小
  let size = FONT_MAX
  while (container.scrollHeight > container.clientHeight && size > FONT_MIN) {
    size -= 1
    inputs.forEach(el => { el.style.fontSize = size + 'px' })
  }
}

function mergeWithCalendar(saved, calendarEvents) {
  if (saved !== null) return saved
  const items = calendarEvents
    .sort((a, b) => (a.start_time || '99:99') > (b.start_time || '99:99') ? 1 : -1)
    .map(ev => {
      const time = ev.start_time
        ? `　${ev.start_time}${ev.end_time ? `～${ev.end_time}` : '～'}`
        : ''
      return { id: ev.id, title: `${ev.title}${time}`, fromCalendar: true }
    })
  if (items.length === 0) items.push(newItem())
  return items
}

export default function MorningAgenda({ dateKey, calendarEvents, rich = false }) {
  const [items, setItems] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dragOverId, setDragOverId] = useState(null) // ドロップ先のid
  const [focusId, setFocusId] = useState(null)
  const debounceRef = useRef(null)
  const inputRefs = useRef({})
  const dragIdRef = useRef(null)
  const bodyRef = useRef(null)

  // rich モード（朝会記録簿）は行ごとに大きさを変えるので自動縮小しない
  useLayoutEffect(() => { if (!rich) autoScaleContainer(bodyRef.current) }, [items, rich])

  useEffect(() => {
    setItems(null)
    if (!USE_SUPABASE) {
      setItems(mergeWithCalendar(lsGet(dateKey), calendarEvents))
      return
    }
    supabase.from('school_notices').select('content').eq('date', dateKey).eq('type', 'morning_agenda').maybeSingle()
      .then(({ data }) => {
        const saved = data?.content ? JSON.parse(data.content) : null
        setItems(mergeWithCalendar(saved, calendarEvents))
      })
  }, [dateKey])

  // 他端末の変更をリアルタイムで受信
  useEffect(() => {
    return subscribeSchoolNotices(row => {
      if (row.type !== 'morning_agenda' || row.date !== dateKey) return
      try {
        const saved = row.content ? JSON.parse(row.content) : null
        setItems(mergeWithCalendar(saved, calendarEvents))
      } catch {}
    })
  }, [dateKey, calendarEvents])

  // スマホ復帰時に再ロード
  useEffect(() => {
    return onVisibilityReload(() => {
      if (!USE_SUPABASE) return
      supabase.from('school_notices').select('content').eq('date', dateKey).eq('type', 'morning_agenda').maybeSingle()
        .then(({ data }) => {
          const saved = data?.content ? JSON.parse(data.content) : null
          setItems(mergeWithCalendar(saved, calendarEvents))
        })
    })
  }, [dateKey, calendarEvents])

  const save = useCallback(async (newItems) => {
    if (!USE_SUPABASE) { lsSet(dateKey, newItems); return }
    setSaving(true)
    await supabase.from('school_notices')
      .upsert({ date: dateKey, type: 'morning_agenda', content: JSON.stringify(newItems), updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
    setSaving(false)
  }, [dateKey])

  function update(newItems) {
    setItems(newItems)
    markPending(dateKey, 'morning_agenda')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(newItems), 800)
  }

  function setTitle(id, value) {
    update(items.map(it => it.id === id ? { ...it, title: value } : it))
  }

  function setFormat(id, patch) {
    update(items.map(it => it.id === id ? { ...it, ...patch } : it))
  }

  function addAfter(index) {
    const item = newItem()
    const next = [...items]
    next.splice(index + 1, 0, item)
    update(next)
    setTimeout(() => inputRefs.current[item.id]?.focus(), 30)
  }

  function remove(id) {
    const next = items.filter(it => it.id !== id)
    update(next.length === 0 ? [newItem()] : next)
  }

  function handleKeyDown(e, id, index) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addAfter(index)
    }
    if (e.key === 'Backspace' && items[index].title === '' && items.length > 1) {
      e.preventDefault()
      remove(id)
      setTimeout(() => {
        const prevId = items[index - 1]?.id || items[index + 1]?.id
        if (prevId) inputRefs.current[prevId]?.focus()
      }, 30)
    }
  }

  // ── ドラッグ＆ドロップ ──
  function handleDragStart(e, id) {
    dragIdRef.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e, id) {
    e.preventDefault()
    if (id !== dragIdRef.current) setDragOverId(id)
  }

  function handleDrop(e, targetId) {
    e.preventDefault()
    const srcId = dragIdRef.current
    dragIdRef.current = null
    setDragOverId(null)
    if (!srcId || srcId === targetId) return
    const next = [...items]
    const srcIdx = next.findIndex(it => it.id === srcId)
    const tgtIdx = next.findIndex(it => it.id === targetId)
    const [moved] = next.splice(srcIdx, 1)
    next.splice(tgtIdx, 0, moved)
    update(next)
  }

  function handleDragEnd() {
    dragIdRef.current = null
    setDragOverId(null)
  }

  if (items === null) return <div className="ttv-body" style={{ color: 'var(--text-muted)', padding: 16 }}>読み込み中…</div>

  return (
    <div className={`agenda-body${rich ? ' agenda-rich' : ''}`} ref={bodyRef}>
      {saving && <div className="agenda-saving">保存中…</div>}
      {items.map((item, i) => (
        <div
          key={item.id}
          className={[
            'agenda-row',
            item.fromCalendar ? 'agenda-row-calendar' : '',
            dragOverId === item.id ? 'agenda-row-dragover' : '',
          ].filter(Boolean).join(' ')}
          draggable
          onDragStart={e => handleDragStart(e, item.id)}
          onDragOver={e => handleDragOver(e, item.id)}
          onDrop={e => handleDrop(e, item.id)}
          onDragEnd={handleDragEnd}
        >
          <span className="agenda-drag-handle" title="ドラッグで並び替え">⠿</span>
          <input
            ref={el => { inputRefs.current[item.id] = el }}
            className="agenda-title-input"
            style={rich ? lineStyle(item) : undefined}
            value={item.title}
            onChange={e => setTitle(item.id, e.target.value)}
            onKeyDown={e => handleKeyDown(e, item.id, i)}
            onFocus={rich ? () => setFocusId(item.id) : undefined}
            onBlur={rich ? () => setTimeout(() => setFocusId(f => (f === item.id ? null : f)), 150) : undefined}
            placeholder="行事・連絡を入力"
          />
          {rich && focusId === item.id && (
            <FormatToolbar item={item} onChange={patch => setFormat(item.id, patch)} />
          )}
          <button className="agenda-add-btn" title="下に行を追加" onClick={() => addAfter(i)}>＋</button>
          <button className="agenda-del-btn" title="削除" onClick={() => remove(item.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
