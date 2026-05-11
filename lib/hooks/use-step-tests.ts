'use client'

import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  getStepTestsAction,
  getStepTestAction,
  createStepTestAction,
  updateStepTestAction,
  deleteStepTestAction,
} from '../actions/step-tests'
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
      const data = await getStepTestsAction()
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
    
    const stepTestToCreate = {
      date: now.split('T')[0],
      title: `Step Test - ${new Date().toLocaleDateString()}`,
      protocol,
      steps,
      status: 'setup' as const,
    }
    
    const created = await createStepTestAction(stepTestToCreate)
    await refresh()
    return created
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await deleteStepTestAction(id)
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
      const data = await getStepTestAction(id)
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
    
    await updateStepTestAction(stepTest.id, updates)
    const updated: StepTest = {
      ...stepTest,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
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
    
    const latestData = await getStepTestAction(stepTest.id)
    if (!latestData) return
    
    const results = analyzeStepTest(latestData.steps, latestData.resting_lactate)
    
    await updateStepTestAction(stepTest.id, {
      status: 'completed',
      results: results || undefined,
    })
    
    const completed: StepTest = {
      ...latestData,
      status: 'completed',
      results: results || undefined,
      updatedAt: new Date().toISOString(),
    }
    setStepTest(completed)
    return completed
  }, [stepTest])

  const cancelTest = useCallback(async () => {
    if (!stepTest) return
    return update({ status: 'cancelled' })
  }, [stepTest, update])

  const remove = useCallback(async (testId: string) => {
    await deleteStepTestAction(testId)
    setStepTest(null)
  }, [])

  const addStep = useCallback(async () => {
    if (!stepTest) return
    
    const lastStep = stepTest.steps[stepTest.steps.length - 1]
    const paceIncrement = stepTest.protocol.pace_increment_s / 60
    const newPace = lastStep.target_pace_min_km - paceIncrement
    
    const newStep: StepData = {
      step_number: stepTest.steps.length + 1,
      target_pace_min_km: Math.max(newPace, 2.5),
      end_hr: null,
      lactate_mmol: null,
      completed: false,
    }
    
    return update({
      steps: [...stepTest.steps, newStep],
    })
  }, [stepTest, update])

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
