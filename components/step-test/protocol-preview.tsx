'use client'

import { Clock, Timer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { StepTestProtocol } from '@/lib/db/schemas'
import { formatPace, formatDuration } from '@/lib/calculations/pace'

interface ProtocolPreviewProps {
  protocol: StepTestProtocol
  paces: number[]
}

export function ProtocolPreview({ protocol, paces }: ProtocolPreviewProps) {
  const totalDuration = protocol.step_duration_s * protocol.target_steps
  
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/50">
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Steps</div>
          <div className="font-bold">{protocol.target_steps}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Step Duration</div>
          <div className="font-bold">{protocol.step_duration_s / 60} min</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-muted-foreground mb-1">Total Time</div>
          <div className="font-bold">{formatDuration(totalDuration)}</div>
        </div>
      </div>

      {/* Protocol details */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{protocol.environment}</Badge>
        <Badge variant="outline">{protocol.mode === 'smart' ? 'Smart' : 'Manual'}</Badge>
        {protocol.vdot && (
          <Badge variant="secondary">VDOT {protocol.vdot.toFixed(0)}</Badge>
        )}
      </div>

      {/* Steps list */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Target Paces</h4>
        <div className="space-y-1.5">
          {paces.map((pace, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                  {index + 1}
                </div>
                <div>
                  <div className="font-mono font-medium">
                    {formatPace(pace)}/km
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {protocol.step_duration_s / 60} minutes
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="size-3.5" />
                {formatDuration(protocol.step_duration_s)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Timer className="size-4 text-accent" />
          How it works
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>- Run each step at the target pace for {protocol.step_duration_s / 60} minutes</li>
          <li>- At the end of each step, record your heart rate</li>
          <li>- Take a lactate measurement during the rest period</li>
          <li>- Continue until you can no longer maintain pace or reach exhaustion</li>
        </ul>
      </div>
    </div>
  )
}
