"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Play, Copy, Check, AlertTriangle, CheckCircle, Info, ChevronDown, ChevronRight } from "lucide-react"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import Link from "next/link"
import { toast } from "sonner"

const EXAMPLE_JSON = `[
  {
    "id": 1,
    "scenario": "Standard Amateur-Laeufer",
    "data": [
      {"stufe": 1, "pace": "6:30", "hf": 125, "laktat": 1.4},
      {"stufe": 2, "pace": "6:15", "hf": 132, "laktat": 1.3},
      {"stufe": 3, "pace": "6:00", "hf": 142, "laktat": 1.5},
      {"stufe": 4, "pace": "5:45", "hf": 152, "laktat": 2.1},
      {"stufe": 5, "pace": "5:30", "hf": 163, "laktat": 3.2},
      {"stufe": 6, "pace": "5:15", "hf": 175, "laktat": 5.5},
      {"stufe": 7, "pace": "5:00", "hf": 185, "laktat": 8.3}
    ]
  },
  {
    "id": 2,
    "scenario": "Elite Marathonlaeufer",
    "data": [
      {"stufe": 1, "pace": "4:30", "hf": 120, "laktat": 0.9},
      {"stufe": 2, "pace": "4:15", "hf": 130, "laktat": 0.9},
      {"stufe": 3, "pace": "4:00", "hf": 140, "laktat": 1.0},
      {"stufe": 4, "pace": "3:45", "hf": 150, "laktat": 1.2},
      {"stufe": 5, "pace": "3:30", "hf": 160, "laktat": 1.6},
      {"stufe": 6, "pace": "3:15", "hf": 168, "laktat": 2.3},
      {"stufe": 7, "pace": "3:00", "hf": 175, "laktat": 3.5},
      {"stufe": 8, "pace": "2:45", "hf": 182, "laktat": 6.0}
    ]
  }
]`

interface CalculationStep {
  step: string
  description: string
  formula?: string
  inputs?: Record<string, number | string>
  result?: number | string
}

interface CalculationLog {
  inputData: { speed: number; lactate: number; hr?: number }[]
  curveFitting: {
    method: string
    coefficients: Record<string, number>
    rSquared: number
    equation: string
  } | null
  lt1Detection: {
    method: string
    steps: CalculationStep[]
    finalValue: { speed: number; lactate: number } | null
  }
  lt2Detection: {
    method: string
    steps: CalculationStep[]
    dmaxPoint?: { speed: number; distance: number }
    finalValue: { speed: number; lactate: number } | null
  }
  validation: CalculationStep[]
}

interface AnalysisResult {
  timestamp: string
  anzahl_tests: number
  erfolgreiche_tests: number
  fehlgeschlagene_tests: number
  ergebnisse: Array<{
    id: number
    scenario: string
    success: boolean
    error?: string
    input?: unknown
    ergebnis?: {
      lt1: {
        pace: string | null
        pace_min_km: number | null
        geschwindigkeit_kmh: number | null
        herzfrequenz: number | null
        laktat_mmol: number | null
      }
      lt2: {
        pace: string | null
        pace_min_km: number | null
        geschwindigkeit_kmh: number | null
        herzfrequenz: number | null
        laktat_mmol: number | null
      }
      methodik: {
        lt1_methode: string
        lt2_methode: string
        r_squared: number | null
        konfidenz: string
        baseline_laktat: number | null
      }
      berechnungsdetails?: CalculationLog
      warnungen: string[]
      trainingszonen: Array<{
        name: string
        kuerzel: string
        pace_bereich: string
        geschwindigkeit_bereich: string
        hf_bereich: string | null
        laktat_bereich: string
      }>
    }
  }>
}

export default function TestAnalyzerPage() {
  const [input, setInput] = useState(EXAMPLE_JSON)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const runTests = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const parsed = JSON.parse(input)
      
      const response = await fetch('/api/admin/analyze-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'API Fehler')
      }
      
      const data = await response.json()
      setResult(data)
      toast.success(`${data.erfolgreiche_tests}/${data.anzahl_tests} Tests erfolgreich`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fehler beim Parsen des JSON')
    } finally {
      setLoading(false)
    }
  }

  const copyResult = async () => {
    if (!result) return
    await navigator.clipboard.writeText(JSON.stringify(result, null, 2))
    setCopied(true)
    toast.success('Ergebnis kopiert')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Zurueck
          </Link>
          <div className="flex-1">
            <h1 className="font-semibold">Admin: Schwellen-Analyse Tester</h1>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            Admin
          </Badge>
        </div>
      </header>

      <main className="container py-6 px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Test-Daten (JSON)</CardTitle>
            <CardDescription>
              Fuege Testszenarien im JSON-Format ein. Die Analyse verwendet dieselbe Logik wie die normale Oberflaeche.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="font-mono text-sm min-h-[300px]"
              placeholder="JSON hier einfuegen..."
            />
            <div className="flex gap-2">
              <Button onClick={runTests} disabled={loading}>
                <Play className="h-4 w-4 mr-2" />
                {loading ? 'Analysiere...' : 'Tests ausfuehren'}
              </Button>
              <Button variant="outline" onClick={() => setInput(EXAMPLE_JSON)}>
                Beispiel laden
              </Button>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ergebnisse</CardTitle>
                  <CardDescription>
                    {result.erfolgreiche_tests}/{result.anzahl_tests} Tests erfolgreich - {result.timestamp}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={copyResult}>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Kopiert' : 'JSON kopieren'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {result.ergebnisse.map((test) => (
                <div key={test.id} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    {test.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-semibold">#{test.id}: {test.scenario}</span>
                    <Badge variant={test.success ? "default" : "destructive"}>
                      {test.success ? 'Erfolgreich' : 'Fehlgeschlagen'}
                    </Badge>
                  </div>

                  {test.error && (
                    <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800">
                      {test.error}
                    </div>
                  )}

                  {test.ergebnis && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* LT1 */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-800 mb-2">LT1 - Aerobe Schwelle</h4>
                        <div className="space-y-1 text-sm">
                          <p><strong>Pace:</strong> {test.ergebnis.lt1.pace ?? 'n/a'} min/km</p>
                          <p><strong>Geschwindigkeit:</strong> {test.ergebnis.lt1.geschwindigkeit_kmh?.toFixed(1) ?? 'n/a'} km/h</p>
                          <p><strong>Herzfrequenz:</strong> {test.ergebnis.lt1.herzfrequenz ?? 'n/a'} bpm</p>
                          <p><strong>Laktat:</strong> {test.ergebnis.lt1.laktat_mmol?.toFixed(2) ?? 'n/a'} mmol/L</p>
                        </div>
                      </div>

                      {/* LT2 */}
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="font-semibold text-red-800 mb-2">LT2 - Anaerobe Schwelle</h4>
                        <div className="space-y-1 text-sm">
                          <p><strong>Pace:</strong> {test.ergebnis.lt2.pace ?? 'n/a'} min/km</p>
                          <p><strong>Geschwindigkeit:</strong> {test.ergebnis.lt2.geschwindigkeit_kmh?.toFixed(1) ?? 'n/a'} km/h</p>
                          <p><strong>Herzfrequenz:</strong> {test.ergebnis.lt2.herzfrequenz ?? 'n/a'} bpm</p>
                          <p><strong>Laktat:</strong> {test.ergebnis.lt2.laktat_mmol?.toFixed(2) ?? 'n/a'} mmol/L</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {test.ergebnis?.methodik && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Methodik</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        <div><strong>Methode:</strong> {test.ergebnis.methodik.lt2_methode}</div>
                        <div><strong>R²:</strong> {test.ergebnis.methodik.r_squared?.toFixed(4) ?? 'n/a'}</div>
                        <div><strong>Konfidenz:</strong> {test.ergebnis.methodik.konfidenz}</div>
                        <div><strong>Baseline:</strong> {test.ergebnis.methodik.baseline_laktat?.toFixed(2) ?? 'n/a'} mmol/L</div>
                      </div>
                    </div>
                  )}

                  {/* Detaillierte Berechnungsschritte */}
                  {test.ergebnis?.berechnungsdetails && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
                        <Info className="h-4 w-4" />
                        Berechnungsdetails anzeigen
                        <ChevronDown className="h-4 w-4" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-4 space-y-4">
                        {/* Input Data */}
                        <div className="border rounded-lg p-4 bg-slate-50">
                          <h5 className="font-semibold text-sm mb-2">Eingangsdaten</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs border">
                              <thead className="bg-slate-100">
                                <tr>
                                  <th className="border p-1">Geschwindigkeit</th>
                                  <th className="border p-1">Laktat</th>
                                  <th className="border p-1">HF</th>
                                </tr>
                              </thead>
                              <tbody>
                                {test.ergebnis.berechnungsdetails.inputData.map((d, i) => (
                                  <tr key={i}>
                                    <td className="border p-1 text-center">{d.speed.toFixed(2)} km/h</td>
                                    <td className="border p-1 text-center">{d.lactate.toFixed(2)} mmol/L</td>
                                    <td className="border p-1 text-center">{d.hr ?? '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Curve Fitting */}
                        {test.ergebnis.berechnungsdetails.curveFitting && (
                          <div className="border rounded-lg p-4 bg-blue-50">
                            <h5 className="font-semibold text-sm mb-2 text-blue-800">Kurvenanpassung</h5>
                            <div className="text-xs space-y-1">
                              <p><strong>Methode:</strong> {test.ergebnis.berechnungsdetails.curveFitting.method}</p>
                              <p><strong>Gleichung:</strong> <code className="bg-blue-100 px-1 rounded">{test.ergebnis.berechnungsdetails.curveFitting.equation}</code></p>
                              <p><strong>R²:</strong> {test.ergebnis.berechnungsdetails.curveFitting.rSquared.toFixed(6)}</p>
                            </div>
                          </div>
                        )}

                        {/* LT1 Detection Steps */}
                        <div className="border rounded-lg p-4 bg-green-50">
                          <h5 className="font-semibold text-sm mb-2 text-green-800">LT1-Berechnung: {test.ergebnis.berechnungsdetails.lt1Detection.method}</h5>
                          <div className="space-y-3">
                            {test.ergebnis.berechnungsdetails.lt1Detection.steps.map((step, i) => (
                              <div key={i} className="text-xs border-l-2 border-green-300 pl-3">
                                <p className="font-semibold">{step.step}</p>
                                <p className="text-muted-foreground">{step.description}</p>
                                {step.formula && (
                                  <p className="mt-1"><code className="bg-green-100 px-1 rounded text-xs">{step.formula}</code></p>
                                )}
                                {step.inputs && (
                                  <div className="mt-1 text-muted-foreground">
                                    {Object.entries(step.inputs).map(([k, v]) => (
                                      <span key={k} className="mr-2">{k}: {v}</span>
                                    ))}
                                  </div>
                                )}
                                {step.result && (
                                  <p className="mt-1 font-medium text-green-700">Ergebnis: {step.result}</p>
                                )}
                              </div>
                            ))}
                            {test.ergebnis.berechnungsdetails.lt1Detection.finalValue && (
                              <div className="mt-2 p-2 bg-green-100 rounded text-xs">
                                <strong>LT1:</strong> {test.ergebnis.berechnungsdetails.lt1Detection.finalValue.speed.toFixed(2)} km/h 
                                bei {test.ergebnis.berechnungsdetails.lt1Detection.finalValue.lactate.toFixed(2)} mmol/L
                              </div>
                            )}
                          </div>
                        </div>

                        {/* LT2 Detection Steps */}
                        <div className="border rounded-lg p-4 bg-red-50">
                          <h5 className="font-semibold text-sm mb-2 text-red-800">LT2-Berechnung: {test.ergebnis.berechnungsdetails.lt2Detection.method}</h5>
                          <div className="space-y-3">
                            {test.ergebnis.berechnungsdetails.lt2Detection.steps.map((step, i) => (
                              <div key={i} className="text-xs border-l-2 border-red-300 pl-3">
                                <p className="font-semibold">{step.step}</p>
                                <p className="text-muted-foreground">{step.description}</p>
                                {step.formula && (
                                  <p className="mt-1"><code className="bg-red-100 px-1 rounded text-xs">{step.formula}</code></p>
                                )}
                                {step.inputs && (
                                  <div className="mt-1 text-muted-foreground">
                                    {Object.entries(step.inputs).map(([k, v]) => (
                                      <span key={k} className="mr-2">{k}: {String(v)}</span>
                                    ))}
                                  </div>
                                )}
                                {step.result && (
                                  <p className="mt-1 font-medium text-red-700">Ergebnis: {step.result}</p>
                                )}
                              </div>
                            ))}
                            {test.ergebnis.berechnungsdetails.lt2Detection.finalValue && (
                              <div className="mt-2 p-2 bg-red-100 rounded text-xs">
                                <strong>LT2:</strong> {test.ergebnis.berechnungsdetails.lt2Detection.finalValue.speed.toFixed(2)} km/h 
                                bei {test.ergebnis.berechnungsdetails.lt2Detection.finalValue.lactate.toFixed(2)} mmol/L
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Validation */}
                        <div className="border rounded-lg p-4 bg-amber-50">
                          <h5 className="font-semibold text-sm mb-2 text-amber-800">Validierung</h5>
                          <div className="space-y-2">
                            {test.ergebnis.berechnungsdetails.validation.map((step, i) => (
                              <div key={i} className="text-xs flex items-center gap-2">
                                <span className="font-medium">{step.step}:</span>
                                <span className="text-muted-foreground">{step.description}</span>
                                <Badge variant={step.result === 'OK' || step.result === 'high' ? 'default' : 'secondary'} className="text-xs">
                                  {step.result}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {test.ergebnis?.warnungen && test.ergebnis.warnungen.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="font-semibold text-amber-800 mb-2">Warnungen</h4>
                      <ul className="list-disc list-inside text-sm text-amber-700">
                        {test.ergebnis.warnungen.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {test.ergebnis?.trainingszonen && (
                    <div>
                      <h4 className="font-semibold mb-2">Trainingszonen</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border">
                          <thead className="bg-muted">
                            <tr>
                              <th className="border p-2 text-left">Zone</th>
                              <th className="border p-2 text-left">Pace</th>
                              <th className="border p-2 text-left">Geschwindigkeit</th>
                              <th className="border p-2 text-left">HF</th>
                              <th className="border p-2 text-left">Laktat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {test.ergebnis.trainingszonen.map((zone, i) => (
                              <tr key={i}>
                                <td className="border p-2 font-medium">{zone.kuerzel}</td>
                                <td className="border p-2">{zone.pace_bereich}</td>
                                <td className="border p-2">{zone.geschwindigkeit_bereich}</td>
                                <td className="border p-2">{zone.hf_bereich ?? '-'}</td>
                                <td className="border p-2">{zone.laktat_bereich}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Raw JSON */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Raw JSON anzeigen
                </summary>
                <pre className="mt-2 bg-muted p-4 rounded-lg overflow-x-auto text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
