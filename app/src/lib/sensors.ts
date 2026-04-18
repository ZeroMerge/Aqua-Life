import type { SensorStatus, SensorStates } from '@/types/sensors';

// These act as fallbacks. The hook will overwrite them with DB configs on load.
export const THRESHOLDS: Record<string, { min: number; max: number; unit: string; label: string; description: string }> = {
  ph: {
    min: 6.5, max: 8.5, unit: 'pH', label: 'pH',
    description: 'pH measures how acidic or alkaline the water is. Fish thrive between 6.5 and 8.5.',
  },
  temperature: {
    min: 22.0, max: 28.0, unit: '°C', label: 'Temperature',
    description: 'Water temperature controls the metabolic rate of fish. Most do best between 22°C and 28°C.',
  },
  turbidity: {
    min: 0, max: 30, unit: 'NTU', label: 'Turbidity',
    description: 'Measures how cloudy the water is. Clear water means fish can see and breathe normally.',
  },
  dissolved_oxygen: {
    min: 5.0, max: 10.0, unit: 'mg/L', label: 'Dissolved Oxygen',
    description: 'Oxygen available for fish respiration. Below 5 mg/L, fish gasp at the surface.',
  },
  avg_speed: {
    min: 10, max: 80, unit: 'px/s', label: 'Tank Activity',
    description: 'AI-calculated behavioral activity score. Sudden drops indicate severe stress or illness.',
  }
};

export function getSensorStatus(key: string, value: number, customThresholds = THRESHOLDS): SensorStatus {
  const config = customThresholds[key] || THRESHOLDS[key];
  if (!config) return 'safe';

  const { min, max } = config;
  const range = max - min;
  const buffer = range * 0.10;

  if (value < min || value > max) return 'critical';
  if (value < min + buffer || value > max - buffer) return 'warning';
  return 'safe';
}

export function systemStatusLabel(status: SensorStatus): string {
  if (status === 'safe') return 'Nominal';
  if (status === 'warning') return 'Warning';
  return 'Critical';
}

export function getSystemStatus(states: SensorStates): SensorStatus {
  const statuses = Object.values(states).map((s) => s.status);
  if (statuses.includes('critical')) return 'critical';
  if (statuses.includes('warning')) return 'warning';
  return 'safe';
}

export function getSensorStatusText(key: string, status: SensorStatus, value: number, customThresholds = THRESHOLDS): string {
  const config = customThresholds[key] || THRESHOLDS[key];
  if (!config) return 'Awaiting sensor calibration...';
  const { min, max } = config;

  if (status === 'safe') {
    switch (key) {
      case 'ph': return 'Water acidity is balanced. Fish are comfortable.';
      case 'temperature': return 'Temperature is in the ideal range for fish health.';
      case 'turbidity': return 'Water is clear. Visibility and gill health are normal.';
      case 'dissolved_oxygen': return 'Oxygen levels are healthy. Fish are breathing normally.';
      case 'avg_speed': return 'Tank activity is normal. Fish are actively swimming.';
      default: return 'Sensor reading is optimal.';
    }
  }

  if (status === 'warning') {
    switch (key) {
      case 'ph': return value < min + (max - min) * 0.1 ? 'Water is getting slightly acidic.' : 'Water is becoming slightly alkaline.';
      case 'temperature': return value < min + (max - min) * 0.1 ? 'Water is cooling. Activity may slow.' : 'Water is warming up. Watch oxygen.';
      case 'turbidity': return 'Water is becoming cloudy. Check the filter.';
      case 'dissolved_oxygen': return value < min + (max - min) * 0.1 ? 'Oxygen is getting low. Monitor closely.' : 'Oxygen is unusually high.';
      case 'avg_speed': return value < min + (max - min) * 0.1 ? 'Fish are becoming lethargic.' : 'Fish are unusually frantic.';
      default: return 'Sensor reading is approaching limits.';
    }
  }

  // critical
  switch (key) {
    case 'ph': return value < min ? 'Dangerously acidic. Immediate correction needed.' : 'Dangerously alkaline. Immediate correction needed.';
    case 'temperature': return value < min ? 'Water is too cold. Risk of shock.' : 'Overheating. Oxygen levels will drop rapidly.';
    case 'turbidity': return 'Severely cloudy. Fish gills may be at risk.';
    case 'dissolved_oxygen': return value < min ? 'Critically low oxygen. Fish are suffocating.' : 'Dangerously high oxygen.';
    case 'avg_speed': return value < min ? 'Zero or critical low activity. Check life support immediately!' : 'Severe stress/frenzy detected.';
    default: return 'Critical sensor threshold breached.';
  }
}

export function getAlertMessages(states: SensorStates): string[] {
  const messages: string[] = [];
  for (const state of Object.values(states)) {
    if (state.status === 'critical') {
      messages.push(`${state.label} is critical (${state.value.toFixed(1)} ${state.unit}). Immediate action required.`);
    } else if (state.status === 'warning') {
      messages.push(`${state.label} is approaching unsafe levels (${state.value.toFixed(1)} ${state.unit}).`);
    }
  }
  return messages;
}