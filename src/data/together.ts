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
