export type SensorStatus = 'safe' | 'warning' | 'critical';

export type SensorKey = 'ph' | 'temperature' | 'turbidity' | 'dissolved_oxygen' | 'avg_speed' | 'fish_count';

export interface SensorLog {
  id: number;
  ph?: number;
  temperature?: number;
  turbidity?: number;
  dissolved_oxygen?: number;
  avg_speed?: number;
  fish_count?: number;
  // x_pos and y_pos are for the Heatmap (0-100 normalized)
  x_pos?: number;
  y_pos?: number;
  timestamp: string;
}

export interface SensorState {
  key: SensorKey;
  label: string;
  value: number;
  unit: string;
  status: SensorStatus;
  rollingAvg: number;
}

export type SensorStates = Record<SensorKey, SensorState>;