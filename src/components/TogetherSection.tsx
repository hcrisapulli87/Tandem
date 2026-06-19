import type { Item, Profile } from '../data/types'
import type { DayStat } from '../data/summary'
import { StreakBadge } from './StreakBadge'
import { CompletionNote } from './CompletionNote'

export interface Signoff {
  profile: Profile
  isSelf: boolean
  done: boolean
  note: string | null
}

export interface TogetherRow {
  item: Item
  signoffs: Signoff[]
}

interface Props {
  rows: TogetherRow[]
  doneCount: number
  streak: number
  week: DayStat[]
  onToggle: (item: Item, done: boolean) => void
  onSaveNote: (item: Item, note: string) => void
}

// The shared section: each together check shows both people's sign-off side by side.
// "done" for the day means BOTH signed; that drives doneCount and the streak dots.
export function TogetherSection({
  rows,
  doneCount,
  streak,
  week,
  onToggle,
  onSaveNote,
}: Props) {
  return (
    <section className="person card together">
      <header className="person__header">
        <h2 className="person__name">
          Together <span className="tag">both of us</span>
        </h2>
        <span className="person__progress">
          {doneCount}/{rows.length}
        </span>
      </header>

      <StreakBadge streak={streak} week={week} />

      <ul className="check-list">
        {rows.map(({ item, signoffs }) => (
          <li key={item.id} className="together-row">
            <div className="together-row__title">{item.title}</div>
            <div className="together-signoffs">
              {signoffs.map((s) => {
                const box = (
                  <span
                    className={'checkbox' + (s.done ? ' checkbox--on' : '')}
                    aria-hidden="true"
                  >
                    {s.done ? '♥' : '♡'}
                  </span>
                )
                return (
                  <div className="signoff" key={s.profile.id}>
                    {s.isSelf ? (
                      <button
                        type="button"
                        className="signoff__btn"
                        onClick={() => onToggle(item, !s.done)}
                        aria-pressed={s.done}
                      >
                        {box}
                        <span className="signoff__name">
                          {s.profile.display_name}
                          <span className="tag tag--you">you</span>
                        </span>
                      </button>
                    ) : (
                      <div className="signoff__btn signoff__btn--readonly">
                        {box}
                        <span className="signoff__name">{s.profile.display_name}</span>
                      </div>
                    )}
                    {s.done && (
                      <CompletionNote
                        note={s.note}
                        editable={s.isSelf}
                        label={s.isSelf ? 'you' : s.profile.display_name}
                        onSave={s.isSelf ? (n) => onSaveNote(item, n) : undefined}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
