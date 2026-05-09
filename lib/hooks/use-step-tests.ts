'use client'

import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  getAllStepTests,
  getStepTest,
  saveStepTest,
  deleteStepTest,
} from '../db/indexed-db'
import type { StepTest, StepTestProtocol, StepData } from '../db/schemas'
import { generateSmartProtocol, getTrainingPaces } from '../calculations/vdot'
import { analyzeStepTest } from '../calculations/lactate-threshold'
import { generateStepPaces } from '../calculations/pace'

export function useStepTests() {
  const [stepTests, setStepTests] = useState<StepTest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAllStepTests()
      setStepTests(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load step tests'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (protocol: StepTestProtocol): Promise<StepTest> => {
    const now = new Date().toISOString()
    
    // Generate target paces based on mode
    let targetPaces: number[]
    
    if (protocol.mode === 'smart' && protocol.vdot) {
      const smartProtocol = generateSmartProtocol(protocol.vdot, protocol.target_steps)
      targetPaces = smartProtocol.paces
    } else {
      targetPaces = generateStepPaces(
        protocol.start_pace_min_km,
        protocol.pace_increment_s,
        protocol.target_steps
      )
    }
    
    // Create step data array
    const steps: StepData[] = targetPaces.map((pace, index) => ({
      step_number: index + 1,
      target_pace_min_km: pace,
      end_hr: null,
      lactate_mmol: null,
      completed: false,
    }))
    
    const stepTest: StepTest = {
      id: uuidv4(),
      date: now.split('T')[0],
      title: `Step Test - ${new Date().toLocaleDateString()}`,
      protocol,
      steps,
      status: 'setup',
      createdAt: now,
      updatedAt: now,
    }
    
    await saveStepTest(stepTest)
    await refresh()
    return stepTest
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await deleteStepTest(id)
    await refresh()
  }, [refresh])

  return {
    stepTests,
    loading,
    error,
    refresh,
    create,
    remove,
  }
}

export function useStepTest(id: string | undefined) {
  const [stepTest, setStepTest] = useState<StepTest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!id) {
      setStepTest(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getStepTest(id)
      setStepTest(data || null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load step test'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = useCallback(async (updates: Partial<StepTest>) => {
    if (!stepTest) return
    
    const updated: StepTest = {
      ...stepTest,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    await saveStepTest(updated)
    setStepTest(updated)
    return updated
  }, [stepTest])

  const startCapture = useCallback(async () => {
    if (!stepTest) return
    return update({ status: 'in_progress' })
  }, [stepTest, update])

  const updateStep = useCallback(async (stepNumber: number, data: Partial<StepData>) => {
    if (!stepTest) return
    
    const updatedSteps = stepTest.steps.map(step => {
      if (step.step_number !== stepNumber) return step
      return { ...step, ...data }
    })
    
    return update({ steps: updatedSteps })
  }, [stepTest, update])

  const completeStep = useCallback(async (stepNumber: number, hr: number | null, lactate: number | null) => {
    if (!stepTest) return
    
    const updatedSteps = stepTest.steps.map(step => {
      if (step.step_number !== stepNumber) return step
      return {
        ...step,
        end_hr: hr,
        lactate_mmol: lactate,
        completed: true,
      }
    })
    
    // Just save the step - do NOT auto-complete test
    // The capture page handles when to call completeTest
    return update({ steps: updatedSteps })
  }, [stepTest, update])

  const skipStep = useCallback(async (stepNumber: number) => {
    if (!stepTest) return
    
    const updatedSteps = stepTest.steps.map(step => {
      if (step.step_number !== stepNumber) return step
      return { ...step, skipped: true, completed: true }
    })
    
    return update({ steps: updatedSteps })
  }, [stepTest, update])

  const completeTest = useCallback(async () => {
    if (!stepTest) return
    
    // IMPORTANT: Refresh from DB to get the latest data including the last step
    const latestData = await getStepTest(stepTest.id)
    if (!latestData) return
    
    // Run analysis on the LATEST steps from DB
    const results = analyzeStepTest(latestData.steps, latestData.resting_lactate)
    
    // Update with completed status and results
    const completed: StepTest = {
      ...latestData,
      status: 'completed',
      results: results || undefined,
      updatedAt: new Date().toISOString(),
    }
    
    await saveStepTest(completed)
    setStepTest(completed)
    return completed
  }, [stepTest])

  const cancelTest = useCallback(async () => {
    if (!stepTest) return
    return update({ status: 'cancelled' })
  }, [stepTest, update])

  const remove = useCallback(async (testId: string) => {
    await deleteStepTest(testId)
    setStepTest(null)
  }, [])

  const addStep = useCallback(async () => {
    if (!stepTest) return
    
    // Get the last step to calculate next pace
    const lastStep = stepTest.steps[stepTest.steps.length - 1]
    const paceIncrement = stepTest.protocol.pace_increment_s / 60 // Convert to min/km
    const newPace = lastStep.target_pace_min_km - paceIncrement // Faster pace
    
    const newStep: StepData = {
      step_number: stepTest.steps.length + 1,
      target_pace_min_km: Math.max(newPace, 2.5), // Min 2:30/km
      end_hr: null,
      lactate_mmol: null,
      completed: false,
    }
    
    return update({
      steps: [...stepTest.steps, newStep],
    })
  }, [stepTest, update])

  // Get current step (first incomplete step)
  const currentStep = stepTest?.steps.find(s => !s.completed && !s.skipped) || null
  const currentStepIndex = currentStep ? stepTest!.steps.indexOf(currentStep) : -1
  const completedSteps = stepTest?.steps.filter(s => s.completed).length || 0
  const totalSteps = stepTest?.steps.length || 0
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0

  return {
    stepTest,
    loading,
    error,
    refresh,
    update,
    remove,
    startCapture,
    updateStep,
    completeStep,
    skipStep,
    completeTest,
    cancelTest,
    addStep,
    currentStep,
    currentStepIndex,
    completedSteps,
    totalSteps,
    progress,
  }
}

// Hook for protocol generation
export function useProtocolGenerator() {
  const [protocol, setProtocol] = useState<StepTestProtocol | null>(null)
  const [paces, setPaces] = useState<number[]>([])

  const generateManualProtocol = useCallback((
    environment: 'track' | 'treadmill',
    startPace: number,
    stepDuration: number,
    paceIncrement: number,
    numSteps: number
  ) => {
    const newProtocol: StepTestProtocol = {
      mode: 'manual',
      environment,
      start_pace_min_km: startPace,
      step_duration_s: stepDuration,
      pace_increment_s: paceIncrement,
      target_steps: numSteps,
    }
    
    const newPaces = generateStepPaces(startPace, paceIncrement, numSteps)
    
    setProtocol(newProtocol)
    setPaces(newPaces)
    
    return { protocol: newProtocol, paces: newPaces }
  }, [])

  const generateFromVDOT = useCallback((
    environment: 'track' | 'treadmill',
    vdot: number,
    stepDuration: number = 180,
    numSteps: number = 7
  ) => {
    const smartProtocol = generateSmartProtocol(vdot, numSteps, stepDuration)
    const trainingPaces = getTrainingPaces(vdot)
    
    const newProtocol: StepTestProtocol = {
      mode: 'smart',
      environment,
      start_pace_min_km: smartProtocol.startPace,
      step_duration_s: stepDuration,
      pace_increment_s: Math.round((smartProtocol.startPace - smartProtocol.endPace) / (numSteps - 1) * 60),
      target_steps: numSteps,
      vdot,
    }
    
    setProtocol(newProtocol)
    setPaces(smartProtocol.paces)
    
    return { protocol: newProtocol, paces: smartProtocol.paces }
  }, [])

  const reset = useCallback(() => {
    setProtocol(null)
    setPaces([])
  }, [])

  return {
    protocol,
    paces,
    generateManualProtocol,
    generateFromVDOT,
    reset,
  }
}
