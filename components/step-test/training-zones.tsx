"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ThresholdAnalysis, calculateTrainingZones } from "@/lib/calculations/lactate-threshold"
import { Target, Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TrainingZonesProps {
  analysis: ThresholdAnalysis
}

// Helper to format pace from seconds per km
function formatPaceFromSeconds(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Convert speed to m/s
function speedToMs(kmh: number): number {
  return kmh / 3.6
}

export function TrainingZones({ analysis }: TrainingZonesProps) {
  const zones = calculateTrainingZones(analysis)
  
  if (zones.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Individuelle Belastungsempfehlungen
        </CardTitle>
        <CardDescription>
          Trainingszonen basierend auf deinen Schwellenwerten
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Main training zones table */}
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold text-xs sm:text-sm">Zone</TableHead>
                <TableHead className="font-semibold text-xs sm:text-sm hidden sm:table-cell">Abk.</TableHead>
                <TableHead className="font-semibold text-right text-xs sm:text-sm">
                  <span className="hidden sm:inline">Laufgeschwindigkeit (flach)</span>
                  <span className="sm:hidden">Tempo</span>
                  <div className="text-[10px] sm:text-xs font-normal text-muted-foreground">pro 1.000m</div>
                </TableHead>
                <TableHead className="font-semibold text-right text-xs sm:text-sm hidden md:table-cell">
                  <div className="text-xs font-normal text-muted-foreground">(m/s)</div>
                </TableHead>
                <TableHead className="font-semibold text-right text-xs sm:text-sm">
                  <span className="hidden sm:inline">Herzfrequenz</span>
                  <span className="sm:hidden">HF</span>
                  <div className="text-[10px] sm:text-xs font-normal text-muted-foreground">(bpm)</div>
                </TableHead>
                <TableHead className="w-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {zones.map((zone) => (
                <TableRow 
                  key={zone.zone}
                  className="hover:bg-muted/30"
                >
                  <TableCell className="font-medium text-xs sm:text-sm">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div 
                        className="w-2 h-6 sm:w-3 sm:h-8 rounded-sm flex-shrink-0" 
                        style={{ backgroundColor: zone.color }}
                      />
                      <span className="hidden lg:inline">{zone.name}</span>
                      <span className="lg:hidden">{zone.shortName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs sm:text-sm hidden sm:table-cell">
                    {zone.shortName}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs sm:text-sm">
                    {formatPaceFromSeconds(zone.paceRange.min)} - {formatPaceFromSeconds(zone.paceRange.max)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
                    {speedToMs(zone.speedRange.min).toFixed(2)} - {speedToMs(zone.speedRange.max).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs sm:text-sm">
                    {zone.hrRange 
                      ? `${zone.hrRange.min} - ${zone.hrRange.max}`
                      : '-'
                    }
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="size-3.5 sm:size-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs">
                          <p className="font-medium mb-1">{zone.name}</p>
                          <p className="text-sm">{zone.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Laktat: {zone.lactateRange.min.toFixed(1)} - {zone.lactateRange.max.toFixed(1)} mmol/L
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Visual zone bar */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-medium mb-3">Intensitätsverteilung</p>
          <div className="flex h-6 rounded-lg overflow-hidden shadow-inner">
            {zones.map(zone => (
              <div 
                key={zone.zone}
                className="flex-1 flex items-center justify-center text-[9px] sm:text-[10px] font-medium text-white"
                style={{ backgroundColor: zone.color }}
                title={zone.name}
              >
                {zone.shortName}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground mt-2">
            <span>Leicht (Regeneration)</span>
            <span className="hidden sm:inline">Moderat (Grundlage)</span>
            <span>Intensiv (Wettkampf)</span>
          </div>
        </div>

        {/* Practical examples */}
        <div className="mt-6 pt-4 border-t">
          <h4 className="font-medium text-sm mb-3">Praktische Anwendung</h4>
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
            <div className="p-2.5 sm:p-3 bg-muted/30 rounded-lg">
              <p className="font-medium text-xs sm:text-sm text-green-700">Langer Lauf (GA1)</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                60-120 Min in Zone 1-2<br/>
                Tempo: {formatPaceFromSeconds(zones[1]?.paceRange.min || 0)} - {formatPaceFromSeconds(zones[1]?.paceRange.max || 0)}/km
              </p>
            </div>
            <div className="p-2.5 sm:p-3 bg-muted/30 rounded-lg">
              <p className="font-medium text-xs sm:text-sm text-yellow-700">Tempodauerlauf</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                30-45 Min in Zone 3<br/>
                Tempo: {formatPaceFromSeconds(zones[2]?.paceRange.min || 0)} - {formatPaceFromSeconds(zones[2]?.paceRange.max || 0)}/km
              </p>
            </div>
            <div className="p-2.5 sm:p-3 bg-muted/30 rounded-lg">
              <p className="font-medium text-xs sm:text-sm text-orange-700">Schwellentraining</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                4-6x 5-8 Min in Zone 4<br/>
                Tempo: {formatPaceFromSeconds(zones[3]?.paceRange.min || 0)} - {formatPaceFromSeconds(zones[3]?.paceRange.max || 0)}/km
              </p>
            </div>
            <div className="p-2.5 sm:p-3 bg-muted/30 rounded-lg">
              <p className="font-medium text-xs sm:text-sm text-red-700">VO2max Intervalle</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                5-8x 3 Min in Zone 5<br/>
                Tempo: {formatPaceFromSeconds(zones[4]?.paceRange.min || 0)} - {formatPaceFromSeconds(zones[4]?.paceRange.max || 0)}/km
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
