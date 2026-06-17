import type { DayStat } from '../data/summary'

// Current "perfect day" streak plus a last-7-days dot row (full / partial / empty).
export function StreakBadge({ streak, week }: { streak: number; week: DayStat[] }) {
  return (
    <div className="streak" title={`${streak}-day streak`}>
      <span className="streak__count">⭐ {streak}</span>
      <span className="streak__dots">
        {week.map((s) => {
          const cls =
            s.total > 0 && s.done === s.total
              ? 'dot dot--full'
              : s.done > 0
                ? 'dot dot--partial'
                : 'dot'
          return (
            <span key={s.date} className={cls} title={`${s.date}: ${s.done}/${s.total}`} />
          )
        })}
      </span>
    </div>
  )
}
