import Link from 'next/link'
import { Plus, Activity, ChevronRight, Calendar, Play, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BottomNav } from '@/components/layout/bottom-nav'
import { DesktopSidebar } from '@/components/layout/desktop-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { getStepTestsAction } from '@/lib/actions/step-tests'
import { formatPace } from '@/lib/calculations/pace'
import { cn } from '@/lib/utils'
import type { StepTest } from '@/lib/db/schemas'

const statusConfig: Record<StepTest['status'], { label: string; color: string; icon: typeof Activity }> = {
  setup: { label: 'Setup', color: 'bg-yellow-500/10 text-yellow-600', icon: Activity },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-600', icon: Play },
  completed: { label: 'Completed', color: 'bg-green-500/10 text-green-600', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground', icon: XCircle },
}

export default async function StepTestListPage() {
  const stepTests = await getStepTestsAction()

  const completedTests = stepTests.filter(t => t.status === 'completed')
  const inProgressTests = stepTests.filter(t => t.status === 'in_progress' || t.status === 'setup')

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      
      <main className="flex-1 pb-20 md:pb-0">
        {/* Mobile Header */}
        <div className="md:hidden">
          <MobileHeader 
            title="Step Tests" 
            action={
              <Button asChild size="icon-sm">
                <Link href="/step-test/new">
                  <Plus className="size-5" />
                  <span className="sr-only">New Test</span>
                </Link>
              </Button>
            }
          />
        </div>

        {/* Desktop Header */}
        <header className="hidden md:flex sticky top-0 z-40 items-center justify-between h-16 px-6 border-b bg-background/95 backdrop-blur">
          <div>
            <h1 className="text-2xl font-semibold">Step Tests</h1>
            <p className="text-sm text-muted-foreground">
              {completedTests.length} completed tests
            </p>
          </div>
          <Button asChild>
            <Link href="/step-test/new">
              <Plus className="size-4 mr-2" />
              New Step Test
            </Link>
          </Button>
        </header>

        <div className="p-4 md:p-6 space-y-6">
          {/* In Progress Tests */}
          {inProgressTests.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="size-4 text-blue-500" />
                  Continue Test
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {inProgressTests.map((test) => (
                  <Link key={test.id} href={`/step-test/${test.id}/capture`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-colors">
                      <div>
                        <div className="font-medium">{test.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {test.steps.filter(s => s.completed).length} / {test.steps.length} steps completed
                        </div>
                      </div>
                      <Button size="sm">
                        Continue
                        <ChevronRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Completed Tests */}
          {completedTests.length > 0 ? (
            <div className="space-y-4">
              <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="size-4" />
                Completed Tests
              </h2>
              <div className="space-y-3">
                {completedTests.map((test) => (
                  <StepTestCard key={test.id} test={test} />
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="size-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Activity className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No step tests yet</h3>
              <p className="text-muted-foreground mb-4">
                Start a step test to determine your lactate thresholds and training zones
              </p>
              <Button asChild>
                <Link href="/step-test/new">
                  <Plus className="size-4 mr-2" />
                  Start Step Test
                </Link>
              </Button>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}

function StepTestCard({ test }: { test: StepTest }) {
  const status = statusConfig[test.status]
  const StatusIcon = status.icon
  const date = new Date(test.date)

  return (
    <Link href={`/step-test/${test.id}`}>
      <Card className="hover:bg-accent/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            {/* Left: Date indicator */}
            <div className="flex flex-col items-center justify-center w-12 shrink-0">
              <span className="text-xs text-muted-foreground uppercase">
                {date.toLocaleDateString(undefined, { month: 'short' })}
              </span>
              <span className="text-xl font-bold">{date.getDate()}</span>
            </div>

            {/* Middle: Test info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{test.title}</h3>
                <Badge variant="secondary" className={cn('shrink-0', status.color)}>
                  <StatusIcon className="size-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              {/* Results */}
              {test.results && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">LT1: </span>
                    <span className="font-mono font-medium">
                      {formatPace(test.results.lt1_pace)}/km
                    </span>
                    <span className="text-muted-foreground text-xs ml-1">
                      @ {test.results.lt1_hr}bpm
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LT2: </span>
                    <span className="font-mono font-medium text-accent">
                      {formatPace(test.results.lt2_pace)}/km
                    </span>
                    <span className="text-muted-foreground text-xs ml-1">
                      @ {test.results.lt2_hr}bpm
                    </span>
                  </div>
                </div>
              )}

              {/* Protocol info */}
              <div className="text-xs text-muted-foreground mt-1">
                {test.protocol.target_steps} steps, {test.protocol.step_duration_s / 60}min each
                {test.protocol.mode === 'smart' && test.protocol.vdot && (
                  <span> (VDOT {test.protocol.vdot.toFixed(0)})</span>
                )}
              </div>
            </div>

            {/* Right: Chevron */}
            <ChevronRight className="size-5 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
