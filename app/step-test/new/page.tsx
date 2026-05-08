'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Activity, 
  ChevronRight, 
  ChevronLeft, 
  Zap, 
  Settings, 
  Timer,
  Route
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { BottomNav } from '@/components/layout/bottom-nav'
import { DesktopSidebar } from '@/components/layout/desktop-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { ProtocolPreview } from '@/components/step-test/protocol-preview'
import { useStepTests, useProtocolGenerator } from '@/lib/hooks/use-step-tests'
import { calculateVDOT, getVDOTLevel, formatVDOT } from '@/lib/calculations/vdot'
import { formatPace, parsePace, parseDuration } from '@/lib/calculations/pace'
import { VDOT_DISTANCES } from '@/lib/db/schemas'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type WizardStep = 'environment' | 'mode' | 'manual' | 'smart' | 'preview'

export default function NewStepTestPage() {
  const router = useRouter()
  const { create } = useStepTests()
  const { protocol, paces, generateManualProtocol, generateFromVDOT, reset } = useProtocolGenerator()

  const [step, setStep] = useState<WizardStep>('environment')
  const [environment, setEnvironment] = useState<'track' | 'treadmill'>('track')
  const [mode, setMode] = useState<'manual' | 'smart'>('smart')
  
  // Manual mode inputs
  const [startPace, setStartPace] = useState('6:00')
  const [stepDuration, setStepDuration] = useState('3')
  const [paceIncrement, setPaceIncrement] = useState('15')
  const [numSteps, setNumSteps] = useState('7')

  // Smart mode inputs
  const [referenceDistance, setReferenceDistance] = useState<number>(5000)
  const [referenceTime, setReferenceTime] = useState('')
  const [calculatedVDOT, setCalculatedVDOT] = useState<number | null>(null)

  const [isCreating, setIsCreating] = useState(false)

  const handleCalculateVDOT = () => {
    const timeSec = parseDuration(referenceTime)
    if (!timeSec || timeSec <= 0) {
      toast.error('Please enter a valid race time')
      return
    }
    
    const vdot = calculateVDOT(referenceDistance, timeSec)
    setCalculatedVDOT(vdot)
    
    // Generate protocol
    generateFromVDOT(environment, vdot, parseInt(stepDuration) * 60, parseInt(numSteps))
  }

  const handleGenerateManual = () => {
    const pace = parsePace(startPace)
    if (!pace) {
      toast.error('Please enter a valid start pace (e.g., 6:00)')
      return
    }

    generateManualProtocol(
      environment,
      pace,
      parseInt(stepDuration) * 60,
      parseInt(paceIncrement),
      parseInt(numSteps)
    )
    setStep('preview')
  }

  const handleCreate = async () => {
    if (!protocol) return
    
    setIsCreating(true)
    try {
      const test = await create(protocol)
      toast.success('Step test created')
      router.push(`/step-test/${test.id}/capture`)
    } catch (error) {
      toast.error('Failed to create step test')
    } finally {
      setIsCreating(false)
    }
  }

  const goBack = () => {
    switch (step) {
      case 'mode':
        setStep('environment')
        break
      case 'manual':
      case 'smart':
        setStep('mode')
        reset()
        break
      case 'preview':
        setStep(mode)
        break
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      
      <main className="flex-1 pb-20 md:pb-0">
        {/* Mobile Header */}
        <div className="md:hidden">
          <MobileHeader 
            title="New Step Test" 
            backHref="/step-test"
            backLabel="Step Tests"
          />
        </div>

        {/* Desktop Header */}
        <header className="hidden md:flex sticky top-0 z-40 items-center h-16 px-6 border-b bg-background/95 backdrop-blur">
          <h1 className="text-2xl font-semibold">New Step Test</h1>
        </header>

        <div className="p-4 md:p-6 max-w-2xl mx-auto">
          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {(['environment', 'mode', mode, 'preview'] as WizardStep[]).map((s, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 rounded-full transition-all',
                  s === step ? 'w-8 bg-primary' : 
                  ['environment', 'mode', mode].indexOf(step) >= i ? 'w-2 bg-primary/50' : 'w-2 bg-muted'
                )}
              />
            ))}
          </div>

          {/* Step: Environment */}
          {step === 'environment' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Route className="size-5 text-primary" />
                  Test Environment
                </CardTitle>
                <CardDescription>
                  Where will you perform the step test?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={environment}
                  onValueChange={(v) => setEnvironment(v as 'track' | 'treadmill')}
                  className="grid grid-cols-2 gap-4"
                >
                  <Label
                    htmlFor="track"
                    className={cn(
                      'flex flex-col items-center gap-3 p-6 rounded-xl border-2 cursor-pointer transition-colors',
                      environment === 'track' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                    )}
                  >
                    <RadioGroupItem value="track" id="track" className="sr-only" />
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Route className="size-6 text-primary" />
                    </div>
                    <span className="font-medium">Track</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Outdoor track or measured course
                    </span>
                  </Label>
                  <Label
                    htmlFor="treadmill"
                    className={cn(
                      'flex flex-col items-center gap-3 p-6 rounded-xl border-2 cursor-pointer transition-colors',
                      environment === 'treadmill' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                    )}
                  >
                    <RadioGroupItem value="treadmill" id="treadmill" className="sr-only" />
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Activity className="size-6 text-primary" />
                    </div>
                    <span className="font-medium">Treadmill</span>
                    <span className="text-xs text-muted-foreground text-center">
                      Indoor treadmill with speed control
                    </span>
                  </Label>
                </RadioGroup>

                <Button 
                  className="w-full" 
                  onClick={() => setStep('mode')}
                >
                  Continue
                  <ChevronRight className="size-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step: Mode Selection */}
          {step === 'mode' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="size-5 text-primary" />
                  Protocol Mode
                </CardTitle>
                <CardDescription>
                  How would you like to configure the test protocol?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as 'manual' | 'smart')}
                  className="space-y-3"
                >
                  <Label
                    htmlFor="smart"
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors',
                      mode === 'smart' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                    )}
                  >
                    <RadioGroupItem value="smart" id="smart" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Zap className="size-4 text-accent" />
                        Smart Protocol
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enter a recent race time and we&apos;ll calculate your VDOT to generate
                        an optimal protocol targeting your thresholds.
                      </p>
                    </div>
                  </Label>
                  <Label
                    htmlFor="manual"
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors',
                      mode === 'manual' ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground/50'
                    )}
                  >
                    <RadioGroupItem value="manual" id="manual" className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 font-medium">
                        <Settings className="size-4" />
                        Manual Protocol
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Specify start pace, step duration, and pace increments yourself.
                      </p>
                    </div>
                  </Label>
                </RadioGroup>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={goBack} className="flex-1">
                    <ChevronLeft className="size-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={() => setStep(mode)} className="flex-1">
                    Continue
                    <ChevronRight className="size-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Manual Configuration */}
          {step === 'manual' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="size-5 text-primary" />
                  Manual Protocol
                </CardTitle>
                <CardDescription>
                  Configure the step test parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startPace">Start Pace (min/km)</Label>
                    <Input
                      id="startPace"
                      value={startPace}
                      onChange={(e) => setStartPace(e.target.value)}
                      placeholder="6:00"
                    />
                    <p className="text-xs text-muted-foreground">First step pace</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paceIncrement">Pace Jump (sec/km)</Label>
                    <Input
                      id="paceIncrement"
                      type="number"
                      value={paceIncrement}
                      onChange={(e) => setPaceIncrement(e.target.value)}
                      min={5}
                      max={60}
                    />
                    <p className="text-xs text-muted-foreground">Faster each step</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stepDuration">Step Duration (min)</Label>
                    <Select value={stepDuration} onValueChange={setStepDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 minutes</SelectItem>
                        <SelectItem value="4">4 minutes</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numSteps">Number of Steps</Label>
                    <Select value={numSteps} onValueChange={setNumSteps}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 6, 7, 8, 9, 10].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} steps
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={goBack} className="flex-1">
                    <ChevronLeft className="size-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleGenerateManual} className="flex-1">
                    Generate Protocol
                    <ChevronRight className="size-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Smart Configuration */}
          {step === 'smart' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-5 text-accent" />
                  Smart Protocol
                </CardTitle>
                <CardDescription>
                  Enter a recent race result to calculate your VDOT
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="distance">Race Distance</Label>
                    <Select
                      value={String(referenceDistance)}
                      onValueChange={(v) => setReferenceDistance(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VDOT_DISTANCES.map((d) => (
                          <SelectItem key={d.value} value={String(d.value)}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="raceTime">Finish Time</Label>
                    <Input
                      id="raceTime"
                      value={referenceTime}
                      onChange={(e) => setReferenceTime(e.target.value)}
                      placeholder="20:00 or 1:45:00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: MM:SS or H:MM:SS
                    </p>
                  </div>

                  <Button 
                    variant="secondary" 
                    className="w-full"
                    onClick={handleCalculateVDOT}
                  >
                    <Timer className="size-4 mr-2" />
                    Calculate VDOT
                  </Button>

                  {calculatedVDOT && (
                    <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-muted-foreground">Your VDOT</div>
                          <div className="text-3xl font-bold text-accent">
                            {formatVDOT(calculatedVDOT)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Level</div>
                          <div className="font-medium">{getVDOTLevel(calculatedVDOT)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Step Duration</Label>
                    <Select value={stepDuration} onValueChange={setStepDuration}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3 minutes</SelectItem>
                        <SelectItem value="4">4 minutes</SelectItem>
                        <SelectItem value="5">5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Steps</Label>
                    <Select value={numSteps} onValueChange={setNumSteps}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[5, 6, 7, 8, 9, 10].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n} steps
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={goBack} className="flex-1">
                    <ChevronLeft className="size-4 mr-2" />
                    Back
                  </Button>
                  <Button 
                    onClick={() => {
                      if (calculatedVDOT) {
                        generateFromVDOT(environment, calculatedVDOT, parseInt(stepDuration) * 60, parseInt(numSteps))
                        setStep('preview')
                      } else {
                        toast.error('Please calculate VDOT first')
                      }
                    }} 
                    className="flex-1"
                    disabled={!calculatedVDOT}
                  >
                    Preview Protocol
                    <ChevronRight className="size-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Preview */}
          {step === 'preview' && protocol && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-5 text-primary" />
                  Protocol Preview
                </CardTitle>
                <CardDescription>
                  Review your step test protocol before starting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ProtocolPreview protocol={protocol} paces={paces} />

                <div className="flex gap-3">
                  <Button variant="outline" onClick={goBack} className="flex-1">
                    <ChevronLeft className="size-4 mr-2" />
                    Modify
                  </Button>
                  <Button 
                    onClick={handleCreate} 
                    className="flex-1"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Start Test'}
                    <ChevronRight className="size-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
