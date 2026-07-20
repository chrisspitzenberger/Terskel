import { describe, it, expect } from 'vitest'
import { formatPace, formatPaceFromSecondsPerKm, formatDuration } from '@/lib/calculations/pace'

describe('formatPace', () => {
  it('formatiert ganze Minuten', () => {
    expect(formatPace(5)).toBe('5:00')
  })

  it('formatiert Sekundenanteile', () => {
    expect(formatPace(4.5)).toBe('4:30')
    expect(formatPace(3.25)).toBe('3:15')
  })

  it('rollt auf die nächste Minute statt ":60" auszugeben', () => {
    // 4.9999 min entspricht 4:59.99 -> muss 5:00 werden, nicht 4:60
    expect(formatPace(4.9999)).toBe('5:00')
    expect(formatPace(5.99999)).toBe('6:00')
  })

  it('liefert Platzhalter für ungültige Werte', () => {
    expect(formatPace(0)).toBe('--:--')
    expect(formatPace(-1)).toBe('--:--')
    expect(formatPace(Infinity)).toBe('--:--')
  })
})

describe('formatPaceFromSecondsPerKm', () => {
  it('formatiert Sekunden pro Kilometer', () => {
    expect(formatPaceFromSecondsPerKm(300)).toBe('5:00')
    expect(formatPaceFromSecondsPerKm(215)).toBe('3:35')
  })

  it('rollt auf die nächste Minute statt ":60" auszugeben', () => {
    expect(formatPaceFromSecondsPerKm(359.7)).toBe('6:00')
  })

  it('liefert Platzhalter für ungültige Werte', () => {
    expect(formatPaceFromSecondsPerKm(0)).toBe('--:--')
    expect(formatPaceFromSecondsPerKm(NaN)).toBe('--:--')
  })
})

describe('formatDuration', () => {
  it('formatiert Minuten und Sekunden', () => {
    expect(formatDuration(125)).toBe('2:05')
  })

  it('formatiert Stunden', () => {
    expect(formatDuration(3725)).toBe('1:02:05')
  })
})
