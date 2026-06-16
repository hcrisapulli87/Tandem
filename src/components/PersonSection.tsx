import type { Item, Profile } from '../data/types'
import type { DayStat } from '../data/summary'
import { ChecklistItem } from './ChecklistItem'
import { StreakBadge } from './StreakBadge'

export interface Row {
  item: Item
  done: boolean
}

interface Props {
  profile: Profile
  isSelf: boolean
  rows: Row[]
  doneCount: number
  streak: number
  week: DayStat[]
  onToggle: (item: Item, done: boolean) => void
}

export function PersonSection({
  profile,
  isSelf,
  rows,
  doneCount,
  streak,
  week,
  onToggle,
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
        {rows.map(({ item, done }) => (
          <li key={item.id}>
            <ChecklistItem
              title={item.title}
              kind={item.kind}
              done={done}
              interactive={isSelf}
              onToggle={(d) => onToggle(item, d)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
