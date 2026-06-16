import type { ItemKind } from '../data/types'

interface Props {
  title: string
  kind: ItemKind
  done: boolean
  // Your own items are tappable; the other person's render read-only.
  interactive: boolean
  onToggle?: (done: boolean) => void
}

export function ChecklistItem({ title, kind, done, interactive, onToggle }: Props) {
  const className =
    'check-row' +
    (done ? ' check-row--done' : '') +
    (interactive ? '' : ' check-row--readonly')

  const inner = (
    <>
      <span className={'checkbox' + (done ? ' checkbox--on' : '')} aria-hidden="true">
        {done ? '✓' : ''}
      </span>
      <span className="check-row__title">{title}</span>
      {kind === 'oneoff' && <span className="tag">one-off</span>}
    </>
  )

  if (!interactive) {
    return <div className={className}>{inner}</div>
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => onToggle?.(!done)}
      aria-pressed={done}
    >
      {inner}
    </button>
  )
}
