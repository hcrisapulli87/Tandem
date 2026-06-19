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
