'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { parseDuration, formatDuration } from '@/lib/calculations/pace'
import type { Lap } from '@/lib/db/schemas'

const lapFormSchema = z.object({
  type: z.enum(['effort', 'rest']),
  distance: z.string().min(1, 'Distance is required'),
  duration: z.string().min(1, 'Duration is required'),
  avg_hr: z.string().optional(),
  lactate_mmol: z.string().optional(),
  linkedEffortId: z.string().optional(),
})

type LapFormData = z.infer<typeof lapFormSchema>

interface LapInputDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (lap: Omit<Lap, 'id' | 'pace_min_km'>) => Promise<void>
  existingLaps: Lap[]
  editLap?: Lap
}

export function LapInputDialog({
  open,
  onOpenChange,
  onSave,
  existingLaps,
  editLap,
}: LapInputDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRest, setIsRest] = useState(editLap?.type === 'rest')

  const effortLaps = existingLaps.filter(l => l.type === 'effort')

  const form = useForm<LapFormData>({
    resolver: zodResolver(lapFormSchema),
    defaultValues: editLap
      ? {
          type: editLap.type,
          distance: String(editLap.distance_m),
          duration: formatDuration(editLap.duration_s),
          avg_hr: editLap.avg_hr ? String(editLap.avg_hr) : '',
          lactate_mmol: editLap.lactate_mmol ? String(editLap.lactate_mmol) : '',
          linkedEffortId: editLap.linkedEffortId || '',
        }
      : {
          type: 'effort',
          distance: '',
          duration: '',
          avg_hr: '',
          lactate_mmol: '',
          linkedEffortId: '',
        },
  })

  const handleSubmit = async (data: LapFormData) => {
    setIsSubmitting(true)
    try {
      // Parse distance - support m and km
      let distance_m = 0
      const distanceStr = data.distance.toLowerCase().trim()
      if (distanceStr.endsWith('km')) {
        distance_m = parseFloat(distanceStr) * 1000
      } else if (distanceStr.endsWith('m')) {
        distance_m = parseFloat(distanceStr)
      } else {
        // Assume meters if no unit
        distance_m = parseFloat(distanceStr)
      }

      // Parse duration
      const duration_s = parseDuration(data.duration) || 0

      const lap: Omit<Lap, 'id' | 'pace_min_km'> = {
        type: isRest ? 'rest' : 'effort',
        distance_m,
        duration_s,
        avg_hr: data.avg_hr ? parseInt(data.avg_hr) : null,
        max_hr: null,
        lactate_mmol: data.lactate_mmol ? parseFloat(data.lactate_mmol) : null,
        linkedEffortId: isRest && data.linkedEffortId ? data.linkedEffortId : undefined,
      }

      await onSave(lap)
      form.reset()
      setIsRest(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editLap ? 'Edit Lap' : 'Add Lap'}</DialogTitle>
          <DialogDescription>
            Enter the details for this lap. For lactate measurements taken during rest,
            toggle &quot;Rest Lap&quot; to link the value to the previous effort.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Rest lap toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="rest-toggle" className="text-sm">
              Rest Lap
            </Label>
            <Switch
              id="rest-toggle"
              checked={isRest}
              onCheckedChange={setIsRest}
            />
          </div>

          {/* Link to effort (for rest laps) */}
          {isRest && effortLaps.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="linkedEffort">Link Lactate to Effort</Label>
              <Select
                value={form.watch('linkedEffortId')}
                onValueChange={(value) => form.setValue('linkedEffortId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select effort lap" />
                </SelectTrigger>
                <SelectContent>
                  {effortLaps.map((lap, index) => (
                    <SelectItem key={lap.id} value={lap.id}>
                      Lap {index + 1} ({lap.distance_m}m)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Lactate measured during rest will be attributed to this effort
              </p>
            </div>
          )}

          {/* Distance */}
          <div className="space-y-2">
            <Label htmlFor="distance">Distance</Label>
            <Input
              id="distance"
              placeholder="400m, 1km, 1000"
              {...form.register('distance')}
            />
            {form.formState.errors.distance && (
              <p className="text-xs text-destructive">
                {form.formState.errors.distance.message}
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duration</Label>
            <Input
              id="duration"
              placeholder="1:30, 5:00, 90"
              {...form.register('duration')}
            />
            <p className="text-xs text-muted-foreground">
              Format: MM:SS or just seconds
            </p>
            {form.formState.errors.duration && (
              <p className="text-xs text-destructive">
                {form.formState.errors.duration.message}
              </p>
            )}
          </div>

          {/* Heart Rate */}
          <div className="space-y-2">
            <Label htmlFor="avg_hr">Average Heart Rate (optional)</Label>
            <Input
              id="avg_hr"
              type="number"
              placeholder="165"
              min={0}
              max={250}
              {...form.register('avg_hr')}
            />
          </div>

          {/* Lactate */}
          <div className="space-y-2">
            <Label htmlFor="lactate" className="flex items-center gap-2">
              Lactate (optional)
              <span className="text-xs text-muted-foreground">mmol/L</span>
            </Label>
            <Input
              id="lactate"
              type="number"
              step="0.1"
              placeholder="2.4"
              min={0}
              max={30}
              {...form.register('lactate_mmol')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editLap ? 'Update Lap' : 'Add Lap'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
