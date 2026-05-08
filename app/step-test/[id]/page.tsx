"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Play, BarChart3, Trash2, AlertCircle, Edit2, Save, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useStepTest } from "@/lib/hooks/use-step-tests"
import { deleteStepTest } from "@/lib/db/indexed-db"
import { formatPace } from "@/lib/calculations/pace"
import { AnalysisChart } from "@/components/step-test/analysis-chart"
import { ThresholdResults } from "@/components/step-test/threshold-results"
import { TrainingZones } from "@/components/step-test/training-zones"
import { detectThresholds, type ThresholdAnalysis } from "@/lib/calculations/lactate-threshold"
import { stepDataToStepTestStep } from "@/lib/db/schemas"
import { toast } from "sonner"

export default function StepTestDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { stepTest: test, loading, update } = useStepTest(params.id as string)
  const [analysis, setAnalysis] = useState<ThresholdAnalysis | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedSteps, setEditedSteps] = useState<{ [key: number]: { hr: string; lactate: string } }>({})

  // Convert steps to the format expected by analysis components
  const convertedSteps = useMemo(() => {
    if (!test) return []
    return test.steps.map(step => stepDataToStepTestStep(step))
  }, [test])

  // Run analysis when data changes
  const runAnalysis = useCallback(() => {
    if (!test || test.steps.length < 3) {
      setAnalysis(null)
      return
    }
    
    const stepsWithLactate = convertedSteps.filter(s => s.lactate !== undefined)
    if (stepsWithLactate.length >= 3) {
      const thresholdAnalysis = detectThresholds(convertedSteps)
      setAnalysis(thresholdAnalysis)
    } else {
      setAnalysis(null)
    }
  }, [test, convertedSteps])

  useEffect(() => {
    runAnalysis()
  }, [runAnalysis])

  const handleDelete = useCallback(async () => {
    if (!test) return
    try {
      await deleteStepTest(test.id)
      router.push("/step-test")
    } catch (error) {
      toast.error('Fehler beim Loeschen')
    }
  }, [test, router])

  // Start editing mode
  const handleStartEdit = () => {
    if (!test) return
    
    const initialEdits: { [key: number]: { hr: string; lactate: string } } = {}
    test.steps.forEach(step => {
      initialEdits[step.step_number] = {
        hr: step.end_hr?.toString() || '',
        lactate: step.lactate_mmol?.toString() || '',
      }
    })
    setEditedSteps(initialEdits)
    setIsEditing(true)
  }

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedSteps({})
  }

  // Save edited values
  const handleSaveEdit = async () => {
    if (!test) return

    try {
      const updatedSteps = test.steps.map(step => {
        const edited = editedSteps[step.step_number]
        if (!edited) return step
        
        return {
          ...step,
          end_hr: edited.hr ? parseInt(edited.hr) : null,
          lactate_mmol: edited.lactate ? parseFloat(edited.lactate) : null,
        }
      })

      await update({ steps: updatedSteps })
      setIsEditing(false)
      setEditedSteps({})
      toast.success('Werte gespeichert - Analyse wird aktualisiert')
    } catch (error) {
      toast.error('Fehler beim Speichern')
    }
  }

  // Update a single step value while editing
  const handleStepValueChange = (stepNumber: number, field: 'hr' | 'lactate', value: string) => {
    setEditedSteps(prev => ({
      ...prev,
      [stepNumber]: {
        ...prev[stepNumber],
        [field]: value,
      },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Lade Test...</div>
      </div>
    )
  }

  if (!test) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Test nicht gefunden</p>
        <Button asChild>
          <Link href="/step-test">Zur Übersicht</Link>
        </Button>
      </div>
    )
  }

  const completedSteps = test.steps.filter(s => s.end_hr !== null || s.lactate_mmol !== null)
  const hasEnoughData = completedSteps.length >= 3
  const isInProgress = test.status === "in_progress"
  const isCompleted = test.status === "completed"

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/step-test">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">
              {test.title || `Stufentest vom ${new Date(test.date).toLocaleDateString("de-DE")}`}
            </h1>
            <p className="text-sm text-muted-foreground">
              {test.protocol.environment === "treadmill" ? "Laufband" : "Bahn"} - {test.protocol.mode === "smart" ? "VDOT-basiert" : "Manuell"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-11 sm:ml-0">
          <Badge variant={isCompleted ? "default" : isInProgress ? "secondary" : "outline"}>
            {isCompleted ? "Abgeschlossen" : isInProgress ? "In Bearbeitung" : "Geplant"}
          </Badge>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Test löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten dieses Tests werden dauerhaft gelöscht.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Action Buttons */}
      {!isCompleted && (
        <div className="flex gap-2">
          <Button asChild className="flex-1">
            <Link href={`/step-test/${test.id}/capture`}>
              <Play className="h-4 w-4 mr-2" />
              {isInProgress ? "Fortsetzen" : "Test starten"}
            </Link>
          </Button>
        </div>
      )}

      {/* Protocol Overview */}
      <Card>
        <CardHeader className="pb-2 sm:pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base sm:text-lg">Protokoll</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {test.steps.length} Stufen, {test.protocol.step_duration_s}s pro Stufe
              </CardDescription>
            </div>
            {isCompleted && !isEditing && (
              <Button variant="outline" size="sm" onClick={handleStartEdit}>
                <Edit2 className="h-4 w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Werte bearbeiten</span>
                <span className="sm:hidden">Bearbeiten</span>
              </Button>
            )}
            {isEditing && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Abbrechen</span>
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  <Save className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Speichern</span>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 sm:px-3">Stufe</th>
                  <th className="text-left py-2 px-2 sm:px-3">Tempo</th>
                  <th className="text-left py-2 px-2 sm:px-3">HF</th>
                  <th className="text-left py-2 px-2 sm:px-3">Laktat</th>
                </tr>
              </thead>
              <tbody>
                {test.steps.map((step) => (
                  <tr key={step.step_number} className="border-b last:border-0">
                    <td className="py-2 px-2 sm:px-3 font-medium">{step.step_number}</td>
                    <td className="py-2 px-2 sm:px-3">{formatPace(step.target_pace_min_km)}</td>
                    <td className="py-2 px-2 sm:px-3">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editedSteps[step.step_number]?.hr || ''}
                          onChange={(e) => handleStepValueChange(step.step_number, 'hr', e.target.value)}
                          className="h-7 w-16 sm:w-20 text-xs sm:text-sm"
                          placeholder="bpm"
                        />
                      ) : (
                        step.end_hr ? `${step.end_hr} bpm` : "-"
                      )}
                    </td>
                    <td className="py-2 px-2 sm:px-3">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.1"
                          value={editedSteps[step.step_number]?.lactate || ''}
                          onChange={(e) => handleStepValueChange(step.step_number, 'lactate', e.target.value)}
                          className="h-7 w-16 sm:w-20 text-xs sm:text-sm"
                          placeholder="mmol/L"
                        />
                      ) : (
                        step.lactate_mmol ? `${step.lactate_mmol.toFixed(1)} mmol/L` : "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isEditing && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Nach dem Speichern wird die Analyse automatisch neu berechnet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Analysis Section */}
      {hasEnoughData && (
        <>
          {/* Chart */}
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                Analyse
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Laktat- und Herzfrequenzkurve über die Geschwindigkeit
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <AnalysisChart steps={convertedSteps} analysis={analysis} />
            </CardContent>
          </Card>

          {/* Threshold Results */}
          {analysis && (
            <ThresholdResults analysis={analysis} />
          )}

          {/* Training Zones */}
          {analysis && analysis.lt2 && (
            <TrainingZones analysis={analysis} />
          )}
        </>
      )}

      {/* Not enough data message */}
      {!hasEnoughData && isCompleted && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>Nicht genügend Daten für eine Analyse.</p>
              <p className="text-sm">Mindestens 3 Stufen mit Laktatwerten werden benötigt.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
