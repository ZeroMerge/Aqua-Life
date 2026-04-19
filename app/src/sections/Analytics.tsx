import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { SensorLog, SensorStates, SensorKey } from '@/types/sensors';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { THRESHOLDS } from '@/lib/sensors';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AnalyticsProps {
  logs: SensorLog[];
  sensorStates: SensorStates;
}

type TimeWindow = '15m' | '1h' | '6h' | 'all';

const TIME_WINDOWS: { id: TimeWindow; label: string; ms: number }[] = [
  { id: '15m', label: '15 Min', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 Hour', ms: 60 * 60 * 1000 },
  { id: '6h', label: '6 Hours', ms: 6 * 60 * 60 * 1000 },
  { id: 'all', label: 'All Time', ms: Infinity },
];

const SENSOR_CONFIG: { key: SensorKey; label: string; decimals: number }[] = [
  { key: 'ph', label: 'Water PH', decimals: 2 },
  { key: 'temperature', label: 'Water Temperature', decimals: 1 },
  { key: 'turbidity', label: 'Water Turbidity', decimals: 1 },
  { key: 'dissolved_oxygen', label: 'Oxygen Level', decimals: 1 },
];

export default function Analytics({ logs }: AnalyticsProps) {
  const [window, setWindow] = useState<TimeWindow>('15m');

  // Map string timestamps to numeric milliseconds for Recharts zooming
  const chartData = useMemo(() => {
    return logs.map(log => ({
      ...log,
      timeMs: new Date(log.timestamp).getTime()
    }));
  }, [logs]);

  // Calculate strict domain boundaries for the X-Axis
  const { filteredData, xDomain } = useMemo(() => {
    if (chartData.length === 0) return { filteredData: [], xDomain: ['auto', 'auto'] };

    const latestTime = chartData[chartData.length - 1].timeMs;

    if (window === 'all') {
      return { filteredData: chartData, xDomain: ['dataMin', 'dataMax'] };
    }

    const windowMs = TIME_WINDOWS.find(w => w.id === window)?.ms ?? Infinity;
    const minTime = latestTime - windowMs;

    const filtered = chartData.filter(d => d.timeMs >= minTime);

    return {
      filteredData: filtered,
      xDomain: [minTime, latestTime]
    };
  }, [chartData, window]);

  const CustomTooltip = ({ active, payload, label }: TooltipProps<ValueType, NameType>) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel px-4 py-3 rounded-[6px] flex flex-col gap-1">
          <span className="text-[12px] font-medium text-al-mid-gray">
            {format(new Date(label), 'HH:mm:ss')}
          </span>
          <span className="text-[15px] font-semibold text-al-near-black">
            {Number(payload[0].value).toFixed(payload[0].payload.decimals || 2)}
          </span>
        </div>
      );
    }
    return null;
  };

  function SensorChart({ sensorKey, label, decimals }: { sensorKey: SensorKey; label: string; decimals: number }) {
    const thresh = THRESHOLDS[sensorKey];

    return (
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] text-al-dark-gray font-bold uppercase tracking-widest">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5ea" />
                <XAxis
                  dataKey="timeMs"
                  type="number"
                  scale="time"
                  domain={xDomain}
                  tickFormatter={(val) => format(new Date(val), 'HH:mm')}
                  stroke="#8e8e93"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  domain={['dataMin - 1', 'auto']}
                  stroke="#8e8e93"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val.toFixed(decimals)}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={thresh.max} stroke="#ff3b30" strokeDasharray="3 3" opacity={0.5} />
                <ReferenceLine y={thresh.min} stroke="#ff3b30" strokeDasharray="3 3" opacity={0.5} />
                <Line
                  type="monotone"
                  dataKey={sensorKey}
                  stroke="#007aff"
                  strokeWidth={3}
                  dot={false}
                  isAnimationActive={false} // Prevents jarring redraws on live updates
                  activeDot={{ r: 6, fill: "#007aff", stroke: "#ffffff", strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
        <div className="flex p-1 bg-al-light-gray/50 rounded-[6px] w-fit border border-black/5">
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw.id}
              onClick={() => setWindow(tw.id)}
              className={`px-4 py-1.5 text-[13px] font-medium rounded-[6px] transition-all duration-300 ${window === tw.id
                ? 'bg-white text-al-near-black shadow-sm'
                : 'text-al-mid-gray hover:text-al-near-black'
                }`}
            >
              {tw.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 px-4 py-1.5 bg-al-safe/10 text-al-safe rounded-[6px] w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-al-safe animate-pulse" />
          <span className="text-[13px] font-medium">
            {filteredData.length} Live Readings
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {SENSOR_CONFIG.map((config) => (
          <SensorChart
            key={config.key}
            sensorKey={config.key}
            label={config.label}
            decimals={config.decimals}
          />
        ))}
      </div>
    </div>
  );
}