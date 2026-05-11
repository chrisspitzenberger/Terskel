'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  MoreHorizontal, 
  Trash2, 
  Plus,
  Clock,
  Route,
  Heart,
  Droplet
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MobileHeader } from '@/components/layout/mobile-header'
import { LapTable } from '@/components/trainings/lap-table'
import { LapInputDialog } from '@/components/trainings/lap-input-dialog'
import { formatDistance, formatDuration, formatPace } from '@/lib/calculations/pace'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Training, LapInput } from '@/lib/db/schemas'
import { deleteTrainingAction, addLapAction, updateLapAction, deleteLapAction } from '@/lib/actions/trainings'

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

export function TrainingDetailClient({ training, summary }: { training: Training, summary: any }) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showLapDialog, setShowLapDialog] = useState(false)

  const handleDelete = async () => {
    try {
      await deleteTrainingAction(training.id)
      toast.success('Training deleted')
      router.push('/trainings')
    } catch (error) {
      toast.error('Failed to delete training')
    }
  }

  const handleAddLap = async (lap: LapInput) => {
    try {
      await addLapAction(training.id, lap)
      toast.success('Lap added')
      setShowLapDialog(false)
    } catch (error) {
      toast.error('Failed to add lap')
    }
  }

  const handleUpdateLap = async (lapId: string, updates: Partial<LapInput>) => {
    try {
      await updateLapAction(training.id, lapId, updates)
      toast.success('Lap updated')
    } catch (error) {
      toast.error('Failed to update lap')
    }
  }

  const handleRemoveLap = async (lapId: string) => {
    try {
      await deleteLapAction(training.id, lapId)
      toast.success('Lap removed')
    } catch (error) {
      toast.error('Failed to remove lap')
    }
  }

  const date = new Date(training.date)

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden">
        <MobileHeader 
          title={training.title}
          backHref="/trainings"
          backLabel="Trainings"
          action={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreHorizontal className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowLapDialog(true)}>
                  <Plus className="size-4 mr-2" />
                  Add Lap
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />
      </div>

      {/* Desktop Header */}
      <header className="hidden md:flex sticky top-0 z-40 items-center justify-between h-16 px-6 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{training.title}</h1>
          <Badge className={cn(typeColors[training.type])}>
            {typeLabels[training.type]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowLapDialog(true)}>
            <Plus className="size-4 mr-2" />
            Add Lap
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="size-4 mr-2" />
            Delete
          </Button>
        </div>
      </header>

      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* Summary Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Summary</CardTitle>
              <span className="text-sm text-muted-foreground">
                {date.toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {summary ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <Route className="size-4" />
                    <span className="text-xs">Distance</span>
                  </div>
                  <div className="text-xl font-bold">
                    {formatDistance(summary.totalDistance)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <Clock className="size-4" />
                    <span className="text-xs">Duration</span>
                  </div>
                  <div className="text-xl font-bold">
                    {formatDuration(summary.totalDuration)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                    <span className="text-xs">Avg Pace</span>
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {formatPace(summary.avgPace)}/km
                  </div>
                </div>
                {summary.avgHr && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                      <Heart className="size-4" />
                      <span className="text-xs">Avg HR</span>
                    </div>
                    <div className="text-xl font-bold">
                      {summary.avgHr} <span className="text-sm font-normal">bpm</span>
                    </div>
                  </div>
                )}
                {summary.maxLactate && (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1.5 text-accent mb-1">
                      <Droplet className="size-4" />
                      <span className="text-xs">Max Lactate</span>
                    </div>
                    <div className="text-xl font-bold text-accent">
                      {summary.maxLactate.toFixed(1)} <span className="text-sm font-normal">mmol/L</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                No laps recorded yet
              </p>
            )}
          </CardContent>
        </Card>

        {/* Laps Table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Laps</CardTitle>
              <span className="text-sm text-muted-foreground">
                {training.laps.length} {training.laps.length === 1 ? 'lap' : 'laps'}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {training.laps.length > 0 ? (
              <LapTable
                laps={training.laps}
                onUpdateLap={handleUpdateLap}
                onRemoveLap={handleRemoveLap}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No laps recorded yet</p>
                <Button onClick={() => setShowLapDialog(true)}>
                  <Plus className="size-4 mr-2" />
                  Add First Lap
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {training.notes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">
                {training.notes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Lap Dialog */}
      <LapInputDialog
        open={showLapDialog}
        onOpenChange={setShowLapDialog}
        onSave={handleAddLap}
        existingLaps={training.laps}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Training?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{training.title}&quot; and all its laps.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
