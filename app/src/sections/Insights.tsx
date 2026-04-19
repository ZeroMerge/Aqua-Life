import { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Card } from '@/components/ui/card';
import type { SensorLog } from '@/types/sensors';

interface InsightsProps {
    logs: SensorLog[];
}

type TimeWindow = '24h' | '7d' | 'all';
type ScatterAxis = 'temperature' | 'ph' | 'dissolved_oxygen';

const TIME_WINDOWS: { id: TimeWindow; label: string; ms: number }[] = [
    { id: '24h', label: 'Last 24 Hours', ms: 24 * 60 * 60 * 1000 },
    { id: '7d', label: 'Last 7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
    { id: 'all', label: 'All Time', ms: Infinity },
];

export default function Insights({ logs }: InsightsProps) {
    const [timeWindow, setTimeWindow] = useState<TimeWindow>('24h');
    const [scatterAxis, setScatterAxis] = useState<ScatterAxis>('temperature');

    // Filter logs based on the selected time window
    const filteredLogs = useMemo(() => {
        if (logs.length === 0) return [];
        if (timeWindow === 'all') return logs;

        const latestTime = new Date(logs[logs.length - 1].timestamp).getTime();
        const windowMs = TIME_WINDOWS.find(w => w.id === timeWindow)?.ms ?? Infinity;
        const cutoffTime = latestTime - windowMs;

        return logs.filter(log => new Date(log.timestamp).getTime() >= cutoffTime);
    }, [logs, timeWindow]);

    const hasTrackingData = useMemo(() => filteredLogs.some(l => l.x_pos != null), [filteredLogs]);

    // 1. Heatmap Data Processing (10x10 grid) - Now uses filteredLogs
    const heatmapData = useMemo(() => {
        const grid = Array(10).fill(0).map(() => Array(10).fill(0));
        filteredLogs.forEach(log => {
            if (log.x_pos != null && log.y_pos != null) {
                const x = Math.floor(Math.min(log.x_pos, 99) / 10);
                const y = Math.floor(Math.min(log.y_pos, 99) / 10);
                grid[y][x] += 1;
            }
        });
        return grid;
    }, [filteredLogs]);

    // 2. Average Fish Speed Processing - Now uses filteredLogs
    const rhythmData = useMemo(() => {
        const hourlyMap: Record<number, { count: number, totalSpeed: number }> = {};
        filteredLogs.forEach(log => {
            const hour = new Date(log.timestamp).getHours();
            if (!hourlyMap[hour]) hourlyMap[hour] = { count: 0, totalSpeed: 0 };

            if (log.avg_speed != null && log.avg_speed > 0) {
                hourlyMap[hour].totalSpeed += log.avg_speed;
                hourlyMap[hour].count += 1;
            }
        });

        return Array.from({ length: 24 }, (_, i) => ({
            hour: `${i}:00`,
            speed: hourlyMap[i] && hourlyMap[i].count > 0
                ? (hourlyMap[i].totalSpeed / hourlyMap[i].count).toFixed(1)
                : 0
        }));
    }, [filteredLogs]);

    // 3. Dynamic Scatter Chart (Speed vs Chosen Metric) - Now uses filteredLogs
    const correlationData = useMemo(() => {
        const paired = [];
        let lastKnownMetric: number | null = null;

        for (const log of filteredLogs) {
            // Update the carried metric based on user selection
            if (log[scatterAxis] != null) {
                lastKnownMetric = log[scatterAxis] as number;
            }
            if (log.avg_speed != null && lastKnownMetric != null && log.avg_speed > 0) {
                paired.push({
                    x: lastKnownMetric,
                    y: log.avg_speed,
                });
            }
        }

        // Limit to 150 points so the chart doesn't become a massive unreadable blob
        return paired.slice(-150);
    }, [filteredLogs, scatterAxis]);

    // Helper to format axis labels dynamically
    const getAxisConfig = () => {
        switch (scatterAxis) {
            case 'ph': return { name: 'Water pH', unit: ' pH', domain: [6, 8.5] };
            case 'dissolved_oxygen': return { name: 'Dissolved Oxygen', unit: ' mg/L', domain: ['auto', 'auto'] };
            default: return { name: 'Water Temperature', unit: '°C', domain: ['auto', 'auto'] };
        }
    };

    const axisConfig = getAxisConfig();

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-[28px] font-semibold tracking-tight text-al-near-black">Life Trends</h2>
                    <p className="text-[15px] text-al-mid-gray max-w-2xl">
                        Understanding how your fish interact with their environment over time.
                    </p>
                </div>

                {/* Global Time Window Filter */}
                <div className="flex p-1 bg-al-light-gray/50 rounded-[6px] w-fit border border-black/5 shrink-0">
                    {TIME_WINDOWS.map((tw) => (
                        <button
                            key={tw.id}
                            onClick={() => setTimeWindow(tw.id)}
                            className={`px-4 py-1.5 text-[13px] font-medium rounded-[6px] transition-all duration-300 ${timeWindow === tw.id
                                ? 'bg-white text-al-near-black shadow-sm'
                                : 'text-al-mid-gray hover:text-al-near-black'
                                }`}
                        >
                            {tw.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Average Fish Speed (Area Chart) */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px]">
                    <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest mb-6">Average Fish Speed (24hr Cycle)</h3>
                    <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={rhythmData}>
                                <defs>
                                    <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#007aff" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#007aff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="hour" fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip
                                    isAnimationActive={false}
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="speed"
                                    stroke="#007aff"
                                    strokeWidth={2.5}
                                    fillOpacity={1}
                                    fill="url(#colorSpeed)"
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Favorite Spots (Heatmap) */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px] flex flex-col relative overflow-hidden">
                    <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest mb-6">Favorite Spots (Heatmap)</h3>

                    {!hasTrackingData && (
                        <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center p-8 text-center rounded-[6px]">
                            <p className="text-[13px] font-medium text-al-mid-gray">Waiting for AI tracking data...<br /><span className="text-[11px] opacity-60">Frequented areas will appear here shortly.</span></p>
                        </div>
                    )}

                    <div className="flex-1 flex items-center justify-center p-4">
                        <div className="grid grid-cols-10 gap-0.5 border border-black/5 bg-[#f5f5f7] p-1 rounded-[4px] aspect-video w-full">
                            {heatmapData.flat().map((val, i) => {
                                const maxVal = Math.max(...heatmapData.flat(), 1);
                                const intensity = (val / maxVal);
                                return (
                                    <div
                                        key={i}
                                        className="w-full h-full rounded-[1px] transition-all duration-1000"
                                        style={{ backgroundColor: val > 0 ? `rgba(0, 122, 255, ${Math.max(intensity, 0.15)})` : 'transparent' }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                    <p className="text-[11px] text-al-mid-gray mt-4 text-center">Darker blue indicates where your fish spend the most time.</p>
                </Card>

                {/* Dynamic Scatter Chart (Speed vs Metric) */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px] lg:col-span-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest">Fish Speed vs. Water Chemistry</h3>

                        {/* Interactive Axis Selector */}
                        <div className="flex gap-2">
                            {(['temperature', 'ph', 'dissolved_oxygen'] as ScatterAxis[]).map(axis => (
                                <button
                                    key={axis}
                                    onClick={() => setScatterAxis(axis)}
                                    className={`text-[12px] px-3 py-1 rounded-[4px] transition-colors ${scatterAxis === axis
                                            ? 'bg-[#007aff] text-white font-medium'
                                            : 'bg-al-light-gray/30 text-al-mid-gray hover:text-al-near-black'
                                        }`}
                                >
                                    {axis === 'temperature' ? 'Temp' : axis === 'ph' ? 'pH' : 'Oxygen'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    type="number"
                                    dataKey="x"
                                    name={axisConfig.name}
                                    unit={axisConfig.unit}
                                    fontSize={10}
                                    axisLine={false}
                                    tickLine={false}
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    domain={axisConfig.domain as any}
                                />
                                <YAxis
                                    type="number"
                                    dataKey="y"
                                    name="Speed"
                                    unit=" px/s"
                                    fontSize={10}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <ZAxis type="number" range={[60, 60]} />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    isAnimationActive={false}
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                                />
                                <Scatter
                                    name="Logs"
                                    data={correlationData}
                                    fill="#007aff"
                                    fillOpacity={0.5}
                                    isAnimationActive={false}
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

            </div>
        </div>
    );
}