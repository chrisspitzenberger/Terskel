/**
 * Pace conversion utilities
 * Pace is stored as min/km internally
 */

/**
 * Calculate pace (min/km) from distance and duration
 */
export function calculatePace(distance_m: number, duration_s: number): number {
  if (distance_m <= 0 || duration_s <= 0) return 0
  const pace_min_km = (duration_s / 60) / (distance_m / 1000)
  return Math.round(pace_min_km * 100) / 100 // Round to 2 decimal places
}

/**
 * Format pace as MM:SS string
 */
export function formatPace(pace_min_km: number): string {
  if (pace_min_km <= 0 || !isFinite(pace_min_km)) return '--:--'
  const minutes = Math.floor(pace_min_km)
  const seconds = Math.round((pace_min_km - minutes) * 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Parse MM:SS string to pace in min/km
 */
export function parsePace(paceStr: string): number | null {
  const match = paceStr.match(/^(\d+):(\d{2})$/)
  if (!match) return null
  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)
  if (seconds >= 60) return null
  return minutes + seconds / 60
}

/**
 * Format duration in seconds to HH:MM:SS or MM:SS
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Parse duration string to seconds
 * Accepts formats: "MM:SS", "HH:MM:SS", or just seconds
 */
export function parseDuration(durationStr: string): number | null {
  // Try HH:MM:SS format
  const hhmmss = durationStr.match(/^(\d+):(\d{2}):(\d{2})$/)
  if (hhmmss) {
    return parseInt(hhmmss[1], 10) * 3600 + parseInt(hhmmss[2], 10) * 60 + parseInt(hhmmss[3], 10)
  }
  
  // Try MM:SS format
  const mmss = durationStr.match(/^(\d+):(\d{2})$/)
  if (mmss) {
    return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10)
  }
  
  // Try just seconds
  const seconds = parseInt(durationStr, 10)
  if (!isNaN(seconds)) return seconds
  
  return null
}

/**
 * Format distance in meters to human readable string
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`
  }
  const km = meters / 1000
  if (km === Math.floor(km)) {
    return `${km}km`
  }
  return `${km.toFixed(2)}km`
}

/**
 * Convert pace to speed (km/h)
 */
export function paceToSpeed(pace_min_km: number): number {
  if (pace_min_km <= 0) return 0
  return 60 / pace_min_km
}

/**
 * Convert speed (km/h) to pace (min/km)
 */
export function speedToPace(speed_kmh: number): number {
  if (speed_kmh <= 0) return 0
  return 60 / speed_kmh
}

/**
 * Format pace from seconds per km to MM:SS string
 * Used when pace is stored as total seconds
 */
export function formatPaceFromSecondsPerKm(seconds_per_km: number): string {
  if (seconds_per_km <= 0 || !isFinite(seconds_per_km)) return '--:--'
  const minutes = Math.floor(seconds_per_km / 60)
  const secs = Math.round(seconds_per_km % 60)
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

/**
 * Convert seconds per km to speed (km/h)
 */
export function secondsPerKmToSpeed(seconds_per_km: number): number {
  if (seconds_per_km <= 0) return 0
  return 3600 / seconds_per_km
}

/**
 * Calculate expected duration for a given distance and pace
 */
export function calculateDuration(distance_m: number, pace_min_km: number): number {
  if (distance_m <= 0 || pace_min_km <= 0) return 0
  return (distance_m / 1000) * pace_min_km * 60 // Returns seconds
}

/**
 * Generate step paces for a step test protocol
 */
export function generateStepPaces(
  startPace: number,
  paceIncrement: number,
  numSteps: number
): number[] {
  const paces: number[] = []
  for (let i = 0; i < numSteps; i++) {
    // Pace decreases (gets faster) with each step
    const pace = startPace - (i * paceIncrement / 60) // Convert seconds to minutes
    if (pace > 0) {
      paces.push(Math.round(pace * 100) / 100)
    }
  }
  return paces
}
