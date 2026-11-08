import { describe, expect, it } from 'vitest'
import { staffTransitions } from './staff'

describe('staff management rules', () => {
  it('FE-13 staff actions follow the member status', () => {
    expect(staffTransitions('INVITED')).toEqual(['reinvite', 'remove'])
    expect(staffTransitions('SUSPENDED')).toEqual(['reinstate', 'remove'])
    expect(staffTransitions('REMOVED')).toEqual([])
  })
})
