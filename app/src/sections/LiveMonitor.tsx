import { useState } from 'react';
import { getSensorStatusText, getAlertMessages, THRESHOLDS } from '@/lib/sensors';

interface LiveMonitorProps {
  sensorStates: any;
  telemetry?: any;
  logs?: any[];
}

const STREAM_URL = import.meta.env.VITE_STREAM_URL ?? '';

const SENSOR_ORDER = ['ph', 'temperature', 'turbidity', 'dissolved_oxygen', 'avg_speed'];

function formatUptime(seconds?: number) {
  if (!seconds) return '--h --m';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
  return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
}

// Apple-style status colors
function getStatusColor(status: string) {
  if (status === 'safe' || status === 'online') return '#34c759'; // Apple Green
  if (status === 'warning') return '#ff9500'; // Apple Orange
  return '#ff3b30'; // Apple Red
}

function SensorCard({ sensorKey, states }: { sensorKey: string; states: any }) {
  const state = states[sensorKey];

  if (!state) {
    return (
      <div className="bg-white border border-black/5 shadow-sm rounded-[6px] p-4 flex flex-col justify-between h-full min-h-[140px] animate-pulse">
        <div className="h-3 bg-al-light-gray/50 rounded-[3px] w-1/3 mb-2" />
        <div className="h-8 bg-al-light-gray/50 rounded-[3px] w-1/2 mx-auto my-2" />
        <div className="h-2 bg-al-light-gray/50 rounded-[3px] w-full mt-auto" />
      </div>
    );
  }

  const thresh = THRESHOLDS[sensorKey] || { unit: '' };
  const statusText = getSensorStatusText(sensorKey, state.status, state.rollingAvg);
  const statusColor = getStatusColor(state.status);

  return (
    <div className="bg-white border border-black/5 shadow-sm rounded-[6px] p-4 flex flex-col justify-between h-full min-h-[140px] transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-al-mid-gray tracking-tight">
          {state.label}
        </span>
        <div
          style={{ backgroundColor: statusColor }}
          className={`w-2 h-2 rounded-full shadow-sm ${state.status === 'critical' ? 'animate-critical-pulse' : ''}`}
        />
      </div>

      <div className="flex items-baseline gap-1 justify-center flex-1 py-2">
        <span className="font-sans text-3xl font-semibold tracking-tight text-al-near-black tabular-nums">
          {state.value.toFixed(sensorKey === 'ph' ? 2 : 1)}
        </span>
        <span className="font-sans text-[13px] font-medium text-al-mid-gray leading-none">
          {thresh.unit}
        </span>
      </div>

      <div className="mt-2 pt-3 border-t border-al-light-gray/50">
        <p className="text-[12px] text-al-mid-gray leading-tight line-clamp-2">
          {statusText}
        </p>
      </div>
    </div>
  );
}

export default function LiveMonitor({ sensorStates, telemetry, logs }: LiveMonitorProps) {
  const [streamStatus, setStreamStatus] = useState<'online' | 'offline'>(STREAM_URL ? 'online' : 'offline');

  const alerts = getAlertMessages(sensorStates || {});
  const hasAlert = alerts.length > 0;
  const latestLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;
  const fishCount = latestLog?.fish_count;

  return (
    <div className="max-w-[1400px] mx-auto w-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Redesigned Apple-Style Alert Log */}
        {hasAlert && (
          <div
            role="alert"
            className="col-span-full border border-[#ff3b30]/30 bg-white rounded-[8px] p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-[#ff3b30] shadow-sm animate-critical-pulse shrink-0" />
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-[#ff3b30] tracking-tight">System Critical Alerts</span>
                <ul className="flex flex-col gap-1.5">
                  {alerts.map((msg, i) => (
                    <li key={i} className="text-[13px] font-medium text-al-near-black tracking-tight flex items-start gap-2">
                      <span className="text-[#ff3b30] font-bold mt-0.5">•</span>
                      <span>{msg}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Video Feed — Apple Style Structure */}
        <div className="col-span-full lg:col-span-2 lg:row-span-2 bg-white border border-black/5 shadow-sm rounded-[6px] overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-al-light-gray/50 flex items-center justify-between bg-white z-20">
            <span className="text-[13px] font-medium text-al-near-black tracking-tight">
              Live Monitor
            </span>
            <div className="flex items-center gap-2 px-2.5 py-1 bg-al-light-gray/30 rounded-[4px]">
              <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: getStatusColor(streamStatus) }} />
              <span className="text-[11px] font-medium text-al-dark-gray uppercase tracking-wider">
                {streamStatus === 'online' ? 'Linked' : 'Offline'}
              </span>
            </div>
          </div>

          {/* RESTORED: Dark Mode Monitor Screen Fallback */}
          <div className="relative aspect-video w-full bg-black">

            {/* Fallback UI: Lives BEHIND the video */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-0">
              <div className="w-10 h-10 border border-white/10 bg-[#1c1c1e] flex items-center justify-center rounded-[8px] shadow-sm text-[#86868b]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <span className="text-[12px] font-medium text-[#86868b] tracking-wide">
                {STREAM_URL ? 'Connecting to Stream...' : 'No Stream Configured'}
              </span>
            </div>

            {/* Live MJPEG Stream */}
            {STREAM_URL && (
              <img
                src={STREAM_URL}
                alt="Live tank feed"
                className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 ${streamStatus === 'offline' ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setStreamStatus('online')}
                onError={() => setStreamStatus('offline')}
              />
            )}
          </div>
        </div>

        {/* Dynamic Sensor Cards Grid */}
        {SENSOR_ORDER.map((key) => (
          <div key={key} className="col-span-1">
            <SensorCard sensorKey={key} states={sensorStates} />
          </div>
        ))}

        {/* Behavioral & System Intelligence Dashboard - Apple Style with Dividers */}
        <div className="col-span-full lg:col-span-3 bg-white border border-black/5 shadow-sm rounded-[6px] p-5 flex flex-col justify-center animate-in fade-in duration-500">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[14px] font-medium text-al-near-black tracking-tight">
              Behavioral & System Intelligence
            </span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-50"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34c759] shadow-sm"></span>
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-x divide-al-light-gray/50">

            {/* Metric 1 */}
            <div className="flex flex-col pl-0">
              <span className="text-[12px] text-al-mid-gray tracking-wide mb-1">Tank Occupancy</span>
              <span className="text-[17px] font-semibold text-al-near-black tracking-tight">
                {fishCount != null ? `${fishCount} Detected` : 'Scanning...'}
              </span>
            </div>

            {/* Metric 2 */}
            <div className="flex flex-col pl-4">
              <span className="text-[12px] text-al-mid-gray tracking-wide mb-1">Vision Link</span>
              <span className={`text-[17px] font-semibold tracking-tight ${streamStatus === 'online' ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                {streamStatus === 'online' ? 'Active (YOLOv8)' : 'Signal Lost'}
              </span>
            </div>

            {/* Metric 3 */}
            <div className="flex flex-col pl-4">
              <span className="text-[12px] text-al-mid-gray tracking-wide mb-1">Edge Temp</span>
              <span className="text-[17px] font-semibold text-al-near-black tracking-tight tabular-nums">
                {telemetry?.core_temp ? `${telemetry.core_temp.toFixed(1)}°C` : '--°C'}
              </span>
            </div>

            {/* Metric 4 */}
            <div className="flex flex-col pl-4">
              <span className="text-[12px] text-al-mid-gray tracking-wide mb-1">System Uptime</span>
              <span className="text-[17px] font-semibold text-al-near-black tabular-nums tracking-tight">
                {formatUptime(telemetry?.uptime_seconds)}
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}