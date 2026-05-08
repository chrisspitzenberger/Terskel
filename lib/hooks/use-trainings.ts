'use client'

import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  getAllTrainings,
  getTraining,
  saveTraining,
  deleteTraining,
} from '../db/indexed-db'
import type { Training, Lap, CreateTrainingForm } from '../db/schemas'
import { calculatePace } from '../calculations/pace'

export function useTrainings() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getAllTrainings()
      setTrainings(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load trainings'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = useCallback(async (form: CreateTrainingForm): Promise<Training> => {
    const now = new Date().toISOString()
    const training: Training = {
      id: uuidv4(),
      date: form.date,
      title: form.title,
      type: form.type,
      environment: form.environment,
      laps: [],
      notes: form.notes,
      createdAt: now,
      updatedAt: now,
    }
    await saveTraining(training)
    await refresh()
    return training
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await deleteTraining(id)
    await refresh()
  }, [refresh])

  return {
    trainings,
    loading,
    error,
    refresh,
    create,
    remove,
  }
}

export function useTraining(id: string | undefined) {
  const [training, setTraining] = useState<Training | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!id) {
      setTraining(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getTraining(id)
      setTraining(data || null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load training'))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    refresh()
  }, [refresh])

  const update = useCallback(async (updates: Partial<Training>) => {
    if (!training) return
    
    const updated: Training = {
      ...training,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    await saveTraining(updated)
    setTraining(updated)
    return updated
  }, [training])

  const addLap = useCallback(async (lapData: Omit<Lap, 'id' | 'pace_min_km'>) => {
    if (!training) return
    
    const pace = calculatePace(lapData.distance_m, lapData.duration_s)
    const lap: Lap = {
      ...lapData,
      id: uuidv4(),
      pace_min_km: pace,
    }
    
    const updated: Training = {
      ...training,
      laps: [...training.laps, lap],
      updatedAt: new Date().toISOString(),
    }
    await saveTraining(updated)
    setTraining(updated)
    return lap
  }, [training])

  const updateLap = useCallback(async (lapId: string, updates: Partial<Lap>) => {
    if (!training) return
    
    const updatedLaps = training.laps.map(lap => {
      if (lap.id !== lapId) return lap
      const updated = { ...lap, ...updates }
      // Recalculate pace if distance or duration changed
      if (updates.distance_m !== undefined || updates.duration_s !== undefined) {
        updated.pace_min_km = calculatePace(updated.distance_m, updated.duration_s)
      }
      return updated
    })
    
    const updated: Training = {
      ...training,
      laps: updatedLaps,
      updatedAt: new Date().toISOString(),
    }
    await saveTraining(updated)
    setTraining(updated)
  }, [training])

  const removeLap = useCallback(async (lapId: string) => {
    if (!training) return
    
    const updated: Training = {
      ...training,
      laps: training.laps.filter(lap => lap.id !== lapId),
      updatedAt: new Date().toISOString(),
    }
    await saveTraining(updated)
    setTraining(updated)
  }, [training])

  const reorderLaps = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!training) return
    
    const laps = [...training.laps]
    const [removed] = laps.splice(fromIndex, 1)
    laps.splice(toIndex, 0, removed)
    
    const updated: Training = {
      ...training,
      laps,
      updatedAt: new Date().toISOString(),
    }
    await saveTraining(updated)
    setTraining(updated)
  }, [training])

  return {
    training,
    loading,
    error,
    refresh,
    update,
    addLap,
    updateLap,
    removeLap,
    reorderLaps,
  }
}

// Calculate training summary stats
export function useTrainingSummary(training: Training | null) {
  if (!training) return null
  
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
