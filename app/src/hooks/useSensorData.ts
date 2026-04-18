import { useState, useEffect } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { getSensorStatus, getSystemStatus, THRESHOLDS } from '@/lib/sensors';

const ROLLING_WINDOW = 5;
const INSIGHTS_LOGS = 1000; // Larger window for trend analysis

function getLatestNonNull(logs: any[], key: string): number {
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i][key] != null) return Number(logs[i][key]);
  }
  return 0;
}

function computeRolling(logs: any[], key: string): number {
  const validLogs = logs.filter(l => l[key] != null).slice(-ROLLING_WINDOW);
  if (validLogs.length === 0) return 0;
  return validLogs.reduce((sum, l) => sum + Number(l[key]), 0) / validLogs.length;
}

function buildStates(logs: any[], customThresholds: any = THRESHOLDS): any {
  if (logs.length === 0) return {};

  const keys = ['ph', 'temperature', 'turbidity', 'dissolved_oxygen', 'avg_speed', 'fish_count'];
  const states: any = {};

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

  return states;
}

export function useSensorData() {
  const [logs, setLogs] = useState<any[]>([]);
  const [telemetry, setTelemetry] = useState<any>(null);
  const [sensorStates, setSensorStates] = useState<any>({});
  const [systemStatus, setSystemStatus] = useState<any>('safe');

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('Supabase not configured in .env. Live tracking disabled.');
      return;
    }

    // 1. Fetch Dynamic Threshold Configs
    supabase.from('sensor_configs').select('*').then(({ data }) => {
      if (data) {
        data.forEach((conf: any) => {
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

    // 3. Fetch Sensor Logs (Increased limit for Insights)
    supabase.from('sensor_logs').select('*').order('timestamp', { ascending: false }).limit(INSIGHTS_LOGS)
      .then(({ data }) => {
        if (data && data.length > 0) {
          const sorted = [...data].reverse();
          setLogs(sorted);
          const states = buildStates(sorted, THRESHOLDS);
          setSensorStates(states);
          setSystemStatus(getSystemStatus(states));
        }
      });

    // 4. Real-time Subscriptions
    const sensorSub = supabase
      .channel('sensor_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_logs' }, (payload) => {
        setLogs((prev) => {
          const next = [...prev, payload.new].slice(-INSIGHTS_LOGS);
          const states = buildStates(next, THRESHOLDS);
          setSensorStates(states);
          setSystemStatus(getSystemStatus(states));
          return next;
        });
      })
      .subscribe();

    const telemetrySub = supabase
      .channel('telemetry_stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_telemetry' }, (payload) => {
        setTelemetry(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sensorSub);
      supabase.removeChannel(telemetrySub);
    };
  }, []);

  return { logs, sensorStates, systemStatus, telemetry };
}