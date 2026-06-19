import { supabase } from '../lib/supabase'
import type { Completion } from './types'

// A completion row's existence == "done" for that (item, day). Checking inserts a
// row; unchecking deletes it. Reads cover both users (read-all) over a date range,
// which powers both today's view and the streak history.

export async function fetchCompletions(
  fromDate: string,
  toDate: string,
): Promise<Completion[]> {
  const { data, error } = await supabase
    .from('completions')
    .select('*')
    .gte('for_date', fromDate)
    .lte('for_date', toDate)
  if (error) throw error
  return (data ?? []) as Completion[]
}

/** Check off (item, date). Upsert + ignoreDuplicates makes a double-tap a no-op
 *  instead of a unique-constraint error. owner_id must be the current user. */
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
