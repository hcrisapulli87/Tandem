# Tandem — Together Checks & Completion Notes

## Context

Tandem is a two-person accountability checklist. Today, every check belongs to one
person: both can *see* each other's checks, but you can only create and sign off your
own (enforced by Row-Level Security: read-all, write-own). We keep that exactly.

This spec adds two features:

1. **Together checks** — shared daily goals either person can create, that *both* people
   sign off each day.
2. **Completion notes** — an optional short description the person who ticks a check adds,
   shown beneath it. Together checks show both people's notes.

Both are additive and backward-compatible. No change to auth, hosting, or the realtime
mechanism.

## Locked decisions (from brainstorming)

- **Together checks live in their own section** at the top of Today, showing each check
  with both people's sign-off side by side, plus its own streak. Solo sections stay
  personal and unchanged.
- **Either person can edit / delete / reorder** a together check (it's a shared
  commitment). Each person still signs off only their own completion.
- **Notes are written by whoever ticks the check off** — no per-item setup toggle. Any
  check can carry a note. Together checks show each person's note.
- **Together checks are daily-only** (no one-off together) — YAGNI for v1.
- **The together section's count and streak use "fully complete" = both people signed
  off.** Together checks do *not* feed either person's solo streak; they get their own.
- **Unchecking discards the note** — the note lives on the completion row, which is
  ephemeral daily data, so it goes when the check is cleared.

## Data model

### `items` — add one column

- `shared boolean not null default false`. `true` marks a together check. Kept
  *orthogonal* to `kind` (which stays `daily | oneoff`): "who completes it" is a separate
  axis from "how it recurs". A together check is `kind = 'daily', shared = true`.
- `owner_id` continues to record the **creator** (stable reference + basis for RLS), even
  though either person may manage a shared item.

### `completions` — two changes

- Widen the unique key: `unique(item_id, for_date)` → **`unique(item_id, owner_id,
  for_date)`**. Solo checks have a single owner so behaviour is identical; together checks
  get one row per person per day. Backward-compatible with existing rows.
- Add `note text` (nullable) — the optional completion description.

### Realtime

No change. The existing subscription on `items` + `completions` already triggers a
refetch on any insert/update/delete, and notes + together completions are just rows in
those tables.

## Row-Level Security

Only one genuinely new capability is granted: "sign off / note a **shared** check". The
accountability guarantee is preserved — every completion is still stamped with
`owner_id = auth.uid()`, so neither person can forge the other's sign-off or note.

- **`completions` insert** — widen from "items you own" to "your own items **or** any
  shared item":
  ```sql
  with check (
    owner_id = auth.uid()
    and item_id in (
      select id from public.items
      where owner_id = auth.uid() or shared
    )
  )
  ```
- **`items` update / delete** — widen `using` to `owner_id = auth.uid() or shared` so
  either person can manage shared items. The update `with check` keeps `owner_id =
  auth.uid() or shared`, so a non-creator can rename/reorder a shared item but **cannot
  un-share it or move it into their own solo list**.
- **`completions` update / delete (own)** — unchanged. Because notes live on the
  completion row, "update own" already governs note editing: you edit only *your* note;
  your partner's renders read-only.
- **Read-all** policies — unchanged.

The schema file uses the existing drop-and-recreate-policy pattern so it stays
re-runnable. The new column and constraint use `add column if not exists` /
guarded-constraint patterns so re-running is safe. (Changing the `completions` unique
constraint requires dropping the old one and adding the new — done idempotently.)

## Behaviour

### Together section (Today screen)

- Rendered above the two person sections, **only if** at least one together check exists.
- Each row: title, **your tappable tick**, and your **partner's read-only tick**.
- A together check is **done for a day only when both completions exist**.
- Header shows the fully-complete count (e.g. `1/3 today`) and a **together streak** —
  consecutive days where *every* active together check was signed off by *both* people,
  reusing the existing "grace for today" rule.

### Completion notes

- After a check is ticked, an "add a note" affordance appears beneath it; once saved the
  note shows under the check. Editable any time while the check is done.
- Together checks show both notes stacked (`you: …` / partner: …), each person editing
  only their own.
- Unchecking deletes the completion row and therefore the note.

## UI / component changes

- **New `TogetherSection`** component (sibling to `PersonSection`): header with together
  streak + fully-complete count; rows with dual ticks and notes.
- **`ChecklistItem`** — extended to optionally render a note line + inline edit input when
  `done` and interactive; read-only note display otherwise.
- **`PersonSection`** — solo done-items now display the owner's note (editable when it's
  your own section).
- **`MyList`** — the create-form type selector becomes three options: *Daily (just me)* /
  *One-off (just me)* / *Together (daily, both of us)*. MyList now lists **your solo items
  + all together items** (tagged `together`), since either person manages them.
- **Data layer:**
  - new `setNote(itemId, forDate, note)` on `completions`;
  - `setCompleted` `onConflict` key updated to `item_id,owner_id,for_date`;
  - `clearCompleted` pinned to `owner_id` (correct-by-construction, not just RLS backstop);
  - `addItem` accepts `shared`;
  - `DataProvider` gains `toggleTogether` + `setNote`, fetches/derives the together
    section, and keeps solo logic as-is.

## Testing

- Extend `summary` / `streak` unit tests for the "both-owners-signed = perfect together
  day" derivation (pure functions).
- Manual verification in the real app:
  - either person can sign off a partner-created together check;
  - RLS blocks forging the other person's sign-off or note;
  - notes save, display, edit, and clear (on uncheck) correctly;
  - together streak advances only on fully-complete days.

## Not in scope

- Notifications / nudges (still deferred).
- One-off together checks.
- Note history beyond the current day.
- Any change to auth, hosting, or the realtime transport.
