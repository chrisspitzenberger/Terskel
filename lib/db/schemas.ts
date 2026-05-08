import { z } from 'zod'

// Lap schema
export const lapSchema = z.object({
  id: z.string(),
  type: z.enum(['effort', 'rest']),
  distance_m: z.number().min(0),
  duration_s: z.number().min(0),
  pace_min_km: z.number().optional(), // Calculated field
  avg_hr: z.number().min(0).max(250).nullable(),
  max_hr: z.number().min(0).max(250).nullable(),
  lactate_mmol: z.number().min(0).max(30).nullable(),
  linkedEffortId: z.string().optional(), // For rest laps - links lactate to previous effort
  notes: z.string().optional(),
})

export type Lap = z.infer<typeof lapSchema>

// Training schema
export const trainingSchema = z.object({
  id: z.string(),
  date: z.string(), // ISO date
  title: z.string().min(1).max(100),
  type: z.enum(['interval', 'long_run', 'tempo', 'step_test', 'easy', 'race']),
  environment: z.enum(['track', 'treadmill', 'road', 'trail']).optional(),
  laps: z.array(lapSchema),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Training = z.infer<typeof trainingSchema>

// Step test protocol schema
export const stepTestProtocolSchema = z.object({
  mode: z.enum(['manual', 'smart']),
  environment: z.enum(['track', 'treadmill']),
  start_pace_min_km: z.number().min(3).max(10), // min/km
  step_duration_s: z.number().min(60).max(600), // 1-10 minutes
  pace_increment_s: z.number().min(5).max(60), // seconds per km faster
  target_steps: z.number().min(3).max(15),
  // For smart mode
  reference_distance_m: z.number().optional(),
  reference_time_s: z.number().optional(),
  vdot: z.number().optional(),
})

export type StepTestProtocol = z.infer<typeof stepTestProtocolSchema>

// Step data during capture
export const stepDataSchema = z.object({
  step_number: z.number(),
  target_pace_min_km: z.number(),
  actual_pace_min_km: z.number().optional(),
  end_hr: z.number().min(0).max(250).nullable(),
  lactate_mmol: z.number().min(0).max(30).nullable(),
  completed: z.boolean(),
  skipped: z.boolean().optional(),
})

export type StepData = z.infer<typeof stepDataSchema>

// Training zone schema
export const trainingZoneSchema = z.object({
  zone: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  name: z.string(),
  pace_range: z.tuple([z.number(), z.number()]), // [min, max] in min/km
  hr_range: z.tuple([z.number(), z.number()]), // [min, max] in bpm
  description: z.string(),
})

export type TrainingZone = z.infer<typeof trainingZoneSchema>

// Step test results schema
export const stepTestResultsSchema = z.object({
  lt1_pace: z.number(), // Aerobic threshold pace in min/km
  lt2_pace: z.number(), // Anaerobic threshold pace in min/km
  lt1_hr: z.number(),
  lt2_hr: z.number(),
  lt1_lactate: z.number(),
  lt2_lactate: z.number(),
  zones: z.array(trainingZoneSchema),
  max_hr_reached: z.number(),
  max_lactate_reached: z.number(),
})

export type StepTestResults = z.infer<typeof stepTestResultsSchema>

// Full step test schema
export const stepTestSchema = z.object({
  id: z.string(),
  date: z.string(),
  title: z.string(),
  protocol: stepTestProtocolSchema,
  steps: z.array(stepDataSchema),
  results: stepTestResultsSchema.optional(),
  status: z.enum(['setup', 'in_progress', 'completed', 'cancelled']),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type StepTest = z.infer<typeof stepTestSchema>

// Form schemas for validation
export const createTrainingFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  title: z.string().min(1, 'Title is required').max(100),
  type: z.enum(['interval', 'long_run', 'tempo', 'easy', 'race']),
  environment: z.enum(['track', 'treadmill', 'road', 'trail']).optional(),
  notes: z.string().optional(),
})

export type CreateTrainingForm = z.infer<typeof createTrainingFormSchema>

export const lapInputSchema = z.object({
  type: z.enum(['effort', 'rest']),
  distance_m: z.number().min(0, 'Distance must be positive'),
  duration_s: z.number().min(0, 'Duration must be positive'),
  avg_hr: z.number().min(0).max(250).nullable().optional(),
  max_hr: z.number().min(0).max(250).nullable().optional(),
  lactate_mmol: z.number().min(0).max(30).nullable().optional(),
  linkedEffortId: z.string().optional(),
  notes: z.string().optional(),
})

export type LapInput = z.infer<typeof lapInputSchema>

// VDOT reference distances
export const VDOT_DISTANCES = [
  { label: '1500m', value: 1500 },
  { label: '1 Mile', value: 1609 },
  { label: '3000m', value: 3000 },
  { label: '5K', value: 5000 },
  { label: '10K', value: 10000 },
  { label: 'Half Marathon', value: 21097 },
  { label: 'Marathon', value: 42195 },
] as const

export type VDOTDistance = (typeof VDOT_DISTANCES)[number]

// Alias for step data used in UI components
export interface StepTestStep {
  stepNumber: number
  targetPace: number // seconds per km
  heartRate?: number
  lactate?: number
}

// Convert StepData to StepTestStep format
export function stepDataToStepTestStep(step: StepData, paceInSeconds: boolean = false): StepTestStep {
  return {
    stepNumber: step.step_number,
    targetPace: paceInSeconds ? step.target_pace_min_km : step.target_pace_min_km * 60,
    heartRate: step.end_hr ?? undefined,
    lactate: step.lactate_mmol ?? undefined,
  }
}
