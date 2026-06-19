import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import type { Item } from '../data/types'

export default function MyList() {
  const { user } = useAuth()
  const { items, addItem, renameItem, removeItem, reorderItems } = useData()

  // My own items plus every together item (either person manages those).
  const myItems = useMemo(
    () =>
      items
        .filter((i) => i.owner_id === user?.id || i.shared)
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
        ),
    [items, user?.id],
  )

  type NewType = 'daily' | 'oneoff' | 'together'

  const [title, setTitle] = useState('')
  const [type, setType] = useState<NewType>('daily')
  const [busy, setBusy] = useState(false)

  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      const nextSort = myItems.length
        ? Math.max(...myItems.map((i) => i.sort_order)) + 1
        : 0
      await addItem({
        title: trimmed,
        kind: type === 'oneoff' ? 'oneoff' : 'daily',
        shared: type === 'together',
        sortOrder: nextSort,
      })
      setTitle('')
      setType('daily')
    } finally {
      setBusy(false)
    }
  }

  // Swap sort_order with the neighbour in the chosen direction.
  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= myItems.length) return
    const a = myItems[index]
    const b = myItems[target]
    await reorderItems([
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ])
  }

  return (
    <div className="mylist">
      <h1 className="page-title">My list</h1>

      <form className="add-form card" onSubmit={onAdd}>
        <input
          className="input"
          placeholder="Add an item (e.g. Workout)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <div className="add-form__row">
          <select
            className="input select"
            value={type}
            onChange={(e) => setType(e.target.value as NewType)}
          >
            <option value="daily">Daily (just me)</option>
            <option value="oneoff">One-off (just me)</option>
            <option value="together">Together (both of us)</option>
          </select>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            Add
          </button>
        </div>
      </form>

      <ul className="manage-list">
        {myItems.length === 0 && (
          <li className="muted">No items yet — add your first above.</li>
        )}
        {myItems.map((item, index) => (
          <ManageRow
            key={item.id}
            item={item}
            isFirst={index === 0}
            isLast={index === myItems.length - 1}
            onRename={(t) => renameItem(item.id, t)}
            onDelete={() => removeItem(item.id)}
            onMoveUp={() => move(index, -1)}
            onMoveDown={() => move(index, 1)}
          />
        ))}
      </ul>
    </div>
  )
}

interface ManageRowProps {
  item: Item
  isFirst: boolean
  isLast: boolean
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
  onMoveUp: () => Promise<void>
  onMoveDown: () => Promise<void>
}

function ManageRow({
  item,
  isFirst,
  isLast,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ManageRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.title)

  const save = async () => {
    const t = draft.trim()
    if (t && t !== item.title) await onRename(t)
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="manage-row card">
        <div className="manage-row__edit">
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoFocus
          />
          <button className="btn btn--primary btn--sm" onClick={() => void save()}>
            Save
          </button>
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setDraft(item.title)
              setEditing(false)
            }}
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="manage-row card">
      <span className="manage-row__title">{item.title}</span>
      <span className={'tag' + (item.shared ? ' tag--together' : '')}>
        {item.shared ? 'together' : item.kind === 'daily' ? 'daily' : 'one-off'}
      </span>
      <div className="manage-row__actions">
        <button className="iconbtn" title="Move up" disabled={isFirst} onClick={() => void onMoveUp()}>
          ↑
        </button>
        <button className="iconbtn" title="Move down" disabled={isLast} onClick={() => void onMoveDown()}>
          ↓
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button
          className="btn btn--ghost btn--sm btn--danger"
          onClick={() => {
            if (window.confirm(`Delete "${item.title}"?`)) void onDelete()
          }}
        >
          Delete
        </button>
      </div>
    </li>
  )
}
