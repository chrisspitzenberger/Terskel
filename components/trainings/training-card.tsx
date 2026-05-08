'use client'

import Link from 'next/link'
import { ChevronRight, Clock, Route, Heart, Droplet } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Training } from '@/lib/db/schemas'
import { formatDistance, formatDuration, formatPace } from '@/lib/calculations/pace'
import { cn } from '@/lib/utils'

interface TrainingCardProps {
  training: Training
}

const typeColors: Record<Training['type'], string> = {
  interval: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  long_run: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  tempo: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  easy: 'bg-green-500/10 text-green-600 dark:text-green-400',
  race: 'bg-red-500/10 text-red-600 dark:text-red-400',
  step_test: 'bg-primary/10 text-primary',
}

const typeLabels: Record<Training['type'], string> = {
  interval: 'Interval',
  long_run: 'Long Run',
  tempo: 'Tempo',
  easy: 'Easy',
  race: 'Race',
  step_test: 'Step Test',
}

export function TrainingCard({ training }: TrainingCardProps) {
  const effortLaps = training.laps.filter(l => l.type === 'effort')
  const totalDistance = effortLaps.reduce((sum, l) => sum + l.distance_m, 0)
  const totalDuration = effortLaps.reduce((sum, l) => sum + l.duration_s, 0)
  const avgPace = totalDistance > 0 && totalDuration > 0
    ? (totalDuration / 60) / (totalDistance / 1000)
    : 0
  
  const avgHr = effortLaps.filter(l => l.avg_hr).length > 0
    ? Math.round(
        effortLaps.filter(l => l.avg_hr).reduce((sum, l) => sum + (l.avg_hr || 0), 0) /
        effortLaps.filter(l => l.avg_hr).length
      )
    : null
  
  const maxLactate = Math.max(...training.laps.filter(l => l.lactate_mmol).map(l => l.lactate_mmol!), 0)

  const date = new Date(training.date)
  const dayLabel = date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
  })

  return (
    <Link href={`/trainings/${training.id}`}>
      <Card className="hover:bg-accent/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left: Date indicator */}
            <div className="flex flex-col items-center justify-center w-12 shrink-0">
              <span className="text-xs text-muted-foreground uppercase">
                {date.toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span className="text-xl font-bold">{date.getDate()}</span>
            </div>

            {/* Middle: Training info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{training.title}</h3>
                <Badge variant="secondary" className={cn('shrink-0', typeColors[training.type])}>
                  {typeLabels[training.type]}
                </Badge>
              </div>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Route className="size-3.5" />
                  {formatDistance(totalDistance)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {formatDuration(totalDuration)}
                </span>
                {avgPace > 0 && (
                  <span className="font-mono">
                    {formatPace(avgPace)}/km
                  </span>
                )}
                {avgHr && (
                  <span className="flex items-center gap-1">
                    <Heart className="size-3.5" />
                    {avgHr}
                  </span>
                )}
                {maxLactate > 0 && (
                  <span className="flex items-center gap-1 text-accent">
                    <Droplet className="size-3.5" />
                    {maxLactate.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Laps indicator */}
              {effortLaps.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {effortLaps.slice(0, 10).map((lap, i) => (
                    <div
                      key={lap.id}
                      className={cn(
                        'h-1.5 rounded-full',
                        lap.lactate_mmol
                          ? 'bg-accent w-3'
                          : 'bg-primary/30 w-2'
                      )}
                      title={`Lap ${i + 1}: ${formatDistance(lap.distance_m)}`}
                    />
                  ))}
                  {effortLaps.length > 10 && (
                    <span className="text-xs text-muted-foreground ml-1">
                      +{effortLaps.length - 10}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Chevron */}
            <ChevronRight className="size-5 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
