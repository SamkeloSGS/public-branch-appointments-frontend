import { describe, expect, it } from 'vitest'
import { prerequisitesFromText, prerequisitesToText, rangeProblems, weeklyHoursOf, weeklyHoursRequest } from './branch-admin'

describe('branch administration rules', () => {
  it('FE-11 weekly hours round-trip between the API and the editor', () => {
    const hours = weeklyHoursOf({ MONDAY: [{ start: '08:00:00', end: '16:30:00' }] })
    expect(hours.MONDAY).toEqual([{ start: '08:00', end: '16:30' }])
    expect(hours.SUNDAY).toEqual([])
    expect(weeklyHoursRequest(hours)).toEqual({ MONDAY: [{ start: '08:00:00', end: '16:30:00' }] })
  })

  it('FE-11 hour ranges must end after they start and not overlap', () => {
    expect(rangeProblems([{ start: '08:00', end: '12:00' }, { start: '13:00', end: '16:00' }])).toEqual([])
    expect(rangeProblems([{ start: '12:00', end: '08:00' }])).toEqual(['admin.hours.errors.endBeforeStart'])
    expect(rangeProblems([{ start: '08:00', end: '12:00' }, { start: '11:00', end: '14:00' }])).toEqual([
      'admin.hours.errors.overlap',
    ])
  })

  it('FE-13 prerequisites are edited one per line, without blank lines', () => {
    expect(prerequisitesFromText(' Your ID document \n\n Proof of address\r\n')).toEqual([
      'Your ID document',
      'Proof of address',
    ])
    expect(prerequisitesToText(['Your ID document', 'Proof of address'])).toBe('Your ID document\nProof of address')
    expect(prerequisitesFromText('')).toEqual([])
  })
})
