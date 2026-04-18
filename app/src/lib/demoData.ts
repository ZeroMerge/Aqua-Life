import type { SensorLog } from '@/types/sensors';

let idCounter = 1;
let intervalId: ReturnType<typeof setInterval> | null = null;

// Track recent values to create smooth random walks
let lastValues = {
  ph: 7.2,
  temperature: 26.5,
  turbidity: 25,
  dissolved_oxygen: 8.5,
};

/**
 * Generate a random walk value that stays within safe bounds most of the time,
 * but occasionally drifts toward warning boundaries.
 */
function walkValue(
  current: number,
  minSafe: number,
  maxSafe: number,
  step: number,
  driftTowardWarningChance: number = 0.05
): number {
  const range = maxSafe - minSafe;
  const center = (minSafe + maxSafe) / 2;

  // Occasionally drift toward a boundary to trigger warning states
  let bias = 0;
  if (Math.random() < driftTowardWarningChance) {
    // Drift toward one of the boundaries
    const towardUpper = Math.random() > 0.5;
    bias = towardUpper ? step * 2 : -step * 2;
  } else {
    // Gentle pull back toward center
    const distanceFromCenter = current - center;
    bias = -distanceFromCenter * 0.05;
  }

  const change = (Math.random() - 0.5) * step * 2 + bias;
  let next = current + change;

  // Soft boundaries — allow brief excursions but pull back
  const hardMin = minSafe - range * 0.3;
  const hardMax = maxSafe + range * 0.3;

  if (next < hardMin) next = hardMin + Math.random() * step;
  if (next > hardMax) next = hardMax - Math.random() * step;

  return next;
}

/**
 * Generate a single sensor log with realistic values.
 */
function generateLog(): SensorLog {
  lastValues.ph = walkValue(lastValues.ph, 6.5, 8.0, 0.08, 0.08);
  lastValues.temperature = walkValue(lastValues.temperature, 24, 30, 0.3, 0.06);
  lastValues.turbidity = walkValue(lastValues.turbidity, 0, 50, 2, 0.04);
  lastValues.dissolved_oxygen = walkValue(lastValues.dissolved_oxygen, 5, 12, 0.2, 0.07);

  return {
    id: idCounter++,
    ph: parseFloat(lastValues.ph.toFixed(2)),
    temperature: parseFloat(lastValues.temperature.toFixed(2)),
    turbidity: Math.round(lastValues.turbidity),
    dissolved_oxygen: parseFloat(lastValues.dissolved_oxygen.toFixed(2)),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate an initial batch of historical data.
 */
export function generateInitialData(count: number = 50): SensorLog[] {
  const logs: SensorLog[] = [];
  const now = Date.now();

  // Reset to safe starting values
  lastValues = {
    ph: 7.2,
    temperature: 26.5,
    turbidity: 25,
    dissolved_oxygen: 8.5,
  };

  for (let i = count - 1; i >= 0; i--) {
    const log = generateLog();
    // Backdate the timestamp
    const timestamp = new Date(now - i * 15000); // 15 seconds apart
    log.timestamp = timestamp.toISOString();
    logs.push(log);
  }

  return logs;
}

/**
 * Start generating demo data at regular intervals.
 */
export function startDemoDataGenerator(
  onData: (log: SensorLog) => void,
  intervalMs: number = 3000
): () => void {
  // Stop any existing generator
  stopDemoDataGenerator();

  intervalId = setInterval(() => {
    const log = generateLog();
    onData(log);
  }, intervalMs);

  // Return cleanup function
  return stopDemoDataGenerator;
}

/**
 * Stop the demo data generator.
 */
export function stopDemoDataGenerator() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
