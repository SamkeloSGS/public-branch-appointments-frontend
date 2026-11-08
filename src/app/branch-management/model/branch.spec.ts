import { describe, expect, it } from 'vitest'
import {
  directionsUrl,
  formatAddress,
  hoursOn,
  mapEmbedUrl,
  serviceName,
  servicesByCategory,
  type BranchDetail,
  type OfferedService,
} from './branch'

const branch = {
  code: 'MAIN',
  name: 'Main Branch',
  address: { street: '1 Main Road', city: 'Cape Town', postalCode: '8001', province: 'WC' },
  location: { latitude: 0, longitude: 0 },
  timeZone: 'Africa/Johannesburg',
  segments: ['PERSONAL'],
  weeklyHours: { MONDAY: [{ start: '08:00:00', end: '17:00:00' }] },
  services: [{ serviceId: 's1', name: 'Card replacement', categoryId: 'c1', segment: 'PERSONAL', durationMinutes: 15 }],
} as unknown as BranchDetail

describe('branch rules', () => {
  it('FE-5 an address reads as one line', () => {
    expect(formatAddress(branch.address)).toBe('1 Main Road, Cape Town, 8001')
  })

  it('FE-5 a day without hours is closed', () => {
    expect(hoursOn(branch, 'MONDAY')).toHaveLength(1)
    expect(hoursOn(branch, 'SUNDAY')).toEqual([])
  })

  it('FE-5 services are named from the branch', () => {
    expect(serviceName(branch, 's1')).toBe('Card replacement')
    expect(serviceName(branch, 'other')).toBeUndefined()
  })

  it('FE-5 the map is centred on the branch with a marker, and directions lead there', () => {
    const location = { latitude: -33.9249, longitude: 18.4241 }
    expect(mapEmbedUrl(location)).toBe(
      'https://www.openstreetmap.org/export/embed.html?bbox=18.41810,-33.93090,18.43010,-33.91890&layer=mapnik&marker=-33.9249,18.4241',
    )
    expect(directionsUrl(location)).toBe('https://www.google.com/maps/dir/?api=1&destination=-33.9249,18.4241')
  })

  it('FE-5 services are grouped by category in catalog order, unknown categories by segment', () => {
    const service = (name: string, categoryId: string, segment = 'PERSONAL') =>
      ({ serviceId: name, name, categoryId, segment, durationMinutes: 30, description: null }) as OfferedService
    const groups = servicesByCategory(
      [service('Loan', 'credit'), service('Card', 'transact'), service('Account', 'transact'), service('Bond', 'x', 'BUSINESS')],
      [
        { id: 'transact', name: 'Transact', segment: 'PERSONAL' },
        { id: 'credit', name: 'Credit', segment: 'PERSONAL' },
        { id: 'empty', name: 'Empty', segment: 'BUSINESS' },
      ],
      (segment) => `Segment ${segment}`,
    )
    expect(groups.map((group) => group.name)).toEqual(['Transact', 'Credit', 'Segment BUSINESS'])
    expect(groups[0]!.services.map((s) => s.name)).toEqual(['Account', 'Card'])
    expect(groups.map((group) => group.segment)).toEqual(['PERSONAL', 'PERSONAL', 'BUSINESS'])
  })
})
