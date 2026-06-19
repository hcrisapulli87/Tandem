import type { Item, Profile } from '../data/types'
import type { DayStat } from '../data/summary'
import { ChecklistItem } from './ChecklistItem'
import { StreakBadge } from './StreakBadge'

export interface Row {
  item: Item
  done: boolean
  note: string | null
}

interface Props {
  profile: Profile
  isSelf: boolean
  rows: Row[]
  doneCount: number
  streak: number
  week: DayStat[]
  onToggle: (item: Item, done: boolean) => void
  onSaveNote: (item: Item, note: string) => void
}

export function PersonSection({
  profile,
  isSelf,
  rows,
  doneCount,
  streak,
  week,
  onToggle,
  onSaveNote,
}: Props) {
  return (
    <section className="person card">
      <header className="person__header">
        <h2 className="person__name">
          {profile.display_name}
          {isSelf && <span className="tag tag--you">you</span>}
        </h2>
        <span className="person__progress">
          {doneCount}/{rows.length}
        </span>
      </header>

      <StreakBadge streak={streak} week={week} />

      <ul className="check-list">
        {rows.length === 0 && <li className="muted check-empty">No items yet.</li>}
        {rows.map(({ item, done, note }) => (
          <li key={item.id}>
            <ChecklistItem
              title={item.title}
              kind={item.kind}
              done={done}
              note={note}
              interactive={isSelf}
              onToggle={(d) => onToggle(item, d)}
              onSaveNote={isSelf ? (n) => onSaveNote(item, n) : undefined}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
