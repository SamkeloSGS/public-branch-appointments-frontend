// The booking selection lives in the page address (service, date, time), so it survives the trip to Keycloak and back
// and can be shared as a link (spec 4.5).

export interface BookingSelection {
  serviceId?: string
  /** Branch-local date, yyyy-MM-dd */
  date?: string
  /** Branch-local time, HH:mm or HH:mm:ss */
  time?: string
}

export const BOOKING_STEPS = ['service', 'date', 'time', 'confirm'] as const
export type BookingStep = (typeof BOOKING_STEPS)[number]

const ID = /^[0-9a-fA-F-]{36}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}(:\d{2})?$/

function valid(value: unknown, pattern: RegExp): string | undefined {
  const single = Array.isArray(value) ? value[0] : value
  return typeof single === 'string' && pattern.test(single) ? single : undefined
}

/** Reads a selection from the query; anything malformed is ignored, and a later value needs the earlier ones. */
export function selectionFromQuery(query: Record<string, unknown>): BookingSelection {
  const serviceId = valid(query['service'], ID)
  const date = serviceId ? valid(query['date'], DATE) : undefined
  const time = date ? valid(query['time'], TIME) : undefined
  return { serviceId, date, time }
}

export function selectionToQuery(selection: BookingSelection): Record<string, string> {
  const query: Record<string, string> = {}
  if (selection.serviceId) query['service'] = selection.serviceId
  if (selection.date) query['date'] = selection.date
  if (selection.time) query['time'] = selection.time
  return query
}

/** The first step whose value is missing. */
export function currentStep(selection: BookingSelection): BookingStep {
  if (!selection.serviceId) return 'service'
  if (!selection.date) return 'date'
  if (!selection.time) return 'time'
  return 'confirm'
}

/** Goes back to change a step: clears that step's value and every value that depends on it. */
export function reopen(selection: BookingSelection, step: Exclude<BookingStep, 'confirm'>): BookingSelection {
  switch (step) {
    case 'service':
      return {}
    case 'date':
      return { serviceId: selection.serviceId }
    case 'time':
      return { ...selection, time: undefined }
  }
}

export function isComplete(selection: BookingSelection): selection is Required<BookingSelection> {
  return currentStep(selection) === 'confirm'
}
