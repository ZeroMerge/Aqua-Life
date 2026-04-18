export type SensorStatus = 'safe' | 'warning' | 'critical';

export type SensorKey = 'ph' | 'temperature' | 'turbidity' | 'dissolved_oxygen' | 'avg_speed';

export interface SensorLog {
  id: number;
  ph?: number;
  temperature?: number;
  turbidity?: number;
  dissolved_oxygen?: number;
  avg_speed?: number;
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
