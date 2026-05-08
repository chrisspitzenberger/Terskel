'use client'

import { useState } from 'react'
import { Trash2, GripVertical, Heart, Droplet, Link as LinkIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Lap } from '@/lib/db/schemas'
import { formatDistance, formatDuration, formatPace } from '@/lib/calculations/pace'
import { cn } from '@/lib/utils'

interface LapTableProps {
  laps: Lap[]
  onUpdateLap: (lapId: string, updates: Partial<Lap>) => Promise<void>
  onRemoveLap: (lapId: string) => Promise<void>
}

export function LapTable({ laps, onUpdateLap, onRemoveLap }: LapTableProps) {
  const [expandedLap, setExpandedLap] = useState<string | null>(null)

  // Separate effort and rest laps, but maintain order
  const effortLaps = laps.filter(l => l.type === 'effort')

  return (
    <TooltipProvider>
      <div className="overflow-x-auto -mx-6 px-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Pace</TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>
                    <Heart className="size-4 mx-auto" />
                  </TooltipTrigger>
                  <TooltipContent>Heart Rate (bpm)</TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-center">
                <Tooltip>
                  <TooltipTrigger>
                    <Droplet className="size-4 mx-auto text-accent" />
                  </TooltipTrigger>
                  <TooltipContent>Lactate (mmol/L)</TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {laps.map((lap, index) => {
              const lapNumber = effortLaps.indexOf(lap) + 1
              const isRest = lap.type === 'rest'
              const linkedEffort = isRest && lap.linkedEffortId
                ? laps.find(l => l.id === lap.linkedEffortId)
                : null

              return (
                <TableRow 
                  key={lap.id}
                  className={cn(
                    isRest && 'bg-muted/50',
                    expandedLap === lap.id && 'bg-accent/20'
                  )}
                >
                  <TableCell className="text-center font-mono text-sm">
                    {isRest ? (
                      <Badge variant="outline" className="text-xs">R</Badge>
                    ) : (
                      lapNumber
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatDistance(lap.distance_m)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatDuration(lap.duration_s)}
                  </TableCell>
                  <TableCell className="font-mono">
                    {formatPace(lap.pace_min_km || 0)}/km
                  </TableCell>
                  <TableCell className="text-center">
                    {lap.avg_hr ? (
                      <span className="font-mono">{lap.avg_hr}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {lap.lactate_mmol ? (
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-mono font-medium text-accent">
                          {lap.lactate_mmol.toFixed(1)}
                        </span>
                        {linkedEffort && (
                          <Tooltip>
                            <TooltipTrigger>
                              <LinkIcon className="size-3 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Linked to lap {effortLaps.indexOf(linkedEffort) + 1}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemoveLap(lap.id)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sr-only">Delete lap</span>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile-friendly lap cards for small screens */}
      <div className="md:hidden space-y-2 mt-4">
        {laps.map((lap, index) => {
          const lapNumber = effortLaps.indexOf(lap) + 1
          const isRest = lap.type === 'rest'

          return (
            <div
              key={lap.id}
              className={cn(
                'p-3 rounded-lg border',
                isRest ? 'bg-muted/50' : 'bg-card'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {isRest ? (
                    <Badge variant="outline" className="text-xs">Rest</Badge>
                  ) : (
                    <span className="font-medium">Lap {lapNumber}</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  onClick={() => onRemoveLap(lap.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Distance</span>
                  <div className="font-medium">{formatDistance(lap.distance_m)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Duration</span>
                  <div className="font-mono">{formatDuration(lap.duration_s)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Pace</span>
                  <div className="font-mono">{formatPace(lap.pace_min_km || 0)}/km</div>
                </div>
              </div>
              {(lap.avg_hr || lap.lactate_mmol) && (
                <div className="flex items-center gap-4 mt-2 pt-2 border-t text-sm">
                  {lap.avg_hr && (
                    <div className="flex items-center gap-1">
                      <Heart className="size-3.5 text-muted-foreground" />
                      <span className="font-mono">{lap.avg_hr} bpm</span>
                    </div>
                  )}
                  {lap.lactate_mmol && (
                    <div className="flex items-center gap-1 text-accent">
                      <Droplet className="size-3.5" />
                      <span className="font-mono font-medium">
                        {lap.lactate_mmol.toFixed(1)} mmol/L
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
