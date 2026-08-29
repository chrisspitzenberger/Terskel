/**
 * Scientific Lactate Threshold Detection Algorithms
 * 
 * ROBUST IMPLEMENTATION based on validated sports science methods:
 * 
 * Curve Fitting (Priority Order):
 * 1. 3rd degree polynomial (primary) - best for most athletes
 * 2. Exponential + constant (fallback) - when polynomial R² < 0.90
 * 
 * LT1 (Aerobic Threshold):
 * - Log-Log transformation breakpoint method (Beaver et al., 1985)
 * - Fallback: Baseline minimum + 0.4 mmol/L (Norwegian model)
 * 
 * LT2 (Anaerobic Threshold / MLSS):
 * - ModDmax method on fitted curve (Cheng et al., 1992, modified)
 * - The 4.0 mmol/L OBLA is ONLY used as absolute emergency fallback
 *   when geometric analysis completely fails
 * 
 * Key Validations:
 * - LT2 must always be at higher speed than LT1
 * - LT2 lactate typically 2.5-6.0 mmol/L (individual variation!)
 * - Tolerates physiological lactate dip at low intensities
 */

import type { StepData, TrainingZone, StepTestResults, StepTestStep } from '../db/schemas'

// Threshold point with all relevant data
export interface ThresholdPoint {
  pace: number // seconds per km
  speed: number // km/h
  lactate: number
  heartRate?: number
}

// Detailed calculation step for transparency
export interface CalculationStep {
  step: string
  description: string
  formula?: string           // Abstract formula (e.g. "Baseline = min(La₁, La₂, ...)")
  formulaFilled?: string     // Formula with actual values substituted
  inputs?: Record<string, number | string>
  result?: number | string
}

// Complete calculation log for full transparency
export interface CalculationLog {
  inputData: { speed: number; lactate: number; hr?: number }[]
  curveFitting: {
    method: 'polynomial-3' | 'exponential'
    coefficients: Record<string, number>
    rSquared: number
    equation: string
  } | null
  lt1Detection: {
    method: string
    steps: CalculationStep[]
    finalValue: { speed: number; lactate: number } | null
  }
  lt2Detection: {
    method: string
    steps: CalculationStep[]
    dmaxPoint?: { speed: number; distance: number }
    finalValue: { speed: number; lactate: number } | null
  }
  validation: CalculationStep[]
}

// Complete analysis results with scientific details
export interface ThresholdAnalysis {
  lt1: ThresholdPoint | null
  lt2: ThresholdPoint | null
  method: 'moddmax-poly' | 'moddmax-exp' | 'obla-fallback' | 'log-log'
  confidence: 'high' | 'medium' | 'low'
  warnings: string[]
  baseline: number
  rSquared?: number
  calculationLog?: CalculationLog
}

// Internal data point format
interface DataPoint {
  speed: number // km/h
  pace: number // seconds per km
  lactate: number
  hr?: number
}

// Helper: format pace from seconds/km to MM:SS for calculation log
function formatPaceFromSecondsForLog(secondsPerKm: number): string {
  const totalSeconds = Math.round(secondsPerKm)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// ============================================================================
// POLYNOMIAL FITTING (3rd degree)
// ============================================================================

interface PolynomialCoeffs {
  a: number // x^3
  b: number // x^2
  c: number // x^1
  d: number // constant
}

/**
 * Fit 3rd degree polynomial using least squares
 * La(v) = a*v³ + b*v² + c*v + d
 */
function fitPolynomial3(data: DataPoint[]): PolynomialCoeffs | null {
  if (data.length < 4) return null
  
  const n = data.length
  
  // Build normal equations matrix for polynomial regression
  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0, sumX5 = 0, sumX6 = 0
  let sumY = 0, sumXY = 0, sumX2Y = 0, sumX3Y = 0
  
  for (const p of data) {
    const x = p.speed
    const y = p.lactate
    const x2 = x * x
    const x3 = x2 * x
    
    sumX += x
    sumX2 += x2
    sumX3 += x3
    sumX4 += x2 * x2
    sumX5 += x2 * x3
    sumX6 += x3 * x3
    sumY += y
    sumXY += x * y
    sumX2Y += x2 * y
    sumX3Y += x3 * y
  }
  
  // Solve 4x4 system using Gaussian elimination
  const matrix = [
    [n, sumX, sumX2, sumX3, sumY],
    [sumX, sumX2, sumX3, sumX4, sumXY],
    [sumX2, sumX3, sumX4, sumX5, sumX2Y],
    [sumX3, sumX4, sumX5, sumX6, sumX3Y],
  ]
  
  const m = matrix
  for (let i = 0; i < 4; i++) {
    let maxRow = i
    for (let k = i + 1; k < 4; k++) {
      if (Math.abs(m[k][i]) > Math.abs(m[maxRow][i])) maxRow = k
    }
    [m[i], m[maxRow]] = [m[maxRow], m[i]]
    
    if (Math.abs(m[i][i]) < 1e-10) return null
    
    for (let k = i + 1; k < 4; k++) {
      const factor = m[k][i] / m[i][i]
      for (let j = i; j <= 4; j++) {
        m[k][j] -= factor * m[i][j]
      }
    }
  }
  
  const coeffs = [0, 0, 0, 0]
  for (let i = 3; i >= 0; i--) {
    coeffs[i] = m[i][4]
    for (let j = i + 1; j < 4; j++) {
      coeffs[i] -= m[i][j] * coeffs[j]
    }
    coeffs[i] /= m[i][i]
  }
  
  return { d: coeffs[0], c: coeffs[1], b: coeffs[2], a: coeffs[3] }
}

function evalPolynomial(coeffs: PolynomialCoeffs, v: number): number {
  return coeffs.a * v * v * v + coeffs.b * v * v + coeffs.c * v + coeffs.d
}

function calcRSquared(data: DataPoint[], evalFn: (v: number) => number): number {
  const meanY = data.reduce((s, p) => s + p.lactate, 0) / data.length
  
  let ssTotal = 0
  let ssResidual = 0
  
  for (const p of data) {
    const predicted = evalFn(p.speed)
    ssTotal += (p.lactate - meanY) ** 2
    ssResidual += (p.lactate - predicted) ** 2
  }
  
  return ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0
}

/**
 * Check if polynomial is physiologically plausible
 * The curve should generally increase with speed (at least in upper half)
 */
function isPolynomialPlausible(coeffs: PolynomialCoeffs, minSpeed: number, maxSpeed: number): boolean {
  // Sample derivative at several points in upper half of range
  const midSpeed = (minSpeed + maxSpeed) / 2
  const step = (maxSpeed - midSpeed) / 5
  
  for (let i = 0; i <= 5; i++) {
    const v = midSpeed + i * step
    // Derivative: 3a*v² + 2b*v + c
    const derivative = 3 * coeffs.a * v * v + 2 * coeffs.b * v + coeffs.c
    
    // In the upper half, derivative should be non-negative
    // Allow small negative values due to numerical noise
    if (derivative < -0.1) {
      return false
    }
  }
  
  return true
}

// ============================================================================
// EXPONENTIAL FITTING (fallback)
// ============================================================================

interface ExponentialCoeffs {
  a: number // constant offset
  b: number // amplitude
  c: number // growth rate
  vRef: number // speeds are centred on this to keep e^(c·Δv) in a safe range
}

/**
 * Fit exponential model: La(v) = a + b * e^(c*(v - vRef))
 *
 * For a fixed growth rate c the model is linear in a and b, so c is scanned
 * over a grid and the remaining two coefficients are solved exactly by least
 * squares for each candidate.
 */
function fitExponential(data: DataPoint[]): ExponentialCoeffs | null {
  if (data.length < 3) return null

  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const vRef = sorted[0].speed
  const speedRange = sorted[sorted.length - 1].speed - vRef
  if (speedRange <= 0) return null

  const n = data.length
  let best: ExponentialCoeffs | null = null
  let bestResidual = Infinity

  const gridSize = 400
  for (let i = 0; i <= gridSize; i++) {
    const c = 0.01 + (i / gridSize) * 0.79

    let sumE = 0, sumE2 = 0, sumY = 0, sumEY = 0
    for (const p of data) {
      const e = Math.exp(c * (p.speed - vRef))
      sumE += e
      sumE2 += e * e
      sumY += p.lactate
      sumEY += e * p.lactate
    }

    const denom = n * sumE2 - sumE * sumE
    if (Math.abs(denom) < 1e-12) continue

    const b = (n * sumEY - sumE * sumY) / denom
    const a = (sumY - b * sumE) / n

    // The curve has to rise with speed and must not predict negative lactate.
    if (b <= 0 || a < 0) continue

    let residual = 0
    for (const p of data) {
      const predicted = a + b * Math.exp(c * (p.speed - vRef))
      residual += (p.lactate - predicted) ** 2
    }

    if (residual < bestResidual) {
      bestResidual = residual
      best = { a, b, c, vRef }
    }
  }

  return best
}

function evalExponential(coeffs: ExponentialCoeffs, v: number): number {
  return coeffs.a + coeffs.b * Math.exp(Math.min(coeffs.c * (v - coeffs.vRef), 50))
}

// ============================================================================
// INTERPOLATION FOR VISUALIZATION
// ============================================================================

/**
 * Curve for the chart. Uses the SAME fit as the threshold detection so the
 * plotted line and the LT1/LT2 markers can never disagree.
 */
export function generateSmoothCurve(
  data: DataPoint[],
  numPoints: number = 50
): { speed: number; lactate: number; hr?: number }[] {
  if (data.length < 2) return data.map(d => ({ speed: d.speed, lactate: d.lactate, hr: d.hr }))

  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const minSpeed = sorted[0].speed
  const maxSpeed = sorted[sorted.length - 1].speed

  const curveFit = fitLactateCurve(sorted)

  const curve: { speed: number; lactate: number; hr?: number }[] = []
  const step = (maxSpeed - minSpeed) / (numPoints - 1)

  for (let i = 0; i < numPoints; i++) {
    const speed = minSpeed + i * step
    const lactate = curveFit ? curveFit.evalFn(speed) : linearInterpolate(sorted, speed)
    const hr = linearInterpolateHr(sorted, speed)
    curve.push({ speed, lactate: Math.max(0, lactate), hr })
  }

  return curve
}

function linearInterpolate(data: DataPoint[], speed: number): number {
  for (let i = 0; i < data.length - 1; i++) {
    if (speed >= data[i].speed && speed <= data[i + 1].speed) {
      const t = (speed - data[i].speed) / (data[i + 1].speed - data[i].speed)
      return data[i].lactate + t * (data[i + 1].lactate - data[i].lactate)
    }
  }
  return speed <= data[0].speed ? data[0].lactate : data[data.length - 1].lactate
}

function linearInterpolateHr(data: DataPoint[], speed: number): number | undefined {
  const hrPoints = data.filter(d => d.hr !== undefined)
  if (hrPoints.length < 2) return hrPoints[0]?.hr
  
  for (let i = 0; i < hrPoints.length - 1; i++) {
    if (speed >= hrPoints[i].speed && speed <= hrPoints[i + 1].speed) {
      const t = (speed - hrPoints[i].speed) / (hrPoints[i + 1].speed - hrPoints[i].speed)
      return Math.round(hrPoints[i].hr! + t * (hrPoints[i + 1].hr! - hrPoints[i].hr!))
    }
  }
  return speed <= hrPoints[0].speed ? hrPoints[0].hr : hrPoints[hrPoints.length - 1].hr
}

// ============================================================================
// LT1 DETECTION - Log-Log Breakpoint Method
// ============================================================================

function detectLT1LogLog(data: DataPoint[]): { speed: number; lactate: number } | null {
  if (data.length < 4) return null
  
  const logData = data
    .filter(d => d.lactate > 0 && d.speed > 0)
    .map(d => ({
      logSpeed: Math.log(d.speed),
      logLactate: Math.log(d.lactate),
      speed: d.speed,
      lactate: d.lactate,
    }))
    .sort((a, b) => a.logSpeed - b.logSpeed)
  
  if (logData.length < 4) return null
  
  let bestBreakIdx = 2
  let bestError = Infinity
  
  for (let i = 2; i < logData.length - 1; i++) {
    const left = logData.slice(0, i + 1)
    const leftFit = fitLine(left.map(p => ({ x: p.logSpeed, y: p.logLactate })))
    
    const right = logData.slice(i)
    const rightFit = fitLine(right.map(p => ({ x: p.logSpeed, y: p.logLactate })))
    
    let error = 0
    for (const p of left) {
      const predicted = leftFit.m * p.logSpeed + leftFit.b
      error += (p.logLactate - predicted) ** 2
    }
    for (const p of right) {
      const predicted = rightFit.m * p.logSpeed + rightFit.b
      error += (p.logLactate - predicted) ** 2
    }
    
    if (error < bestError) {
      bestError = error
      bestBreakIdx = i
    }
  }
  
  const lt1Point = logData[bestBreakIdx]
  return { speed: lt1Point.speed, lactate: lt1Point.lactate }
}

function fitLine(points: { x: number; y: number }[]): { m: number; b: number } {
  const n = points.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  
  for (const p of points) {
    sumX += p.x
    sumY += p.y
    sumXY += p.x * p.y
    sumX2 += p.x * p.x
  }
  
  const denom = n * sumX2 - sumX * sumX
  if (Math.abs(denom) < 1e-10) return { m: 0, b: sumY / n }
  
  const m = (n * sumXY - sumX * sumY) / denom
  const b = (sumY - m * sumX) / n
  
  return { m, b }
}

export interface CurveFitResult {
  evalFn: (v: number) => number;
  method: 'moddmax-poly' | 'moddmax-exp';
  rSquared: number;
  coefficients: { a: number; b: number; c: number; d?: number };
  equation: string;
}

function fitLactateCurve(data: DataPoint[]): CurveFitResult | null {
  if (data.length < 4) return null
  
  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  
  const polyCoeffs = fitPolynomial3(sorted)
  if (polyCoeffs) {
    const polyR2 = calcRSquared(sorted, v => evalPolynomial(polyCoeffs, v))
    const polyValid = isPolynomialPlausible(polyCoeffs, first.speed, last.speed)
    if (polyR2 >= 0.90 && polyValid) {
      return {
        evalFn: v => evalPolynomial(polyCoeffs, v),
        rSquared: polyR2,
        method: 'moddmax-poly',
        coefficients: polyCoeffs,
        equation: `La(v) = ${polyCoeffs.a.toExponential(4)}·v³ + ${polyCoeffs.b.toFixed(4)}·v² + ${polyCoeffs.c.toFixed(4)}·v + ${polyCoeffs.d.toFixed(4)}`,
      }
    }
  }
  
  const expCoeffs = fitExponential(sorted)
  if (expCoeffs) {
    const expR2 = calcRSquared(sorted, v => evalExponential(expCoeffs, v))
    if (expR2 >= 0.85) {
      return {
        evalFn: v => evalExponential(expCoeffs, v),
        rSquared: expR2,
        method: 'moddmax-exp',
        coefficients: { a: expCoeffs.a, b: expCoeffs.b, c: expCoeffs.c },
        equation: `La(v) = ${expCoeffs.a.toFixed(4)} + ${expCoeffs.b.toFixed(4)}·e^(${expCoeffs.c.toFixed(4)}·(v − ${expCoeffs.vRef.toFixed(2)}))`,
      }
    }
  }
  
  return null
}

/**
 * Find the speed at which the curve rises through baseline + 0.4.
 *
 * Lactate frequently starts elevated (warm-up) and dips before the aerobic
 * rise begins. Only the ASCENDING crossing after the curve minimum marks LT1 -
 * searching from the slowest step upwards would return the warm-up value.
 */
function detectLT1Baseline(data: DataPoint[], baseline: number, curveFit?: CurveFitResult | null): { speed: number; lactate: number } | null {
  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const threshold = baseline + 0.4

  if (curveFit) {
    const minSpeed = sorted[0].speed
    const maxSpeed = sorted[sorted.length - 1].speed
    const steps = 1000
    const stepSize = (maxSpeed - minSpeed) / steps

    let minIndex = 0
    let minValue = Infinity
    for (let i = 0; i <= steps; i++) {
      const value = curveFit.evalFn(minSpeed + i * stepSize)
      if (value < minValue) {
        minValue = value
        minIndex = i
      }
    }

    for (let i = minIndex; i <= steps; i++) {
      const speed = minSpeed + i * stepSize
      if (curveFit.evalFn(speed) >= threshold) {
        return { speed, lactate: threshold }
      }
    }
  }

  // Measured-point fallback: an ascending crossing requires the lower point to
  // sit below the threshold, so an elevated first step is skipped naturally.
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].lactate < threshold && sorted[i + 1].lactate >= threshold) {
      const t = (threshold - sorted[i].lactate) / (sorted[i + 1].lactate - sorted[i].lactate)
      const speed = sorted[i].speed + t * (sorted[i + 1].speed - sorted[i].speed)
      return { speed, lactate: threshold }
    }
  }

  // Every measured value already sits above the threshold - only then is the
  // slowest step a legitimate LT1.
  if (sorted.every(p => p.lactate >= threshold)) {
    return { speed: sorted[0].speed, lactate: sorted[0].lactate }
  }

  return null
}

// ============================================================================
// LT2 DETECTION - ModDmax Method (PRIMARY - NOT OBLA!)
// ============================================================================

/**
 * ModDmax Method (Modified Dmax - Cheng et al. 1992)
 * 
 * Algorithm:
 * 1. Draw a secant line from LT1 to last data point
 * 2. Find the point on the FITTED CURVE with maximum perpendicular distance to the secant
 * 3. That point is LT2
 */
function detectLT2ModDmax(
  data: DataPoint[],
  curveFit: CurveFitResult,
  lt1: { speed: number, lactate: number }
): { speed: number; lactate: number; method: 'moddmax-poly' | 'moddmax-exp'; rSquared: number } | null {
  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const last = sorted[sorted.length - 1]
  
  const first = lt1
  const dx = last.speed - first.speed
  const dy = last.lactate - first.lactate
  
  if (dx <= 0) return null
  
  const lineA = dy
  const lineB = -dx
  const lineC = dx * first.lactate - dy * first.speed
  const lineDenom = Math.sqrt(lineA * lineA + lineB * lineB)
  
  if (lineDenom === 0) return null
  
  const numSamples = 200
  const step = dx / numSamples

  let maxDistance = 0
  let dmaxSpeed = 0
  let dmaxLactate = 0

  // A lactate curve is convex between the secant endpoints and therefore runs
  // BELOW the secant. Restricting the search to that side keeps a residual
  // warm-up bump near LT1 from being mistaken for the point of maximum
  // curvature.
  for (let i = 1; i < numSamples; i++) {
    const speed = first.speed + i * step
    const lactate = curveFit.evalFn(speed)

    const distance = Math.abs(lineA * speed + lineB * lactate + lineC) / lineDenom
    const secantY = first.lactate + (dy / dx) * (speed - first.speed)

    if (lactate < secantY && distance > maxDistance) {
      maxDistance = distance
      dmaxSpeed = speed
      dmaxLactate = lactate
    }
  }

  if (dmaxSpeed === 0) {
    for (let i = 1; i < numSamples; i++) {
      const speed = first.speed + i * step
      const lactate = curveFit.evalFn(speed)
      const distance = Math.abs(lineA * speed + lineB * lactate + lineC) / lineDenom

      if (distance > maxDistance) {
        maxDistance = distance
        dmaxSpeed = speed
        dmaxLactate = lactate
      }
    }
  }

  if (dmaxSpeed === 0) return null
  
  return {
    speed: dmaxSpeed,
    lactate: dmaxLactate,
    method: curveFit.method,
    rSquared: curveFit.rSquared,
  }
}

/**
 * OBLA Fallback - ONLY used when ModDmax completely fails
 * Fixed 4.0 mmol/L threshold (Sjödin & Jacobs, 1981)
 */
function detectLT2OBLA(data: DataPoint[]): { speed: number; lactate: number } | null {
  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const threshold = 4.0
  
  // Find where lactate crosses 4.0 mmol/L
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].lactate < threshold && sorted[i + 1].lactate >= threshold) {
      const t = (threshold - sorted[i].lactate) / (sorted[i + 1].lactate - sorted[i].lactate)
      const speed = sorted[i].speed + t * (sorted[i + 1].speed - sorted[i].speed)
      return { speed, lactate: threshold }
    }
  }
  
  // If max lactate never reached 4.0, check if we're close
  const maxLactate = Math.max(...sorted.map(d => d.lactate))
  if (maxLactate >= 3.5) {
    // Use the point with highest lactate
    const maxPoint = sorted.reduce((max, d) => d.lactate > max.lactate ? d : max)
    return { speed: maxPoint.speed, lactate: maxPoint.lactate }
  }
  
  return null
}

// ============================================================================
// MAIN THRESHOLD DETECTION
// ============================================================================

export function detectThresholds(steps: StepTestStep[], restingLactate?: number): ThresholdAnalysis {
  const warnings: string[] = []
  
  // Filter valid steps
  const validSteps = steps.filter(s => s.lactate !== undefined && s.lactate !== null)
  
  if (validSteps.length < 3) {
    return {
      lt1: null,
      lt2: null,
      method: 'moddmax-poly',
      confidence: 'low',
      warnings: ['Mindestens 3 Stufen mit Laktatwerten benoetigt'],
      baseline: 0,
    }
  }
  
  // Convert to data points
  const data: DataPoint[] = validSteps.map(s => ({
    speed: 3600 / s.targetPace,
    pace: s.targetPace,
    lactate: s.lactate!,
    hr: s.heartRate,
  })).sort((a, b) => a.speed - b.speed)
  
  // Baseline is the lowest lactate measured UNDER LOAD (Norwegian model).
  // Resting lactate is deliberately not folded in: it is regularly lower than
  // anything reached during the test and would drag LT1 towards slower paces.
  const baseline = Math.min(...data.map(d => d.lactate))
  const maxLactate = Math.max(...data.map(d => d.lactate))

  if (restingLactate !== undefined && restingLactate > baseline + 0.5) {
    warnings.push('Ruhelaktat liegt ueber dem niedrigsten Belastungslaktat - Messung pruefen')
  }
  
  // Quality warnings
  if (validSteps.length < 5) {
    warnings.push('Weniger als 5 Stufen - Genauigkeit eingeschraenkt')
  }
  
  if (maxLactate < 4.0) {
    warnings.push('Maximales Laktat unter 4.0 mmol/L - LT2 moeglicherweise ungenau')
  }
  
  // Check for a drop AFTER the rise has actually started.
  //
  // The rise begins at the minimum of the series, not at "baseline + 0.4":
  // with an elevated warm-up value on step 1 that threshold is already met
  // while lactate is still falling, so the initial dip itself would be
  // reported as a measurement error.
  let minIndex = 0
  for (let i = 1; i < data.length; i++) {
    if (data[i].lactate < data[minIndex].lactate) minIndex = i
  }

  // Compare as a difference with a small tolerance - "a < b - 0.4" misfires on
  // exact values like 1.7 < 2.1 - 0.4, where the subtraction yields
  // 1.7000000000000002 in floating point.
  const EPSILON = 1e-9
  for (let i = minIndex + 1; i < data.length; i++) {
    if (data[i - 1].lactate - data[i].lactate > 0.4 + EPSILON) {
      warnings.push('Laktatwerte nicht monoton steigend - Messung ueberpruefen')
      break
    }
  }
  
  // ========== Curve Fitting ==========
  const curveFit = fitLactateCurve(data)
  let method: ThresholdAnalysis['method'] = curveFit?.method || 'moddmax-poly'
  let rSquared = curveFit?.rSquared
  let lt1Method = 'curve-intersection'

  // ========== LT1 Detection ==========
  // ALWAYS use the fitted curve to find the exact speed where La(v) = baseline + 0.4
  // The Log-Log breakpoint is only used as a validation fallback
  let lt1Result: { speed: number; lactate: number } | null = null

  if (curveFit) {
    // Primary: solve curve intersection at baseline + 0.4
    lt1Result = detectLT1Baseline(data, baseline, curveFit)
    lt1Method = 'curve-intersection'
  }
  
  if (!lt1Result) {
    // Fallback 1: Log-Log breakpoint
    lt1Result = detectLT1LogLog(data)
    lt1Method = 'log-log'
    
    // Validate Log-Log result
    if (lt1Result) {
      const speedRange = data[data.length - 1].speed - data[0].speed
      const maxLt1Speed = data[0].speed + 0.6 * speedRange
      if (lt1Result.speed > maxLt1Speed || lt1Result.lactate > 2.5) {
        lt1Result = detectLT1Baseline(data, baseline) // linear interpolation fallback
        lt1Method = 'linear-interpolation'
      }
    } else {
      // Fallback 2: linear interpolation
      lt1Result = detectLT1Baseline(data, baseline)
      lt1Method = 'linear-interpolation'
    }
  }
  
  // ========== LT2 Detection (ModDmax PRIMARY!) ==========
  let lt2Result: { speed: number; lactate: number; method?: string; rSquared?: number } | null = null
  
  if (curveFit && lt1Result) {
    lt2Result = detectLT2ModDmax(data, curveFit, lt1Result)
    if (lt2Result) {
      method = lt2Result.method as any
      rSquared = lt2Result.rSquared
    }
  }
  
  // Only fall back to OBLA if ModDmax COMPLETELY failed
  if (!lt2Result) {
    warnings.push('ModDmax-Methode fehlgeschlagen - OBLA 4.0 mmol/L als Fallback verwendet')
    const oblaResult = detectLT2OBLA(data)
    if (oblaResult) {
      lt2Result = { ...oblaResult, method: 'obla-fallback', rSquared: 0 }
      method = 'obla-fallback'
    }
  }
  
  // Ensure LT2 > LT1 (speed)
  if (lt1Result && lt2Result && lt2Result.speed <= lt1Result.speed) {
    // Try OBLA as a rescue
    const oblaResult = detectLT2OBLA(data)
    if (oblaResult && oblaResult.speed > lt1Result.speed) {
      lt2Result = { ...oblaResult, method: 'obla-fallback', rSquared: 0 }
      method = 'obla-fallback'
      warnings.push('LT2 mit OBLA korrigiert (ModDmax ergab LT2 <= LT1)')
    } else {
      // Last resort: place LT2 between LT1 and max speed
      const maxSpeed = data[data.length - 1].speed
      const lt2Speed = lt1Result.speed + 0.6 * (maxSpeed - lt1Result.speed)
      const lt2Lactate = linearInterpolate(data, lt2Speed)
      lt2Result = { speed: lt2Speed, lactate: lt2Lactate, method: 'obla-fallback', rSquared: 0 }
      method = 'obla-fallback'
      warnings.push('LT2 interpoliert (keine geometrische Loesung gefunden)')
    }
  }
  
  // Build final threshold points
  let lt1: ThresholdPoint | null = null
  let lt2: ThresholdPoint | null = null
  
  if (lt1Result) {
    const hr = linearInterpolateHr(data, lt1Result.speed)
    lt1 = {
      speed: lt1Result.speed,
      pace: 3600 / lt1Result.speed,
      lactate: lt1Result.lactate,
      heartRate: hr,
    }
  }
  
  if (lt2Result) {
    const hr = linearInterpolateHr(data, lt2Result.speed)
    lt2 = {
      speed: lt2Result.speed,
      pace: 3600 / lt2Result.speed,
      lactate: lt2Result.lactate,
      heartRate: hr,
    }
  }
  
  // Plausibility checks on the finished thresholds. Without these a collapsed
  // result (both thresholds pinned to the same end of the test) is reported
  // with full confidence and no warning at all.
  const slowestSpeed = data[0].speed
  const fastestSpeed = data[data.length - 1].speed
  const speedRange = fastestSpeed - slowestSpeed

  if (lt1 && lt2) {
    if (lt2.speed - lt1.speed < 0.05 * speedRange) {
      warnings.push('LT1 und LT2 liegen ungewoehnlich nah beieinander - Ergebnis unsicher')
    }
    if (lt2.lactate <= lt1.lactate) {
      warnings.push('LT2-Laktat nicht hoeher als LT1-Laktat - Kurvenverlauf unplausibel')
    }
  }

  if (lt1 && speedRange > 0 && lt1.speed <= slowestSpeed + 0.02 * speedRange) {
    warnings.push('LT1 liegt auf der langsamsten Stufe - Test startete moeglicherweise zu intensiv')
  }

  if (lt2 && speedRange > 0 && lt2.speed >= fastestSpeed - 0.02 * speedRange) {
    warnings.push('LT2 liegt auf der schnellsten Stufe - Test war moeglicherweise zu kurz')
  }

  // Determine confidence
  let confidence: ThresholdAnalysis['confidence'] = 'high'
  if (!lt1 || !lt2) {
    confidence = 'low'
  } else if (method === 'obla-fallback' || warnings.length > 1) {
    confidence = 'medium'
  } else if (rSquared && rSquared < 0.95) {
    confidence = 'medium'
  }

  // Build calculation log for full transparency
  // Compute secant parameters for log display
  const secantStart = lt1Result ? { speed: lt1Result.speed, lactate: lt1Result.lactate } : data[0]
  const secantEnd = data[data.length - 1]
  const secantSlope = secantStart && secantEnd && (secantEnd.speed - secantStart.speed) !== 0
    ? (secantEnd.lactate - secantStart.lactate) / (secantEnd.speed - secantStart.speed)
    : 0
  const secantIntercept = secantStart
    ? secantStart.lactate - secantSlope * secantStart.speed
    : 0

  const calculationLog: CalculationLog = {
    inputData: data.map(d => ({ speed: Math.round(d.speed * 100) / 100, lactate: d.lactate, hr: d.hr })),
    curveFitting: curveFit ? {
      method: curveFit.method.includes('poly') ? 'polynomial-3' : 'exponential',
      coefficients: curveFit.coefficients,
      rSquared: curveFit.rSquared,
      equation: curveFit.equation,
    } : null,
    lt1Detection: {
      method: lt1Method === 'curve-intersection'
        ? 'Kurven-Schnittpunkt bei Baseline + 0.4'
        : lt1Method === 'log-log'
          ? 'Log-Log Breakpoint (Beaver et al.)'
          : 'Lineare Interpolation (Fallback)',
      steps: [
        {
          step: '1. Baseline-Berechnung',
          description: 'Minimum aller Laktatwerte als Baseline',
          formula: 'Baseline = min(La₁, La₂, ..., Laₙ)',
          formulaFilled: `Baseline = min(${data.map(d => d.lactate.toFixed(2)).join(', ')})`,
          result: `= ${baseline.toFixed(2)} mmol/L`,
        },
        {
          step: '2. LT1-Schwellenwert',
          description: 'Baseline plus 0.4 mmol/L (Norwegisches Modell)',
          formula: 'LT1_threshold = Baseline + 0.4',
          formulaFilled: `LT1_threshold = ${baseline.toFixed(2)} + 0.4 = ${(baseline + 0.4).toFixed(2)}`,
          result: `= ${(baseline + 0.4).toFixed(2)} mmol/L`,
        },
        {
          step: '3. LT1-Punkt auf Kurve finden',
          description: lt1Method === 'curve-intersection'
            ? `Exaktes v lösen, bei dem die gefittete Kurve den Wert ${(baseline + 0.4).toFixed(2)} erreicht`
            : lt1Method === 'log-log'
              ? 'Breakpoint in der Log-Log-Transformation der Laktatkurve'
              : `Lineare Interpolation zwischen Messpunkten bei La = ${(baseline + 0.4).toFixed(2)}`,
          formula: lt1Method === 'curve-intersection'
            ? 'Löse: La(v) = LT1_threshold'
            : 'LT1 = erster Punkt mit La ≥ LT1_threshold',
          formulaFilled: lt1Method === 'curve-intersection' && curveFit
            ? `Löse: ${curveFit.equation} = ${(baseline + 0.4).toFixed(2)}`
            : `LT1 = erster Punkt mit La ≥ ${(baseline + 0.4).toFixed(2)}`,
          result: lt1Result
            ? `→ v = ${lt1Result.speed.toFixed(2)} km/h (${formatPaceFromSecondsForLog(3600 / lt1Result.speed)}/km) bei La = ${lt1Result.lactate.toFixed(2)} mmol/L`
            : 'Nicht gefunden',
        },
      ],
      finalValue: lt1Result ? { speed: lt1Result.speed, lactate: lt1Result.lactate } : null,
    },
    lt2Detection: {
      method: method === 'obla-fallback' ? 'OBLA 4.0 mmol/L (Fallback)' : 'ModDmax (Modifizierte Dmax-Methode)',
      steps: method !== 'obla-fallback' ? [
        {
          step: '1. Kurvenanpassung',
          description: curveFit
            ? `${curveFit.method.includes('poly') ? 'Polynom 3. Grades' : 'Exponentialfunktion'} an ${data.length} Datenpunkte angepasst`
            : 'Kurvenanpassung',
          formula: curveFit?.method.includes('poly')
            ? 'La(v) = a·v³ + b·v² + c·v + d'
            : 'La(v) = a + b·e^(c·v)',
          formulaFilled: curveFit?.equation,
          result: curveFit ? `R² = ${curveFit.rSquared.toFixed(4)} (${(curveFit.rSquared * 100).toFixed(1)}%)` : 'Nicht berechnet',
        },
        {
          step: '2. ModDmax-Sekante definieren',
          description: 'Gerade vom LT1-Punkt zum letzten Messpunkt (ModDmax, NICHT vom ersten Messpunkt!)',
          formula: 'Sekante: y = m·x + n, wobei m = (La_last - La_LT1) / (v_last - v_LT1)',
          formulaFilled: `Sekante: y = ${secantSlope.toFixed(4)}·x + ${secantIntercept.toFixed(4)}`,
          inputs: {
            'Startpunkt (LT1)': `(${secantStart.speed.toFixed(2)} km/h, ${secantStart.lactate.toFixed(2)} mmol/L)`,
            'Endpunkt (letzter Messpunkt)': `(${secantEnd.speed.toFixed(2)} km/h, ${secantEnd.lactate.toFixed(2)} mmol/L)`,
            'Steigung m': `(${secantEnd.lactate.toFixed(2)} - ${secantStart.lactate.toFixed(2)}) / (${secantEnd.speed.toFixed(2)} - ${secantStart.speed.toFixed(2)}) = ${secantSlope.toFixed(4)}`,
          },
        },
        {
          step: '3. Dmax finden',
          description: 'Maximaler senkrechter Abstand zwischen gefitteter Kurve und ModDmax-Sekante',
          formula: 'd(v) = |A·v + B·La(v) + C| / √(A² + B²)',
          formulaFilled: lt2Result
            ? `d(${lt2Result.speed.toFixed(2)}) = max. Abstand auf Kurve zwischen v = ${secantStart.speed.toFixed(2)} und v = ${secantEnd.speed.toFixed(2)}`
            : undefined,
          result: lt2Result
            ? `→ Dmax bei v = ${lt2Result.speed.toFixed(2)} km/h (${formatPaceFromSecondsForLog(3600 / lt2Result.speed)}/km)`
            : 'Nicht gefunden',
        },
        {
          step: '4. Laktat bei Dmax',
          description: 'Laktatwert an der Dmax-Position auf der gefitteten Kurve ablesen',
          formula: 'La_LT2 = La(v_dmax)',
          formulaFilled: lt2Result && curveFit
            ? `La(${lt2Result.speed.toFixed(2)}) = ${lt2Result.lactate.toFixed(2)}`
            : undefined,
          result: lt2Result ? `= ${lt2Result.lactate.toFixed(2)} mmol/L` : 'Nicht berechnet',
        },
      ] : [
        {
          step: '1. OBLA Fallback',
          description: 'ModDmax-Methode fehlgeschlagen. Fixe Schwelle bei 4.0 mmol/L (OBLA = Onset of Blood Lactate Accumulation)',
          formula: 'LT2 = v bei La(v) = 4.0 mmol/L',
          formulaFilled: lt2Result
            ? `LT2 = v bei La(v) = 4.0 → v = ${lt2Result.speed.toFixed(2)} km/h`
            : undefined,
          result: lt2Result
            ? `→ v = ${lt2Result.speed.toFixed(2)} km/h (${formatPaceFromSecondsForLog(3600 / lt2Result.speed)}/km)`
            : 'Nicht gefunden',
        },
      ],
      dmaxPoint: lt2Result && method !== 'obla-fallback' ? { speed: lt2Result.speed, distance: 0 } : undefined,
      finalValue: lt2Result ? { speed: lt2Result.speed, lactate: lt2Result.lactate } : null,
    },
    validation: [
      {
        step: 'LT2 > LT1 Pruefung',
        description: lt1 && lt2
          ? `LT2 (${lt2.speed.toFixed(2)} km/h) > LT1 (${lt1.speed.toFixed(2)} km/h)`
          : 'LT2 muss bei hoeherer Geschwindigkeit als LT1 liegen',
        result: lt1 && lt2 ? (lt2.speed > lt1.speed ? '✓ OK' : '✗ Korrigiert') : 'N/A',
      },
      {
        step: 'Konfidenz-Bewertung',
        description: `Basierend auf R²=${rSquared?.toFixed(4) ?? 'N/A'}, Methode=${method}, Warnungen=${warnings.length}`,
        result: confidence === 'high' ? '✓ Hoch' : confidence === 'medium' ? '⚠ Mittel' : '✗ Niedrig',
      },
    ],
  }
  
  return {
    lt1,
    lt2,
    method,
    confidence,
    warnings,
    baseline,
    rSquared,
    calculationLog,
  }
}

// ============================================================================
// TRAINING ZONES (derived from thresholds)
// ============================================================================

export interface TrainingZoneInfo {
  name: string
  shortName: string
  abbrev: string
  zone: string
  description: string
  paceRange: { min: number; max: number } // seconds per km
  speedRange: { min: number; max: number } // km/h
  lactateRange: { min: number; max: number } // mmol/L
  hrRange?: { min: number; max: number }
  color: string
}

/**
 * Derive the five training zones from LT1 and LT2.
 *
 * The zones share their boundaries, so they tile the whole range without gaps.
 * The previous definition anchored Z3 to LT1 and Z4 to LT2 independently,
 * which left the entire span between the two thresholds unassigned.
 *
 * Lactate and heart rate ranges are derived from the athlete's measured
 * threshold values rather than from a fixed table, so they cannot contradict
 * the thresholds shown next to them.
 */
export function calculateTrainingZones(analysis: ThresholdAnalysis): TrainingZoneInfo[] {
  if (!analysis.lt1 || !analysis.lt2) return []

  const lt1Pace = analysis.lt1.pace
  const lt2Pace = analysis.lt2.pace
  const lt1Hr = analysis.lt1.heartRate
  const lt2Hr = analysis.lt2.heartRate
  const lt1La = analysis.lt1.lactate
  const lt2La = analysis.lt2.lactate
  const baseline = analysis.baseline

  // Pace boundaries in seconds/km, from slowest to fastest. Consecutive zones
  // share a boundary, so there are six values for five zones.
  const boundaries = [
    lt1Pace + 75, // slow end of Z1
    lt1Pace + 20, // Z1 | Z2
    lt1Pace + 5,  // Z2 | Z3
    lt2Pace + 12, // Z3 | Z4
    lt2Pace - 5,  // Z4 | Z5
    lt2Pace - 30, // fast end of Z5
  ]

  // If the thresholds sit very close together the LT1- and LT2-anchored
  // boundaries can cross. Force them strictly decreasing so no zone inverts.
  for (let i = 1; i < boundaries.length; i++) {
    boundaries[i] = Math.min(boundaries[i], boundaries[i - 1] - 1)
  }

  const hrRange = (min: number | undefined, max: number | undefined) =>
    min !== undefined && max !== undefined
      ? { min: Math.round(min), max: Math.round(max) }
      : undefined

  const zoneDefs = [
    {
      name: 'Regeneration / Langer Dauerlauf',
      shortName: 'REKOM',
      abbrev: 'REKOM/LDL',
      zone: 'Z1',
      description: 'Sehr lockeres Tempo, aktive Erholung',
      lactateMin: baseline,
      lactateMax: baseline + 0.3,
      hrRange: hrRange(lt1Hr && lt1Hr - 28, lt1Hr && lt1Hr - 13),
      color: '#22c55e',
    },
    {
      name: 'Grundlagenausdauer 1',
      shortName: 'GA1',
      abbrev: 'GA1',
      zone: 'Z2',
      description: 'Lockerer Dauerlauf, knapp unter LT1',
      lactateMin: baseline + 0.2,
      lactateMax: lt1La,
      hrRange: hrRange(lt1Hr && lt1Hr - 13, lt1Hr && lt1Hr - 3),
      color: '#84cc16',
    },
    {
      name: 'Grundlagenausdauer 2',
      shortName: 'GA2',
      abbrev: 'GA2',
      zone: 'Z3',
      description: 'Mittlerer Dauerlauf zwischen LT1 und LT2',
      lactateMin: lt1La,
      lactateMax: lt2La,
      hrRange: hrRange(lt1Hr && lt1Hr - 3, lt2Hr && lt2Hr - 4),
      color: '#eab308',
    },
    {
      name: 'Schwellentraining',
      shortName: 'TDL',
      abbrev: 'TDL',
      zone: 'Z4',
      description: 'Tempolauf an LT2, Schwellenintervalle',
      lactateMin: Math.max(lt1La, lt2La - 0.3),
      lactateMax: lt2La + 0.8,
      hrRange: hrRange(lt2Hr && lt2Hr - 4, lt2Hr && lt2Hr + 3),
      color: '#f97316',
    },
    {
      name: 'Wettkampfspezifisch',
      shortName: 'WSA',
      abbrev: 'WSA',
      zone: 'Z5',
      description: 'Intervalle ueber LT2, VO2max-Training',
      lactateMin: lt2La + 0.8,
      lactateMax: lt2La + 4,
      hrRange: hrRange(lt2Hr && lt2Hr + 3, lt2Hr && lt2Hr + 12),
      color: '#ef4444',
    },
  ]

  return zoneDefs.map((z, i) => {
    const slowPace = boundaries[i]
    const fastPace = boundaries[i + 1]

    return {
      name: z.name,
      shortName: z.shortName,
      abbrev: z.abbrev,
      zone: z.zone,
      description: z.description,
      paceRange: { min: fastPace, max: slowPace },
      speedRange: { min: 3600 / slowPace, max: 3600 / fastPace },
      lactateRange: { min: z.lactateMin, max: z.lactateMax },
      hrRange: z.hrRange,
      color: z.color,
    }
  })
}

// ============================================================================
// ANALYZE STEP TEST (main entry point for step test data)
// ============================================================================

export function analyzeStepTest(steps: StepData[], restingLactate?: number): StepTestResults | null {
  // Convert StepData to StepTestStep format
  const stepsForAnalysis: StepTestStep[] = steps
    .filter(s => s.completed && s.lactate_mmol !== null)
    .map(s => ({
      stepNumber: s.step_number,
      targetPace: s.target_pace_min_km * 60, // Convert min/km to seconds/km
      heartRate: s.end_hr ?? undefined,
      lactate: s.lactate_mmol ?? undefined,
    }))
  
  if (stepsForAnalysis.length < 3) return null
  
  const analysis = detectThresholds(stepsForAnalysis, restingLactate)
  const zones = calculateTrainingZones(analysis)
  
  // Convert to StepTestResults format
  const zoneResults: TrainingZone[] = zones.map((z, i) => ({
    zone: (i + 1) as 1 | 2 | 3 | 4 | 5,
    name: z.name,
    // [min, max] in min/km - the faster (numerically smaller) pace first
    pace_range: [z.paceRange.min / 60, z.paceRange.max / 60],
    hr_range: [z.hrRange?.min ?? 0, z.hrRange?.max ?? 0],
    description: z.description,
  }))
  
  return {
    lt1_pace: analysis.lt1 ? analysis.lt1.pace / 60 : 0,
    lt2_pace: analysis.lt2 ? analysis.lt2.pace / 60 : 0,
    lt1_hr: analysis.lt1?.heartRate ?? 0,
    lt2_hr: analysis.lt2?.heartRate ?? 0,
    lt1_lactate: analysis.lt1?.lactate ?? 0,
    lt2_lactate: analysis.lt2?.lactate ?? 0,
    max_hr_reached: Math.max(...stepsForAnalysis.map(s => s.heartRate ?? 0)),
    max_lactate_reached: Math.max(...stepsForAnalysis.map(s => s.lactate ?? 0)),
    zones: zoneResults,
  }
}
