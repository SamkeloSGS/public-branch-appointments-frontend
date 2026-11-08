import type { components } from './api.generated'

type Schemas = components['schemas']
/** The branch this app runs for, with its hours and the services it takes bookings for. */
export type BranchDetail = Schemas['PublicBranchDetail']
export type OfferedService = Schemas['PublicOfferedService']
export type Service = Schemas['PublicServiceResponse']
export type ServiceCategory = Schemas['PublicServiceCategoryResponse']
export type TimeRange = Schemas['TimeRangeDto']
export type Address = Schemas['AddressDto']

export const DAYS_OF_WEEK = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number]

export function hoursOn(branch: Pick<BranchDetail, 'weeklyHours'>, day: DayOfWeek): TimeRange[] {
  return branch.weeklyHours[day] ?? []
}

export function formatAddress(address: Address): string {
  return [address.street, address.city, address.postalCode].filter(Boolean).join(', ')
}

export function serviceName(branch: Pick<BranchDetail, 'services'>, serviceId: string): string | undefined {
  return branch.services.find((service) => service.serviceId === serviceId)?.name
}

export interface MapLocation {
  latitude: number
  longitude: number
}

/** About 0.006 degrees on each side: a few streets around the branch. */
const MAP_SPAN = 0.006

/** An OpenStreetMap embed centred on the location, with a marker. */
export function mapEmbedUrl(location: MapLocation): string {
  const { latitude, longitude } = location
  const bbox = [longitude - MAP_SPAN, latitude - MAP_SPAN, longitude + MAP_SPAN, latitude + MAP_SPAN]
    .map((value) => value.toFixed(5))
    .join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`
}

/** Directions to the location in Google Maps, from wherever the visitor is. */
export function directionsUrl(location: MapLocation): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`
}

export interface ServiceGroup {
  id: string
  name: string
  /** Categories of the same name exist for personal and business customers, so the segment tells them apart */
  segment: string
  services: OfferedService[]
}

/**
 * The branch's services grouped by category, in catalog order and by name within a group. Services whose category is
 * not in the catalog (or when the catalog could not be loaded) are grouped by customer segment, named by `segmentName`.
 */
export function servicesByCategory(
  services: readonly OfferedService[],
  categories: readonly Pick<ServiceCategory, 'id' | 'name' | 'segment'>[],
  segmentName: (segment: string) => string,
): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup>()
  for (const category of categories) {
    groups.set(category.id, { id: category.id, name: category.name, segment: category.segment, services: [] })
  }
  for (const service of services) {
    let group = groups.get(service.categoryId)
    if (!group) {
      const id = `segment:${service.segment}`
      group = groups.get(id) ?? { id, name: segmentName(service.segment), segment: service.segment, services: [] }
      groups.set(id, group)
    }
    group.services.push(service)
  }
  return [...groups.values()]
    .filter((group) => group.services.length > 0)
    .map((group) => ({ ...group, services: [...group.services].sort((a, b) => a.name.localeCompare(b.name)) }))
}
