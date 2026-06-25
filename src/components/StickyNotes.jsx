import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'sticky_notes'
const COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa', '#ffffff']

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function save(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) }

function newNote(inPanel = true) {
  return { id: crypto.randomUUID(), type: 'note', text: '', x: 200, y: 200, width: 180, height: 140, color: COLORS[0], fontSize: 14, inPanel }
}
function newLink(inPanel = true) {
  return { id: crypto.randomUUID(), type: 'link', label: 'Google Drive', url: 'https://drive.google.com', x: 200, y: 200, width: 24, inPanel }
}
function newTable(inPanel = true) {
  const cols = 4, rows = 4
  return { id: crypto.randomUUID(), type: 'table', cells: Array.from({length: rows}, () => Array(cols).fill('')), x: 200, y: 200, width: 320, height: 160, inPanel }
}

// ── ドラッグ＆リサイズ共通フック ──────────────────────────
function useDrag(onUpdate) {
  return useCallback((e, note) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX - note.x, sy = e.clientY - note.y
    const onMove = e => onUpdate(note.id, { x: e.clientX - sx, y: e.clientY - sy, inPanel: false })
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [onUpdate])
}
function useResize(onUpdate) {
  return useCallback((e, note) => {
    e.preventDefault(); e.stopPropagation()
    const sx = e.clientX, sy = e.clientY, sw = note.width, sh = note.height
    const onMove = e => onUpdate(note.id, { width: Math.max(120, sw + e.clientX - sx), height: Math.max(60, sh + e.clientY - sy) })
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }, [onUpdate])
}

// ── 共通ツールバー ─────────────────────────────────────────
function ItemToolbar({ hovered, inPanel, onStore, onDelete, onDuplicate, extra }) {
  return (
    <div className={`sn-toolbar${hovered ? ' sn-toolbar-visible' : ''}`} onMouseDown={e => e.stopPropagation()}>
      {extra}
      <div className="sn-actions">
        {!inPanel && <button className="sn-btn" title="パネルにしまう" onClick={onStore}>▶</button>}
        <button className="sn-btn" title="複製" onClick={onDuplicate}>⧉</button>
        <button className="sn-btn sn-btn-del" title="削除" onClick={onDelete}>×</button>
      </div>
    </div>
  )
}

// ── 付箋アイテム ───────────────────────────────────────────
function NoteItem({ note, onUpdate, onDelete, onDuplicate, onDrag, onResize }) {
  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const textRef = useRef(null)

  return (
    <div className="sn-note" style={{ left: note.x, top: note.y, width: note.width, height: note.height, background: note.color, zIndex: note.inPanel ? 1001 : 1002 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onMouseDown={e => { if (!e.target.closest('.sn-resize') && !e.target.closest('.sn-toolbar')) onDrag(e, note) }}
      onDoubleClick={() => { setEditing(true); setTimeout(() => textRef.current?.focus(), 0) }}>
      <ItemToolbar hovered={hovered} inPanel={note.inPanel} onStore={() => onUpdate(note.id, { inPanel: true })} onDelete={onDelete} onDuplicate={onDuplicate}
        extra={
          <div className="sn-colors">
            {COLORS.map(c => <button key={c} className="sn-color-btn" style={{ background: c, outline: c === note.color ? '2px solid #333' : 'none' }} onClick={() => onUpdate(note.id, { color: c })} />)}
            <button className="sn-btn" title="A-" onClick={() => onUpdate(note.id, { fontSize: Math.max(10, note.fontSize - 2) })}>A-</button>
            <button className="sn-btn" title="A+" onClick={() => onUpdate(note.id, { fontSize: Math.min(32, note.fontSize + 2) })}>A+</button>
          </div>
        } />
      {editing
        ? <textarea ref={textRef} className="sn-textarea" value={note.text} onChange={e => onUpdate(note.id, { text: e.target.value })} onBlur={() => setEditing(false)} style={{ fontSize: note.fontSize, textAlign: 'center' }} />
        : <div className="sn-text" style={{ fontSize: note.fontSize }}>{note.text || <span className="sn-placeholder">ダブルクリックで編集</span>}</div>}
      <div className="sn-resize" onMouseDown={e => onResize(e, note)} />
    </div>
  )
}

// ── リンクアイコン ─────────────────────────────────────────
function DriveIcon({ size }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 87.3 78" width={size} height={size} style={{ display: 'block' }}>
      <path fill="#0066da" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z"/>
      <path fill="#00ac47" d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 47.5C.4 48.9 0 50.45 0 52h27.5z"/>
      <path fill="#ea4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.55z"/>
      <path fill="#00832d" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"/>
      <path fill="#2684fc" d="M59.8 52H27.5L13.75 75.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"/>
      <path fill="#ffba00" d="M43.65 25l16.15 27H87.3c0-1.55-.4-3.1-1.2-4.5L60.75 4.7c-1.35-.8-2.9-1.2-4.5-1.2h-.85z"/>
    </svg>
  )
}

function FaviconIcon({ url, size }) {
  try {
    const host = new URL(url).hostname
    return <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" width={size} height={size} style={{ display: 'block', objectFit: 'contain' }} />
  } catch { return null }
}

const TOOLBAR_H = 28

function LinkItem({ note, onUpdate, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const [editingUrl, setEditingUrl] = useState(false)
  const [urlDraft, setUrlDraft] = useState(note.url)
  const draggedRef = useRef(false)
  const sz = note.width || 72
  const isDrive = note.url.includes('drive.google')

  // ドラッグ：ツールバー含む外枠全体で受付、ツールバーボタンクリックは除外
  function handleMouseDown(e) {
    if (e.button !== 0) return
    if (e.target.closest('button') || e.target.closest('input')) return
    e.preventDefault()
    draggedRef.current = false
    // note.y はアイコン上端。外枠はアイコン上端 - TOOLBAR_H
    const outerTop = (note.y || 0) - TOOLBAR_H
    const sx = e.clientX - (note.x || 0), sy = e.clientY - outerTop
    function onMove(ev) {
      draggedRef.current = true
      const newOuterTop = ev.clientY - sy
      onUpdate(note.id, { x: ev.clientX - sx, y: newOuterTop + TOOLBAR_H, inPanel: false })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function handleResizeDown(e) {
    e.stopPropagation(); e.preventDefault()
    const startSz = note.width || 72, startX = e.clientX
    function onMove(ev) {
      onUpdate(note.id, { width: Math.max(40, Math.min(200, startSz + ev.clientX - startX)) })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  function handleIconClick() {
    if (!draggedRef.current) window.open(note.url, '_blank', 'noreferrer')
  }

  // 外枠：ツールバー(TOOLBAR_H) + アイコン(sz) を1つのdivで囲み当たり判定を統一
  return (
    <div className="sn-icon-wrap"
      style={{ left: note.x, top: (note.y || 0) - TOOLBAR_H, width: sz, height: sz + TOOLBAR_H, zIndex: note.inPanel ? 1001 : 1002 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onMouseDown={handleMouseDown}>

      {/* ツールバー（常にスペース確保、ホバー時のみ表示） */}
      <div className="sn-icon-toolbar" style={{ opacity: hovered ? 1 : 0, pointerEvents: hovered ? 'all' : 'none' }}>
        {!note.inPanel && <button className="sn-btn" onClick={() => onUpdate(note.id, { inPanel: true })}>▶</button>}
        <button className="sn-btn" onClick={() => { setUrlDraft(note.url); setEditingUrl(true) }}>✎</button>
        <button className="sn-btn sn-btn-del" onClick={onDelete}>×</button>
      </div>

      {/* アイコン本体 */}
      <div className="sn-icon-body" style={{ width: sz, height: sz, borderRadius: sz * 0.15 }} onClick={handleIconClick}>
        {isDrive ? <DriveIcon size={sz} /> : <FaviconIcon url={note.url} size={sz} />}
      </div>

      {/* リサイズハンドル */}
      {hovered && <div className="sn-icon-resize" onMouseDown={handleResizeDown} />}

      {/* URL編集 */}
      {editingUrl && (
        <input className="sn-icon-url-edit" autoFocus value={urlDraft}
          onChange={e => setUrlDraft(e.target.value)}
          onBlur={() => { onUpdate(note.id, { url: urlDraft }); setEditingUrl(false) }}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          onMouseDown={e => e.stopPropagation()} />
      )}
    </div>
  )
}

// ── 表アイテム ─────────────────────────────────────────────
function TableItem({ note, onUpdate, onDelete, onDuplicate, onDrag, onResize }) {
  const [hovered, setHovered] = useState(false)
  const cells = note.cells

  function setCell(r, c, val) {
    const next = cells.map((row, ri) => row.map((cell, ci) => ri === r && ci === c ? val : cell))
    onUpdate(note.id, { cells: next })
  }
  function addRow() { onUpdate(note.id, { cells: [...cells, Array(cells[0].length).fill('')] }) }
  function addCol() { onUpdate(note.id, { cells: cells.map(row => [...row, '']) }) }
  function delRow() { if (cells.length > 1) onUpdate(note.id, { cells: cells.slice(0, -1) }) }
  function delCol() { if (cells[0].length > 1) onUpdate(note.id, { cells: cells.map(row => row.slice(0, -1)) }) }

  return (
    <div className="sn-note sn-table-item" style={{ left: note.x, top: note.y, width: note.width, height: note.height, background: '#fff', zIndex: note.inPanel ? 1001 : 1002 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onMouseDown={e => { if (!e.target.closest('.sn-resize') && !e.target.closest('.sn-toolbar') && !e.target.closest('input') && !e.target.closest('.sn-table-ctrl')) onDrag(e, note) }}>
      <ItemToolbar hovered={hovered} inPanel={note.inPanel} onStore={() => onUpdate(note.id, { inPanel: true })} onDelete={onDelete} onDuplicate={onDuplicate}
        extra={hovered ? (
          <div className="sn-table-ctrl">
            <button className="sn-btn" onClick={addRow} title="行追加">+行</button>
            <button className="sn-btn" onClick={addCol} title="列追加">+列</button>
            <button className="sn-btn" onClick={delRow} title="行削除">-行</button>
            <button className="sn-btn" onClick={delCol} title="列削除">-列</button>
          </div>
        ) : null} />
      <div className="sn-table-wrap">
        <table className="sn-table">
          <tbody>
            {cells.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input className="sn-table-cell" value={cell} onChange={e => setCell(r, c, e.target.value)}
                      onMouseDown={e => e.stopPropagation()} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sn-resize" onMouseDown={e => onResize(e, note)} />
    </div>
  )
}

// ── アイテムディスパッチャ ─────────────────────────────────
function AnyItem(props) {
  if (props.note.type === 'link') return <LinkItem {...props} />
  if (props.note.type === 'table') return <TableItem {...props} />
  return <NoteItem {...props} />
}

// ── パネル ────────────────────────────────────────────────
export default function StickyNotes() {
  const [items, setItems] = useState(() => {
    const saved = load()
    return saved.length > 0 ? saved : Array.from({ length: 3 }, (_, i) => ({ ...newNote(true), color: COLORS[i] }))
  })
  const [panelOpen, setPanelOpen] = useState(false)

  const panelWidth = 210
  const headerH = 72   // panel header height
  const itemH = 110
  const itemGap = 8

  useEffect(() => { save(items) }, [items])

  const update = useCallback((id, patch) => setItems(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n)), [])
  const remove = useCallback((id) => setItems(ns => ns.filter(n => n.id !== id)), [])
  const duplicate = useCallback((id) => setItems(ns => {
    const src = ns.find(n => n.id === id); if (!src) return ns
    return [...ns, { ...src, id: crypto.randomUUID(), x: src.x + 20, y: src.y + 20, inPanel: false }]
  }), [])

  const onDrag = useDrag(update)
  const onResize = useResize(update)

  const panelItems = items.filter(n => n.inPanel)
  const freeItems = items.filter(n => !n.inPanel)

  return (
    <>
      {/* タブボタン */}
      <button className="sn-panel-tab" style={{ right: panelOpen ? panelWidth - 6 : 0 }}
        onClick={() => setPanelOpen(o => !o)} title={panelOpen ? 'パネルを閉じる' : 'パネルを開く'}>
        {panelOpen ? '▶' : '◀'}
      </button>

      {/* パネル背景 */}
      {panelOpen && (
        <div className="sn-panel" style={{ width: panelWidth }}>
          <div className="sn-panel-header">
            <span className="sn-panel-title">ストック</span>
            <div className="sn-panel-add-btns">
              <button className="sn-btn" title="付箋を追加" onClick={() => setItems(ns => [...ns, newNote(true)])}>付箋</button>
              <button className="sn-btn" title="リンクを追加" onClick={() => setItems(ns => [...ns, newLink(true)])}>リンク</button>
              <button className="sn-btn" title="表を追加" onClick={() => setItems(ns => [...ns, newTable(true)])}>表</button>
            </div>
          </div>
        </div>
      )}

      {/* パネル内アイテム */}
      {panelOpen && (() => {
        let yOffset = headerH
        return panelItems.map((item) => {
          const x = window.innerWidth - panelWidth + 5
          const y = yOffset
          const isLink = item.type === 'link'
          const h = isLink ? 80 : itemH
          yOffset += h + itemGap
          const positioned = isLink
            ? { ...item, x, y }
            : { ...item, x, y, width: panelWidth - 10, height: h }
          return (
            <AnyItem key={item.id}
              note={positioned}
              onUpdate={update} onDelete={() => remove(item.id)} onDuplicate={() => duplicate(item.id)}
              onDrag={onDrag} onResize={onResize} />
          )
        })
      })()}

      {/* フリーアイテム */}
      {freeItems.map(item => (
        <AnyItem key={item.id} note={item}
          onUpdate={update} onDelete={() => remove(item.id)} onDuplicate={() => duplicate(item.id)}
          onDrag={onDrag} onResize={onResize} />
      ))}
    </>
  )
}
