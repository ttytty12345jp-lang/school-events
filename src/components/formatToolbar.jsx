// 行ごとの書式（大きさ・色・取り消し線）の共通モデルとツールバー。
// 朝会記録簿の「行事予定」「諸連絡」「配付物」で共有する。

export const TEXT_SIZES = [16, 20, 24, 28, 32, 38] // px
export const DEFAULT_SIZE = 28
export const TEXT_COLORS = ['#1e293b', '#dc2626', '#2563eb', '#16a34a', '#ea580c']

// 1行ぶんのインラインスタイル
export function lineStyle(item) {
  return {
    fontSize: (item.size || DEFAULT_SIZE) + 'px',
    color: item.color || TEXT_COLORS[0],
    textDecoration: item.strike ? 'line-through' : 'none',
  }
}

function stepSize(cur, dir) {
  const base = cur || DEFAULT_SIZE
  // 現在値に最も近いインデックスを基準に増減
  let idx = TEXT_SIZES.reduce((best, s, i) =>
    Math.abs(s - base) < Math.abs(TEXT_SIZES[best] - base) ? i : best, 0)
  idx = Math.max(0, Math.min(TEXT_SIZES.length - 1, idx + dir))
  return TEXT_SIZES[idx]
}

// item: { size, color, strike }、onChange(patch) で部分更新
export function FormatToolbar({ item, onChange }) {
  return (
    <div className="fmt-toolbar" onMouseDown={e => e.preventDefault()}>
      <button className="fmt-btn" title="小さく" onClick={() => onChange({ size: stepSize(item.size, -1) })}>A−</button>
      <button className="fmt-btn" title="大きく" onClick={() => onChange({ size: stepSize(item.size, +1) })}>A＋</button>
      <span className="fmt-sep" />
      {TEXT_COLORS.map(c => (
        <button key={c} className={`fmt-color${(item.color || TEXT_COLORS[0]) === c ? ' sel' : ''}`}
          style={{ background: c }} title="色" onClick={() => onChange({ color: c })} />
      ))}
      <span className="fmt-sep" />
      <button className={`fmt-btn${item.strike ? ' sel' : ''}`} title="取り消し線"
        onClick={() => onChange({ strike: !item.strike })} style={{ textDecoration: 'line-through' }}>S</button>
    </div>
  )
}
