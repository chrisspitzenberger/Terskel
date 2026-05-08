'use client'

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Training, StepTest } from './schemas'

interface TerskelDB extends DBSchema {
  trainings: {
    key: string
    value: Training
    indexes: { 'by-date': string; 'by-type': string }
  }
  stepTests: {
    key: string
    value: StepTest
    indexes: { 'by-date': string; 'by-status': string }
  }
  pendingSync: {
    key: string
    value: {
      id: string
      type: 'training' | 'stepTest'
      action: 'create' | 'update' | 'delete'
      data: Training | StepTest | null
      timestamp: string
    }
  }
}

const DB_NAME = 'terskel-db'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<TerskelDB>> | null = null

export function getDB(): Promise<IDBPDatabase<TerskelDB>> {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB is only available in the browser')
  }

  if (!dbPromise) {
    dbPromise = openDB<TerskelDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Trainings store
        if (!db.objectStoreNames.contains('trainings')) {
          const trainingStore = db.createObjectStore('trainings', { keyPath: 'id' })
          trainingStore.createIndex('by-date', 'date')
          trainingStore.createIndex('by-type', 'type')
        }

        // Step tests store
        if (!db.objectStoreNames.contains('stepTests')) {
          const stepTestStore = db.createObjectStore('stepTests', { keyPath: 'id' })
          stepTestStore.createIndex('by-date', 'date')
          stepTestStore.createIndex('by-status', 'status')
        }

        // Pending sync store (for future MongoDB sync)
        if (!db.objectStoreNames.contains('pendingSync')) {
          db.createObjectStore('pendingSync', { keyPath: 'id' })
        }
      },
    })
  }

  return dbPromise
}

// Training operations
export async function getAllTrainings(): Promise<Training[]> {
  const db = await getDB()
  const trainings = await db.getAll('trainings')
  return trainings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function getTraining(id: string): Promise<Training | undefined> {
  const db = await getDB()
  return db.get('trainings', id)
}

export async function saveTraining(training: Training): Promise<void> {
  const db = await getDB()
  await db.put('trainings', training)
}

export async function deleteTraining(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('trainings', id)
}

export async function getTrainingsByType(type: Training['type']): Promise<Training[]> {
  const db = await getDB()
  return db.getAllFromIndex('trainings', 'by-type', type)
}

// Step test operations
export async function getAllStepTests(): Promise<StepTest[]> {
  const db = await getDB()
  const tests = await db.getAll('stepTests')
  return tests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function getStepTest(id: string): Promise<StepTest | undefined> {
  const db = await getDB()
  return db.get('stepTests', id)
}

export async function saveStepTest(stepTest: StepTest): Promise<void> {
  const db = await getDB()
  await db.put('stepTests', stepTest)
}

export async function deleteStepTest(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('stepTests', id)
}

export async function getStepTestsByStatus(status: StepTest['status']): Promise<StepTest[]> {
  const db = await getDB()
  return db.getAllFromIndex('stepTests', 'by-status', status)
}

// Pending sync operations (for future MongoDB integration)
export async function addPendingSync(
  type: 'training' | 'stepTest',
  action: 'create' | 'update' | 'delete',
  data: Training | StepTest | null
): Promise<void> {
  const db = await getDB()
  await db.put('pendingSync', {
    id: crypto.randomUUID(),
    type,
    action,
    data,
    timestamp: new Date().toISOString(),
  })
}

export async function getPendingSync() {
  const db = await getDB()
  return db.getAll('pendingSync')
}

export async function clearPendingSync(): Promise<void> {
  const db = await getDB()
  await db.clear('pendingSync')
}

// Clear all data from the database
export async function clearAllData(): Promise<void> {
  const db = await getDB()
  await db.clear('trainings')
  await db.clear('stepTests')
  await db.clear('pendingSync')
}
