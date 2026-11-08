import type { components } from './api.generated'
import { DAYS_OF_WEEK, type DayOfWeek } from './branch'

type Schemas = components['schemas']
export type AdminBranch = Schemas['BranchResponse']
export type Segment = AdminBranch['segments'][number]
export type Pool = Schemas['PoolResponse']
export type Offering = Schemas['OfferingResponse']
export type CalendarException = Schemas['ExceptionResponse']
export type CapacityOverride = Schemas['OverrideResponse']
export type OverrideReason = CapacityOverride['reason']
export type AdminService = Schemas['ServiceResponse']
export type AdminCategory = Schemas['ServiceCategoryResponse']
export type OfferServiceRequest = Schemas['OfferServiceRequest']
export type ChangeOfferingRequest = Schemas['ChangeOfferingRequest']
export type AddExceptionRequest = Schemas['AddExceptionRequest']
export type SetOverrideRequest = Schemas['SetOverrideRequest']
export type DefineServiceRequest = Schemas['DefineServiceRequest']
export type DefineCategoryRequest = Schemas['DefineServiceCategoryRequest']

export interface TimeRangeValue {
  start: string
  end: string
}

export type WeeklyHours = Record<DayOfWeek, TimeRangeValue[]>

export const SEGMENTS: readonly Segment[] = ['PERSONAL', 'BUSINESS']
export const OVERRIDE_REASONS: readonly OverrideReason[] = [
  'SHORT_STAFFED',
  'LEAVE',
  'TRAINING',
  'OUTAGE',
  'EXTRA_STAFF',
  'OTHER',
]

/** HH:mm for an input of type time, from the API's HH:mm:ss. */
export function toTimeInput(time: string): string {
  return time.slice(0, 5)
}

/** HH:mm:ss for the API, from an input of type time. */
export function fromTimeInput(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

/** Every weekday with its ranges as the editor shows them; days without hours are closed. */
export function weeklyHoursOf(source: Partial<Record<string, readonly TimeRangeValue[] | undefined>>): WeeklyHours {
  return Object.fromEntries(
    DAYS_OF_WEEK.map((day) => [day, (source[day] ?? []).map((range) => ({ start: toTimeInput(range.start), end: toTimeInput(range.end) }))]),
  ) as WeeklyHours
}

/** The request body: open days only, times as HH:mm:ss. */
export function weeklyHoursRequest(hours: WeeklyHours): Record<string, TimeRangeValue[]> {
  return Object.fromEntries(
    DAYS_OF_WEEK.filter((day) => hours[day].length > 0).map((day) => [
      day,
      hours[day].map((range) => ({ start: fromTimeInput(range.start), end: fromTimeInput(range.end) })),
    ]),
  )
}

/**
 * Problems with one day's ranges, as translation keys: empty times, an end not after its start, or overlapping
 * ranges. The server validates again; this only catches mistakes early.
 */
export function rangeProblems(ranges: readonly TimeRangeValue[]): string[] {
  const problems = new Set<string>()
  for (const range of ranges) {
    if (!range.start || !range.end) problems.add('admin.hours.errors.missing')
    else if (range.end <= range.start) problems.add('admin.hours.errors.endBeforeStart')
  }
  const sorted = [...ranges].filter((range) => range.start && range.end).sort((a, b) => a.start.localeCompare(b.start))
  for (let index = 1; index < sorted.length; index++) {
    if (sorted[index]!.start < sorted[index - 1]!.end) problems.add('admin.hours.errors.overlap')
  }
  return [...problems]
}

/** Prerequisites from a text area, one per line; blank lines are dropped. */
export function prerequisitesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** Prerequisites for a text area, one per line. */
export function prerequisitesToText(prerequisites: readonly string[]): string {
  return prerequisites.join('\n')
}
