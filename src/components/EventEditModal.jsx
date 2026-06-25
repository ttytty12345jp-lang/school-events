import { useState, useEffect } from 'react'
import { DAYS_JA } from '../utils/date'

const CATEGORIES = ['学校行事', '教職員関係行事', 'その他']

function emptyEvent() {
  return { _key: Math.random(), id: null, title: '', start_time: '', end_time: '', note: '', category: '学校行事' }
}

export default function EventEditModal({ date, events, onClose, onAdd, onUpdate, onDelete, addToast }) {
  const d = new Date(date)
  const label = `${d.getMonth() + 1}月${d.getDate()}日（${DAYS_JA[d.getDay()]}）`

  const [rows, setRows] = useState(() =>
    events.length > 0
      ? events.map(e => ({ ...e, _key: e.id, category: e.category || '学校行事' }))
      : [emptyEvent()]
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRows(events.length > 0
      ? events.map(e => ({ ...e, _key: e.id, category: e.category || '学校行事' }))
      : [emptyEvent()])
  }, [date])

  function setField(key, field, value) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r))
  }

  async function handleSave() {
    setSaving(true)
    try {
      for (const row of rows) {
        if (!row.title.trim()) continue
        const payload = {
          title: row.title,
          start_time: row.start_time || null,
          end_time: row.end_time || null,
          note: row.note || null,
          category: row.category || '学校行事',
        }
        if (row.id) {
          await onUpdate(row.id, payload)
        } else {
          await onAdd({ date, ...payload })
        }
      }
      const keptIds = new Set(rows.filter(r => r.id).map(r => r.id))
      for (const ev of events) {
        if (!keptIds.has(ev.id)) await onDelete(ev.id)
      }
      addToast('保存しました', 'success')
      onClose()
    } catch {
      addToast('保存に失敗しました', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>{label} の行事</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="event-list">
            {rows.map(row => (
              <div key={row._key} className="event-item">
                <div className="event-item-row">
                  <label>種別</label>
                  <select value={row.category} onChange={e => setField(row._key, 'category', e.target.value)} style={{ flex: 1 }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button
                    className="btn-danger"
                    style={{ padding: '4px 8px', fontSize: '12px' }}
                    onClick={() => setRows(prev => prev.filter(r => r._key !== row._key))}
                  >削除</button>
                </div>
                <div className="event-item-row">
                  <label>行事名</label>
                  <input
                    type="text"
                    placeholder="行事名（必須）"
                    value={row.title}
                    onChange={e => setField(row._key, 'title', e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
                <div className="event-item-row">
                  <label>開始</label>
                  <input type="time" value={row.start_time || ''} onChange={e => setField(row._key, 'start_time', e.target.value)} />
                  <label>終了</label>
                  <input type="time" value={row.end_time || ''} onChange={e => setField(row._key, 'end_time', e.target.value)} />
                </div>
                <div className="event-item-row">
                  <label>備考</label>
                  <input type="text" placeholder="備考（任意）" value={row.note || ''} onChange={e => setField(row._key, 'note', e.target.value)} style={{ flex: 1 }} />
                </div>
              </div>
            ))}
            <button className="add-event-btn" onClick={() => setRows(prev => [...prev, emptyEvent()])}>
              ＋ 行事を追加
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>キャンセル</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
