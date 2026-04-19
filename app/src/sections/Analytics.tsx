import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { SensorLog, SensorStates, SensorKey } from '@/types/sensors';
import { THRESHOLDS } from '@/lib/sensors';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

interface AnalyticsProps {
  logs: SensorLog[];
  sensorStates: SensorStates;
}

interface ChartDataPoint extends SensorLog {
  timeMs: number;
  sma?: number;
  sma_forecast?: number;
  isForecast?: boolean;
}

type TimeWindow = '15m' | '1h' | '6h' | 'all';

const TIME_WINDOWS: { id: TimeWindow; label: string; ms: number }[] = [
  { id: '15m', label: '15 Min', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 Hour', ms: 60 * 60 * 1000 },
  { id: '6h', label: '6 Hours', ms: 6 * 60 * 60 * 1000 },
  { id: 'all', label: 'All Time', ms: Infinity },
];

// Re-integrated contextual colors for clear Trendline visibility
const SENSOR_CONFIG: { key: SensorKey; label: string; decimals: number; color: string }[] = [
  { key: 'ph', label: 'Water pH', decimals: 2, color: '#00c7be' },
  { key: 'temperature', label: 'Water Temperature', decimals: 1, color: '#ff9500' },
  { key: 'turbidity', label: 'Water Turbidity', decimals: 1, color: '#d1a054' },
  { key: 'dissolved_oxygen', label: 'Oxygen Level', decimals: 1, color: '#32ade6' },
];

export default function Analytics({ logs }: AnalyticsProps) {
  const [window, setWindow] = useState<TimeWindow>('15m');

  const chartData = useMemo(() => {
    return logs.map(log => ({
      ...log,
      timeMs: new Date(log.timestamp).getTime()
    }));
  }, [logs]);

  // Extended X-Axis to create empty space on the right for the Forecast
  const { filteredData, xDomain } = useMemo(() => {
    if (chartData.length === 0) return { filteredData: [], xDomain: ['auto', 'auto'] };

    const latestTime = chartData[chartData.length - 1].timeMs;

    if (window === 'all') {
      const minTime = chartData[0].timeMs;
      const span = latestTime - minTime;
      return { filteredData: chartData, xDomain: [minTime, latestTime + (span * 0.1)] };
    }

    const windowMs = TIME_WINDOWS.find(w => w.id === window)?.ms ?? Infinity;
    const minTime = latestTime - windowMs;
    // Add 15% extra time to the right side of the chart to project the future
    const futureTime = latestTime + (windowMs * 0.15);

    const filtered = chartData.filter(d => d.timeMs >= minTime);

    return {
      filteredData: filtered,
      xDomain: [minTime, futureTime]
    };
  }, [chartData, window]);

// Custom Tooltip that ignores the 'sma' lines and only reads actual data
const CustomTooltip = ({ active, payload, label, decimals, color }: TooltipProps<ValueType, NameType> & { decimals: number; color: string }) => {
  if (active && payload && payload.length) {
    const activeData = payload.find((p) => p.dataKey !== 'sma' && p.dataKey !== 'sma_forecast') || payload[0];
    if (activeData.value == null) return null; // Don't show tooltip in the future empty space

    return (
      <div className="bg-white/95 backdrop-blur-md px-4 py-3 rounded-[6px] flex flex-col gap-1 shadow-xl border border-black/5">
        <span className="text-[12px] font-bold text-al-mid-gray uppercase tracking-wider mb-1">
          {label ? format(new Date(label), 'HH:mm:ss') : ''}
        </span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[16px] font-semibold text-al-near-black tabular-nums">
            {Number(activeData.value).toFixed(decimals)}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

interface SensorChartProps {
  sensorKey: SensorKey;
  label: string;
  decimals: number;
  color: string;
  filteredData: ChartDataPoint[];
  xDomain: [number, number] | ['auto', 'auto'];
}

function SensorChart({ sensorKey, label, decimals, color, filteredData, xDomain }: SensorChartProps) {
  const thresh = THRESHOLDS[sensorKey];

  // The Diagnostic Brain: Calculate Simple Moving Average and Forward Projection
  const chartDataWithTrend = useMemo(() => {
    const SMA_PERIODS = 5; // 5-tick rolling average to filter noise

    const processed: ChartDataPoint[] = filteredData.map((d, index, arr) => {
      let sma = undefined;
      if (index >= SMA_PERIODS - 1) {
        let sum = 0;
        let validCount = 0;
        for (let i = 0; i < SMA_PERIODS; i++) {
          const val = arr[index - i][sensorKey];
          if (typeof val === 'number') {
            sum += val;
            validCount++;
          }
        }
        sma = validCount > 0 ? sum / validCount : undefined;
      }
      return { ...d, sma };
    });

    // Calculate Future Projection slope
    const validSmas = processed.filter(p => p.sma !== undefined);
    if (validSmas.length > 5 && xDomain[1] !== 'auto') {
      const p2 = validSmas[validSmas.length - 1]; // Latest smoothed point
      const p1 = validSmas[validSmas.length - 5]; // Point 5 ticks ago to find trajectory

      if (p2.timeMs > p1.timeMs) {
        const slope = (p2.sma! - p1.sma!) / (p2.timeMs - p1.timeMs);
        const futureTime = xDomain[1] as number;
        const futurePrediction = p2.sma! + (slope * (futureTime - p2.timeMs));

        // Attach the forecast start point to the latest SMA point so the line connects cleanly
        p2.sma_forecast = p2.sma;

        // Push the empty future state to force the line to render forward
        processed.push({
          id: -1,
          timestamp: new Date(futureTime).toISOString(),
          timeMs: futureTime,
          [sensorKey]: undefined,
          sma: undefined,
          sma_forecast: futurePrediction,
          isForecast: true
        } as ChartDataPoint);
      }
    }
    return processed;
  }, [filteredData, sensorKey, xDomain]);


  return (
    <Card className="w-full relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[13px] text-al-dark-gray font-bold uppercase tracking-widest">{label}</CardTitle>
          <span className="text-[10px] font-bold text-al-mid-gray bg-al-light-gray/50 px-2 py-0.5 rounded-[4px]">
            + FORECAST
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartDataWithTrend}
              margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="timeMs"
                type="number"
                scale="time"
                domain={xDomain}
                tickFormatter={(val) => format(new Date(val), 'HH:mm')}
                stroke="#8e8e93"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                stroke="#8e8e93"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val.toFixed(decimals)}
              />

              <Tooltip content={<CustomTooltip decimals={decimals} color={color} />} isAnimationActive={false} />

              <ReferenceLine y={thresh.max} stroke="#ff3b30" strokeDasharray="3 3" strokeWidth={1.5} opacity={0.4} />
              <ReferenceLine y={thresh.min} stroke="#ff3b30" strokeDasharray="3 3" strokeWidth={1.5} opacity={0.4} />

              {/* 1. Raw Data (Noisy & Faded in Background) */}
              <Line
                type="monotone"
                dataKey={sensorKey}
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.25}
                dot={false}
                isAnimationActive={false}
              />

              {/* 2. Simple Moving Average (Smooth & Bold) */}
              <Line
                type="monotone"
                dataKey="sma"
                stroke={color}
                strokeWidth={3.5}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 5, fill: color, stroke: "#ffffff", strokeWidth: 2 }}
              />

              {/* 3. Future Trendline Projection (Dashed into empty space) */}
              <Line
                type="monotone"
                dataKey="sma_forecast"
                stroke={color}
                strokeWidth={3.5}
                strokeDasharray="6 6"
                strokeOpacity={0.7}
                dot={false}
                isAnimationActive={false}
                activeDot={false}
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
        <div className="flex items-center gap-2 px-4 py-1.5 bg-[#007aff]/10 text-[#007aff] rounded-[6px] w-fit border border-[#007aff]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#007aff] animate-pulse" />
          <span className="text-[12px] font-bold uppercase tracking-wider">
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
            color={config.color}
            filteredData={filteredData}
            xDomain={xDomain as [number, number]}
          />
        ))}
      </div>
    </div>
  );
}