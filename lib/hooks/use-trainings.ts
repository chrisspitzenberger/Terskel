'use client'

import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  getTrainingsAction,
  getTrainingAction,
  createTrainingAction,
  deleteTrainingAction,
  addLapAction,
  deleteLapAction,
  updateLapAction,
  updateTrainingAction
} from '../actions/trainings'

export function useTrainings() {
  const [trainings, setTrainings] = useState<Training[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTrainingsAction()
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
    const training = await createTrainingAction(form)
    await refresh()
    return training
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await deleteTrainingAction(id)
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
      const data = await getTrainingAction(id)
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
    
    await updateTrainingAction(training.id, updates)
    const updated: Training = {
      ...training,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    setTraining(updated)
    return updated
  }, [training])

  const addLap = useCallback(async (lapData: Omit<Lap, 'id' | 'pace_min_km'>) => {
    if (!training) return
    
    await addLapAction(training.id, lapData)
    await refresh() // Refresh to get the actual lap with ID from DB
  }, [training, refresh])

  const updateLap = useCallback(async (lapId: string, updates: Partial<Lap>) => {
    if (!training) return
    
    await updateLapAction(training.id, lapId, updates)
    await refresh() // Refresh to sync correctly
  }, [training, refresh])

  const removeLap = useCallback(async (lapId: string) => {
    if (!training) return
    
    await deleteLapAction(training.id, lapId)
    await refresh()
  }, [training, refresh])

  const reorderLaps = useCallback(async (fromIndex: number, toIndex: number) => {
    // Reordering laps is not trivial since laps don't have an order column in db
    // It's typically ordered by insertion order or time. 
    // We can just ignore this for now if it's not strictly required in the UI
    console.warn("reorderLaps is currently not supported with the server-side implementation.")
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
