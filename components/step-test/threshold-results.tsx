"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ThresholdAnalysis } from "@/lib/calculations/lactate-threshold"
import { Activity, TrendingUp, AlertTriangle, CheckCircle2, HelpCircle, Info, ChevronDown } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ThresholdResultsProps {
  analysis: ThresholdAnalysis
}

// Helper to format pace from seconds per km
function formatPaceFromSeconds(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Confidence badge component
function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { label: 'Hohe Genauigkeit', variant: 'default' as const, icon: CheckCircle2 },
    medium: { label: 'Mittlere Genauigkeit', variant: 'secondary' as const, icon: Info },
    low: { label: 'Geringe Genauigkeit', variant: 'destructive' as const, icon: AlertTriangle },
  }
  const cfg = config[confidence]
  const Icon = cfg.icon
  
  return (
    <Badge variant={cfg.variant} className="gap-1">
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  )
}

export function ThresholdResults({ analysis }: ThresholdResultsProps) {
  const [lt1DetailsOpen, setLt1DetailsOpen] = useState(false)
  const [lt2DetailsOpen, setLt2DetailsOpen] = useState(false)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Warnings */}
      {analysis.warnings.length > 0 && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Hinweise zur Datenqualität</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-1 space-y-0.5 text-sm">
              {analysis.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Method and confidence info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
          <span>Methode: {analysis.method.includes('moddmax') ? 'ModDmax' : 'Fixwert (4.0 mmol/L)'}</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="size-4" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  {analysis.method.includes('moddmax')
                    ? 'Die ModDmax-Methode findet den Punkt der maximalen Abweichung von einer Geraden zwischen erstem und letztem Messpunkt. Sie gilt als genaueste Methode zur Bestimmung des MLSS.'
                    : 'Die Fixwert-Methode verwendet einen festen Laktatwert von 4.0 mmol/L als Schwelle (OBLA-Methode nach Sjödin & Jacobs).'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ConfidenceBadge confidence={analysis.confidence} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* LT1 Card */}
        <Card className={cn(
          analysis.lt1 ? "border-green-500/30 bg-green-50/30" : "opacity-60"
        )}>
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                </div>
                <div>
                  <span className="block">LT1 - Aerobe Schwelle</span>
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">Erste Laktatschwelle</span>
                </div>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.lt1 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-0.5 sm:mb-1">Tempo</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-700">{formatPaceFromSeconds(analysis.lt1.pace)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">min/km</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-0.5 sm:mb-1">Geschwindigkeit</p>
                    <p className="text-2xl sm:text-3xl font-bold text-green-700">{analysis.lt1.speed.toFixed(1)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">km/h</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2 sm:pt-3 border-t">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Herzfrequenz</p>
                    <p className="text-lg sm:text-xl font-semibold">
                      {analysis.lt1.heartRate ? `${analysis.lt1.heartRate} bpm` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Laktat</p>
                    <p className="text-lg sm:text-xl font-semibold">{analysis.lt1.lactate.toFixed(2)} mmol/L</p>
                  </div>
                </div>
                
                {/* User-friendly explanation */}
                <div className="p-2.5 sm:p-3 bg-green-100/50 rounded-lg">
                  <p className="text-xs sm:text-sm text-green-800">
                    <strong>Was bedeutet das?</strong><br/>
                    Bis zu diesem Tempo kannst du sehr lange und entspannt laufen ohne zu ermüden. 
                    Ideal für Grundlagentraining, lange Läufe und aktive Regeneration.
                  </p>
                </div>

                {/* Detailed explanation (collapsible) */}
                <Collapsible open={lt1DetailsOpen} onOpenChange={setLt1DetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                      <span className="text-xs">Mehr über LT1 erfahren</span>
                      <ChevronDown className={cn("size-4 transition-transform", lt1DetailsOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    <div className="text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-lg">
                      <p>
                        <strong className="text-foreground">Physiologie:</strong> LT1 markiert den Übergang von rein aerobem 
                        zu gemischt aerob-anaerobem Stoffwechsel. Unterhalb dieser Schwelle wird Energie fast ausschließlich 
                        durch Fettverbrennung und aerobe Glykose bereitgestellt.
                      </p>
                      <p>
                        <strong className="text-foreground">Training:</strong> Der Großteil deines Trainings (ca. 75-80%) 
                        sollte unterhalb oder an LT1 stattfinden. Dies bildet die Basis für alle anderen Trainingsformen 
                        und maximiert die aerobe Kapazität ohne übermäßige Ermüdung.
                      </p>
                      <p>
                        <strong className="text-foreground">Wettkampf:</strong> LT1-Tempo entspricht etwa dem Marathontempo 
                        bei Hobbyläufern oder dem Ultramarathon-Tempo bei schnelleren Athleten.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nicht genügend Datenpunkte im unteren Intensitätsbereich.
              </p>
            )}
          </CardContent>
        </Card>

        {/* LT2 Card */}
        <Card className={cn(
          analysis.lt2 ? "border-red-500/30 bg-red-50/30" : "opacity-60"
        )}>
          <CardHeader className="pb-2 sm:pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                </div>
                <div>
                  <span className="block">LT2 - Anaerobe Schwelle</span>
                  <span className="text-xs sm:text-sm font-normal text-muted-foreground">MLSS / ANS</span>
                </div>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.lt2 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-0.5 sm:mb-1">Tempo</p>
                    <p className="text-2xl sm:text-3xl font-bold text-red-700">{formatPaceFromSeconds(analysis.lt2.pace)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">min/km</p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide mb-0.5 sm:mb-1">Geschwindigkeit</p>
                    <p className="text-2xl sm:text-3xl font-bold text-red-700">{analysis.lt2.speed.toFixed(1)}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">km/h</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2 sm:pt-3 border-t">
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Herzfrequenz</p>
                    <p className="text-lg sm:text-xl font-semibold">
                      {analysis.lt2.heartRate ? `${analysis.lt2.heartRate} bpm` : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">Laktat</p>
                    <p className="text-lg sm:text-xl font-semibold">{analysis.lt2.lactate.toFixed(2)} mmol/L</p>
                  </div>
                </div>
                
                {/* User-friendly explanation */}
                <div className="p-2.5 sm:p-3 bg-red-100/50 rounded-lg">
                  <p className="text-xs sm:text-sm text-red-800">
                    <strong>Was bedeutet das?</strong><br/>
                    Das ist dein Schwellentempo - du kannst es etwa 40-60 Minuten durchhalten.
                    Perfekt für 10km-Wettkämpfe und gezieltes Schwellentraining.
                  </p>
                </div>

                {/* Detailed explanation (collapsible) */}
                <Collapsible open={lt2DetailsOpen} onOpenChange={setLt2DetailsOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                      <span className="text-xs">Mehr über LT2 erfahren</span>
                      <ChevronDown className={cn("size-4 transition-transform", lt2DetailsOpen && "rotate-180")} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 pt-2">
                    <div className="text-xs text-muted-foreground space-y-2 p-3 bg-muted/30 rounded-lg">
                      <p>
                        <strong className="text-foreground">Physiologie:</strong> LT2 entspricht dem Maximum Lactate Steady State (MLSS) - 
                        die höchste Intensität, bei der Laktatproduktion und -abbau noch im Gleichgewicht sind. 
                        Darüber akkumuliert Laktat exponentiell und führt schnell zur Erschöpfung.
                      </p>
                      <p>
                        <strong className="text-foreground">Training:</strong> Gezieltes Training an oder knapp unter LT2 
                        (Schwellentraining, Tempoläufe) verbessert die Laktattoleranz und verschiebt die Schwelle 
                        zu höheren Intensitäten. 2-3 solcher Einheiten pro Woche sind optimal.
                      </p>
                      <p>
                        <strong className="text-foreground">Wettkampf:</strong> LT2 entspricht etwa dem 10km- bis Halbmarathontempo 
                        bei gut trainierten Läufern. Elite-Marathonläufer können ihr LT2-Tempo über 2+ Stunden halten.
                      </p>
                      <p>
                        <strong className="text-foreground">Herzfrequenz:</strong> Die Schwellenfrequenz ist ein wichtiger 
                        Trainingsparameter. Im Training kannst du die HF nutzen, wenn kein Laktatmessgerät verfügbar ist.
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">
                Nicht genügend Datenpunkte oder kein klarer Schwellenverlauf erkennbar.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calculation Details (collapsible) */}
      {analysis.calculationLog && (
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <Info className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    Berechnungsdetails
                  </CardTitle>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-4 space-y-4">
                  {/* Input Data */}
                  <div className="border rounded-lg p-3 bg-slate-50">
                    <h5 className="font-semibold text-sm mb-2">Eingangsdaten ({analysis.calculationLog.inputData.length} Messpunkte)</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="border p-1.5 text-left">Geschw.</th>
                            <th className="border p-1.5 text-left">Laktat</th>
                            <th className="border p-1.5 text-left">HF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analysis.calculationLog.inputData.map((d, i) => (
                            <tr key={i}>
                              <td className="border p-1.5">{d.speed.toFixed(2)} km/h</td>
                              <td className="border p-1.5">{d.lactate.toFixed(2)} mmol/L</td>
                              <td className="border p-1.5">{d.hr ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Curve Fitting */}
                  {analysis.calculationLog.curveFitting && (
                    <div className="border rounded-lg p-3 bg-blue-50">
                      <h5 className="font-semibold text-sm mb-2 text-blue-800">Kurvenanpassung</h5>
                      <div className="text-xs space-y-1">
                        <p><strong>Methode:</strong> {analysis.calculationLog.curveFitting.method === 'polynomial-3' ? 'Polynom 3. Grades' : 'Exponentialfunktion'}</p>
                        <p><strong>Gleichung:</strong> <code className="bg-blue-100 px-1 rounded">{analysis.calculationLog.curveFitting.equation}</code></p>
                        <p><strong>Bestimmtheitsmass R²:</strong> {analysis.calculationLog.curveFitting.rSquared.toFixed(6)} {analysis.calculationLog.curveFitting.rSquared >= 0.95 ? '(Sehr gut)' : analysis.calculationLog.curveFitting.rSquared >= 0.90 ? '(Gut)' : '(Maessig)'}</p>
                      </div>
                    </div>
                  )}

                  {/* LT1 Calculation Steps */}
                  <div className="border rounded-lg p-3 bg-green-50">
                    <h5 className="font-semibold text-sm mb-2 text-green-800">LT1-Berechnung: {analysis.calculationLog.lt1Detection.method}</h5>
                    <div className="space-y-2">
                      {analysis.calculationLog.lt1Detection.steps.map((step, i) => (
                        <div key={i} className="text-xs border-l-2 border-green-300 pl-2">
                          <p className="font-medium">{step.step}</p>
                          <p className="text-muted-foreground">{step.description}</p>
                          {step.formula && <p className="mt-0.5"><code className="bg-green-100 px-1 rounded text-[10px]">{step.formula}</code></p>}
                          {step.result && <p className="mt-0.5 text-green-700 font-medium">→ {step.result}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LT2 Calculation Steps */}
                  <div className="border rounded-lg p-3 bg-red-50">
                    <h5 className="font-semibold text-sm mb-2 text-red-800">LT2-Berechnung: {analysis.calculationLog.lt2Detection.method}</h5>
                    <div className="space-y-2">
                      {analysis.calculationLog.lt2Detection.steps.map((step, i) => (
                        <div key={i} className="text-xs border-l-2 border-red-300 pl-2">
                          <p className="font-medium">{step.step}</p>
                          <p className="text-muted-foreground">{step.description}</p>
                          {step.formula && <p className="mt-0.5"><code className="bg-red-100 px-1 rounded text-[10px]">{step.formula}</code></p>}
                          {step.result && <p className="mt-0.5 text-red-700 font-medium">→ {step.result}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Validation */}
                  <div className="border rounded-lg p-3 bg-amber-50">
                    <h5 className="font-semibold text-sm mb-2 text-amber-800">Validierung</h5>
                    <div className="space-y-1">
                      {analysis.calculationLog.validation.map((step, i) => (
                        <div key={i} className="text-xs flex items-center gap-2">
                          <span className="font-medium">{step.step}:</span>
                          <span className="text-muted-foreground">{step.description}</span>
                          <Badge variant={step.result === 'OK' || step.result === 'high' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            {step.result}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
        </Card>
      )}

      {/* Race Time Predictions */}
      {analysis.lt2 && (
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
              Wettkampf-Prognosen
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Geschätzte Zielzeiten basierend auf deiner anaeroben Schwelle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
              {/* 5K */}
              <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">5 km</p>
                <p className="text-lg sm:text-xl font-bold">
                  {formatRaceTime(5, analysis.lt2.speed * 1.02)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {formatPaceFromSeconds(3600 / (analysis.lt2.speed * 1.02))}/km
                </p>
              </div>
              {/* 10K */}
              <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">10 km</p>
                <p className="text-lg sm:text-xl font-bold">
                  {formatRaceTime(10, analysis.lt2.speed * 0.98)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {formatPaceFromSeconds(3600 / (analysis.lt2.speed * 0.98))}/km
                </p>
              </div>
              {/* Half Marathon */}
              <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Halbmarathon</p>
                <p className="text-lg sm:text-xl font-bold">
                  {formatRaceTime(21.0975, analysis.lt2.speed * 0.92)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {formatPaceFromSeconds(3600 / (analysis.lt2.speed * 0.92))}/km
                </p>
              </div>
              {/* Marathon */}
              <div className="text-center p-2 sm:p-3 bg-muted/50 rounded-lg">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase mb-0.5 sm:mb-1">Marathon</p>
                <p className="text-lg sm:text-xl font-bold">
                  {formatRaceTime(42.195, analysis.lt2.speed * 0.85)}
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  {formatPaceFromSeconds(3600 / (analysis.lt2.speed * 0.85))}/km
                </p>
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3 text-center">
              Diese Prognosen sind Schätzungen basierend auf typischen Abfällen von der Schwellenleistung
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper to format race time from distance and speed
function formatRaceTime(distanceKm: number, speedKmh: number): string {
  const hours = distanceKm / speedKmh
  const totalMinutes = hours * 60
  const h = Math.floor(hours)
  const m = Math.floor(totalMinutes % 60)
  const s = Math.round((totalMinutes * 60) % 60)
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}
