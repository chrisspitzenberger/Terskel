/**
 * Wettkampfprognosen aus LT2
 *
 * Die Referenzwerte stammen aus der Riegel-Formel mit LT2 als Stundenleistung
 * und decken sich fuer 5 km und 10 km eng mit Daniels' VDOT-Tabelle.
 */

import { describe, it, expect } from 'vitest'
import { predictRaceTimeFromLT2, predictRaces } from '@/lib/calculations/race-prediction'

/** Sekunden -> "H:MM:SS" bzw. "M:SS" */
function fmt(seconds: number): string {
  const total = Math.round(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

describe('predictRaceTimeFromLT2', () => {
  it('gibt für die Stundenleistung selbst genau 60 Minuten zurück', () => {
    // Bei LT2 = 15 km/h ist die Stundenleistung per Definition 15 km
    expect(predictRaceTimeFromLT2(15, 15)).toBeCloseTo(3600, 6)
  })

  it('sagt kürzere Distanzen schneller als Schwellentempo voraus', () => {
    const lt2Speed = 15
    const thresholdPace = 3600 / lt2Speed
    const pace5k = predictRaceTimeFromLT2(lt2Speed, 5) / 5
    expect(pace5k).toBeLessThan(thresholdPace)
  })

  it('sagt längere Distanzen langsamer als Schwellentempo voraus', () => {
    const lt2Speed = 15
    const thresholdPace = 3600 / lt2Speed
    const paceMarathon = predictRaceTimeFromLT2(lt2Speed, 42.195) / 42.195
    expect(paceMarathon).toBeGreaterThan(thresholdPace)
  })

  it('trifft für die Stundendistanz exakt 60 Minuten', () => {
    // LT2 10 km/h -> die Stundenleistung sind genau 10 km
    expect(fmt(predictRaceTimeFromLT2(10, 10))).toBe('1:00:00')
  })

  it('liefert für einen Leistungsläufer (LT2 3:04/km) plausible Zeiten', () => {
    // Deckt sich bis auf wenige Sekunden mit Daniels' VDOT-Aequivalenzen
    // (14:14 / 29:36 / 1:05:11 / 2:16:49)
    const lt2Speed = 19.52
    expect(fmt(predictRaceTimeFromLT2(lt2Speed, 5))).toBe('14:10')
    expect(fmt(predictRaceTimeFromLT2(lt2Speed, 10))).toBe('29:32')
    expect(fmt(predictRaceTimeFromLT2(lt2Speed, 21.0975))).toBe('1:05:09')
    expect(fmt(predictRaceTimeFromLT2(lt2Speed, 42.195))).toBe('2:16:53')
  })

  it('liefert für einen Freizeitläufer (LT2 4:48/km) plausible Zeiten', () => {
    const lt2Speed = 12.52
    expect(fmt(predictRaceTimeFromLT2(lt2Speed, 5))).toBe('22:41')
    expect(fmt(predictRaceTimeFromLT2(lt2Speed, 10))).toBe('47:17')
    expect(fmt(predictRaceTimeFromLT2(lt2Speed, 21.0975))).toBe('1:44:19')
    expect(fmt(predictRaceTimeFromLT2(lt2Speed, 42.195))).toBe('3:40:10')
  })

  it('skaliert den Marathon-Abfall mit dem Leistungsniveau', () => {
    // Der Verlust gegenueber dem Schwellentempo muss beim langsameren Laeufer
    // groesser sein - genau das leistete die alte Faktor-Methode nicht.
    const lossFor = (lt2Speed: number) => {
      const thresholdPace = 3600 / lt2Speed
      const marathonPace = predictRaceTimeFromLT2(lt2Speed, 42.195) / 42.195
      return marathonPace - thresholdPace
    }
    expect(lossFor(10)).toBeGreaterThan(lossFor(20))
  })

  it('behandelt ungültige Eingaben ohne NaN', () => {
    expect(predictRaceTimeFromLT2(0, 10)).toBe(0)
    expect(predictRaceTimeFromLT2(-5, 10)).toBe(0)
    expect(predictRaceTimeFromLT2(15, 0)).toBe(0)
    expect(predictRaceTimeFromLT2(Infinity, 10)).toBe(0)
  })
})

describe('predictRaces', () => {
  const races = predictRaces(15)

  it('liefert alle vier Standarddistanzen', () => {
    expect(races.map(r => r.label)).toEqual(['5 km', '10 km', 'Halbmarathon', 'Marathon'])
  })

  it('liefert mit der Distanz steigende Zeiten und langsamere Paces', () => {
    for (let i = 0; i < races.length - 1; i++) {
      expect(races[i + 1].timeSeconds).toBeGreaterThan(races[i].timeSeconds)
      expect(races[i + 1].paceSecondsPerKm).toBeGreaterThan(races[i].paceSecondsPerKm)
    }
  })

  it('hält Pace und Zeit konsistent', () => {
    for (const race of races) {
      expect(race.paceSecondsPerKm * race.distanceKm).toBeCloseTo(race.timeSeconds, 6)
    }
  })
})
