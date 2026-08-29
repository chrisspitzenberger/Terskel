/**
 * Lactate Threshold Calculation Tests
 * 
 * Diese Testdatei prüft, ob die Schwellenberechnung korrekt funktioniert.
 * 
 * NEUE TESTSZENARIEN HINZUFÜGEN:
 * ================================
 * 1. Kopiere ein bestehendes Szenario in das `scenarios`-Array unten
 * 2. Passe die Stufenwerte an (pace in "M:SS", HR, Laktat)
 * 3. Trage die erwarteten LT1/LT2-Werte ein
 * 4. Starte: npm test
 * 
 * TOLERANZEN:
 * - Pace: ±5 Sekunden pro km
 * - Laktat: ±0.15 mmol/L
 * - Herzfrequenz: ±3 bpm
 */

import { describe, it, expect } from 'vitest'
import { detectThresholds, calculateTrainingZones, type ThresholdAnalysis } from '@/lib/calculations/lactate-threshold'
import type { StepTestStep } from '@/lib/db/schemas'

// ============================================================================
// HELPER
// ============================================================================

/** Parse "M:SS" Pace zu Sekunden pro km */
function parsePace(pace: string): number {
  const [min, sec] = pace.split(':').map(Number)
  return min * 60 + sec
}

/** Sekunden pro km → "M:SS" */
function formatPace(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.round(seconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// ============================================================================
// TESTDATEN-FORMAT
// ============================================================================

interface StepInput {
  step: number
  pace: string      // "M:SS" Format
  hr: number         // bpm
  lactate: number    // mmol/L
}

interface ExpectedThreshold {
  pace: string       // "M:SS" erwartetes Tempo
  lactate: number    // mmol/L erwarteter Laktatwert
  hr: number         // bpm erwartete Herzfrequenz
}

interface TestScenario {
  name: string
  description?: string
  steps: StepInput[]
  expected: {
    lt1: ExpectedThreshold
    lt2: ExpectedThreshold
  }
  /** Pace-Toleranz in Sekunden (default: 5) */
  paceTolerance?: number
  /** Laktat-Toleranz in mmol/L (default: 0.15) */
  lactateTolerance?: number
  /** HR-Toleranz in bpm (default: 3) */
  hrTolerance?: number
}

// ============================================================================
// TESTSZENARIEN
// Neue Szenarien einfach hier unten anfügen!
// ============================================================================

const scenarios: TestScenario[] = [
  {
    name: 'Standardtest 8 Stufen (Christoph Mai 2026)',
    description: 'Typischer Stufentest mit klarer Laktatkurve, Dip bei Stufe 2',
    steps: [
      { step: 1, pace: '4:30', hr: 125, lactate: 1.0 },
      { step: 2, pace: '4:15', hr: 133, lactate: 0.9 },
      { step: 3, pace: '4:00', hr: 142, lactate: 1.0 },
      { step: 4, pace: '3:45', hr: 151, lactate: 1.2 },
      { step: 5, pace: '3:30', hr: 161, lactate: 1.5 },
      { step: 6, pace: '3:15', hr: 170, lactate: 2.2 },
      { step: 7, pace: '3:00', hr: 181, lactate: 3.8 },
      { step: 8, pace: '2:45', hr: 190, lactate: 7.5 },
    ],
    expected: {
      lt1: { pace: '3:36', lactate: 1.30, hr: 157 },
      lt2: { pace: '3:04', lactate: 3.23, hr: 178 },
    },
  },

  {
    name: 'Erhoehtes Aufwaermlaktat auf Stufe 1',
    description:
      'Gleiche Kurve wie der Standardtest, aber Stufe 1 startet mit 1.8 statt 1.0 mmol/L. ' +
      'Ein erhoehter Startwert durch das Aufwaermen darf die Schwellen nicht verschieben.',
    steps: [
      { step: 1, pace: '4:30', hr: 125, lactate: 1.8 },
      { step: 2, pace: '4:15', hr: 133, lactate: 0.9 },
      { step: 3, pace: '4:00', hr: 142, lactate: 1.0 },
      { step: 4, pace: '3:45', hr: 151, lactate: 1.2 },
      { step: 5, pace: '3:30', hr: 161, lactate: 1.5 },
      { step: 6, pace: '3:15', hr: 170, lactate: 2.2 },
      { step: 7, pace: '3:00', hr: 181, lactate: 3.8 },
      { step: 8, pace: '2:45', hr: 190, lactate: 7.5 },
    ],
    expected: {
      lt1: { pace: '3:31', lactate: 1.30, hr: 160 },
      lt2: { pace: '3:04', lactate: 3.38, hr: 178 },
    },
    lactateTolerance: 0.25,
    hrTolerance: 5,
  },

  // ──────────────────────────────────────────────────
  // TEMPLATE: Kopiere diesen Block und passe ihn an
  // ──────────────────────────────────────────────────
  // {
  //   name: 'Mein neuer Testfall',
  //   description: 'Beschreibung des Tests',
  //   steps: [
  //     { step: 1, pace: '5:00', hr: 120, lactate: 1.0 },
  //     { step: 2, pace: '4:45', hr: 130, lactate: 1.1 },
  //     // ... weitere Stufen
  //   ],
  //   expected: {
  //     lt1: { pace: '4:10', lactate: 1.30, hr: 145 },
  //     lt2: { pace: '3:30', lactate: 3.50, hr: 172 },
  //   },
  //   paceTolerance: 5,      // optional, default 5s
  //   lactateTolerance: 0.15, // optional, default 0.15
  //   hrTolerance: 3,         // optional, default 3bpm
  // },
]

// ============================================================================
// TEST-RUNNER
// ============================================================================

describe('Lactate Threshold Calculation', () => {
  scenarios.forEach((scenario) => {
    describe(scenario.name, () => {
      // Convert scenario steps to StepTestStep format
      const stepsForAnalysis: StepTestStep[] = scenario.steps.map(s => ({
        stepNumber: s.step,
        targetPace: parsePace(s.pace),
        heartRate: s.hr,
        lactate: s.lactate,
      }))

      let analysis: ThresholdAnalysis

      // Run the analysis once per scenario
      it('should produce valid analysis results', () => {
        analysis = detectThresholds(stepsForAnalysis)
        expect(analysis).toBeDefined()
        expect(analysis.lt1).not.toBeNull()
        expect(analysis.lt2).not.toBeNull()
        expect(analysis.confidence).not.toBe('low')
      })

      it('should not use OBLA fallback', () => {
        analysis = detectThresholds(stepsForAnalysis)
        expect(analysis.method).not.toBe('obla-fallback')
      })

      // ── LT1 ──
      describe('LT1 (Aerobe Schwelle)', () => {
        const paceTol = scenario.paceTolerance ?? 5
        const lactateTol = scenario.lactateTolerance ?? 0.15
        const hrTol = scenario.hrTolerance ?? 3

        it(`Pace soll ~${scenario.expected.lt1.pace}/km sein (±${paceTol}s)`, () => {
          analysis = detectThresholds(stepsForAnalysis)
          const expectedPaceS = parsePace(scenario.expected.lt1.pace)
          const actualPaceS = analysis.lt1!.pace

          const diff = Math.abs(actualPaceS - expectedPaceS)
          expect(
            diff,
            `LT1-Pace: erwartet ${scenario.expected.lt1.pace} (${expectedPaceS}s), ` +
            `bekommen ${formatPace(actualPaceS)} (${Math.round(actualPaceS)}s), ` +
            `Abweichung ${Math.round(diff)}s (max ${paceTol}s)`
          ).toBeLessThanOrEqual(paceTol)
        })

        it(`Laktat soll ~${scenario.expected.lt1.lactate} mmol/L sein (±${lactateTol})`, () => {
          analysis = detectThresholds(stepsForAnalysis)
          const diff = Math.abs(analysis.lt1!.lactate - scenario.expected.lt1.lactate)
          expect(
            diff,
            `LT1-Laktat: erwartet ${scenario.expected.lt1.lactate}, ` +
            `bekommen ${analysis.lt1!.lactate.toFixed(2)}, ` +
            `Abweichung ${diff.toFixed(2)} (max ${lactateTol})`
          ).toBeLessThanOrEqual(lactateTol)
        })

        it(`HR soll ~${scenario.expected.lt1.hr} bpm sein (±${hrTol})`, () => {
          analysis = detectThresholds(stepsForAnalysis)
          if (!analysis.lt1!.heartRate) return // skip if no HR interpolation
          const diff = Math.abs(analysis.lt1!.heartRate - scenario.expected.lt1.hr)
          expect(
            diff,
            `LT1-HR: erwartet ${scenario.expected.lt1.hr}, ` +
            `bekommen ${analysis.lt1!.heartRate}, ` +
            `Abweichung ${diff} (max ${hrTol})`
          ).toBeLessThanOrEqual(hrTol)
        })
      })

      // ── LT2 ──
      describe('LT2 (Anaerobe Schwelle)', () => {
        const paceTol = scenario.paceTolerance ?? 5
        const lactateTol = scenario.lactateTolerance ?? 0.15
        const hrTol = scenario.hrTolerance ?? 3

        it(`Pace soll ~${scenario.expected.lt2.pace}/km sein (±${paceTol}s)`, () => {
          analysis = detectThresholds(stepsForAnalysis)
          const expectedPaceS = parsePace(scenario.expected.lt2.pace)
          const actualPaceS = analysis.lt2!.pace

          const diff = Math.abs(actualPaceS - expectedPaceS)
          expect(
            diff,
            `LT2-Pace: erwartet ${scenario.expected.lt2.pace} (${expectedPaceS}s), ` +
            `bekommen ${formatPace(actualPaceS)} (${Math.round(actualPaceS)}s), ` +
            `Abweichung ${Math.round(diff)}s (max ${paceTol}s)`
          ).toBeLessThanOrEqual(paceTol)
        })

        it(`Laktat soll ~${scenario.expected.lt2.lactate} mmol/L sein (±${lactateTol})`, () => {
          analysis = detectThresholds(stepsForAnalysis)
          const diff = Math.abs(analysis.lt2!.lactate - scenario.expected.lt2.lactate)
          expect(
            diff,
            `LT2-Laktat: erwartet ${scenario.expected.lt2.lactate}, ` +
            `bekommen ${analysis.lt2!.lactate.toFixed(2)}, ` +
            `Abweichung ${diff.toFixed(2)} (max ${lactateTol})`
          ).toBeLessThanOrEqual(lactateTol)
        })

        it(`HR soll ~${scenario.expected.lt2.hr} bpm sein (±${hrTol})`, () => {
          analysis = detectThresholds(stepsForAnalysis)
          if (!analysis.lt2!.heartRate) return
          const diff = Math.abs(analysis.lt2!.heartRate - scenario.expected.lt2.hr)
          expect(
            diff,
            `LT2-HR: erwartet ${scenario.expected.lt2.hr}, ` +
            `bekommen ${analysis.lt2!.heartRate}, ` +
            `Abweichung ${diff} (max ${hrTol})`
          ).toBeLessThanOrEqual(hrTol)
        })
      })

      // ── Plausibilität ──
      it('LT2 soll schneller als LT1 sein', () => {
        analysis = detectThresholds(stepsForAnalysis)
        expect(analysis.lt2!.speed).toBeGreaterThan(analysis.lt1!.speed)
        expect(analysis.lt2!.pace).toBeLessThan(analysis.lt1!.pace)
      })

      it('LT2-Laktat soll höher als LT1-Laktat sein', () => {
        analysis = detectThresholds(stepsForAnalysis)
        expect(analysis.lt2!.lactate).toBeGreaterThan(analysis.lt1!.lactate)
      })
    })
  })
})

// ============================================================================
// ROBUSTHEIT: Laktat-Dip zu Testbeginn
//
// Laktat ist auf der ersten Stufe haeufig durch das Aufwaermen erhoeht und
// sinkt dann ab, bevor der eigentliche Anstieg beginnt. Das ist physiologisch
// normal und darf die Schwellen nicht nennenswert verschieben.
// ============================================================================

describe('Robustheit gegen erhöhtes Aufwärmlaktat', () => {
  const baseSteps: StepInput[] = [
    { step: 1, pace: '4:30', hr: 125, lactate: 1.0 },
    { step: 2, pace: '4:15', hr: 133, lactate: 0.9 },
    { step: 3, pace: '4:00', hr: 142, lactate: 1.0 },
    { step: 4, pace: '3:45', hr: 151, lactate: 1.2 },
    { step: 5, pace: '3:30', hr: 161, lactate: 1.5 },
    { step: 6, pace: '3:15', hr: 170, lactate: 2.2 },
    { step: 7, pace: '3:00', hr: 181, lactate: 3.8 },
    { step: 8, pace: '2:45', hr: 190, lactate: 7.5 },
  ]

  const toAnalysis = (steps: StepInput[]) =>
    detectThresholds(steps.map(s => ({
      stepNumber: s.step,
      targetPace: parsePace(s.pace),
      heartRate: s.hr,
      lactate: s.lactate,
    })))

  const reference = toAnalysis(baseSteps)

  // 1.4 / 1.8 / 2.2 statt 1.0 auf Stufe 1
  const elevatedStartValues = [1.4, 1.8, 2.2]

  elevatedStartValues.forEach(startLactate => {
    describe(`Stufe 1 mit ${startLactate} mmol/L statt 1.0`, () => {
      const analysis = toAnalysis([
        { ...baseSteps[0], lactate: startLactate },
        ...baseSteps.slice(1),
      ])

      it('LT1 darf sich um höchstens 15 s/km verschieben', () => {
        const diff = Math.abs(analysis.lt1!.pace - reference.lt1!.pace)
        expect(
          diff,
          `LT1: Referenz ${formatPace(reference.lt1!.pace)}, ` +
          `mit Dip ${formatPace(analysis.lt1!.pace)}, Abweichung ${Math.round(diff)}s`
        ).toBeLessThanOrEqual(15)
      })

      it('LT2 darf sich um höchstens 10 s/km verschieben', () => {
        const diff = Math.abs(analysis.lt2!.pace - reference.lt2!.pace)
        expect(
          diff,
          `LT2: Referenz ${formatPace(reference.lt2!.pace)}, ` +
          `mit Dip ${formatPace(analysis.lt2!.pace)}, Abweichung ${Math.round(diff)}s`
        ).toBeLessThanOrEqual(10)
      })

      it('LT1 darf nicht auf die langsamste Stufe fallen', () => {
        const slowestPace = parsePace(baseSteps[0].pace)
        expect(analysis.lt1!.pace).toBeLessThan(slowestPace - 5)
      })

      it('LT2 muss deutlich schneller als LT1 bleiben', () => {
        expect(analysis.lt2!.speed).toBeGreaterThan(analysis.lt1!.speed * 1.05)
      })

      it('soll nicht auf OBLA zurückfallen', () => {
        expect(analysis.method).not.toBe('obla-fallback')
      })
    })
  })
})

// ============================================================================
// WARNUNG "nicht monoton steigend"
//
// Diese Warnung soll echte Messfehler melden, aber den normalen Laktatabfall
// zu Testbeginn in Ruhe lassen.
// ============================================================================

describe('Warnung "nicht monoton steigend"', () => {
  const paces = ['5:30', '5:15', '5:00', '4:45', '4:30', '4:15', '4:00', '3:45']

  const warnsAboutMonotonicity = (lactates: number[]) =>
    detectThresholds(
      lactates.map((lactate, i) => ({
        stepNumber: i + 1,
        targetPace: parsePace(paces[i]),
        heartRate: 120 + i * 9,
        lactate,
      }))
    ).warnings.some(w => w.includes('monoton'))

  it('meldet einen Dip zu Testbeginn nicht (2.1 / 2.1 / 1.7)', () => {
    // Der Grenzfall aus der Praxis: 2.1 - 0.4 ergibt in Fliesskomma
    // 1.7000000000000002, wodurch 1.7 faelschlich als Abfall galt
    expect(warnsAboutMonotonicity([2.1, 2.1, 1.7, 1.9, 2.4, 3.3, 5.2])).toBe(false)
  })

  it('meldet auch einen bis Stufe 4 laufenden Dip nicht', () => {
    expect(warnsAboutMonotonicity([2.3, 2.0, 1.8, 1.5, 1.8, 2.6, 4.1, 6.5])).toBe(false)
  })

  it('meldet einen sauberen Test nicht', () => {
    expect(warnsAboutMonotonicity([1.0, 1.1, 1.3, 1.6, 2.1, 3.0, 4.6, 7.0])).toBe(false)
  })

  it('meldet einen Einbruch mitten im Anstieg', () => {
    expect(warnsAboutMonotonicity([1.0, 1.1, 1.3, 1.8, 2.8, 1.9, 4.6, 7.0])).toBe(true)
  })

  it('meldet einen Einbruch am Testende', () => {
    expect(warnsAboutMonotonicity([1.2, 1.3, 1.6, 2.2, 3.4, 5.0, 3.9, 7.2])).toBe(true)
  })
})

// ============================================================================
// TRAININGSZONEN
// ============================================================================

describe('Trainingszonen', () => {
  const analysis = detectThresholds([
    { stepNumber: 1, targetPace: parsePace('4:30'), heartRate: 125, lactate: 1.0 },
    { stepNumber: 2, targetPace: parsePace('4:15'), heartRate: 133, lactate: 0.9 },
    { stepNumber: 3, targetPace: parsePace('4:00'), heartRate: 142, lactate: 1.0 },
    { stepNumber: 4, targetPace: parsePace('3:45'), heartRate: 151, lactate: 1.2 },
    { stepNumber: 5, targetPace: parsePace('3:30'), heartRate: 161, lactate: 1.5 },
    { stepNumber: 6, targetPace: parsePace('3:15'), heartRate: 170, lactate: 2.2 },
    { stepNumber: 7, targetPace: parsePace('3:00'), heartRate: 181, lactate: 3.8 },
    { stepNumber: 8, targetPace: parsePace('2:45'), heartRate: 190, lactate: 7.5 },
  ])

  const zones = calculateTrainingZones(analysis)

  it('soll fünf Zonen liefern', () => {
    expect(zones).toHaveLength(5)
  })

  it('soll lückenlos aneinander anschließen', () => {
    for (let i = 0; i < zones.length - 1; i++) {
      expect(
        zones[i].paceRange.min,
        `Lücke zwischen ${zones[i].zone} (bis ${formatPace(zones[i].paceRange.min)}) ` +
        `und ${zones[i + 1].zone} (ab ${formatPace(zones[i + 1].paceRange.max)})`
      ).toBe(zones[i + 1].paceRange.max)
    }
  })

  it('soll von langsam nach schnell geordnet sein', () => {
    for (const zone of zones) {
      expect(zone.paceRange.min).toBeLessThan(zone.paceRange.max)
    }
    for (let i = 0; i < zones.length - 1; i++) {
      expect(zones[i + 1].paceRange.max).toBeLessThan(zones[i].paceRange.max)
    }
  })

  it('soll beide Schwellen abdecken', () => {
    const slowest = zones[0].paceRange.max
    const fastest = zones[zones.length - 1].paceRange.min
    expect(analysis.lt1!.pace).toBeLessThanOrEqual(slowest)
    expect(analysis.lt1!.pace).toBeGreaterThanOrEqual(fastest)
    expect(analysis.lt2!.pace).toBeLessThanOrEqual(slowest)
    expect(analysis.lt2!.pace).toBeGreaterThanOrEqual(fastest)
  })

  it('soll Laktatbereiche an den gemessenen Schwellen ausrichten', () => {
    const ga2 = zones.find(z => z.zone === 'Z3')!
    expect(ga2.lactateRange.min).toBeCloseTo(analysis.lt1!.lactate, 5)
    expect(ga2.lactateRange.max).toBeCloseTo(analysis.lt2!.lactate, 5)
  })

  it('soll keine HF-Bereiche mit NaN liefern', () => {
    for (const zone of zones) {
      if (!zone.hrRange) continue
      expect(Number.isFinite(zone.hrRange.min), `${zone.zone} min`).toBe(true)
      expect(Number.isFinite(zone.hrRange.max), `${zone.zone} max`).toBe(true)
    }
  })
})
