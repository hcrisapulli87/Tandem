import { describe, it, expect } from 'vitest'
import { toLocalISODate, todayISO, addDays, lastNDates } from './dates'

describe('todayISO', () => {
  it('returns the local calendar day for a given instant', () => {
    expect(todayISO(new Date(2026, 5, 16, 8, 0, 0))).toBe('2026-06-16')
  })
})

describe('toLocalISODate', () => {
  it('formats a Date as YYYY-MM-DD in LOCAL time, zero-padded', () => {
    // Constructed from local components: 5 Jan 2026, late evening.
    // toISOString() (UTC) could report this as Jan 4 or 5 depending on TZ —
    // we require the local calendar day regardless of timezone.
    const d = new Date(2026, 0, 5, 23, 30, 0)
    expect(toLocalISODate(d)).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('rolls forward across a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('rolls backward across a month boundary', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28') // 2026 is not a leap year
  })
})

describe('lastNDates', () => {
  it('returns n dates ending at today (inclusive), oldest first', () => {
    expect(lastNDates(3, '2026-06-16')).toEqual([
      '2026-06-14',
      '2026-06-15',
      '2026-06-16',
    ])
  })
})
