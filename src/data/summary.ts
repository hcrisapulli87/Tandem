import type { Completion, Item } from './types'

export interface DayStat {
  date: string
  done: number
  total: number
}

/**
 * Per-day completion counts for one person's daily habits, over the given dates.
 * `total` is how many daily items they currently have; `done` is how many were
 * completed on that date. Pass all completions — the item-id filter restricts to
 * this person's items.
 */
export function weekStats(
  dailyItems: Item[],
  completions: Completion[],
  dates: string[],
): DayStat[] {
  const total = dailyItems.length
  const itemIds = new Set(dailyItems.map((i) => i.id))
  return dates.map((date) => {
    const done = completions.filter(
      (c) => c.for_date === date && itemIds.has(c.item_id),
    ).length
    return { date, done, total }
  })
}

/** The dates on which every one of this person's daily habits was completed. */
export function perfectDayDates(
  dailyItems: Item[],
  completions: Completion[],
  dates: string[],
): Set<string> {
  if (dailyItems.length === 0) return new Set()
  return new Set(
    weekStats(dailyItems, completions, dates)
      .filter((s) => s.total > 0 && s.done === s.total)
      .map((s) => s.date),
  )
}
