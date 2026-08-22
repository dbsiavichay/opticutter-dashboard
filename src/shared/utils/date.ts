// Generic date helpers. Analytics-specific formatting (UTC-naive handling, bucket labels,
// duration in hours) lives in `dashboard/format.ts`.

// A Date → ISO calendar day 'YYYY-MM-DD' (UTC). Used for API date-range params and <input type="date">.
export const formatDate = (date: Date): string => date.toISOString().slice(0, 10)

// A Date → calendar day 'YYYY-MM-DD' in the browser's local time zone (not UTC).
// Used to detect calendar-day boundaries (e.g. forcing daily re-login) — using the
// UTC-based `formatDate` here would roll the day over at the wrong local hour.
export const localDateKey = (date: Date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// A calendar day 'YYYY-MM-DD' → 'dd/mm/yyyy', by reordering the parts rather than parsing.
// `fmtDate` cannot do this job: `new Date('2026-08-21')` is UTC midnight, which in Ecuador (UTC-5)
// renders as the 20th. A date-only string has no time zone to convert, so none is applied.
export const fmtDay = (day: string): string => {
  const [year, month, date] = day.split('-')
  return year && month && date ? `${date}/${month}/${year}` : day
}

// A new Date `n` days before `date` (does not mutate the input).
export const subDays = (date: Date, n: number): Date => {
  const d = new Date(date)
  d.setDate(d.getDate() - n)
  return d
}

// Human-readable "time ago" in Spanish: 'ahora', 'hace 5 min', 'hace 2 h', 'hace 3 d'.
export const relativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const hours = Math.round(min / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}
