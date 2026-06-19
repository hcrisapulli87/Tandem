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
