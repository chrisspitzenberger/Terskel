import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { analyzeStepTest, detectThresholds, calculateTrainingZones } from '@/lib/calculations/lactate-threshold'
import type { StepData } from '@/lib/db/schemas'
import type { StepTestStep } from '@/lib/db/schemas'

// Input format from JSON
interface TestInput {
  stufe: number
  pace: string // "MM:SS" format
  hf: number
  laktat: number
}

interface TestScenario {
  id: number
  scenario: string
  data: TestInput[]
}

// Parse "MM:SS" pace to decimal min/km
function parsePace(paceStr: string): number {
  const parts = paceStr.split(':')
  if (parts.length !== 2) throw new Error(`Invalid pace format: ${paceStr}`)
  const minutes = parseInt(parts[0], 10)
  const seconds = parseInt(parts[1], 10)
  return minutes + seconds / 60
}

// Format decimal min/km to "MM:SS"
function formatPace(paceMinKm: number): string {
  const minutes = Math.floor(paceMinKm)
  const seconds = Math.round((paceMinKm - minutes) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Convert TestInput[] to StepData[] format expected by analyzeStepTest
function convertToStepData(inputs: TestInput[]): StepData[] {
  return inputs.map(input => ({
    step_number: input.stufe,
    target_pace_min_km: parsePace(input.pace),
    end_hr: input.hf,
    lactate_mmol: input.laktat,
    completed: true,
    skipped: false,
  }))
}

export async function POST(request: NextRequest) {
  // The middleware matcher in proxy.ts excludes /api entirely, so the
  // authorized() callback never runs here - the check has to be explicit.
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const scenarios: TestScenario[] = await request.json()
    
    if (!Array.isArray(scenarios)) {
      return NextResponse.json(
        { error: 'Input must be an array of test scenarios' },
        { status: 400 }
      )
    }
    
    const results = scenarios.map(scenario => {
      try {
        // Convert input format to StepData format
        const stepData = convertToStepData(scenario.data)
        
        // Call the SAME analyzeStepTest function used by the UI
        const analysisResult = analyzeStepTest(stepData)
        
        if (!analysisResult) {
          return {
            id: scenario.id,
            scenario: scenario.scenario,
            success: false,
            error: 'Analyse fehlgeschlagen - mindestens 3 Stufen mit Laktatwerten erforderlich',
            input: scenario.data,
          }
        }
        
        // Also get the detailed threshold analysis for more info
        const stepsForAnalysis: StepTestStep[] = stepData
          .filter(s => s.completed && s.lactate_mmol !== null)
          .map(s => ({
            stepNumber: s.step_number,
            targetPace: s.target_pace_min_km * 60, // Convert to seconds/km
            heartRate: s.end_hr ?? undefined,
            lactate: s.lactate_mmol ?? undefined,
          }))
        
        const detailedAnalysis = detectThresholds(stepsForAnalysis)
        const zones = calculateTrainingZones(detailedAnalysis)
        
        return {
          id: scenario.id,
          scenario: scenario.scenario,
          success: true,
          input: {
            stufenAnzahl: scenario.data.length,
            daten: scenario.data,
          },
          ergebnis: {
            lt1: {
              pace: analysisResult.lt1_pace ? formatPace(analysisResult.lt1_pace) : null,
              pace_min_km: analysisResult.lt1_pace,
              geschwindigkeit_kmh: analysisResult.lt1_pace ? 60 / analysisResult.lt1_pace : null,
              herzfrequenz: analysisResult.lt1_hr,
              laktat_mmol: detailedAnalysis.lt1?.lactate ?? null,
            },
            lt2: {
              pace: analysisResult.lt2_pace ? formatPace(analysisResult.lt2_pace) : null,
              pace_min_km: analysisResult.lt2_pace,
              geschwindigkeit_kmh: analysisResult.lt2_pace ? 60 / analysisResult.lt2_pace : null,
              herzfrequenz: analysisResult.lt2_hr,
              laktat_mmol: detailedAnalysis.lt2?.lactate ?? null,
            },
            methodik: {
              lt1_methode: detailedAnalysis.method,
              lt2_methode: detailedAnalysis.method,
              r_squared: detailedAnalysis.rSquared,
              konfidenz: detailedAnalysis.confidence,
              baseline_laktat: detailedAnalysis.baseline,
            },
            berechnungsdetails: detailedAnalysis.calculationLog,
            warnungen: detailedAnalysis.warnings,
            trainingszonen: zones.map(z => ({
              name: z.name,
              kuerzel: z.abbrev,
              pace_bereich: `${formatPace(z.paceRange.min / 60)} - ${formatPace(z.paceRange.max / 60)}`,
              geschwindigkeit_bereich: `${z.speedRange.min.toFixed(1)} - ${z.speedRange.max.toFixed(1)} km/h`,
              hf_bereich: z.hrRange ? `${z.hrRange.min} - ${z.hrRange.max} bpm` : null,
              laktat_bereich: `${z.lactateRange.min.toFixed(1)} - ${z.lactateRange.max.toFixed(1)} mmol/L`,
            })),
          },
        }
      } catch (error) {
        return {
          id: scenario.id,
          scenario: scenario.scenario,
          success: false,
          error: error instanceof Error ? error.message : 'Unbekannter Fehler',
          input: scenario.data,
        }
      }
    })
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      anzahl_tests: scenarios.length,
      erfolgreiche_tests: results.filter(r => r.success).length,
      fehlgeschlagene_tests: results.filter(r => !r.success).length,
      ergebnisse: results,
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON input', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
