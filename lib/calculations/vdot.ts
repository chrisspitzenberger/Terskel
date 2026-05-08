/**
 * VDOT Calculator based on Jack Daniels' Running Formula
 * 
 * VDOT is a measure of running ability that can be used to:
 * 1. Estimate equivalent performances across different race distances
 * 2. Determine appropriate training paces
 * 3. Generate smart step test protocols
 */

/**
 * Calculate VO2 from velocity (ml/kg/min)
 * Based on the ACSM metabolic equation for running
 */
function velocityToVO2(velocity_m_per_min: number): number {
  return -4.6 + 0.182258 * velocity_m_per_min + 0.000104 * Math.pow(velocity_m_per_min, 2)
}

/**
 * Calculate the percentage of VO2max that can be sustained for a given duration
 * This is the "drop-off" function based on Jack Daniels' research
 */
function percentVO2max(time_min: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * time_min) + 
         0.2989558 * Math.exp(-0.1932605 * time_min)
}

/**
 * Calculate VDOT from a race performance
 * @param distance_m Distance in meters
 * @param time_s Time in seconds
 * @returns VDOT value
 */
export function calculateVDOT(distance_m: number, time_s: number): number {
  const time_min = time_s / 60
  const velocity_m_per_min = distance_m / time_min
  
  const vo2 = velocityToVO2(velocity_m_per_min)
  const pctMax = percentVO2max(time_min)
  
  return vo2 / pctMax
}

/**
 * Calculate the pace for a given VDOT and percentage of VO2max
 * @param vdot VDOT value
 * @param pctVO2max Percentage of VO2max (0.0 to 1.0)
 * @returns Pace in min/km
 */
function vdotToPace(vdot: number, pctVO2max: number): number {
  // Target VO2 for the given intensity
  const targetVO2 = vdot * pctVO2max
  
  // Solve for velocity using quadratic formula
  // vo2 = -4.6 + 0.182258 * v + 0.000104 * v^2
  // 0.000104 * v^2 + 0.182258 * v + (-4.6 - vo2) = 0
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - targetVO2
  
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return 0
  
  const velocity_m_per_min = (-b + Math.sqrt(discriminant)) / (2 * a)
  
  // Convert to min/km
  const pace_min_km = 1000 / velocity_m_per_min
  return Math.round(pace_min_km * 100) / 100
}

/**
 * Training pace zones based on VDOT
 */
export interface TrainingPaces {
  easy: { min: number; max: number }
  marathon: number
  threshold: number
  interval: number
  repetition: number
}

/**
 * Get training paces from VDOT
 */
export function getTrainingPaces(vdot: number): TrainingPaces {
  return {
    easy: {
      min: vdotToPace(vdot, 0.59), // 59% VO2max
      max: vdotToPace(vdot, 0.74), // 74% VO2max
    },
    marathon: vdotToPace(vdot, 0.79),    // 79% VO2max
    threshold: vdotToPace(vdot, 0.88),   // 88% VO2max (lactate threshold)
    interval: vdotToPace(vdot, 0.98),    // 98% VO2max
    repetition: vdotToPace(vdot, 1.05),  // 105% VO2max
  }
}

/**
 * Predict race time for a given distance based on VDOT
 * @param vdot VDOT value
 * @param distance_m Distance in meters
 * @returns Predicted time in seconds
 */
export function predictRaceTime(vdot: number, distance_m: number): number {
  // Iteratively solve for time
  // We need to find t where VDOT(distance, t) = vdot
  let time_s = distance_m / 4 // Initial guess: ~4 m/s
  
  for (let i = 0; i < 100; i++) {
    const predictedVdot = calculateVDOT(distance_m, time_s)
    const error = predictedVdot - vdot
    
    if (Math.abs(error) < 0.01) break
    
    // Adjust time based on error
    // If predicted VDOT is higher, we need more time (slower)
    time_s += error * 5
  }
  
  return Math.round(time_s)
}

/**
 * Generate a smart step test protocol based on VDOT
 * Returns array of target paces for each step
 */
export function generateSmartProtocol(
  vdot: number,
  numSteps: number = 7,
  stepDuration_s: number = 180
): { paces: number[]; startPace: number; endPace: number } {
  const paces = getTrainingPaces(vdot)
  
  // Start around easy pace, end near interval pace
  const startPace = paces.easy.min // Slowest easy pace
  const endPace = paces.interval    // Interval pace
  
  // Calculate pace increment per step
  const totalPaceDecrease = startPace - endPace
  const paceDecrementPerStep = totalPaceDecrease / (numSteps - 1)
  
  const stepPaces: number[] = []
  for (let i = 0; i < numSteps; i++) {
    const pace = startPace - (i * paceDecrementPerStep)
    stepPaces.push(Math.round(pace * 100) / 100)
  }
  
  return {
    paces: stepPaces,
    startPace,
    endPace,
  }
}

/**
 * Estimate VDOT from a recent race result
 * Useful for users who know their race times
 */
export function vdotFromRaceTime(
  distance: '1500m' | '1mile' | '3000m' | '5k' | '10k' | 'half' | 'marathon',
  time_s: number
): number {
  const distances: Record<string, number> = {
    '1500m': 1500,
    '1mile': 1609,
    '3000m': 3000,
    '5k': 5000,
    '10k': 10000,
    'half': 21097,
    'marathon': 42195,
  }
  
  return calculateVDOT(distances[distance], time_s)
}

/**
 * Format VDOT for display
 */
export function formatVDOT(vdot: number): string {
  return vdot.toFixed(1)
}

/**
 * Get a description of the runner's level based on VDOT
 */
export function getVDOTLevel(vdot: number): string {
  if (vdot >= 75) return 'Elite'
  if (vdot >= 65) return 'Advanced'
  if (vdot >= 55) return 'Intermediate'
  if (vdot >= 45) return 'Recreational'
  if (vdot >= 35) return 'Beginner'
  return 'Novice'
}
