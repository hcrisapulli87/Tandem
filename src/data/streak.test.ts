import { describe, it, expect } from 'vitest'
import { currentStreak } from './streak'

const set = (...dates: string[]) => new Set(dates)

describe('currentStreak (grace-for-today rule)', () => {
  it('counts today plus consecutive earlier days when today is done', () => {
    expect(
      currentStreak(set('2026-06-14', '2026-06-15', '2026-06-16'), '2026-06-16'),
    ).toBe(3)
  })

  it('is 1 when only today is done', () => {
    expect(currentStreak(set('2026-06-16'), '2026-06-16')).toBe(1)
  })

  it('stops at the first gap before today', () => {
    // 15th missing → even though today and the 14th are done, the run is just today.
    expect(currentStreak(set('2026-06-14', '2026-06-16'), '2026-06-16')).toBe(1)
  })

  it('is 0 when nothing is completed', () => {
    expect(currentStreak(set(), '2026-06-16')).toBe(0)
  })

  // ── The design decision lives in these two cases ───────────────────────────
  // "Grace for today": today not yet done does NOT break a run that is intact
  // through yesterday. To switch to the stricter "today or zero" rule, change
  // the first expectation below to 0.
  it('keeps the streak through yesterday when today is not done yet', () => {
    expect(currentStreak(set('2026-06-14', '2026-06-15'), '2026-06-16')).toBe(2)
  })

  it('is 0 when neither today nor yesterday is done', () => {
    expect(currentStreak(set('2026-06-10', '2026-06-11'), '2026-06-16')).toBe(0)
  })
})
