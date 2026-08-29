"use client"

import { useMemo, useState } from "react"
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  Scatter,
} from "recharts"
import { StepTestStep } from "@/lib/db/schemas"
import { ThresholdAnalysis, calculateTrainingZones, generateSmoothCurve } from "@/lib/calculations/lactate-threshold"
import { HelpCircle, Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface AnalysisChartProps {
  steps: StepTestStep[]
  analysis: ThresholdAnalysis | null
}

// Format pace from seconds per km to MM:SS
function formatPaceFromSeconds(secondsPerKm: number): string {
  const totalSeconds = Math.round(secondsPerKm)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function AnalysisChart({ steps, analysis }: AnalysisChartProps) {
  const [showMethodInfo, setShowMethodInfo] = useState(false)
  
  // Filter steps that have lactate data and convert to speed
  const validDataPoints = useMemo(() => {
    return steps
      .filter(s => s.lactate !== undefined && s.lactate !== null)
      .map(step => ({
        speed: 3600 / step.targetPace, // pace in s/km -> speed in km/h
        pace: step.targetPace,
        lactate: step.lactate!,
        hr: step.heartRate,
        stepNumber: step.stepNumber,
      }))
      .sort((a, b) => a.speed - b.speed)
  }, [steps])

  // Generate smooth curve using scientific curve fitting
  const smoothCurveData = useMemo(() => {
    if (validDataPoints.length < 2) return []
    
    // Use the scientific curve fitting from lactate-threshold module
    const curve = generateSmoothCurve(validDataPoints, 60)
    
    return curve.map(point => ({
      speed: point.speed,
      lactateCurve: point.lactate,
      hrCurve: point.hr,
    }))
  }, [validDataPoints])

  // Scatter data for actual measurement points
  const scatterData = useMemo(() => {
    return validDataPoints.map(d => ({
      speed: d.speed,
      lactatePoint: d.lactate,
      hrPoint: d.hr,
      stepNumber: d.stepNumber,
      pace: d.pace,
    }))
  }, [validDataPoints])

  // Training zones for colored areas - now includes speedRange directly
  const zones = useMemo(() => {
    if (!analysis) return []
    return calculateTrainingZones(analysis)
  }, [analysis])

  if (validDataPoints.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Keine Laktatdaten vorhanden
      </div>
    )
  }

  // Axis ranges based on ACTUAL data points
  const lactateValues = validDataPoints.map(d => d.lactate)
  const hrValues = validDataPoints.filter(d => d.hr).map(d => d.hr!)
  const speedValues = validDataPoints.map(d => d.speed)
  
  const lactateMin = 0
  const lactateMax = Math.ceil(Math.max(...lactateValues, 4) * 1.15)
  const hrMin = hrValues.length > 0 ? Math.floor((Math.min(...hrValues) - 20) / 10) * 10 : 60
  const hrMax = hrValues.length > 0 ? Math.ceil((Math.max(...hrValues) + 10) / 10) * 10 : 200
  const speedMin = Math.floor(Math.min(...speedValues) - 0.5)
  const speedMax = Math.ceil(Math.max(...speedValues) + 0.5)

  // Threshold speeds
  const lt1Speed = analysis?.lt1?.speed
  const lt2Speed = analysis?.lt2?.speed

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="w-full h-[280px] sm:h-[340px] md:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 20, right: 45, left: 5, bottom: 40 }}>
            {/* Zone backgrounds */}
            {zones.map((zone) => (
              <ReferenceArea
                key={zone.zone}
                x1={Math.max(speedMin, zone.speedRange.min)}
                x2={Math.min(speedMax, zone.speedRange.max)}
                y1={lactateMin}
                y2={lactateMax}
                yAxisId="lactate"
                fill={zone.color}
                fillOpacity={0.12}
                stroke="none"
              />
            ))}

            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
            
            <XAxis 
              dataKey="speed"
              type="number"
              domain={[speedMin, speedMax]}
              allowDataOverflow
              tickCount={Math.min(8, speedMax - speedMin + 1)}
              tickFormatter={(v) => v.toFixed(0)}
              label={{ 
                value: 'Geschwindigkeit (km/h)', 
                position: 'bottom', 
                offset: 20,
                style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' }
              }}
              className="text-[10px]"
            />
            
            {/* Left: Heart Rate */}
            <YAxis 
              yAxisId="hr"
              orientation="left"
              domain={[hrMin, hrMax]}
              tickFormatter={(v) => `${v}`}
              label={{ 
                value: 'HF (bpm)', 
                angle: -90, 
                position: 'insideLeft',
                style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' }
              }}
              className="text-[10px]"
              width={32}
            />
            
            {/* Right: Lactate */}
            <YAxis 
              yAxisId="lactate"
              orientation="right"
              domain={[lactateMin, lactateMax]}
              tickFormatter={(v) => v.toFixed(1)}
              label={{ 
                value: 'Laktat (mmol/L)', 
                angle: 90, 
                position: 'insideRight',
                style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' }
              }}
              className="text-[10px]"
              width={38}
            />

            <Tooltip 
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload
                const speed = d.speed
                const pace = 3600 / speed
                return (
                  <div className="bg-popover border rounded-lg shadow-lg p-2.5 text-sm">
                    <p className="font-medium">
                      {speed.toFixed(1)} km/h
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({formatPaceFromSeconds(pace)}/km)
                      </span>
                    </p>
                    {d.lactateCurve !== undefined && (
                      <p className="text-orange-600">Laktat: {d.lactateCurve.toFixed(2)} mmol/L</p>
                    )}
                    {d.hrCurve !== undefined && (
                      <p className="text-red-600">HF: {Math.round(d.hrCurve)} bpm</p>
                    )}
                    {d.lactatePoint !== undefined && (
                      <p className="text-orange-800 text-xs mt-1">Messpunkt Stufe {d.stepNumber}</p>
                    )}
                  </div>
                )
              }}
            />

            {/* LT1 line */}
            {lt1Speed && (
              <ReferenceLine 
                x={lt1Speed} 
                yAxisId="lactate"
                stroke="#22c55e" 
                strokeWidth={2}
                strokeDasharray="6 4"
                label={{ value: 'LT1', position: 'top', fill: '#22c55e', fontSize: 11, fontWeight: 600 }}
              />
            )}

            {/* LT2 line */}
            {lt2Speed && (
              <ReferenceLine 
                x={lt2Speed} 
                yAxisId="lactate"
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="6 4"
                label={{ value: 'LT2', position: 'top', fill: '#ef4444', fontSize: 11, fontWeight: 600 }}
              />
            )}

            {/* HR curve (dashed) */}
            {hrValues.length >= 2 && (
              <Line
                yAxisId="hr"
                data={smoothCurveData}
                type="monotone"
                dataKey="hrCurve"
                stroke="#dc2626"
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}

            {/* Lactate curve (solid) */}
            <Line
              yAxisId="lactate"
              data={smoothCurveData}
              type="monotone"
              dataKey="lactateCurve"
              stroke="#ea580c"
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            {/* Lactate measurement points */}
            <Scatter
              yAxisId="lactate"
              data={scatterData}
              dataKey="lactatePoint"
              fill="#ea580c"
              isAnimationActive={false}
            />
            
            {/* HR measurement points */}
            {hrValues.length > 0 && (
              <Scatter
                yAxisId="hr"
                data={scatterData.filter(d => d.hrPoint !== undefined)}
                dataKey="hrPoint"
                fill="#dc2626"
                shape="square"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3 text-xs px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 bg-orange-500" />
          <span>Laktat</span>
        </div>
        {hrValues.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 border-t-2 border-dashed border-red-600" />
            <span>Herzfrequenz</span>
          </div>
        )}
        {analysis?.lt1 && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 border-t-2 border-dashed border-green-500" />
            <span>LT1</span>
          </div>
        )}
        {analysis?.lt2 && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 border-t-2 border-dashed border-red-500" />
            <span>LT2</span>
          </div>
        )}
      </div>

      {/* Zone legend */}
      {zones.length > 0 && (
        <div className="flex justify-center gap-2 mt-2 flex-wrap px-2">
          {zones.map(zone => (
            <div key={zone.zone} className="flex items-center gap-1 text-[10px]">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: zone.color }} />
              <span className="text-muted-foreground">{zone.shortName}</span>
            </div>
          ))}
        </div>
      )}

      {/* Threshold summary + info */}
      {analysis && (analysis.lt1 || analysis.lt2) && (
        <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mt-4 text-xs border-t pt-4">
          {analysis.lt1 && (
            <span>
              <strong className="text-green-600">LT1:</strong> {analysis.lt1.speed.toFixed(1)} km/h ({formatPaceFromSeconds(analysis.lt1.pace)}/km)
            </span>
          )}
          {analysis.lt2 && (
            <span>
              <strong className="text-red-600">LT2:</strong> {analysis.lt2.speed.toFixed(1)} km/h ({formatPaceFromSeconds(analysis.lt2.pace)}/km)
            </span>
          )}
          
          <Dialog open={showMethodInfo} onOpenChange={setShowMethodInfo}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-7 px-2">
                <HelpCircle className="size-3.5" />
                <span className="hidden sm:inline text-xs">Methodik</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Info className="size-5 text-primary" />
                  Schwellenbestimmung - Wissenschaftliche Methodik
                </DialogTitle>
                <DialogDescription>Basierend auf aktueller Leistungsdiagnostik-Literatur</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 text-sm">
                <div className="space-y-2">
                  <h3 className="font-semibold text-green-700">LT1 - Aerobe Schwelle</h3>
                  <div className="bg-green-50 p-3 rounded-lg space-y-1.5">
                    <p><strong>Primaere Methode:</strong> Baseline + 0.4 mmol/L (Norwegian Model)</p>
                    <p className="text-xs text-muted-foreground">
                      Die Baseline ist das niedrigste unter Belastung gemessene Laktat. Gesucht wird der
                      ANSTEIGENDE Durchgang der Kurve durch Baseline + 0.4 - ein erhoehter Startwert
                      durch das Aufwaermen verschiebt die LT1 dadurch nicht.
                    </p>
                    <p><strong>Fallback:</strong> Log-Log Breakpoint (Beaver et al., 1985)</p>
                    <p><strong>Typisch:</strong> 1.2-2.0 mmol/L bei 75-85% LT2-Tempo</p>
                    <p className="text-muted-foreground text-xs mt-2">
                      Ref: Beaver WL et al. (1985), Seiler S et al. (2013)
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-red-700">LT2 - Anaerobe Schwelle (MLSS)</h3>
                  <div className="bg-red-50 p-3 rounded-lg space-y-1.5">
                    <p><strong>Methode:</strong> ModDmax mit Polynom 3. Grades (Cheng et al., 1992)</p>
                    <ol className="list-decimal list-inside ml-2 space-y-1 text-xs text-muted-foreground">
                      <li>Polynom 3. Grades an Laktatkurve anpassen (R² pruefen)</li>
                      <li>Falls R² &lt; 0.90: Exponentialfunktion als Fallback</li>
                      <li>Sekante vom LT1-Punkt zum letzten Messpunkt</li>
                      <li>Groesster senkrechter Abstand unterhalb der Sekante = LT2</li>
                    </ol>
                    <p><strong>Validierung:</strong> OBLA 4.0 mmol/L (Sjoedin & Jacobs, 1981)</p>
                    <p><strong>Typisch:</strong> 3.5-4.5 mmol/L, entspricht ~60min Wettkampftempo</p>
                    <p className="text-muted-foreground text-xs mt-2">
                      Ref: Cheng B et al. (1992), Beneke R et al. (2011)
                    </p>
                  </div>
                </div>

                {analysis && (
                  <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                    <p><strong>Verwendete Methode:</strong> {
                      analysis.method === 'moddmax-poly' ? 'Dmax (Polynom 3. Grades)' :
                      analysis.method === 'moddmax-exp' ? 'Dmax (Exponentialfunktion)' :
                      analysis.method === 'log-log' ? 'Log-Log Breakpoint' :
                      'Fixe Schwelle (4.0 mmol/L)'
                    }</p>
                    {analysis.rSquared && (
                      <p className="text-xs text-muted-foreground">
                        Modellguete (R²): {(analysis.rSquared * 100).toFixed(1)}%
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Konfidenz: {analysis.confidence === 'high' ? 'Hoch' : analysis.confidence === 'medium' ? 'Mittel' : 'Niedrig'}
                    </p>
                  </div>
                )}

                <div className="p-3 bg-blue-50 rounded-lg text-xs">
                  <p className="font-medium text-blue-800 mb-1">Hinweis zur Interpretation</p>
                  <p className="text-blue-700">
                    Die automatische Schwellenbestimmung ersetzt keine professionelle Leistungsdiagnostik.
                    Die Werte dienen als Orientierung fuer die Trainingssteuerung.
                    Laktat-Dips in den ersten Stufen sind physiologisch normal und werden toleriert.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  )
}
