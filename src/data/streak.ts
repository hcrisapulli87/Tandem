import { addDays } from './dates'

/**
 * Current consecutive-day streak for a single checklist item.
 *
 * "Grace for today" rule: if today isn't checked yet, the run isn't broken —
 * we start counting at yesterday. Once today is checked it extends the run.
 * The first missing day stops the count.
 *
 * @param completedDates - the YYYY-MM-DD days the item was completed
 * @param today          - the reference day, YYYY-MM-DD
 */
export function currentStreak(completedDates: Set<string>, today: string): number {
  let day = completedDates.has(today) ? today : addDays(today, -1)
  let count = 0
  while (completedDates.has(day)) {
    count++
    day = addDays(day, -1)
  }
  return count
}
