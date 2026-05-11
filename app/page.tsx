import Link from 'next/link'
import { Plus, Activity, Dumbbell, TrendingUp, Clock, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BottomNav, OfflineIndicator } from '@/components/layout/bottom-nav'
import { DesktopSidebar } from '@/components/layout/desktop-sidebar'
import { formatDistance, formatDuration, formatPace } from '@/lib/calculations/pace'
import { getTrainingsAction } from '@/lib/actions/trainings'
import { getStepTestsAction } from '@/lib/actions/step-tests'

export default async function DashboardPage() {
  const [trainings, stepTests] = await Promise.all([
    getTrainingsAction(),
    getStepTestsAction()
  ])

  const recentTrainings = trainings.slice(0, 3)
  const recentTests = stepTests.slice(0, 2)
  const completedTests = stepTests.filter(t => t.status === 'completed')

  // Calculate summary stats from recent trainings
  const last7DaysTrainings = trainings.filter(t => {
    const trainingDate = new Date(t.date)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return trainingDate >= weekAgo
  })

  const weeklyDistance = last7DaysTrainings.reduce((sum, t) => {
    return sum + t.laps.filter(l => l.type === 'effort').reduce((s, l) => s + l.distance_m, 0)
  }, 0)

  const weeklyDuration = last7DaysTrainings.reduce((sum, t) => {
    return sum + t.laps.filter(l => l.type === 'effort').reduce((s, l) => s + l.duration_s, 0)
  }, 0)

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      
      <main className="flex-1 pb-20 md:pb-0">
        <OfflineIndicator />
        
        {/* Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between h-16 px-4 md:px-6">
            <div>
              <h1 className="text-xl font-semibold md:text-2xl">Dashboard</h1>
              <p className="text-sm text-muted-foreground hidden md:block">
                Track your endurance training progress
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm">
                <Link href="/trainings/new">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline ml-2">New Training</span>
                </Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-6 space-y-6">
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Link href="/trainings/new">
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary mb-3">
                    <Dumbbell className="size-6" />
                  </div>
                  <span className="font-medium">Log Training</span>
                  <span className="text-xs text-muted-foreground mt-1">Record your session</span>
                </CardContent>
              </Card>
            </Link>
            <Link href="/step-test/new">
              <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="flex flex-col items-center justify-center p-6 text-center">
                  <div className="flex items-center justify-center size-12 rounded-full bg-accent/20 text-accent mb-3">
                    <Activity className="size-6" />
                  </div>
                  <span className="font-medium">Step Test</span>
                  <span className="text-xs text-muted-foreground mt-1">Find your thresholds</span>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Weekly stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {last7DaysTrainings.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatDistance(weeklyDistance)}
                  </div>
                  <div className="text-xs text-muted-foreground">Distance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatDuration(weeklyDuration)}
                  </div>
                  <div className="text-xs text-muted-foreground">Duration</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent trainings */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Trainings</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/trainings">
                    View all
                    <ChevronRight className="size-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentTrainings.length > 0 ? (
                <div className="space-y-3">
                  {recentTrainings.map((training) => {
                    const effortLaps = training.laps.filter(l => l.type === 'effort')
                    const totalDistance = effortLaps.reduce((s, l) => s + l.distance_m, 0)
                    const totalDuration = effortLaps.reduce((s, l) => s + l.duration_s, 0)
                    
                    return (
                      <Link key={training.id} href={`/trainings/${training.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                          <div>
                            <div className="font-medium">{training.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(training.date).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{formatDistance(totalDistance)}</div>
                            <div className="text-sm text-muted-foreground">
                              {formatDuration(totalDuration)}
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Dumbbell className="size-8 mx-auto mb-2 opacity-50" />
                  <p>No trainings yet</p>
                  <Button asChild variant="link" size="sm" className="mt-2">
                    <Link href="/trainings/new">Log your first training</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent step tests */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Step Tests</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/step-test">
                    View all
                    <ChevronRight className="size-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {completedTests.length > 0 ? (
                <div className="space-y-3">
                  {completedTests.slice(0, 2).map((test) => (
                    <Link key={test.id} href={`/step-test/${test.id}`}>
                      <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                        <div>
                          <div className="font-medium">{test.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(test.date).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                        </div>
                        {test.results && (
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              LT2: {formatPace(test.results.lt2_pace)}/km
                            </div>
                            <div className="text-xs text-muted-foreground">
                              @ {test.results.lt2_hr} bpm
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="size-8 mx-auto mb-2 opacity-50" />
                  <p>No completed step tests</p>
                  <Button asChild variant="link" size="sm" className="mt-2">
                    <Link href="/step-test/new">Start your first test</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
