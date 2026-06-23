import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'sticky_notes'
const COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', '#ffffff']

function loadNotes() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes))
}

function newNote(inPanel = true, index = 0) {
  return {
    id: crypto.randomUUID(),
    text: '',
    x: window.innerWidth + 20,
    y: 60 + index * 30,
    width: 180,
    height: 140,
    color: COLORS[index % COLORS.length],
    fontSize: 14,
    inPanel,
  }
}

// ── 単一付箋 ──────────────────────────────────────────
function StickyNote({ note, onUpdate, onDelete, onDuplicate }) {
  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const noteRef = useRef(null)
  const textRef = useRef(null)

  // ── ドラッグ移動 ──
  function onMouseDownDrag(e) {
    if (e.target.closest('.sn-resize') || e.target.closest('.sn-toolbar')) return
    if (e.button !== 0) return
    e.preventDefault()
    const startX = e.clientX - note.x
    const startY = e.clientY - note.y
    function onMove(e) {
      onUpdate({ x: e.clientX - startX, y: e.clientY - startY, inPanel: false })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  // ── リサイズ ──
  function onMouseDownResize(e) {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const startW = note.width, startH = note.height
    function onMove(e) {
      onUpdate({ width: Math.max(120, startW + e.clientX - startX), height: Math.max(80, startH + e.clientY - startY) })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      ref={noteRef}
      className="sn-note"
      style={{
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.height,
        background: note.color,
        zIndex: note.inPanel ? 1001 : 1002,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={onMouseDownDrag}
      onDoubleClick={() => { setEditing(true); setTimeout(() => textRef.current?.focus(), 0) }}
    >
      {/* ツールバー: ホバー時のみ表示 */}
      <div className={`sn-toolbar${hovered ? ' sn-toolbar-visible' : ''}`} onMouseDown={e => e.stopPropagation()}>
        <div className="sn-colors">
          {COLORS.map(c => (
            <button key={c} className="sn-color-btn" style={{ background: c, outline: c === note.color ? '2px solid #333' : 'none' }}
              onClick={() => onUpdate({ color: c })} />
          ))}
        </div>
        <div className="sn-actions">
          <button className="sn-btn" title="フォント-" onClick={() => onUpdate({ fontSize: Math.max(10, note.fontSize - 2) })}>A-</button>
          <button className="sn-btn" title="フォント+" onClick={() => onUpdate({ fontSize: Math.min(32, note.fontSize + 2) })}>A+</button>
          <button className="sn-btn" title="複製" onClick={onDuplicate}>⧉</button>
          <button className="sn-btn sn-btn-del" title="削除" onClick={onDelete}>×</button>
        </div>
      </div>

      {/* テキストエリア */}
      {editing ? (
        <textarea
          ref={textRef}
          className="sn-textarea"
          value={note.text}
          onChange={e => onUpdate({ text: e.target.value })}
          onBlur={() => setEditing(false)}
          style={{ fontSize: note.fontSize, textAlign: 'center' }}
        />
      ) : (
        <div className="sn-text" style={{ fontSize: note.fontSize }}>
          {note.text || <span className="sn-placeholder">ダブルクリックで編集</span>}
        </div>
      )}

      {/* リサイズハンドル */}
      <div className="sn-resize" onMouseDown={onMouseDownResize} />
    </div>
  )
}

// ── パネル ────────────────────────────────────────────
export default function StickyNotes() {
  const [notes, setNotes] = useState(() => {
    const saved = loadNotes()
    if (saved.length === 0) {
      return Array.from({ length: 5 }, (_, i) => newNote(true, i))
    }
    return saved
  })
  const [panelOpen, setPanelOpen] = useState(true)

  const panelWidth = 190
  const panelStartY = 60
  const noteGap = 10
  const noteH = 120

  useEffect(() => { saveNotes(notes) }, [notes])

  const update = useCallback((id, patch) => {
    setNotes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n))
  }, [])
  const remove = useCallback((id) => {
    setNotes(ns => ns.filter(n => n.id !== id))
  }, [])
  const duplicate = useCallback((id) => {
    setNotes(ns => {
      const src = ns.find(n => n.id === id)
      if (!src) return ns
      return [...ns, { ...src, id: crypto.randomUUID(), x: src.x + 20, y: src.y + 20, inPanel: src.inPanel }]
    })
  }, [])
  function addNote() {
    const idx = notes.filter(n => n.inPanel).length
    setNotes(ns => [...ns, newNote(true, idx)])
  }

  const panelNotes = notes.filter(n => n.inPanel)
  const freeNotes = notes.filter(n => !n.inPanel)

  return (
    <>
      {/* パネルタブ */}
      <button className="sn-panel-tab" style={{ right: panelOpen ? panelWidth - 6 : 0 }}
        onClick={() => setPanelOpen(o => !o)} title={panelOpen ? 'パネルを閉じる' : 'パネルを開く'}>
        {panelOpen ? '▶' : '◀'}
      </button>

      {/* パネル背景 */}
      {panelOpen && (
        <div className="sn-panel" style={{ width: panelWidth }}>
          <div className="sn-panel-header">
            <span>付箋ストック</span>
            <button className="sn-btn" onClick={addNote} title="新しい付箋を追加">＋</button>
          </div>
        </div>
      )}

      {/* パネル内付箋 */}
      {panelOpen && panelNotes.map((note, i) => {
        const x = window.innerWidth - panelWidth + 5
        const y = panelStartY + 36 + i * (noteH + noteGap)
        return (
          <StickyNote
            key={note.id}
            note={{ ...note, x, y, width: panelWidth - 10, height: noteH }}
            onUpdate={patch => update(note.id, patch)}
            onDelete={() => remove(note.id)}
            onDuplicate={() => duplicate(note.id)}
          />
        )
      })}

      {/* フリー付箋 */}
      {freeNotes.map(note => (
        <StickyNote
          key={note.id}
          note={note}
          onUpdate={patch => update(note.id, patch)}
          onDelete={() => remove(note.id)}
          onDuplicate={() => duplicate(note.id)}
        />
      ))}
    </>
  )
}
