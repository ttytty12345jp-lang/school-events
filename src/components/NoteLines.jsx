import { useState, useRef, useMemo, useEffect } from 'react'
import { FormatToolbar, lineStyle } from './formatToolbar'

// 諸連絡・配付物などの自由記入欄を「書式付きの行リスト」として編集する。
// 各行は textarea で、欄内で Enter を押すと普通に改行できる（スマホの改行キーも有効）。
// 保存形式は JSON 配列 [{ text, size, color, strike }]。
// 旧データ（プレーン文字列）は改行で分割して取り込む（後方互換）。

function parseContent(content) {
  if (!content) return [{ text: '' }]
  try {
    const arr = JSON.parse(content)
    if (Array.isArray(arr)) return arr.length ? arr : [{ text: '' }]
  } catch { /* 旧形式（プレーン文字列） */ }
  return content.split('\n').map(t => ({ text: t }))
}

function autoGrow(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = el.scrollHeight + 'px'
}

export default function NoteLines({ content, onChange, placeholder = '' }) {
  const lines = useMemo(() => parseContent(content), [content])
  const [focusIdx, setFocusIdx] = useState(-1)
  const inputRefs = useRef([])

  // 内容が変わったら各 textarea の高さを内容に合わせる
  useEffect(() => { inputRefs.current.forEach(autoGrow) }, [lines])

  function commit(next) {
    onChange(JSON.stringify(next))
  }
  function setText(i, text) {
    commit(lines.map((l, idx) => idx === i ? { ...l, text } : l))
  }
  function patchFormat(i, patch) {
    commit(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }
  function addBlock() {
    commit([...lines, { text: '', size: lines[lines.length - 1]?.size, color: lines[lines.length - 1]?.color }])
    setTimeout(() => inputRefs.current[lines.length]?.focus(), 30)
  }
  function remove(i) {
    const next = lines.filter((_, idx) => idx !== i)
    commit(next.length ? next : [{ text: '' }])
    setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 30)
  }
  // Enter で改行文字を入れるのではなく「別ブロック」に分割する（行ごとに文字サイズ等を変えたいため）。
  // カーソル位置で前後にテキストを分け、後半を新ブロックとして次の位置に挿入する。
  function splitAtCursor(i, el) {
    const pos = el.selectionStart
    const before = el.value.slice(0, pos)
    const after = el.value.slice(pos)
    const cur = lines[i]
    const next = [...lines]
    next[i] = { ...cur, text: before }
    next.splice(i + 1, 0, { text: after, size: cur.size, color: cur.color })
    commit(next)
    setTimeout(() => {
      const el2 = inputRefs.current[i + 1]
      el2?.focus()
      el2?.setSelectionRange(0, 0)
    }, 30)
  }

  return (
    <div className="notelines-body">
      {lines.map((line, i) => (
        <div key={i} className="notelines-row">
          <textarea
            ref={el => { inputRefs.current[i] = el }}
            className="notelines-input"
            style={lineStyle(line)}
            rows={1}
            value={line.text}
            placeholder={i === 0 ? placeholder : ''}
            onChange={e => { setText(i, e.target.value); autoGrow(e.target) }}
            onFocus={e => { setFocusIdx(i); autoGrow(e.target) }}
            onBlur={() => setTimeout(() => setFocusIdx(f => (f === i ? -1 : f)), 150)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); splitAtCursor(i, e.target) }
            }}
          />
          {focusIdx === i && lines.length > 1 && (
            <div className="notelines-tools">
              <FormatToolbar item={line} onChange={patch => patchFormat(i, patch)} />
              <button className="fmt-btn fmt-del" title="このブロックを削除" onMouseDown={e => e.preventDefault()} onClick={() => remove(i)}>✕</button>
            </div>
          )}
          {focusIdx === i && lines.length === 1 && (
            <div className="notelines-tools">
              <FormatToolbar item={line} onChange={patch => patchFormat(i, patch)} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
