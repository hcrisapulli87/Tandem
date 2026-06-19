import { useState } from 'react'

interface Props {
  note: string | null
  // Can the current user edit this note? (Only your own completions.)
  editable: boolean
  // Shown before the text on together rows, e.g. "you" / a partner's name.
  label?: string
  onSave?: (note: string) => void
}

// Renders the note under a completed check. Read-only for a partner's note; an inline
// "+ note" / "edit" affordance for your own. Saving an empty value clears the note.
export function CompletionNote({ note, editable, label, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note ?? '')

  // Nothing to show and nothing to add → render nothing.
  if (!editable && !note) return null

  if (editing) {
    return (
      <div className="note note--edit">
        <input
          className="input note__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note…"
          maxLength={140}
          autoFocus
        />
        <button
          className="btn btn--primary btn--sm"
          type="button"
          onClick={() => {
            onSave?.(draft)
            setEditing(false)
          }}
        >
          Save
        </button>
        <button
          className="btn btn--ghost btn--sm"
          type="button"
          onClick={() => {
            setDraft(note ?? '')
            setEditing(false)
          }}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="note">
      {label && <span className="note__label">{label}:</span>}
      {note && <span className="note__text">{note}</span>}
      {editable && (
        <button
          className="note__edit"
          type="button"
          onClick={() => {
            setDraft(note ?? '')
            setEditing(true)
          }}
        >
          {note ? 'edit' : '+ note'}
        </button>
      )}
    </div>
  )
}
