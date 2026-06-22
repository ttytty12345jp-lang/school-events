import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

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
function autoScale(el) {
  if (!el) return
  el.style.fontSize = FONT_MAX + 'px'
  while (el.scrollWidth > el.clientWidth && parseFloat(el.style.fontSize) > FONT_MIN) {
    el.style.fontSize = (parseFloat(el.style.fontSize) - 1) + 'px'
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

export default function MorningAgenda({ dateKey, calendarEvents }) {
  const [items, setItems] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dragOverId, setDragOverId] = useState(null) // ドロップ先のid
  const debounceRef = useRef(null)
  const inputRefs = useRef({})
  const dragIdRef = useRef(null)

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

  const save = useCallback(async (newItems) => {
    if (!USE_SUPABASE) { lsSet(dateKey, newItems); return }
    setSaving(true)
    await supabase.from('school_notices')
      .upsert({ date: dateKey, type: 'morning_agenda', content: JSON.stringify(newItems), updated_at: new Date().toISOString() }, { onConflict: 'date,type' })
    setSaving(false)
  }, [dateKey])

  function update(newItems) {
    setItems(newItems)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(newItems), 800)
  }

  function setTitle(id, value) {
    update(items.map(it => it.id === id ? { ...it, title: value } : it))
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
    <div className="agenda-body">
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
            ref={el => { inputRefs.current[item.id] = el; autoScale(el) }}
            className="agenda-title-input"
            value={item.title}
            onChange={e => { setTitle(item.id, e.target.value); autoScale(e.target) }}
            onKeyDown={e => handleKeyDown(e, item.id, i)}
            placeholder="行事・連絡を入力"
          />
          <button className="agenda-add-btn" title="下に行を追加" onClick={() => addAfter(i)}>＋</button>
          <button className="agenda-del-btn" title="削除" onClick={() => remove(item.id)}>✕</button>
        </div>
      ))}
    </div>
  )
}
