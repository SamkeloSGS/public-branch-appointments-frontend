// Arithmetic on the API's local dates (yyyy-MM-dd) and local times (HH:mm:ss). Branch-local values stay strings and
// are never converted through the browser's time zone.

export type LocalDate = string
export type LocalTime = string

const pad = (value: number) => String(value).padStart(2, '0')

function parts(date: LocalDate): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number)
  return [year ?? 0, month ?? 1, day ?? 1]
}

/** Today's date in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): LocalDate {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  )
  return `${values['year']}-${values['month']}-${values['day']}`
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [year, month, day] = parts(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
}

export function firstOfMonth(date: LocalDate): LocalDate {
  return `${date.slice(0, 7)}-01`
}

export function lastOfMonth(date: LocalDate): LocalDate {
  const [year, month] = parts(date)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${pad(month)}-${pad(last)}`
}

export function earlier(a: LocalDate, b: LocalDate): LocalDate {
  return a < b ? a : b
}

export function later(a: LocalDate, b: LocalDate): LocalDate {
  return a > b ? a : b
}

/** The branch-local date-time the API expects for a start, e.g. 2026-10-14T09:30:00. */
export function localDateTime(date: LocalDate, time: LocalTime): string {
  return `${date}T${time.length === 5 ? `${time}:00` : time}`
}

export function isLocalDate(value: unknown): value is LocalDate {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)
}

/** Day of the week, Monday = 0 to Sunday = 6. */
export function weekdayIndex(date: LocalDate): number {
  const [year, month, day] = parts(date)
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

/** Every date of the month that `date` falls in. */
export function datesOfMonth(date: LocalDate): LocalDate[] {
  const first = firstOfMonth(date)
  const last = lastOfMonth(date)
  const dates: LocalDate[] = []
  for (let current = first; current <= last; current = addDays(current, 1)) dates.push(current)
  return dates
}

export function addMonths(date: LocalDate, months: number): LocalDate {
  const [year, month] = parts(date)
  const shifted = new Date(Date.UTC(year, month - 1 + months, 1))
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-01`
}
