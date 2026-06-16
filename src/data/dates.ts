// Local-time date helpers.
//
// We deliberately never use Date.prototype.toISOString() to derive "today":
// that formats in UTC, so for someone east/west of UTC the calendar day can be
// off by one near midnight. Everything here works in the browser's LOCAL time,
// which is what "today" means to the two people using the app.

/** Format a Date as YYYY-MM-DD using its LOCAL calendar day. */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today's local date as YYYY-MM-DD. `now` is injectable for testing. */
export function todayISO(now: Date = new Date()): string {
  return toLocalISODate(now)
}

/** Parse a YYYY-MM-DD string into a LOCAL Date (avoids UTC parsing surprises). */
function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Add (or subtract, with a negative delta) whole days to a YYYY-MM-DD string. */
export function addDays(iso: string, delta: number): string {
  const d = parseLocal(iso)
  d.setDate(d.getDate() + delta)
  return toLocalISODate(d)
}

/** The last `n` dates ending at `today` (inclusive), oldest first. */
export function lastNDates(n: number, today: string): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    out.push(addDays(today, -i))
  }
  return out
}
