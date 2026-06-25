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
  return { id: crypto.randomUUID(), type: 'link', label: 'Google Drive', url: 'https://drive.google.com', x: 200, y: 200, inPanel }
}
function newTable(inPanel = true) {
  return { id: crypto.randomUUID(), type: 'table', cells: [['','',''],['','',''],['','','']], x: 200, y: 200, width: 240, height: 120, inPanel }
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
        {!inPanel && <button className="sn-btn" title="パネルにしまう" onClick={onStore}>◀</button>}
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
function faviconUrl(url) {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64` } catch { return '' }
}

function LinkItem({ note, onUpdate, onDelete, onDuplicate, onDrag }) {
  const [hovered, setHovered] = useState(false)
  const [editingLabel, setEditingLabel] = useState(false)
  const [editingUrl, setEditingUrl] = useState(false)
  const [label, setLabel] = useState(note.label)
  const [url, setUrl] = useState(note.url)

  const iconSrc = faviconUrl(note.url)

  return (
    <div className="sn-icon-item" style={{ left: note.x, top: note.y, zIndex: note.inPanel ? 1001 : 1002 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onMouseDown={e => { if (!e.target.closest('.sn-icon-toolbar') && !e.target.closest('.sn-link-edit')) onDrag(e, note) }}>

      {/* ホバー時ミニツールバー */}
      <div className={`sn-icon-toolbar${hovered ? ' sn-icon-toolbar-visible' : ''}`}>
        {!note.inPanel && <button className="sn-btn" title="しまう" onClick={() => onUpdate(note.id, { inPanel: true })}>◀</button>}
        <button className="sn-btn" title="URL編集" onClick={() => setEditingUrl(true)}>✎</button>
        <button className="sn-btn sn-btn-del" title="削除" onClick={onDelete}>×</button>
      </div>

      {/* アイコン本体 */}
      <a className="sn-icon-link" href={note.url} target="_blank" rel="noreferrer"
        onMouseDown={e => e.stopPropagation()}>
        <img className="sn-icon-img" src={iconSrc} alt={note.label} onError={e => { e.target.src = ''; e.target.style.background = '#e2e8f0' }} />
      </a>

      {/* ラベル（ダブルクリックで編集） */}
      {editingLabel
        ? <input className="sn-icon-label-edit" autoFocus value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={() => { onUpdate(note.id, { label }); setEditingLabel(false) }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
            onMouseDown={e => e.stopPropagation()} />
        : <div className="sn-icon-label" onDoubleClick={() => setEditingLabel(true)}>{note.label}</div>}

      {/* URL編集ポップアップ */}
      {editingUrl && (
        <input className="sn-icon-url-edit" autoFocus value={url}
          onChange={e => setUrl(e.target.value)}
          onBlur={() => { onUpdate(note.id, { url }); setEditingUrl(false) }}
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
      onMouseDown={e => { if (!e.target.closest('.sn-resize') && !e.target.closest('.sn-toolbar') && !e.target.closest('table') && !e.target.closest('.sn-table-ctrl')) onDrag(e, note) }}>
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
