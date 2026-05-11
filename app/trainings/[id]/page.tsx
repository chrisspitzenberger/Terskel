import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BottomNav } from '@/components/layout/bottom-nav'
import { DesktopSidebar } from '@/components/layout/desktop-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { TrainingDetailClient } from '@/components/trainings/training-detail-client'
import { getTrainingAction } from '@/lib/actions/trainings'
import { calculatePace } from '@/lib/calculations/pace'
import { notFound } from 'next/navigation'
import type { Training } from '@/lib/db/schemas'

function getTrainingSummary(training: Training) {
  const effortLaps = training.laps.filter(l => l.type === 'effort')
  const totalDistance = effortLaps.reduce((sum, l) => sum + l.distance_m, 0)
  const totalDuration = effortLaps.reduce((sum, l) => sum + l.duration_s, 0)
  const avgPace = calculatePace(totalDistance, totalDuration)
  const avgHr = effortLaps.length > 0
    ? Math.round(effortLaps.filter(l => l.avg_hr).reduce((sum, l) => sum + (l.avg_hr || 0), 0) / effortLaps.filter(l => l.avg_hr).length)
    : null
  const maxLactate = Math.max(...training.laps.filter(l => l.lactate_mmol).map(l => l.lactate_mmol!), 0)
  
  return {
    totalDistance,
    totalDuration,
    avgPace,
    avgHr,
    maxLactate: maxLactate > 0 ? maxLactate : null,
    lapCount: effortLaps.length,
  }
}

export default async function TrainingDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const training = await getTrainingAction(params.id)

  if (!training) {
    return (
      <div className="flex min-h-screen bg-background">
        <DesktopSidebar />
        <main className="flex-1 pb-20 md:pb-0">
          <div className="md:hidden">
            <MobileHeader title="Not Found" backHref="/trainings" />
          </div>
          <div className="p-4 md:p-6 text-center py-16">
            <h2 className="text-xl font-semibold mb-2">Training not found</h2>
            <p className="text-muted-foreground mb-4">This training may have been deleted.</p>
            <Button asChild>
              <Link href="/trainings">Back to Trainings</Link>
            </Button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  const summary = getTrainingSummary(training)

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      <main className="flex-1 pb-20 md:pb-0">
        <TrainingDetailClient training={training} summary={summary} />
      </main>
      <BottomNav />
    </div>
  )
}
