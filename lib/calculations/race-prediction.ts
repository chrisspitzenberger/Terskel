/**
 * Race predictions derived from the anaerobic threshold (LT2)
 *
 * LT2 (MLSS) approximates the intensity that can be held for about 60 minutes.
 * That gives a reference performance from which other distances are projected
 * with Riegel's endurance formula:
 *
 *   t(d) = t_ref * (d / d_ref)^k
 *
 * Riegel derived k = 1.06 empirically across middle and long distances. The
 * marathon uses a slightly higher exponent because glycogen availability
 * limits it on top of the threshold, which the lactate curve does not capture.
 *
 * Applying fixed percentages to threshold SPEED instead (the previous
 * approach) assumes the drop-off is proportional, which it is not - the error
 * grows with distance and reached ~45 min over the marathon for slower runners.
 */

export const RIEGEL_EXPONENT = 1.06
export const RIEGEL_EXPONENT_MARATHON = 1.07

/** Distance beyond which the marathon exponent applies (km) */
const MARATHON_THRESHOLD_KM = 30

/** LT2 is treated as the performance sustainable for this duration */
export const LT2_REFERENCE_DURATION_S = 3600

export interface RacePrediction {
  label: string
  distanceKm: number
  timeSeconds: number
  paceSecondsPerKm: number
}

export const RACE_DISTANCES = [
  { label: '5 km', distanceKm: 5 },
  { label: '10 km', distanceKm: 10 },
  { label: 'Halbmarathon', distanceKm: 21.0975 },
  { label: 'Marathon', distanceKm: 42.195 },
] as const

/**
 * Predict race time in seconds for a distance, given LT2 speed in km/h.
 */
export function predictRaceTimeFromLT2(lt2SpeedKmh: number, distanceKm: number): number {
  if (lt2SpeedKmh <= 0 || distanceKm <= 0 || !isFinite(lt2SpeedKmh)) return 0

  // Distance covered in one hour at threshold speed
  const referenceDistanceKm = lt2SpeedKmh * (LT2_REFERENCE_DURATION_S / 3600)
  const exponent = distanceKm > MARATHON_THRESHOLD_KM ? RIEGEL_EXPONENT_MARATHON : RIEGEL_EXPONENT

  return LT2_REFERENCE_DURATION_S * Math.pow(distanceKm / referenceDistanceKm, exponent)
}

export function predictRaces(lt2SpeedKmh: number): RacePrediction[] {
  return RACE_DISTANCES.map(({ label, distanceKm }) => {
    const timeSeconds = predictRaceTimeFromLT2(lt2SpeedKmh, distanceKm)
    return {
      label,
      distanceKm,
      timeSeconds,
      paceSecondsPerKm: timeSeconds > 0 ? timeSeconds / distanceKm : 0,
    }
  })
}
