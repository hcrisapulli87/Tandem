# Together Checks & Completion Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shared "together" daily checks that both people sign off, and an optional completion note shown beneath any check.

**Architecture:** A together check is an `items` row with `shared = true` (orthogonal to `kind`, which stays `daily | oneoff`). Both people can complete it, so the `completions` unique key widens to `(item_id, owner_id, for_date)` and a nullable `note` column is added. RLS gains exactly one new capability — sign off / note a *shared* item — while keeping every completion stamped with `owner_id = auth.uid()`. The UI adds a Together section (own streak, dual sign-offs) above the two person sections, and a reusable note block under completed checks.

**Tech Stack:** React 19 + TypeScript + Vite, Supabase (Postgres + RLS + Realtime), Vitest for pure-logic tests.

**Spec:** `docs/superpowers/specs/2026-06-19-together-checks-and-notes-design.md`

---

## File map

| File | Change |
|---|---|
| `supabase/schema.sql` | Add `items.shared`, `completions.note`, widen completions unique key, update 3 RLS policies. **Harrison re-runs in Supabase SQL Editor.** |
| `src/data/types.ts` | `Item.shared`, `Completion.note?` |
| `src/data/completions.ts` | `setCompleted` onConflict key; `clearCompleted` owner filter; new `setNote` |
| `src/data/items.ts` | `addItem` accepts `shared` |
| `src/data/together.ts` (new) | `togetherDoneCount`, `togetherPerfectDayDates` |
| `src/data/together.test.ts` (new) | unit tests for the above |
| `src/data/DataProvider.tsx` | `addItem` shared, owner-aware toggle, `setNote`, expose |
| `src/components/CompletionNote.tsx` (new) | display + inline-edit a note |
| `src/components/ChecklistItem.tsx` | render note under a done check |
| `src/components/PersonSection.tsx` | thread note + `onSaveNote` |
| `src/components/TogetherSection.tsx` (new) | shared section with dual sign-offs |
| `src/screens/Today.tsx` | exclude shared from person sections; build + render Together section; pass notes |
| `src/screens/MyList.tsx` | three-way type selector; list together items |
| `src/styles/theme.css` | styles for together rows, sign-offs, notes |

**Backward-compatibility note that keeps every task independently compilable:** `Completion.note` and the new `shared` inputs are **optional** in TypeScript, so a caller that hasn't been updated yet still type-checks. Run `npm run build` after each task.

---

### Task 1: Database schema — columns, unique key, RLS

**Files:**
- Modify: `supabase/schema.sql`

This is run by Harrison in the Supabase SQL Editor (account-bound). The whole file stays
idempotent and re-runnable. Make the edits below, then hand off the run.

- [ ] **Step 1: Add `shared` to the `items` create-table block**

In `supabase/schema.sql`, find the `items` table definition and add the `shared` column
after `active`:

```sql
  kind       text not null default 'daily' check (kind in ('daily', 'oneoff')),
  active     boolean not null default true,
  shared     boolean not null default false,
  sort_order integer not null default 0,
```

- [ ] **Step 2: Add `note` to `completions` and drop the inline unique key**

In the `completions` create-table block, add `note` and REMOVE the inline
`unique (item_id, for_date)` line (the constraint is recreated, renamed, below):

```sql
  for_date     date not null,
  completed_at timestamptz not null default now(),
  note         text
);
```

(Delete the `,` + `unique (item_id, for_date)` line that was there.)

- [ ] **Step 3: Add an idempotent migration block for existing installs**

Immediately after the two `create index if not exists …` statements, insert:

```sql
-- Migration for installs created before these features existed. create-table-if-not-
-- exists won't add columns to an existing table, so add them explicitly. All guarded,
-- so the whole script stays safely re-runnable.
alter table public.items       add column if not exists shared boolean not null default false;
alter table public.completions add column if not exists note text;

-- Move from one-completion-per-(item,day) to one-per-(item,owner,day) so BOTH people
-- can sign off the same together check on the same day. Drop the old auto-named key if
-- a prior version created it, then ensure the new one exists.
alter table public.completions drop constraint if exists completions_item_id_for_date_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'completions_item_owner_for_date_key'
  ) then
    alter table public.completions
      add constraint completions_item_owner_for_date_key unique (item_id, owner_id, for_date);
  end if;
end $$;
```

- [ ] **Step 4: Widen the completions INSERT policy to allow shared items**

Replace the existing `"completions: insert own item"` policy block with:

```sql
-- Insert guard: the row is stamped with your id AND the item is either yours OR a
-- shared (together) item. This is the ONLY new write capability — it lets you sign off
-- a together check your partner created, and nothing else.
drop policy if exists "completions: insert own item" on public.completions;
create policy "completions: insert own item"
  on public.completions for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and item_id in (
      select id from public.items
      where owner_id = auth.uid() or shared
    )
  );
```

- [ ] **Step 5: Widen the items UPDATE and DELETE policies for shared items**

Replace the `"items: update own"` and `"items: delete own"` policy blocks with:

```sql
drop policy if exists "items: update own" on public.items;
create policy "items: update own"
  on public.items for update
  to authenticated
  using (owner_id = auth.uid() or shared)
  with check (owner_id = auth.uid() or shared);

drop policy if exists "items: delete own" on public.items;
create policy "items: delete own"
  on public.items for delete
  to authenticated
  using (owner_id = auth.uid() or shared);
```

(Either person can manage a shared item. The update `with check (… or shared)` keeps the
row shared, so a non-creator can rename/reorder but cannot un-share or steal it.)

- [ ] **Step 6: Commit, then hand off the run to Harrison**

```bash
git add supabase/schema.sql
git commit -m "feat(schema): shared items, completion notes, per-person completion key"
```

Hand-off: **Harrison runs the updated `supabase/schema.sql` in the Supabase SQL Editor**
(Dashboard → SQL Editor → paste → Run). It's safe to proceed past the "destructive
operation" warning — it's the guarded `drop constraint if exists` / `drop policy if
exists` lines, which remove a rule and a key (recreated on the next line), never any rows.
Stand this up before testing the app against it.

---

### Task 2: Domain types

**Files:**
- Modify: `src/data/types.ts`

- [ ] **Step 1: Add the two fields**

Edit `Item` to add `shared`, and `Completion` to add optional `note`:

```typescript
export interface Item {
  id: string
  owner_id: string
  title: string
  kind: ItemKind
  active: boolean
  shared: boolean
  sort_order: number
  created_at: string
}

export interface Completion {
  id: string
  item_id: string
  owner_id: string
  for_date: string // YYYY-MM-DD (the local day this check-off counts for)
  completed_at: string
  note?: string | null // optional completion description, shown under the check
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (note is optional, so the existing optimistic-completion literal in
DataProvider still compiles).

- [ ] **Step 3: Commit**

```bash
git add src/data/types.ts
git commit -m "feat(types): add Item.shared and Completion.note"
```

---

### Task 3: Completions data layer

**Files:**
- Modify: `src/data/completions.ts`

- [ ] **Step 1: Update `setCompleted` onConflict to the new key**

```typescript
export async function setCompleted(
  itemId: string,
  ownerId: string,
  forDate: string,
): Promise<void> {
  const { error } = await supabase
    .from('completions')
    .upsert(
      { item_id: itemId, owner_id: ownerId, for_date: forDate },
      { onConflict: 'item_id,owner_id,for_date', ignoreDuplicates: true },
    )
  if (error) throw error
}
```

- [ ] **Step 2: Pin `clearCompleted` to the owner (optional arg keeps callers compiling)**

```typescript
/** Uncheck (item, date) by deleting its completion row. Pass ownerId so a together
 *  check only clears YOUR sign-off, not your partner's (RLS also enforces this). */
export async function clearCompleted(
  itemId: string,
  forDate: string,
  ownerId?: string,
): Promise<void> {
  let query = supabase
    .from('completions')
    .delete()
    .eq('item_id', itemId)
    .eq('for_date', forDate)
  if (ownerId) query = query.eq('owner_id', ownerId)
  const { error } = await query
  if (error) throw error
}
```

- [ ] **Step 3: Add `setNote`**

Append:

```typescript
/** Set (or clear, with an empty string) the note on the current user's completion of
 *  (item, date). Requires the check to already be done — there's a row to update. */
export async function setNote(
  itemId: string,
  ownerId: string,
  forDate: string,
  note: string,
): Promise<void> {
  const trimmed = note.trim()
  const { error } = await supabase
    .from('completions')
    .update({ note: trimmed === '' ? null : trimmed })
    .eq('item_id', itemId)
    .eq('owner_id', ownerId)
    .eq('for_date', forDate)
  if (error) throw error
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/completions.ts
git commit -m "feat(data): per-person completion key, owner-scoped uncheck, setNote"
```

---

### Task 4: Items data layer — accept `shared`

**Files:**
- Modify: `src/data/items.ts`

- [ ] **Step 1: Add optional `shared` to `addItem`**

Replace the `addItem` function:

```typescript
export async function addItem(input: {
  ownerId: string
  title: string
  kind: ItemKind
  sortOrder: number
  shared?: boolean
}): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .insert({
      owner_id: input.ownerId,
      title: input.title,
      kind: input.kind,
      shared: input.shared ?? false,
      sort_order: input.sortOrder,
    })
    .select()
    .single()
  if (error) throw error
  return data as Item
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (shared is optional; the existing DataProvider call still compiles).

- [ ] **Step 3: Commit**

```bash
git add src/data/items.ts
git commit -m "feat(data): addItem accepts shared flag"
```

---

### Task 5: Together derivations (TDD)

**Files:**
- Create: `src/data/together.ts`
- Test: `src/data/together.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/data/together.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import type { Completion, Item } from './types'
import { togetherDoneCount, togetherPerfectDayDates } from './together'

const A = 'user-a'
const B = 'user-b'

function item(id: string): Item {
  return {
    id,
    owner_id: A,
    title: id,
    kind: 'daily',
    active: true,
    shared: true,
    sort_order: 0,
    created_at: '2026-06-01T00:00:00Z',
  }
}

function comp(itemId: string, owner: string, date: string): Completion {
  return {
    id: `${itemId}-${owner}-${date}`,
    item_id: itemId,
    owner_id: owner,
    for_date: date,
    completed_at: `${date}T08:00:00Z`,
    note: null,
  }
}

describe('togetherDoneCount', () => {
  const items = [item('walk'), item('read')]

  it('counts a check only when both people have signed off', () => {
    const completions = [
      comp('walk', A, '2026-06-19'),
      comp('walk', B, '2026-06-19'),
      comp('read', A, '2026-06-19'), // B missing → not counted
    ]
    expect(togetherDoneCount(items, completions, '2026-06-19', [A, B])).toBe(1)
  })

  it('returns 0 when fewer than two owners are known', () => {
    const completions = [comp('walk', A, '2026-06-19')]
    expect(togetherDoneCount(items, completions, '2026-06-19', [A])).toBe(0)
  })
})

describe('togetherPerfectDayDates', () => {
  const items = [item('walk'), item('read')]

  it('includes only days where every check is signed by both', () => {
    const completions = [
      // 06-18: both did both → perfect together day
      comp('walk', A, '2026-06-18'),
      comp('walk', B, '2026-06-18'),
      comp('read', A, '2026-06-18'),
      comp('read', B, '2026-06-18'),
      // 06-19: B missed "read" → not perfect
      comp('walk', A, '2026-06-19'),
      comp('walk', B, '2026-06-19'),
      comp('read', A, '2026-06-19'),
    ]
    const dates = ['2026-06-18', '2026-06-19']
    expect(togetherPerfectDayDates(items, completions, dates, [A, B])).toEqual(
      new Set(['2026-06-18']),
    )
  })

  it('is empty when there are no together items', () => {
    expect(togetherPerfectDayDates([], [], ['2026-06-19'], [A, B])).toEqual(new Set())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- together`
Expected: FAIL — `together.ts` does not exist / functions not defined.

- [ ] **Step 3: Implement `together.ts`**

Create `src/data/together.ts`:

```typescript
import type { Completion, Item } from './types'

// Derivations for "together" checks: a shared daily check is complete for a day only
// when EVERY known person has a completion row for it on that date.

/** True iff `itemId` has a completion on `date` for every id in `ownerIds`. */
function bothSigned(
  itemId: string,
  date: string,
  ownerIds: string[],
  completions: Completion[],
): boolean {
  return ownerIds.every((owner) =>
    completions.some(
      (c) => c.item_id === itemId && c.for_date === date && c.owner_id === owner,
    ),
  )
}

/** How many together checks are fully signed off (by both people) on `date`. */
export function togetherDoneCount(
  togetherItems: Item[],
  completions: Completion[],
  date: string,
  ownerIds: string[],
): number {
  if (ownerIds.length < 2) return 0
  return togetherItems.filter((i) => bothSigned(i.id, date, ownerIds, completions)).length
}

/** Dates on which every together check was signed off by both people. Powers the
 *  together streak (fed to the shared currentStreak helper). */
export function togetherPerfectDayDates(
  togetherItems: Item[],
  completions: Completion[],
  dates: string[],
  ownerIds: string[],
): Set<string> {
  if (togetherItems.length === 0 || ownerIds.length < 2) return new Set()
  return new Set(
    dates.filter((date) =>
      togetherItems.every((i) => bothSigned(i.id, date, ownerIds, completions)),
    ),
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- together`
Expected: PASS (4 assertions across 2 suites).

- [ ] **Step 5: Commit**

```bash
git add src/data/together.ts src/data/together.test.ts
git commit -m "feat(data): together check derivations with tests"
```

---

### Task 6: DataProvider — shared add, owner-aware toggle, setNote

**Files:**
- Modify: `src/data/DataProvider.tsx`

- [ ] **Step 1: Import `setNote` from the completions module**

Change the completions import:

```typescript
import { fetchCompletions, setCompleted, clearCompleted, setNote as apiSetNote } from './completions'
```

- [ ] **Step 2: Extend the context type**

In `interface DataContextValue`, change the `addItem` signature and add `setNote`:

```typescript
  toggleToday: (item: Item, done: boolean) => Promise<void>
  setNote: (item: Item, note: string) => Promise<void>
  addItem: (input: { title: string; kind: ItemKind; shared?: boolean; sortOrder: number }) => Promise<void>
```

- [ ] **Step 3: Make `toggleToday` owner-aware and note-safe**

Replace the optimistic block + the `clearCompleted` call inside `toggleToday`:

```typescript
      if (done) {
        const optimistic: Completion = {
          id: `optimistic-${item.id}`,
          item_id: item.id,
          owner_id: user.id,
          for_date: today,
          completed_at: new Date().toISOString(),
          note: null,
        }
        setCompletions((prev) => [...prev, optimistic])
        // Completing a one-off removes it from the active list for good.
        if (item.kind === 'oneoff') {
          setItems((prev) => prev.filter((i) => i.id !== item.id))
        }
      } else {
        setCompletions((prev) =>
          prev.filter(
            (c) => !(c.item_id === item.id && c.for_date === today && c.owner_id === user.id),
          ),
        )
      }

      try {
        if (done) {
          await setCompleted(item.id, user.id, today)
          if (item.kind === 'oneoff') await apiArchiveItem(item.id)
        } else {
          await clearCompleted(item.id, today, user.id)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Update failed')
        void reload()
      }
```

- [ ] **Step 4: Add the `setNote` callback** (place it right after `toggleToday`)

```typescript
  // Add/edit the note on the current user's completion of an item for today. Optimistic;
  // a failure resyncs. Updates by (item, owner, date), so it works even before the
  // optimistic completion's real id has arrived from the server.
  const setNote = useCallback(
    async (item: Item, note: string) => {
      if (!user) return
      const value = note.trim() === '' ? null : note.trim()
      setCompletions((prev) =>
        prev.map((c) =>
          c.item_id === item.id && c.for_date === today && c.owner_id === user.id
            ? { ...c, note: value }
            : c,
        ),
      )
      try {
        await apiSetNote(item.id, user.id, today, note)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Note update failed')
        void reload()
      }
    },
    [user, today, reload],
  )
```

- [ ] **Step 5: Pass `shared` through `addItem`**

Replace the `addItem` callback:

```typescript
  const addItem = useCallback(
    async (input: { title: string; kind: ItemKind; shared?: boolean; sortOrder: number }) => {
      if (!user) return
      await apiAddItem({ ownerId: user.id, ...input })
      await reload()
    },
    [user, reload],
  )
```

- [ ] **Step 6: Expose `setNote` in the provider value**

Add `setNote,` to the `value={{ … }}` object (next to `toggleToday`).

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/data/DataProvider.tsx
git commit -m "feat(data): owner-aware toggle, setNote, shared add in DataProvider"
```

---

### Task 7: CompletionNote component

**Files:**
- Create: `src/components/CompletionNote.tsx`

- [ ] **Step 1: Create the component**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (component is unused so far, but must compile).

- [ ] **Step 3: Commit**

```bash
git add src/components/CompletionNote.tsx
git commit -m "feat(ui): CompletionNote display + inline edit component"
```

---

### Task 8: ChecklistItem — show note under a done check

**Files:**
- Modify: `src/components/ChecklistItem.tsx`

- [ ] **Step 1: Replace the component**

The note must sit OUTSIDE the `<button>` (interactive content can't nest in a button), so
wrap the row + note in a `check-item` container.

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (PersonSection passes only title/kind/done/interactive/onToggle today;
note/onSaveNote are optional).

- [ ] **Step 3: Commit**

```bash
git add src/components/ChecklistItem.tsx
git commit -m "feat(ui): render completion note under a done check"
```

---

### Task 9: PersonSection — thread note + onSaveNote

**Files:**
- Modify: `src/components/PersonSection.tsx`

- [ ] **Step 1: Add `note` to `Row`, `onSaveNote` to props, and wire them through**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: FAIL — `Today.tsx` builds `rows` without `note` and doesn't pass `onSaveNote`.
This is expected; Task 11 fixes the caller. (If running tasks strictly one-at-a-time with
a green gate, do Step 2 of Task 11 before committing this — they're a matched pair. The
commit below is still valid as a unit of work.)

- [ ] **Step 3: Commit**

```bash
git add src/components/PersonSection.tsx
git commit -m "feat(ui): thread completion notes through PersonSection"
```

---

### Task 10: TogetherSection component

**Files:**
- Create: `src/components/TogetherSection.tsx`

- [ ] **Step 1: Create the component**

```typescript
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (component is not yet rendered).

- [ ] **Step 3: Commit**

```bash
git add src/components/TogetherSection.tsx
git commit -m "feat(ui): TogetherSection with dual sign-offs and notes"
```

---

### Task 11: Today screen — render Together + per-person notes

**Files:**
- Modify: `src/screens/Today.tsx`

- [ ] **Step 1: Replace the screen**

```typescript
import { useMemo } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { lastNDates } from '../data/dates'
import { currentStreak } from '../data/streak'
import { perfectDayDates, weekStats } from '../data/summary'
import type { DayStat } from '../data/summary'
import { togetherDoneCount, togetherPerfectDayDates } from '../data/together'
import { PersonSection } from '../components/PersonSection'
import type { Row } from '../components/PersonSection'
import { TogetherSection } from '../components/TogetherSection'
import type { TogetherRow } from '../components/TogetherSection'

export default function Today() {
  const { user } = useAuth()
  const { loading, error, profiles, items, completions, today, toggleToday, setNote } = useData()

  const week = useMemo(() => lastNDates(7, today), [today])

  // Today's completions keyed by "item:owner" → gives both done-state and note per person.
  const todayByItemOwner = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const c of completions) {
      if (c.for_date === today) map.set(`${c.item_id}:${c.owner_id}`, c.note ?? null)
    }
    return map
  }, [completions, today])

  if (loading) return <p className="muted">Loading…</p>
  if (error) return <p className="error">{error}</p>
  if (profiles.length === 0)
    return <p className="muted">No profiles yet — sign in on both accounts.</p>

  // You first, then the other person.
  const ordered = [...profiles].sort((a, b) =>
    a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0,
  )
  const ownerIds = profiles.map((p) => p.id)

  // ---- Together section ----
  const togetherItems = items.filter((i) => i.shared)
  const togetherRows: TogetherRow[] = togetherItems.map((item) => ({
    item,
    signoffs: ordered.map((profile) => {
      const key = `${item.id}:${profile.id}`
      return {
        profile,
        isSelf: profile.id === user?.id,
        done: todayByItemOwner.has(key),
        note: todayByItemOwner.get(key) ?? null,
      }
    }),
  }))
  const togetherWeek: DayStat[] = week.map((date) => ({
    date,
    done: togetherDoneCount(togetherItems, completions, date, ownerIds),
    total: togetherItems.length,
  }))
  const togetherStreak = currentStreak(
    togetherPerfectDayDates(togetherItems, completions, week, ownerIds),
    today,
  )
  const togetherDoneToday = togetherDoneCount(togetherItems, completions, today, ownerIds)

  return (
    <>
      {togetherItems.length > 0 && (
        <TogetherSection
          rows={togetherRows}
          doneCount={togetherDoneToday}
          streak={togetherStreak}
          week={togetherWeek}
          onToggle={toggleToday}
          onSaveNote={setNote}
        />
      )}

      <div className="today-grid">
        {ordered.map((profile) => {
          const personItems = items.filter((i) => i.owner_id === profile.id && !i.shared)
          const rows: Row[] = personItems.map((item) => {
            const key = `${item.id}:${profile.id}`
            return {
              item,
              done: todayByItemOwner.has(key),
              note: todayByItemOwner.get(key) ?? null,
            }
          })
          const dailyItems = personItems.filter((i) => i.kind === 'daily')
          const stats = weekStats(dailyItems, completions, week)
          const streak = currentStreak(
            perfectDayDates(dailyItems, completions, week),
            today,
          )
          const doneCount = rows.filter((r) => r.done).length

          return (
            <PersonSection
              key={profile.id}
              profile={profile}
              isSelf={profile.id === user?.id}
              rows={rows}
              doneCount={doneCount}
              streak={streak}
              week={stats}
              onToggle={toggleToday}
              onSaveNote={setNote}
            />
          )
        })}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: PASS (resolves the Task 9 caller break too).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (dates, streak, summary, together).

- [ ] **Step 4: Commit**

```bash
git add src/screens/Today.tsx
git commit -m "feat(ui): Together section + per-person notes on Today"
```

---

### Task 12: MyList — three-way type selector + together items

**Files:**
- Modify: `src/screens/MyList.tsx`

- [ ] **Step 1: List my solo items AND all together items**

Replace the `myItems` memo:

```typescript
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
```

- [ ] **Step 2: Replace `kind` state with a three-way `type` and translate on add**

Replace the `const [title…]`/`const [kind…]` lines and the `onAdd` body:

```typescript
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
```

Also remove the now-unused `ItemKind` import if present; the import line becomes:

```typescript
import type { Item } from '../data/types'
```

- [ ] **Step 3: Replace the select with three options**

```typescript
          <select
            className="input select"
            value={type}
            onChange={(e) => setType(e.target.value as NewType)}
          >
            <option value="daily">Daily (just me)</option>
            <option value="oneoff">One-off (just me)</option>
            <option value="together">Together (both of us)</option>
          </select>
```

- [ ] **Step 4: Tag together items in the manage row**

In `ManageRow`'s render, replace the kind tag line with one that handles `shared`:

```typescript
      <span className={'tag' + (item.shared ? ' tag--together' : '')}>
        {item.shared ? 'together' : item.kind === 'daily' ? 'daily' : 'one-off'}
      </span>
```

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/MyList.tsx
git commit -m "feat(ui): create together checks + manage them in My List"
```

---

### Task 13: Styles

**Files:**
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Append the new styles** (end of file)

```css
/* Together section + dual sign-offs */
.together {
  border-color: var(--border-strong);
  background: linear-gradient(180deg, #fff7fc, #ffffff 62%);
}

.today-grid {
  /* keep the two person columns; Together sits above the grid */
}

section.together {
  margin-bottom: var(--gap);
}

.together-row {
  list-style: none;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 11px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.together-row__title {
  font-weight: 700;
  font-family: var(--font-cute);
}

.together-signoffs {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

@media (min-width: 420px) {
  .together-signoffs {
    grid-template-columns: 1fr 1fr;
  }
}

.signoff {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.signoff__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  appearance: none;
  border: 1px solid var(--border);
  background: #ffffff;
  border-radius: 999px;
  padding: 6px 10px;
  font: inherit;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

button.signoff__btn:hover {
  background: var(--surface-2);
}

.signoff__btn--readonly {
  cursor: default;
}

.signoff__name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.9rem;
}

.tag--together {
  color: #ffffff;
  background: linear-gradient(120deg, var(--accent-2), var(--accent));
  border-color: transparent;
}

/* Completion note */
.check-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.note {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 4px 2px 36px; /* aligns under the checkbox (24px + 12px gap) */
  font-size: 0.85rem;
  color: var(--text);
}

.signoff .note {
  padding-left: 4px;
}

.note__label {
  color: var(--muted);
  font-weight: 700;
  font-size: 0.75rem;
}

.note__text {
  color: var(--text);
}

.note__edit {
  appearance: none;
  border: none;
  background: none;
  padding: 0;
  color: var(--accent-strong);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
}

.note--edit {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 4px 4px 36px;
}

.signoff .note--edit {
  padding-left: 4px;
}

.note__input {
  flex: 1;
  padding: 7px 10px;
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/theme.css
git commit -m "style: together section, sign-offs, completion notes"
```

---

### Task 14: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Build + tests green**

Run: `npm run build`
Expected: PASS (tsc + vite build).

Run: `npm test`
Expected: PASS (all suites).

- [ ] **Step 2: Manual verification in the running app**

Prerequisite: Task 1's schema has been run in Supabase.

Run: `npm run dev`, open http://localhost:5173 in **two browser profiles** signed in as
the two users (or sign in as each in turn).

Verify:
- In My List, add a **Together (both of us)** check. It appears (tagged `together`) in
  **both** people's My List.
- On Today, the **Together** section shows above both person sections, with a tappable
  tick for you and a read-only tick for your partner.
- Sign off your side of a **partner-created** together check → it persists (RLS allows
  signing off shared items).
- The together check's day-dot / `done` count fills only when **both** have signed off;
  the together streak advances only on fully-complete days.
- Add a note under a completed solo check → it shows beneath it; your partner sees it
  read-only in your section.
- A together check shows **both** notes (`you:` / partner) once each person adds one;
  you can edit only your own.
- Unchecking a check removes its note.
- Existing solo daily/one-off behaviour and the solo streaks are unchanged.

- [ ] **Step 3: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "chore: verification fixups for together checks + notes"
```

---

## Self-review notes

- **Spec coverage:** shared column + per-person key + note (Tasks 1–2); RLS new capability
  (Task 1); together derivations + streak reuse (Task 5, 11); Together section UI (Tasks
  10–11); notes display/edit (Tasks 7–9); MyList creation + management (Task 12); daily-only
  together (enforced by the type→`{kind:'daily', shared:true}` mapping in Task 12);
  fully-complete counting (Task 5/11); unchecking discards note (deletion cascades the row;
  no separate handling needed). All covered.
- **Type consistency:** `Row` gains `note: string | null` (Task 9) and Today builds it that
  way (Task 11); `Signoff`/`TogetherRow` shapes match between Task 10 and Task 11;
  `addItem` input shape (`shared?`) consistent across items.ts, DataProvider, MyList;
  `setNote(item, note)` signature consistent between DataProvider (Task 6) and its callers
  (Tasks 11). `togetherDoneCount`/`togetherPerfectDayDates` signatures match between Task 5
  and Task 11.
- **Compile gates:** the only intentional intermediate break is Task 9↔11 (PersonSection
  prop/caller pair); noted in Task 9 Step 2.
```
