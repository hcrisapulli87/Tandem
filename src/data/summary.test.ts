import { describe, it, expect } from 'vitest'
import { weekStats, perfectDayDates } from './summary'
import type { Completion, Item } from './types'

const item = (id: string): Item => ({
  id,
  owner_id: 'u1',
  title: id,
  kind: 'daily',
  active: true,
  shared: false,
  sort_order: 0,
  created_at: '2026-01-01',
})

const comp = (itemId: string, date: string): Completion => ({
  id: `${itemId}-${date}`,
  item_id: itemId,
  owner_id: 'u1',
  for_date: date,
  completed_at: date,
})

const dates = ['2026-06-15', '2026-06-16']

describe('weekStats', () => {
  it('counts each day’s completions against the total daily items', () => {
    const items = [item('a'), item('b')]
    const completions = [comp('a', '2026-06-15'), comp('a', '2026-06-16'), comp('b', '2026-06-16')]
    expect(weekStats(items, completions, dates)).toEqual([
      { date: '2026-06-15', done: 1, total: 2 },
      { date: '2026-06-16', done: 2, total: 2 },
    ])
  })

  it('ignores completions for items the person does not have', () => {
    const items = [item('a')]
    const completions = [comp('a', '2026-06-16'), comp('other', '2026-06-16')]
    expect(weekStats(items, completions, dates)).toEqual([
      { date: '2026-06-15', done: 0, total: 1 },
      { date: '2026-06-16', done: 1, total: 1 },
    ])
  })
})

describe('perfectDayDates', () => {
  it('returns only dates where all daily items were completed', () => {
    const items = [item('a'), item('b')]
    const completions = [comp('a', '2026-06-15'), comp('a', '2026-06-16'), comp('b', '2026-06-16')]
    expect(perfectDayDates(items, completions, dates)).toEqual(new Set(['2026-06-16']))
  })

  it('is empty when the person has no daily items', () => {
    expect(perfectDayDates([], [], dates)).toEqual(new Set())
  })
})
