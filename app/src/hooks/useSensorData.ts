import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { getSensorStatus, getSystemStatus, THRESHOLDS } from '@/lib/sensors';
import type { SensorLog, SensorStates, SystemTelemetry, SensorStatus, SensorKey } from '@/types/sensors';

const ROLLING_WINDOW = 5;

// Define the exact milliseconds for our new time windows
const TIME_WINDOWS = {
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

export type GlobalTimeWindow = keyof typeof TIME_WINDOWS | 'all';

function getLatestNonNull(logs: SensorLog[], key: string): number {
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i][key] != null) return Number(logs[i][key]);
  }
  return 0;
}

function computeRolling(logs: SensorLog[], key: string): number {
  const validLogs = logs.filter(l => l[key as keyof SensorLog] != null).slice(-ROLLING_WINDOW);
  if (validLogs.length === 0) return 0;
  return validLogs.reduce((sum, l) => sum + Number(l[key as keyof SensorLog]), 0) / validLogs.length;
}

function buildStates(
  logs: SensorLog[],
  customThresholds: Record<string, { min: number; max: number; unit: string; label: string; description: string }> = THRESHOLDS
): SensorStates {
  if (logs.length === 0) return {} as SensorStates;

  const keys: SensorKey[] = ['ph', 'temperature', 'turbidity', 'dissolved_oxygen', 'avg_speed', 'fish_count'];
  const states: Partial<SensorStates> = {};

  keys.forEach((key) => {
    const value = getLatestNonNull(logs, key);
    const rollingAvg = computeRolling(logs, key);
    const config = customThresholds[key] || THRESHOLDS[key];

    states[key] = {
      key,
      label: config?.label || key,
      unit: config?.unit || '',
      value,
      rollingAvg,
      status: getSensorStatus(key, rollingAvg, customThresholds),
    };
  });

  return states as SensorStates;
}

// We now pass the active time window into the hook
export function useSensorData(activeWindow: GlobalTimeWindow = '1h') {
  const [logs, setLogs] = useState<SensorLog[]>([]);
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [sensorStates, setSensorStates] = useState<SensorStates>({} as SensorStates);
  const [systemStatus, setSystemStatus] = useState<SensorStatus>('safe');

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase not configured in .env. Live tracking disabled.');
      return;
    }

    // 1. Fetch Dynamic Threshold Configs
    supabase.from('sensor_configs').select('*').then(({ data }) => {
      if (data) {
        data.forEach((conf: { sensor_key: SensorKey; min_val: number; max_val: number; unit: string; label: string; description: string }) => {
          THRESHOLDS[conf.sensor_key] = {
            min: Number(conf.min_val),
            max: Number(conf.max_val),
            unit: conf.unit,
            label: conf.label,
            description: conf.description
          };
        });
      }
    });

    // 2. Fetch Initial Hardware Telemetry
    supabase.from('system_telemetry').select('*').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setTelemetry(data[0]);
      });

    // 3. Smart Contextual Data Fetch (Fires every time the window changes)
    let query = supabase.from('sensor_logs').select('*').order('timestamp', { ascending: true });

    if (activeWindow !== 'all') {
      const windowMs = TIME_WINDOWS[activeWindow];
      const cutoffDate = new Date(Date.now() - windowMs).toISOString();
      query = query.gte('timestamp', cutoffDate);
    } else {
      // If "All Time", limit to 5000 to prevent browser crash
      query = query.limit(5000);
    }

    query.then(({ data }) => {
      if (data && data.length > 0) {
        setLogs(data);
        const states = buildStates(data, THRESHOLDS);
        setSensorStates(states);
        setSystemStatus(getSystemStatus(states));
      } else {
        // Clear out if window is empty
        setLogs([]);
      }
    });

    // 4. Real-time Subscriptions
    const sensorSub = supabase
      .channel('sensor_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_logs' }, (payload) => {
        setLogs((prev) => {
          // Enforce active window limit on live incoming data
          const next = [...prev, payload.new as SensorLog];
          let filteredNext = next;

          if (activeWindow !== 'all') {
            const cutoffTimeMs = Date.now() - TIME_WINDOWS[activeWindow];
            filteredNext = next.filter(l => new Date(l.timestamp).getTime() >= cutoffTimeMs);
          } else {
            // Keep a safety cap of 5000 logs even in "All Time" mode
            filteredNext = next.slice(-3000);
          }

          const states = buildStates(filteredNext, THRESHOLDS);
          setSensorStates(states);
          setSystemStatus(getSystemStatus(states));
          return filteredNext;
        });
      })
      .subscribe();

    const telemetrySub = supabase
      .channel('telemetry_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_telemetry' }, (payload) => {
        setTelemetry(payload.new as SystemTelemetry);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sensorSub);
      supabase.removeChannel(telemetrySub);
    };
    // Hook re-runs fetch exactly when activeWindow changes
  }, [activeWindow]);

  return { logs, sensorStates, systemStatus, telemetry };
}