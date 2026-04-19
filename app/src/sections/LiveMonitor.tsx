import { useState, useEffect } from 'react';
import { getSensorStatusText, getAlertMessages, THRESHOLDS } from '@/lib/sensors';
import type { SensorStates, SystemTelemetry, SensorLog, SensorState } from '@/types/sensors';

interface LiveMonitorProps {
  sensorStates: SensorStates;
  telemetry?: SystemTelemetry | null;
  logs?: SensorLog[];
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
  if (status === 'safe' || status === 'online') return '#34c759';
  if (status === 'warning') return '#ff9500';
  return '#ff3b30';
}

function SensorCard({ sensorKey, states }: { sensorKey: string; states: SensorStates }) {
  const state = states[sensorKey as keyof SensorStates] as SensorState | undefined;

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
    <div className="bg-white border border-black/5 shadow-sm rounded-[6px] p-3 sm:p-4 flex flex-col justify-between h-full min-h-[140px] transition-all duration-300">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-al-mid-gray tracking-tight">
          {state.label}
        </span>
        <div
          style={{ backgroundColor: statusColor }}
          className={`w-2 h-2 rounded-full shadow-sm ${state.status === 'critical' ? 'animate-critical-pulse' : ''}`}
        />
      </div>

      {/* FIXED: The flex-1 container now perfectly centers the nested baseline group */}
      <div className="flex items-center justify-center flex-1 py-2">
        <div className="flex items-baseline gap-1">
          <span className="font-sans text-3xl font-semibold tracking-tight text-al-near-black tabular-nums">
            {state.value.toFixed(sensorKey === 'ph' ? 2 : 1)}
          </span>
          <span className="font-sans text-[13px] font-medium text-al-mid-gray leading-none">
            {thresh.unit}
          </span>
        </div>
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
  const [retryKey, setRetryKey] = useState(0);
  const [isCinemaMode, setIsCinemaMode] = useState(false);

  // Allow Escape key to close Cinema Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCinemaMode) setIsCinemaMode(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCinemaMode]);

  const alerts = getAlertMessages(sensorStates || {});
  const hasAlert = alerts.length > 0;
  const latestLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;
  const fishCount = latestLog?.fish_count;

  return (
    <div className="max-w-[1400px] mx-auto w-full">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">

        {/* Alert Log */}
        {hasAlert && (
          <div
            role="alert"
            className="col-span-full border border-[#ff3b30]/30 bg-white rounded-[8px] p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300"
          >
            <div className="flex items-start gap-3">
              <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-[#ff3b30] shadow-sm animate-critical-pulse shrink-0" />
              <div className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold text-[#ff3b30] tracking-tight">Attention Required</span>
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

        {/* Invisible Placeholder to stop layout collapse when in Cinema Mode */}
        {isCinemaMode && <div className="hidden lg:block lg:col-span-3 lg:row-span-2" />}

        {/* Video Feed — with Cinema Mode toggle */}
        <div
          className={`flex flex-col transition-all duration-300 ${isCinemaMode
              ? 'fixed inset-0 z-[100] bg-black'
              : 'col-span-full lg:col-span-3 lg:row-span-2 bg-white border border-black/5 shadow-sm rounded-[6px] overflow-hidden'
            }`}
        >
          <div className={`px-4 py-2.5 flex items-center justify-between z-20 ${isCinemaMode ? 'bg-[#1c1c1e] border-b border-white/10 text-white' : 'border-b border-al-light-gray/50 bg-white text-al-near-black'
            }`}>
            <span className="text-[13px] font-medium tracking-tight">
              {isCinemaMode ? 'Aqua-Life Cinema Mode' : 'Live View'}
            </span>

            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-2.5 py-1 rounded-[4px] ${isCinemaMode ? 'bg-black/50' : 'bg-al-light-gray/30'}`}>
                <span className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: getStatusColor(streamStatus) }} />
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isCinemaMode ? 'text-white/70' : 'text-al-dark-gray'}`}>
                  {streamStatus === 'online' ? 'Linked' : 'Offline'}
                </span>
              </div>

              {/* Expand / Shrink Button */}
              <button
                onClick={() => setIsCinemaMode(!isCinemaMode)}
                className={`p-1.5 rounded-[4px] transition-colors ${isCinemaMode ? 'hover:bg-white/10 text-white' : 'hover:bg-al-light-gray/50 text-al-dark-gray'}`}
                title={isCinemaMode ? "Exit Fullscreen" : "Enter Cinema Mode"}
              >
                {isCinemaMode ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className={`relative w-full bg-black ${isCinemaMode ? 'flex-1' : 'aspect-video'}`}>

            {/* Fallback UI: Lives BEHIND the video */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-0">
              <div className="w-10 h-10 border border-white/10 bg-[#1c1c1e] flex items-center justify-center rounded-[8px] shadow-sm text-[#86868b]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              <span className="text-[12px] font-medium text-[#86868b] tracking-wide">
                {STREAM_URL ? 'Connecting to Camera...' : 'Camera Not Connected'}
              </span>
            </div>

            {/* Live MJPEG Stream with Active Pinging */}
            {STREAM_URL && (
              <img
                key={retryKey}
                src={`${STREAM_URL}?t=${retryKey}`}
                alt="Live tank feed"
                fetchPriority="high"
                decoding="async"
                className={`absolute inset-0 w-full h-full object-contain md:object-cover z-10 transition-opacity duration-300 ${streamStatus === 'offline' ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setStreamStatus('online')}
                onError={() => {
                  setStreamStatus('offline');
                  setTimeout(() => setRetryKey(prev => prev + 1), 3000);
                }}
              />
            )}
          </div>
        </div>

        {/* Dynamic Sensor Cards Grid */}
        {SENSOR_ORDER.map((key) => (
          <div key={key} className={`col-span-1 ${key === 'avg_speed' ? 'lg:col-span-2' : ''}`}>
            <SensorCard sensorKey={key} states={sensorStates} />
          </div>
        ))}

        {/* Behavioral & System Intelligence Dashboard */}
        <div className="col-span-full lg:col-span-3 bg-white border border-black/5 shadow-sm rounded-[6px] p-5 flex flex-col justify-center animate-in fade-in duration-500">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[14px] font-medium text-al-near-black tracking-tight">
              System Status
            </span>
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-50"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#34c759] shadow-sm"></span>
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 divide-y md:divide-y-0 md:divide-x divide-al-light-gray/50">

            <div className="flex flex-col pl-0 pt-0">
              <span className="text-[12px] text-al-mid-gray tracking-wide mb-1">Population</span>
              <span className="text-[17px] font-semibold text-al-near-black tracking-tight">
                {fishCount != null ? `${fishCount} Visible` : 'Detecting...'}
              </span>
            </div>

            <div className="flex flex-col pl-0 md:pl-4 pt-4 md:pt-0">
              <span className="text-[12px] text-al-mid-gray tracking-wide mb-1">Camera Connection</span>
              <span className={`text-[17px] font-semibold tracking-tight ${streamStatus === 'online' ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
                {streamStatus === 'online' ? 'Connected' : 'Offline'}
              </span>
            </div>

            <div className="flex flex-col pl-0 md:pl-4 pt-4 md:pt-0">
              <span className="text-[12px] text-al-mid-gray tracking-wide mb-1">Processor Heat</span>
              <span className="text-[17px] font-semibold text-al-near-black tracking-tight tabular-nums">
                {telemetry?.core_temp ? `${telemetry.core_temp.toFixed(1)}°C` : '--°C'}
              </span>
            </div>

            <div className="flex flex-col pl-0 md:pl-4 pt-4 md:pt-0">
              <span className="text-[12px] text-al-mid-gray tracking-wide mb-1">Operating Time</span>
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