import { useState, useRef, useMemo } from 'react'
import { FormatToolbar, lineStyle } from './formatToolbar'

// 諸連絡・配付物などの自由記入欄を「書式付きの行リスト」として編集する。
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

export default function NoteLines({ content, onChange, placeholder = '' }) {
  const lines = useMemo(() => parseContent(content), [content])
  const [focusIdx, setFocusIdx] = useState(-1)
  const inputRefs = useRef([])

  function commit(next) {
    onChange(JSON.stringify(next))
  }
  function setText(i, text) {
    commit(lines.map((l, idx) => idx === i ? { ...l, text } : l))
  }
  function patchFormat(i, patch) {
    commit(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }
  function addAfter(i) {
    const next = [...lines]
    next.splice(i + 1, 0, { text: '', size: lines[i]?.size, color: lines[i]?.color })
    commit(next)
    setTimeout(() => inputRefs.current[i + 1]?.focus(), 30)
  }
  function remove(i) {
    const next = lines.filter((_, idx) => idx !== i)
    commit(next.length ? next : [{ text: '' }])
    setTimeout(() => inputRefs.current[Math.max(0, i - 1)]?.focus(), 30)
  }
  function handleKeyDown(e, i) {
    if (e.key === 'Enter') { e.preventDefault(); addAfter(i) }
    if (e.key === 'Backspace' && lines[i].text === '' && lines.length > 1) {
      e.preventDefault(); remove(i)
    }
  }

  return (
    <div className="notelines-body">
      {lines.map((line, i) => (
        <div key={i} className="notelines-row">
          <input
            ref={el => { inputRefs.current[i] = el }}
            className="notelines-input"
            style={lineStyle(line)}
            value={line.text}
            placeholder={i === 0 ? placeholder : ''}
            onChange={e => setText(i, e.target.value)}
            onKeyDown={e => handleKeyDown(e, i)}
            onFocus={() => setFocusIdx(i)}
            onBlur={() => setTimeout(() => setFocusIdx(f => (f === i ? -1 : f)), 150)}
          />
          {focusIdx === i && (
            <div className="notelines-tools">
              <FormatToolbar item={line} onChange={patch => patchFormat(i, patch)} />
              <button className="fmt-btn" title="下に改行を追加" onMouseDown={e => e.preventDefault()} onClick={() => addAfter(i)}>↵</button>
              <button className="fmt-btn fmt-del" title="この行を削除" onMouseDown={e => e.preventDefault()} onClick={() => remove(i)}>✕</button>
            </div>
          )}
        </div>
      ))}
      <button className="notelines-add" title="改行（行を追加）" onMouseDown={e => e.preventDefault()} onClick={() => addAfter(lines.length - 1)}>＋ 改行</button>
    </div>
  )
}
