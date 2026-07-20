'use client'

import { use, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { 
  ChevronRight, 
  X, 
  Check, 
  SkipForward,
  Heart,
  Droplet,
  Timer,
  Plus,
  Flag,
  AlertTriangle,
  Info
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { NumericInput } from '@/components/step-test/numeric-input'
import { useStepTest } from '@/lib/hooks/use-step-tests'
import { formatPace, formatDuration } from '@/lib/calculations/pace'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Plausibility check result
interface PlausibilityWarning {
  type: 'error' | 'warning' | 'info'
  message: string
}

function checkStepPlausibility(
  hr: number | null,
  lactate: number | null,
  previousSteps: { hr: number | null; lactate: number | null }[]
): PlausibilityWarning[] {
  const warnings: PlausibilityWarning[] = []
  const prevStep = previousSteps.length > 0 ? previousSteps[previousSteps.length - 1] : null
  
  // HR checks
  if (hr !== null) {
    if (hr < 80) warnings.push({ type: 'warning', message: 'HF sehr niedrig - Eingabe pruefen' })
    if (hr > 210) warnings.push({ type: 'warning', message: 'HF ungewoehnlich hoch - Eingabe pruefen' })
    if (prevStep?.hr && hr < prevStep.hr - 10) {
      warnings.push({ type: 'warning', message: 'HF niedriger als zuvor - Messung pruefen' })
    }
  }
  
  // Lactate checks
  if (lactate !== null) {
    if (lactate < 0.5) warnings.push({ type: 'warning', message: 'Laktat unter 0.5 mmol/L ist ungewoehnlich' })
    if (lactate > 20) warnings.push({ type: 'warning', message: 'Laktat ueber 20 mmol/L - Eingabe pruefen' })

    // A falling value early in the test is normal (warm-up lactate clearing).
    // It only becomes suspicious once the rise has actually started - i.e. the
    // previous step already sits clearly above the lowest value measured so
    // far. A fixed "from step 3 onwards" rule misses dips that run longer.
    const previousLactates = previousSteps
      .map(s => s.lactate)
      .filter((l): l is number => l !== null && l !== undefined)

    if (prevStep?.lactate != null && previousLactates.length > 0) {
      const lowestSoFar = Math.min(...previousLactates)
      const riseStarted = prevStep.lactate - lowestSoFar > 0.4

      if (riseStarted && prevStep.lactate - lactate > 0.3) {
        warnings.push({ type: 'warning', message: `Laktat faellt (${prevStep.lactate.toFixed(1)} -> ${lactate.toFixed(1)})` })
      }
    }
  }
  
  return warnings
}

export default function StepTestCapturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { 
    stepTest, 
    loading, 
    currentStep, 
    currentStepIndex,
    totalSteps,
    progress,
    startCapture,
    completeStep,
    skipStep,
    completeTest,
    addStep,
    refresh,
    update,
  } = useStepTest(id)

  const [hr, setHr] = useState('')
  const [lactate, setLactate] = useState('')
  const [restingLactateStr, setRestingLactateStr] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  
  // Initialize resting lactate if already saved
  useEffect(() => {
    if (stepTest?.resting_lactate !== undefined && !restingLactateStr) {
      setRestingLactateStr(stepTest.resting_lactate.toString())
    }
  }, [stepTest?.resting_lactate])
  
  // Dialog state machine - only ONE dialog at a time
  type DialogType = 'none' | 'cancel' | 'lastStepOk' | 'lastStepLowLactate'
  const [dialogType, setDialogType] = useState<DialogType>('none')
  
  // Track step count at time of dialog (to show correct number)
  const [dialogStepCount, setDialogStepCount] = useState(0)
  
  // Prevent double-submit
  const submitRef = useRef(false)

  // Start capture when page loads
  useEffect(() => {
    if (stepTest && stepTest.status === 'setup') {
      startCapture()
    }
  }, [stepTest?.status, startCapture])

  // Calculate max lactate reached (from ALL completed steps, INCLUDING current input if set)
  const maxLactateSoFar = useMemo(() => {
    if (!stepTest) return 0
    const completedLactates = stepTest.steps
      .filter(s => s.completed && s.lactate_mmol !== null)
      .map(s => s.lactate_mmol!)
    return Math.max(...completedLactates, 0)
  }, [stepTest])

  // Number of completed steps (used for UI only)
  const completedSteps = useMemo(() => {
    if (!stepTest) return 0
    return stepTest.steps.filter(s => s.completed).length
  }, [stepTest])

  // Plausibility warnings for current input
  const warnings = useMemo(() => {
    if (!stepTest || !currentStep) return []
    const hrVal = hr ? parseInt(hr) : null
    const lacVal = lactate ? parseFloat(lactate) : null
    const prev = stepTest.steps
      .filter(s => s.completed && !s.skipped)
      .map(s => ({ hr: s.end_hr, lactate: s.lactate_mmol }))
    return checkStepPlausibility(hrVal, lacVal, prev)
  }, [hr, lactate, stepTest, currentStep])

  // Handle completing current step
  const handleCompleteStep = useCallback(async () => {
    if (!currentStep || isSaving || submitRef.current) return
    
    submitRef.current = true
    setIsSaving(true)
    
    try {
      const hrVal = hr ? parseInt(hr) : null
      const lacVal = lactate ? parseFloat(lactate) : null
      
      // Check if this is the last step BEFORE saving (using current state)
      const isLastStepBefore = currentStepIndex + 1 === totalSteps
      
      // Calculate what the new max lactate will be (including current input)
      const newMaxLactate = Math.max(maxLactateSoFar, lacVal || 0)
      
      // Save the step to IndexedDB
      await completeStep(currentStep.step_number, hrVal, lacVal)
      
      // Clear inputs
      setHr('')
      setLactate('')
      
      // Refresh to get updated data from IndexedDB
      await refresh()
      
      // Now determine if we should show a dialog
      // The step count AFTER saving is totalSteps (since we just completed the last one)
      // or completedSteps + 1 if not all done
      if (isLastStepBefore) {
        // This was the last step - show dialog
        setDialogStepCount(totalSteps) // All steps are now completed
        
        if (newMaxLactate < 4.0) {
          setDialogType('lastStepLowLactate')
        } else {
          setDialogType('lastStepOk')
        }
      }
      // If not last step, continue to next step automatically (no dialog needed)
    } catch (error) {
      toast.error('Fehler beim Speichern')
    } finally {
      setIsSaving(false)
      submitRef.current = false
    }
  }, [currentStep, hr, lactate, completeStep, refresh, currentStepIndex, totalSteps, maxLactateSoFar, isSaving])

  // Handle skip step
  const handleSkip = useCallback(async () => {
    if (!currentStep || isSaving) return
    
    setIsSaving(true)
    try {
      // Check if this is the last step BEFORE skipping
      const isLastStepBefore = currentStepIndex + 1 === totalSteps
      
      await skipStep(currentStep.step_number)
      setHr('')
      setLactate('')
      await refresh()
      
      // Show dialog if this was the last step
      if (isLastStepBefore) {
        setDialogStepCount(totalSteps)
        if (maxLactateSoFar < 4.0) {
          setDialogType('lastStepLowLactate')
        } else {
          setDialogType('lastStepOk')
        }
      }
    } catch {
      toast.error('Fehler beim Ueberspringen')
    } finally {
      setIsSaving(false)
    }
  }, [currentStep, skipStep, refresh, currentStepIndex, totalSteps, maxLactateSoFar, isSaving])

  // Handle adding another step
  const handleAddStep = useCallback(async () => {
    setDialogType('none')
    try {
      await addStep()
      await refresh()
      toast.success('Weitere Stufe hinzugefuegt')
    } catch {
      toast.error('Fehler beim Hinzufuegen')
    }
  }, [addStep, refresh])

  // Handle finishing test
  const handleFinish = useCallback(async () => {
    setDialogType('none')
    try {
      await completeTest()
      toast.success('Test abgeschlossen')
      router.push(`/step-test/${id}`)
    } catch {
      toast.error('Fehler beim Abschliessen')
    }
  }, [completeTest, router, id])

  // Handle cancel
  const handleCancel = useCallback(() => {
    setDialogType('cancel')
  }, [])

  // Handle confirm cancel
  const handleConfirmCancel = useCallback(async () => {
    setDialogType('none')
    router.push(`/step-test/${id}`)
  }, [router, id])

  // Loading state
  if (loading || !stepTest) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Lade Test...</p>
        </div>
      </div>
    )
  }

  // All steps done - no current step
  if (!currentStep) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center">
          <Check className="size-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Alle Stufen erfasst</h1>
          <p className="text-muted-foreground mb-6">{totalSteps} Stufen abgeschlossen.</p>
          <Button onClick={handleFinish} size="lg">Analyse starten</Button>
        </div>
      </div>
    )
  }

  // Can end test early (from step 5 onwards)?
  const canEndEarly = completedSteps >= 4
  const isLastStep = currentStepIndex === totalSteps - 1

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b shrink-0">
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          <X className="size-5" />
          <span className="ml-2 hidden sm:inline">Abbrechen</span>
        </Button>
        <div className="text-center">
          <div className="text-sm font-medium">Stufe {currentStep.step_number} / {totalSteps}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSkip} disabled={isSaving}>
          <SkipForward className="size-5" />
          <span className="ml-2 hidden sm:inline">Skip</span>
        </Button>
      </header>

      {/* Progress */}
      <div className="px-4 pt-2 shrink-0">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>{completedSteps} abgeschlossen</span>
          <span>{totalSteps - completedSteps} uebrig</span>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 pb-36">
        {/* Target pace */}
        <div className="text-center mb-6">
          <div className="text-sm text-muted-foreground mb-1 flex items-center justify-center gap-1">
            <Timer className="size-4" />
            Zieltempo
          </div>
          <div className="text-4xl sm:text-5xl font-bold font-mono text-primary">
            {formatPace(currentStep.target_pace_min_km)}
            <span className="text-xl text-muted-foreground">/km</span>
          </div>
          <div className="text-base text-muted-foreground mt-1">
            {(60 / currentStep.target_pace_min_km).toFixed(1)} km/h
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {formatDuration(stepTest.protocol.step_duration_s)} bei diesem Tempo
          </div>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-1 mb-6 flex-wrap justify-center max-w-xs">
          {stepTest.steps.map((step, i) => (
            <div
              key={step.step_number}
              className={cn(
                'h-2 rounded-full transition-all',
                step.completed ? 'w-4 bg-green-500' : i === currentStepIndex ? 'w-6 bg-primary' : 'w-2 bg-muted'
              )}
            />
          ))}
        </div>

        {/* Resting Lactate (Only shown before first step is completed) */}
        {completedSteps === 0 && (
          <div className="w-full max-w-sm mb-6 p-4 border rounded-xl bg-muted/30">
            <label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Droplet className="size-4 text-blue-500" />
              Ruhelaktat <span className="text-muted-foreground font-normal">(vor dem Test)</span>
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <NumericInput 
                  value={restingLactateStr} 
                  onChange={setRestingLactateStr} 
                  placeholder="z.B. 1.2" 
                  min={0} max={25} step={0.1} decimal 
                />
              </div>
              <Button 
                variant="secondary" 
                onClick={async () => {
                  setIsSaving(true)
                  try {
                    await update({ resting_lactate: parseFloat(restingLactateStr) })
                    toast.success('Ruhelaktat gespeichert')
                  } catch (e) {
                    toast.error('Fehler beim Speichern')
                  } finally {
                    setIsSaving(false)
                  }
                }}
                disabled={!restingLactateStr || isSaving || (stepTest.resting_lactate === parseFloat(restingLactateStr))}
                className="h-10"
              >
                Speichern
              </Button>
            </div>
            {stepTest.resting_lactate !== undefined && (
              <div className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Check className="size-3" />
                Gespeichert: {stepTest.resting_lactate.toFixed(2)} mmol/L
              </div>
            )}
          </div>
        )}

        {/* Input fields */}
        <div className="w-full max-w-sm space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Heart className="size-4 text-red-500" />
              Herzfrequenz <span className="text-muted-foreground font-normal">(bpm)</span>
            </label>
            <NumericInput value={hr} onChange={setHr} placeholder="165" min={60} max={220} unit="bpm" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Droplet className="size-4 text-orange-500" />
              Laktat <span className="text-muted-foreground font-normal">(mmol/L)</span>
            </label>
            <NumericInput value={lactate} onChange={setLactate} placeholder="2.4" min={0} max={25} step={0.1} unit="mmol/L" decimal />
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (hr || lactate) && (
            <div className="space-y-2 pt-2">
              {warnings.map((w, i) => (
                <Alert key={i} className={cn('py-2', w.type === 'warning' && 'border-amber-500 bg-amber-50 text-amber-900')}>
                  {w.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  {w.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
                  <AlertDescription className="text-sm">{w.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Fixed bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t space-y-2">
        <Button 
          className="w-full h-14 text-lg" 
          onClick={handleCompleteStep} 
          disabled={isSaving}
        >
          {isSaving ? 'Speichern...' : (
            <>
              {isLastStep ? 'Letzte Stufe abschliessen' : 'Stufe abschliessen'}
              <ChevronRight className="size-5 ml-2" />
            </>
          )}
        </Button>
        
        {canEndEarly && !isLastStep && (
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setDialogType('cancel')}
            disabled={isSaving}
          >
            <Flag className="size-4 mr-2" />
            Test jetzt beenden ({completedSteps} Stufen)
          </Button>
        )}
      </div>

      {/* Dialog: Last step - low lactate warning */}
      <AlertDialog open={dialogType === 'lastStepLowLactate'} onOpenChange={(open) => !open && setDialogType('none')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="size-5" />
              Laktat unter 4.0 mmol/L
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">
                <strong className="text-foreground">{dialogStepCount} Stufen</strong> erfasst.
              </span>
              <span className="block">
                Max. Laktat: <strong className="text-foreground">{maxLactateSoFar.toFixed(1)} mmol/L</strong>
              </span>
              <span className="block">
                Fuer eine genaue LT2-Bestimmung sollte mindestens 4.0 mmol/L erreicht werden.
              </span>
              <span className="block font-medium text-amber-700 bg-amber-50 p-2 rounded">
                Empfehlung: Fuehre noch eine Stufe durch um die anaerobe Schwelle sicher zu bestimmen.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button onClick={handleAddStep} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700">
              <Plus className="size-4 mr-2" />
              Weitere Stufe
            </Button>
            <Button variant="outline" onClick={handleFinish} className="w-full sm:w-auto">
              Trotzdem beenden
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Last step completed (lactate OK) */}
      <AlertDialog open={dialogType === 'lastStepOk'} onOpenChange={(open) => !open && setDialogType('none')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Check className="size-5 text-green-600" />
              Letzte Stufe abgeschlossen
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span>
                <strong>{dialogStepCount} Stufen</strong> erfasst. Max. Laktat: <strong>{maxLactateSoFar.toFixed(1)} mmol/L</strong>
                {' - '}
                Moechtest du eine weitere Stufe anhaengen oder den Test beenden?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleAddStep} className="w-full sm:w-auto">
              <Plus className="size-4 mr-2" />
              Weitere Stufe
            </Button>
            <Button onClick={handleFinish} className="w-full sm:w-auto">
              <Check className="size-4 mr-2" />
              Beenden & Analysieren
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Cancel / End early */}
      <AlertDialog open={dialogType === 'cancel'} onOpenChange={(open) => !open && setDialogType('none')}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {canEndEarly ? 'Test beenden?' : 'Test abbrechen?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {completedSteps} von {totalSteps} Stufen abgeschlossen.
              {completedSteps < 4 && (
                <span className="block mt-2 text-amber-600">
                  Hinweis: Mindestens 4 Stufen werden fuer eine genaue Analyse empfohlen.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter testen</AlertDialogCancel>
            {canEndEarly ? (
              <AlertDialogAction onClick={handleFinish}>
                <Check className="size-4 mr-2" />
                Beenden & Analysieren
              </AlertDialogAction>
            ) : (
              <AlertDialogAction onClick={handleConfirmCancel} className="bg-destructive hover:bg-destructive/90">
                Abbrechen
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
