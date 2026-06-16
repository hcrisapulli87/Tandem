import { useMemo } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useData } from '../data/DataProvider'
import { lastNDates } from '../data/dates'
import { currentStreak } from '../data/streak'
import { perfectDayDates, weekStats } from '../data/summary'
import { PersonSection } from '../components/PersonSection'
import type { Row } from '../components/PersonSection'

export default function Today() {
  const { user } = useAuth()
  const { loading, error, profiles, items, completions, today, toggleToday } = useData()

  const week = useMemo(() => lastNDates(7, today), [today])
  const completedToday = useMemo(
    () =>
      new Set(completions.filter((c) => c.for_date === today).map((c) => c.item_id)),
    [completions, today],
  )

  if (loading) return <p className="muted">Loading…</p>
  if (error) return <p className="error">{error}</p>
  if (profiles.length === 0) return <p className="muted">No profiles yet — sign in on both accounts.</p>

  // You first, then the other person.
  const ordered = [...profiles].sort((a, b) =>
    a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0,
  )

  return (
    <div className="today-grid">
      {ordered.map((profile) => {
        const personItems = items.filter((i) => i.owner_id === profile.id)
        const rows: Row[] = personItems.map((item) => ({
          item,
          done: completedToday.has(item.id),
        }))
        const dailyItems = personItems.filter((i) => i.kind === 'daily')
        const stats = weekStats(dailyItems, completions, week)
        const streak = currentStreak(perfectDayDates(dailyItems, completions, week), today)
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
          />
        )
      })}
    </div>
  )
}
