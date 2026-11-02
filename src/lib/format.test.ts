import { describe, expect, it } from 'vitest'
import { distanceKm, isEmail, isValidSaId, normalizePhone, prettyPhone, profileChecklist, rands } from './format'

describe('normalizePhone', () => {
  it('accepts local SA mobile formats', () => {
    expect(normalizePhone('083 302 8969')).toBe('+27833028969')
    expect(normalizePhone('0833028969')).toBe('+27833028969')
    expect(normalizePhone('+27 83 302 8969')).toBe('+27833028969')
    expect(normalizePhone('0027833028969')).toBe('+27833028969')
    expect(normalizePhone('071-234-5678')).toBe('+27712345678')
  })
  it('rejects landlines and junk', () => {
    expect(normalizePhone('021 000 0000')).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('')).toBeNull()
  })
  it('allows other countries in international format', () => {
    expect(normalizePhone('+263 77 123 4567')).toBe('+263771234567')
  })
})

describe('isValidSaId', () => {
  it('accepts a valid ID number', () => expect(isValidSaId('8001015009087')).toBe(true))
  it('rejects a wrong check digit', () => expect(isValidSaId('8001015009088')).toBe(false))
  it('rejects an impossible date', () => expect(isValidSaId('8013015009087')).toBe(false))
  it('rejects wrong length', () => expect(isValidSaId('800101500908')).toBe(false))
})

describe('helpers', () => {
  it('formats rands from cents', () => expect(rands(45000)).toBe('R450'))
  it('formats thousands', () => expect(rands(140000).replace(/\s/g, ' ')).toBe('R1 400'))
  it('prints phones nicely', () => expect(prettyPhone('+27833028969')).toBe('+27 83 302 8969'))
  it('validates email', () => {
    expect(isEmail('matthew@example.com')).toBe(true)
    expect(isEmail('matthew@example')).toBe(false)
  })
  it('measures distance in km', () => {
    const d = distanceKm(-33.938, 18.471, -33.927, 18.448) // Observatory to Woodstock
    expect(d).toBeGreaterThan(2)
    expect(d).toBeLessThan(3)
  })
  it('lists what is left on a profile', () => {
    const left = profileChecklist({ photo_path: null, address: 'x', cv_path: null, rtw_status: 'pending', positions: [] }).filter(i => !i.done)
    expect(left.map(i => i.key)).toEqual(['photo', 'jobs', 'cv'])
  })
})
