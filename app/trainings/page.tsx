import { DesktopSidebar } from '@/components/layout/desktop-sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { getTrainingsAction } from '@/lib/actions/trainings'
import { TrainingsClient } from '@/components/trainings/trainings-client'

export default async function TrainingsPage() {
  const trainings = await getTrainingsAction()

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      
      <main className="flex-1 pb-20 md:pb-0">
        <TrainingsClient trainings={trainings} />
      </main>

      <BottomNav />
    </div>
  )
}
