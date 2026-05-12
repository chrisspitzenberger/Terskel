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
import { detectThresholds, type ThresholdAnalysis } from '@/lib/calculations/lactate-threshold'
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
