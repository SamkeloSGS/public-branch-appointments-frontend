// Display formatting with Intl. Branch-local dates and times from the API are formatted as given (they are already in
// the branch's zone); instants are formatted in an explicitly named zone, never the browser's.

function utcDate(date: string, time = '00:00:00'): Date {
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}Z`)
}

/** e.g. "Wednesday, 14 October 2026" */
export function formatDate(date: string, locale: string, style: 'long' | 'medium' | 'short' = 'long'): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'medium'
        ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
        : { day: 'numeric', month: 'short' }
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(utcDate(date))
}

/** e.g. "October 2026" */
export function formatMonth(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utcDate(date))
}

/** e.g. "09:30" for the local time "09:30:00" */
export function formatTime(time: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(
    utcDate('2000-01-01', time),
  )
}

/** An instant shown in the given IANA zone */
export function formatInstant(instant: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(instant))
}

/** The zone's display name, e.g. "South Africa Standard Time" */
export function zoneName(timeZone: string, locale: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'long' })
    .formatToParts(at)
    .find((candidate) => candidate.type === 'timeZoneName')
  return part?.value ?? timeZone
}
