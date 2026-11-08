import type { components } from './api.generated'

type Schemas = components['schemas']
export type Customer = Schemas['CustomerResponse']
export type CustomerRequest = Schemas['CustomerRequest']
export type ContactDetailsRequest = Schemas['ContactDetailsRequest']
export type ContactPreferencesRequest = Schemas['ContactPreferencesRequest']

/** Languages a customer can receive messages in; the same list as the backend's. */
export const LANGUAGES = ['en', 'af', 'zu', 'xh', 'st'] as const
export type Language = (typeof LANGUAGES)[number]

export type Channel = 'email' | 'sms'

export interface ContactDetailsValues {
  givenName: string
  familyName: string
  email: string
  phone: string
  language: Language
}

export const NAME_MAX_LENGTH = 100
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/

export function contactDetailsValues(customer?: Partial<Customer>, email?: string): ContactDetailsValues {
  return {
    givenName: customer?.givenName ?? '',
    familyName: customer?.familyName ?? '',
    email: customer?.email ?? email ?? '',
    phone: customer?.phone ?? '',
    language: (LANGUAGES as readonly string[]).includes(customer?.language ?? '')
      ? (customer?.language as Language)
      : 'en',
  }
}

/** At least an email address or a phone number is needed, so confirmations can be sent (FE-4). */
export function hasSomeContact(values: Pick<ContactDetailsValues, 'email' | 'phone'>): boolean {
  return values.email.trim() !== '' || values.phone.trim() !== ''
}

/** The request body for contact details: blank optional fields are sent as absent. */
export function contactDetailsRequest(values: ContactDetailsValues): ContactDetailsRequest {
  return {
    givenName: values.givenName.trim(),
    familyName: values.familyName.trim(),
    email: values.email.trim() || undefined,
    phone: values.phone.trim() || undefined,
  }
}

/** The request body for a new profile, with the language for messages. */
export function customerRequest(values: ContactDetailsValues): CustomerRequest {
  return { ...contactDetailsRequest(values), language: values.language }
}

export interface Preferences {
  emailEnabled: boolean
  smsEnabled: boolean
  language: string
}

/** A channel can be switched on only when the customer has its contact detail. */
export function hasContactFor(customer: Pick<Customer, 'email' | 'phone'>, channel: Channel): boolean {
  return channel === 'email' ? Boolean(customer.email) : Boolean(customer.phone)
}

/** The last enabled channel cannot be switched off (FE-8). */
export function isLastChannel(preferences: Preferences, channel: Channel): boolean {
  return channel === 'email'
    ? preferences.emailEnabled && !preferences.smsEnabled
    : preferences.smsEnabled && !preferences.emailEnabled
}

/** Translation keys for the customer module's error codes. */
export const customerErrorMessages = {
  CONTACT_REQUIRED: 'customer.errors.CONTACT_REQUIRED',
  CHANNEL_WITHOUT_CONTACT: 'customer.errors.CHANNEL_WITHOUT_CONTACT',
  NO_CHANNEL_ENABLED: 'customer.errors.NO_CHANNEL_ENABLED',
  INVALID_STATE: 'customer.errors.INVALID_STATE',
  PROFILE_EXISTS: 'customer.errors.PROFILE_EXISTS',
  EMAIL_IN_USE: 'customer.errors.EMAIL_IN_USE',
  CONTACT_DETAILS_UNAVAILABLE: 'customer.errors.CONTACT_DETAILS_UNAVAILABLE',
} as const

export type CustomerSummary = Schemas['CustomerSummaryResponse']
export type CustomerStatus = Customer['status']

/** Staff search needs at least this many characters before a request is sent (spec 6). */
export const MIN_SEARCH_LENGTH = 3

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_SEARCH_LENGTH
}

/** "Given Family", or undefined for an erased customer. */
export function displayName(customer: Pick<Customer, 'givenName' | 'familyName'>): string | undefined {
  const name = [customer.givenName, customer.familyName].filter(Boolean).join(' ')
  return name || undefined
}

/** The customer that already has an email, returned with an EMAIL_IN_USE rejection (staff only). */
export function existingCustomerId(problem: Record<string, unknown>): string | undefined {
  const id = problem['existingCustomerId']
  return typeof id === 'string' ? id : undefined
}

/** Translation keys for rejections on the staff screens, where an email clash may be named. */
export const customerAdminErrorMessages = {
  ...customerErrorMessages,
  EMAIL_IN_USE: 'admin.customers.errors.EMAIL_IN_USE',
} as const
