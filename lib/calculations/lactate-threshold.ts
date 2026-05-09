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
  formula?: string
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
}

/**
 * Fit exponential model: La(v) = a + b * e^(c*v)
 */
function fitExponential(data: DataPoint[]): ExponentialCoeffs | null {
  if (data.length < 3) return null
  
  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  
  // Initial estimates
  let a = Math.max(0.5, first.lactate - 0.5)
  let b = 0.1
  let c = 0.1
  
  // Estimate c from the data range
  if (last.lactate > first.lactate && last.lactate > a) {
    c = Math.log((last.lactate - a + 0.1) / Math.max(0.1, first.lactate - a + 0.1)) / (last.speed - first.speed)
    c = Math.max(0.01, Math.min(0.5, c))
  }
  
  // Gradient descent (20 iterations)
  for (let iter = 0; iter < 20; iter++) {
    let gradA = 0, gradB = 0, gradC = 0
    
    for (const p of data) {
      const expTerm = Math.exp(Math.min(c * p.speed, 10)) // Prevent overflow
      const predicted = a + b * expTerm
      const error = predicted - p.lactate
      
      gradA += error
      gradB += error * expTerm
      gradC += error * b * p.speed * expTerm
    }
    
    const lr = 0.0005 / data.length
    a -= lr * gradA
    b -= lr * gradB
    c -= lr * gradC
    
    a = Math.max(0, a)
    b = Math.max(0.001, b)
    c = Math.max(0.001, Math.min(0.8, c))
  }
  
  return { a, b, c }
}

function evalExponential(coeffs: ExponentialCoeffs, v: number): number {
  return coeffs.a + coeffs.b * Math.exp(Math.min(coeffs.c * v, 10))
}

// ============================================================================
// INTERPOLATION FOR VISUALIZATION
// ============================================================================

export function generateSmoothCurve(
  data: DataPoint[],
  numPoints: number = 50
): { speed: number; lactate: number; hr?: number }[] {
  if (data.length < 2) return data.map(d => ({ speed: d.speed, lactate: d.lactate, hr: d.hr }))
  
  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const minSpeed = sorted[0].speed
  const maxSpeed = sorted[sorted.length - 1].speed
  
  // Try polynomial fit
  const polyCoeffs = fitPolynomial3(sorted)
  const polyR2 = polyCoeffs ? calcRSquared(sorted, v => evalPolynomial(polyCoeffs, v)) : 0
  const polyValid = polyCoeffs && isPolynomialPlausible(polyCoeffs, minSpeed, maxSpeed)
  
  const usePolynomial = polyCoeffs && polyR2 >= 0.90 && polyValid
  
  // Fallback to exponential
  const expCoeffs = !usePolynomial ? fitExponential(sorted) : null
  
  const curve: { speed: number; lactate: number; hr?: number }[] = []
  const step = (maxSpeed - minSpeed) / (numPoints - 1)
  
  for (let i = 0; i < numPoints; i++) {
    const speed = minSpeed + i * step
    
    let lactate: number
    if (usePolynomial && polyCoeffs) {
      lactate = evalPolynomial(polyCoeffs, speed)
    } else if (expCoeffs) {
      lactate = evalExponential(expCoeffs, speed)
    } else {
      lactate = linearInterpolate(sorted, speed)
    }
    
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

function detectLT1Baseline(data: DataPoint[], baseline: number): { speed: number; lactate: number } | null {
  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const threshold = baseline + 0.4
  
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].lactate < threshold && sorted[i + 1].lactate >= threshold) {
      const t = (threshold - sorted[i].lactate) / (sorted[i + 1].lactate - sorted[i].lactate)
      const speed = sorted[i].speed + t * (sorted[i + 1].speed - sorted[i].speed)
      return { speed, lactate: threshold }
    }
  }
  
  if (sorted[0].lactate >= threshold) {
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
 * This is the PRIMARY method for LT2 detection.
 * 
 * Algorithm:
 * 1. Fit a curve (polynomial or exponential) to the lactate data
 * 2. Draw a secant line from first to last data point
 * 3. Find the point on the FITTED CURVE with maximum perpendicular distance to the secant
 * 4. That point is LT2
 * 
 * The 4.0 mmol/L OBLA threshold is ONLY used when:
 * - Curve fitting completely fails (R² < 0.80)
 * - Dmax point is geometrically impossible
 */
function detectLT2ModDmax(data: DataPoint[]): {
  speed: number
  lactate: number
  method: 'moddmax-poly' | 'moddmax-exp'
  rSquared: number
} | null {
  if (data.length < 4) return null
  
  const sorted = [...data].sort((a, b) => a.speed - b.speed)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  
  // Try polynomial fit first
  const polyCoeffs = fitPolynomial3(sorted)
  let polyR2 = 0
  let evalFn: (v: number) => number
  let useMethod: 'moddmax-poly' | 'moddmax-exp' = 'moddmax-poly'
  
  if (polyCoeffs) {
    polyR2 = calcRSquared(sorted, v => evalPolynomial(polyCoeffs, v))
    const polyValid = isPolynomialPlausible(polyCoeffs, first.speed, last.speed)
    
    if (polyR2 >= 0.90 && polyValid) {
      evalFn = v => evalPolynomial(polyCoeffs, v)
    } else {
      // Try exponential
      const expCoeffs = fitExponential(sorted)
      if (expCoeffs) {
        const expR2 = calcRSquared(sorted, v => evalExponential(expCoeffs, v))
        if (expR2 >= 0.85) {
          evalFn = v => evalExponential(expCoeffs, v)
          polyR2 = expR2
          useMethod = 'moddmax-exp'
        } else {
          return null // Fitting failed completely
        }
      } else {
        return null
      }
    }
  } else {
    // No polynomial, try exponential
    const expCoeffs = fitExponential(sorted)
    if (expCoeffs) {
      polyR2 = calcRSquared(sorted, v => evalExponential(expCoeffs, v))
      if (polyR2 >= 0.85) {
        evalFn = v => evalExponential(expCoeffs, v)
        useMethod = 'moddmax-exp'
      } else {
        return null
      }
    } else {
      return null
    }
  }
  
  // Secant line from first to last point
  const dx = last.speed - first.speed
  const dy = last.lactate - first.lactate
  
  if (dx === 0) return null
  
  // Secant line: y = first.lactate + (dy/dx) * (x - first.speed)
  // Or in form Ax + By + C = 0: dy*x - dx*y + (dx*first.lactate - dy*first.speed) = 0
  const lineA = dy
  const lineB = -dx
  const lineC = dx * first.lactate - dy * first.speed
  const lineDenom = Math.sqrt(lineA * lineA + lineB * lineB)
  
  if (lineDenom === 0) return null
  
  // Sample 100 points along the FITTED CURVE
  const numSamples = 100
  const step = dx / numSamples
  
  let maxDistance = 0
  let dmaxSpeed = 0
  let dmaxLactate = 0
  
  for (let i = 1; i < numSamples; i++) {
    const speed = first.speed + i * step
    const lactate = evalFn!(speed)
    
    // Calculate perpendicular distance from curve point to secant line
    // Distance = |A*x + B*y + C| / sqrt(A² + B²)
    const distance = Math.abs(lineA * speed + lineB * lactate + lineC) / lineDenom
    
    // Check if this point is ABOVE the secant line (curve should bulge upward)
    const secantY = first.lactate + (dy / dx) * (speed - first.speed)
    const isAboveSecant = lactate > secantY
    
    // Only consider points where curve is above the secant (positive curvature)
    if (isAboveSecant && distance > maxDistance) {
      maxDistance = distance
      dmaxSpeed = speed
      dmaxLactate = lactate
    }
  }
  
  // If no point found above secant, the curve doesn't have proper shape
  // This can happen with very flat or linear data
  if (dmaxSpeed === 0) {
    // Try without the "above secant" requirement - just find max distance
    for (let i = 1; i < numSamples; i++) {
      const speed = first.speed + i * step
      const lactate = evalFn!(speed)
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
    method: useMethod,
    rSquared: polyR2,
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
  
  // Calculate baseline (minimum lactate - accounting for lactate dip)
  const minStepLactate = Math.min(...data.map(d => d.lactate))
  const baseline = Math.min(minStepLactate, restingLactate ?? Infinity)
  const maxLactate = Math.max(...data.map(d => d.lactate))
  
  // Quality warnings
  if (validSteps.length < 5) {
    warnings.push('Weniger als 5 Stufen - Genauigkeit eingeschraenkt')
  }
  
  if (maxLactate < 4.0) {
    warnings.push('Maximales Laktat unter 4.0 mmol/L - LT2 moeglicherweise ungenau')
  }
  
  // Check for non-monotonic AFTER initial rise
  const lt1Threshold = baseline + 0.4
  let riseStarted = false
  for (let i = 1; i < data.length; i++) {
    if (data[i].lactate >= lt1Threshold) riseStarted = true
    if (riseStarted && data[i].lactate < data[i - 1].lactate - 0.4) {
      warnings.push('Laktatwerte nicht monoton steigend - Messung ueberpruefen')
      break
    }
  }
  
  // ========== LT1 Detection ==========
  let lt1Result = detectLT1LogLog(data)
  
  // Validate LT1 - should be in lower 60% of speed range with lactate < 2.5
  if (lt1Result) {
    const speedRange = data[data.length - 1].speed - data[0].speed
    const maxLt1Speed = data[0].speed + 0.6 * speedRange
    
    if (lt1Result.speed > maxLt1Speed || lt1Result.lactate > 2.5) {
      lt1Result = detectLT1Baseline(data, baseline)
    }
  } else {
    lt1Result = detectLT1Baseline(data, baseline)
  }
  
  // ========== LT2 Detection (ModDmax PRIMARY!) ==========
  let lt2Result = detectLT2ModDmax(data)
  let method: ThresholdAnalysis['method'] = lt2Result?.method || 'moddmax-poly'
  let rSquared = lt2Result?.rSquared
  
  // Only fall back to OBLA if ModDmax COMPLETELY failed
  if (!lt2Result) {
    warnings.push('ModDmax-Methode fehlgeschlagen - OBLA 4.0 mmol/L als Fallback verwendet')
    const oblaResult = detectLT2OBLA(data)
    if (oblaResult) {
      lt2Result = oblaResult
      method = 'obla-fallback'
    }
  }
  
  // Ensure LT2 > LT1 (speed)
  if (lt1Result && lt2Result && lt2Result.speed <= lt1Result.speed) {
    // Try OBLA as a rescue
    const oblaResult = detectLT2OBLA(data)
    if (oblaResult && oblaResult.speed > lt1Result.speed) {
      lt2Result = oblaResult
      method = 'obla-fallback'
      warnings.push('LT2 mit OBLA korrigiert (ModDmax ergab LT2 <= LT1)')
    } else {
      // Last resort: place LT2 between LT1 and max speed
      const maxSpeed = data[data.length - 1].speed
      const lt2Speed = lt1Result.speed + 0.6 * (maxSpeed - lt1Result.speed)
      const lt2Lactate = linearInterpolate(data, lt2Speed)
      lt2Result = { speed: lt2Speed, lactate: lt2Lactate }
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
  const calculationLog: CalculationLog = {
    inputData: data.map(d => ({ speed: Math.round(d.speed * 100) / 100, lactate: d.lactate, hr: d.hr })),
    curveFitting: rSquared ? {
      method: method.includes('poly') ? 'polynomial-3' : 'exponential',
      coefficients: {}, // Would need to pass from detectLT2ModDmax
      rSquared: rSquared,
      equation: method.includes('poly') 
        ? 'La(v) = a·v³ + b·v² + c·v + d' 
        : 'La(v) = a + b·e^(c·v)',
    } : null,
    lt1Detection: {
      method: 'Log-Log Breakpoint / Baseline + 0.4',
      steps: [
        {
          step: '1. Baseline-Berechnung',
          description: 'Minimum aller Laktatwerte als Baseline',
          formula: 'Baseline = min(La₁, La₂, ..., Laₙ)',
          inputs: { 'Laktatwerte': data.map(d => d.lactate.toFixed(2)).join(', ') },
          result: baseline.toFixed(2) + ' mmol/L',
        },
        {
          step: '2. LT1-Schwellenwert',
          description: 'Baseline plus 0.4 mmol/L (Norwegisches Modell)',
          formula: 'LT1_threshold = Baseline + 0.4',
          inputs: { 'Baseline': baseline.toFixed(2) },
          result: (baseline + 0.4).toFixed(2) + ' mmol/L',
        },
        {
          step: '3. LT1-Punkt finden',
          description: 'Erster Punkt der Kurve, an dem Laktat >= LT1_threshold',
          formula: 'LT1 = erster Punkt mit La >= ' + (baseline + 0.4).toFixed(2),
          result: lt1Result ? `${lt1Result.speed.toFixed(2)} km/h bei ${lt1Result.lactate.toFixed(2)} mmol/L` : 'Nicht gefunden',
        },
      ],
      finalValue: lt1Result ? { speed: lt1Result.speed, lactate: lt1Result.lactate } : null,
    },
    lt2Detection: {
      method: method === 'obla-fallback' ? 'OBLA 4.0 mmol/L (Fallback)' : 'ModDmax (Modifizierte Dmax-Methode)',
      steps: method !== 'obla-fallback' ? [
        {
          step: '1. Kurvenanpassung',
          description: 'Polynom 3. Grades an die Laktatdaten anpassen',
          formula: 'La(v) = a·v³ + b·v² + c·v + d',
          result: rSquared ? `R² = ${rSquared.toFixed(4)}` : 'Nicht berechnet',
        },
        {
          step: '2. Sekantenlinie definieren',
          description: 'Gerade vom ersten zum letzten Messpunkt',
          formula: 'Sekante: y = m·x + n',
          inputs: { 
            'Startpunkt': `(${data[0].speed.toFixed(1)}, ${data[0].lactate.toFixed(2)})`,
            'Endpunkt': `(${data[data.length-1].speed.toFixed(1)}, ${data[data.length-1].lactate.toFixed(2)})`,
          },
        },
        {
          step: '3. Dmax finden',
          description: 'Maximaler senkrechter Abstand zwischen Kurve und Sekante',
          formula: 'd = |a·x + b·y + c| / √(a² + b²)',
          result: lt2Result ? `Dmax bei ${lt2Result.speed.toFixed(2)} km/h` : 'Nicht gefunden',
        },
        {
          step: '4. Laktat bei Dmax',
          description: 'Laktatwert an der Dmax-Position auf der gefitteten Kurve',
          result: lt2Result ? `${lt2Result.lactate.toFixed(2)} mmol/L` : 'Nicht berechnet',
        },
      ] : [
        {
          step: '1. OBLA Fallback',
          description: 'Fixe Schwelle bei 4.0 mmol/L (OBLA = Onset of Blood Lactate Accumulation)',
          formula: 'LT2 = Punkt mit La = 4.0 mmol/L',
          result: lt2Result ? `${lt2Result.speed.toFixed(2)} km/h` : 'Nicht gefunden',
        },
      ],
      dmaxPoint: lt2Result && method !== 'obla-fallback' ? { speed: lt2Result.speed, distance: 0 } : undefined,
      finalValue: lt2Result ? { speed: lt2Result.speed, lactate: lt2Result.lactate } : null,
    },
    validation: [
      {
        step: 'LT2 > LT1 Pruefung',
        description: 'LT2 muss bei hoeherer Geschwindigkeit als LT1 liegen',
        result: lt1 && lt2 ? (lt2.speed > lt1.speed ? 'OK' : 'Korrigiert') : 'N/A',
      },
      {
        step: 'Konfidenz-Bewertung',
        description: 'Basierend auf R², Methodik und Warnungen',
        result: confidence,
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

export function calculateTrainingZones(analysis: ThresholdAnalysis): TrainingZoneInfo[] {
  if (!analysis.lt1 || !analysis.lt2) return []
  
  const lt1Pace = analysis.lt1.pace
  const lt2Pace = analysis.lt2.pace
  const lt1Hr = analysis.lt1.heartRate
  const lt2Hr = analysis.lt2.heartRate
  
  // Zone boundaries based on LT1 and LT2
  // Faster pace = lower seconds per km
  
  // Helper to convert pace to speed
  const paceToSpeed = (paceSecondsPerKm: number) => 3600 / paceSecondsPerKm
  
  // Define zone boundaries
  const zoneDefs = [
    {
      name: 'Regeneration / Langer Dauerlauf',
      shortName: 'REKOM',
      abbrev: 'REKOM/LDL',
      zone: 'Z1',
      description: 'Sehr lockeres Tempo, aktive Erholung',
      paceMin: lt1Pace + 40,
      paceMax: lt1Pace + 80,
      lactateMin: 0.8,
      lactateMax: 1.5,
      hrOffset: lt1Hr ? { min: -25, max: -10 } : null,
      color: '#22c55e',
    },
    {
      name: 'Grundlagenausdauer 1',
      shortName: 'GA1',
      abbrev: 'GA1',
      zone: 'Z2',
      description: 'Lockerer Dauerlauf, unter LT1',
      paceMin: lt1Pace + 10,
      paceMax: lt1Pace + 40,
      lactateMin: 1.2,
      lactateMax: 2.0,
      hrOffset: lt1Hr ? { min: -10, max: 0 } : null,
      color: '#84cc16',
    },
    {
      name: 'Grundlagenausdauer 2',
      shortName: 'GA2',
      abbrev: 'GA2',
      zone: 'Z3',
      description: 'Mittlerer Dauerlauf, um LT1',
      paceMin: lt1Pace - 10,
      paceMax: lt1Pace + 10,
      lactateMin: 1.8,
      lactateMax: 2.5,
      hrOffset: lt1Hr ? { min: -5, max: 5 } : null,
      color: '#eab308',
    },
    {
      name: 'Schwellentraining',
      shortName: 'TDL',
      abbrev: 'TDL',
      zone: 'Z4',
      description: 'Tempolauf an LT2, Schwellenintervalle',
      paceMin: lt2Pace - 5,
      paceMax: lt2Pace + 10,
      lactateMin: 2.5,
      lactateMax: 4.0,
      hrOffset: lt2Hr ? { min: -5, max: 3 } : null,
      color: '#f97316',
    },
    {
      name: 'Wettkampfspezifisch',
      shortName: 'WSA',
      abbrev: 'WSA',
      zone: 'Z5',
      description: 'Intervalle ueber LT2, VO2max-Training',
      paceMin: lt2Pace - 25,
      paceMax: lt2Pace - 5,
      lactateMin: 4.0,
      lactateMax: 8.0,
      hrOffset: lt2Hr ? { min: 0, max: 10 } : null,
      color: '#ef4444',
    },
  ]
  
  const zones: TrainingZoneInfo[] = zoneDefs.map(z => ({
    name: z.name,
    shortName: z.shortName,
    abbrev: z.abbrev,
    zone: z.zone,
    description: z.description,
    paceRange: { min: z.paceMin, max: z.paceMax },
    speedRange: { 
      min: paceToSpeed(z.paceMax), // slower pace = lower speed
      max: paceToSpeed(z.paceMin), // faster pace = higher speed
    },
    lactateRange: { min: z.lactateMin, max: z.lactateMax },
    hrRange: z.hrOffset && lt1Hr ? { 
      min: Math.round((z.zone <= 'Z3' ? lt1Hr : lt2Hr!) + z.hrOffset.min), 
      max: Math.round((z.zone <= 'Z3' ? lt1Hr : lt2Hr!) + z.hrOffset.max),
    } : undefined,
    color: z.color,
  }))
  
  return zones
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
    zone_number: i + 1,
    name: z.name,
    min_pace_min_km: z.paceRange.max / 60, // Convert back to min/km
    max_pace_min_km: z.paceRange.min / 60,
    min_hr: z.hrRange?.min ?? null,
    max_hr: z.hrRange?.max ?? null,
  }))
  
  return {
    lt1_pace_min_km: analysis.lt1 ? analysis.lt1.pace / 60 : null,
    lt1_hr: analysis.lt1?.heartRate ?? null,
    lt2_pace_min_km: analysis.lt2 ? analysis.lt2.pace / 60 : null,
    lt2_hr: analysis.lt2?.heartRate ?? null,
    training_zones: zoneResults,
  }
}
