import type { ItemKind } from '../data/types'
import { CompletionNote } from './CompletionNote'

interface Props {
  title: string
  kind: ItemKind
  done: boolean
  // Your own items are tappable; the other person's render read-only.
  interactive: boolean
  note?: string | null
  onToggle?: (done: boolean) => void
  onSaveNote?: (note: string) => void
}

export function ChecklistItem({
  title,
  kind,
  done,
  interactive,
  note = null,
  onToggle,
  onSaveNote,
}: Props) {
  const rowClass =
    'check-row' +
    (done ? ' check-row--done' : '') +
    (interactive ? '' : ' check-row--readonly')

  const inner = (
    <>
      <span className={'checkbox' + (done ? ' checkbox--on' : '')} aria-hidden="true">
        {done ? '♥' : '♡'}
      </span>
      <span className="check-row__title">{title}</span>
      {kind === 'oneoff' && <span className="tag">one-off</span>}
    </>
  )

  // The note sits OUTSIDE the button — interactive content can't nest inside a <button>.
  const row = interactive ? (
    <button
      type="button"
      className={rowClass}
      onClick={() => onToggle?.(!done)}
      aria-pressed={done}
    >
      {inner}
    </button>
  ) : (
    <div className={rowClass}>{inner}</div>
  )

  return (
    <div className="check-item">
      {row}
      {done && (
        <CompletionNote
          note={note}
          editable={interactive && !!onSaveNote}
          onSave={onSaveNote}
        />
      )}
    </div>
  )
}
