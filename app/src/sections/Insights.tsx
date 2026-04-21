import { useState, useMemo, useEffect, useRef } from 'react';
import {
    ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Card } from '@/components/ui/card';
import type { SensorLog } from '@/types/sensors';
import { format } from 'date-fns';

// 1. Updated Props to accept global time state from App.tsx
export type TimeWindow = '1h' | '3h' | '24h' | 'all';

interface InsightsProps {
    logs: SensorLog[];
    timeWindow: TimeWindow;
    setTimeWindow: (window: TimeWindow) => void;
}

// 2. Updated buttons to match the new smart-fetch intervals
const TIME_WINDOWS: { id: TimeWindow; label: string; ms: number }[] = [
    { id: '1h', label: '1 Hour', ms: 60 * 60 * 1000 },
    { id: '3h', label: '3 Hours', ms: 3 * 60 * 60 * 1000 },
    { id: '24h', label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
    { id: 'all', label: 'All Time', ms: Infinity },
];

function getHeatmapPalette() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8ClampedArray(0);

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "rgba(255, 255, 255, 0)");
    grad.addColorStop(0.15, "rgba(255, 255, 204, 0.8)");
    grad.addColorStop(0.4, "rgba(255, 237, 160, 1)");
    grad.addColorStop(0.65, "rgba(254, 178, 76, 1)");
    grad.addColorStop(0.85, "rgba(240, 59, 32, 1)");
    grad.addColorStop(1, "rgba(189, 0, 38, 1)");

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 256);
    return ctx.getImageData(0, 0, 1, 256).data;
}

// ---------------------------------------------------------
// COMPONENT: Ecosystem Tooltip (Diagnostic Brain)
// ---------------------------------------------------------
interface SynchronizedPoint {
    time: number;
    temp_continuous: number | undefined;
    temp_solid: number | null;
    temp_is_stale: boolean;
    ph_continuous: number | undefined;
    ph_solid: number | null;
    ph_is_stale: boolean;
    do_continuous: number | undefined;
    do_solid: number | null;
    do_is_stale: boolean;
    speed_continuous: number;
    speed_solid: number | null;
    speed_is_stale: boolean;
}

const EcosystemDiagnosticTooltip = ({ active, payload, speedThreshold }: { active?: boolean; payload?: { payload: SynchronizedPoint }[]; speedThreshold: number }) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    let status = "Ecosystem Stable";
    let statusColor = "bg-[#34c759]";
    let statusTextColor = "text-[#34c759]";

    const isTotallyOffline = data.temp_is_stale && data.do_is_stale && data.ph_is_stale && data.speed_is_stale;

    if (isTotallyOffline) {
        status = "Sensors Offline";
        statusColor = "bg-al-mid-gray";
        statusTextColor = "text-al-mid-gray";
    } else if ((data.do_continuous ?? 0) < 4.0 && data.speed_continuous > speedThreshold) {
        status = "Hypoxia Panic / Suffocation Risk";
        statusColor = "bg-[#ff3b30]";
        statusTextColor = "text-[#ff3b30]";
    } else if ((data.temp_continuous ?? 0) > 29.0 && (data.do_continuous ?? 0) < 5.0) {
        status = "Heat Stress / Depleted Oxygen";
        statusColor = "bg-[#ff9500]";
        statusTextColor = "text-[#ff9500]";
    } else if ((data.temp_continuous ?? 0) < 22.0) {
        status = "Cold Shock Risk";
        statusColor = "bg-[#007aff]";
        statusTextColor = "text-[#007aff]";
    } else if ((data.ph_continuous ?? 0) < 6.5 || (data.ph_continuous ?? 0) > 8.0) {
        status = "pH Imbalance";
        statusColor = "bg-[#ffcc00]";
        statusTextColor = "text-[#ffcc00]";
    } else if (data.speed_continuous > speedThreshold) {
        status = "Unexplained High Activity / Panic";
        statusColor = "bg-[#ff3b30]";
        statusTextColor = "text-[#ff3b30]";
    }

    return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-[8px] shadow-xl border border-black/5 min-w-[250px] z-50">
            <p className="text-[12px] font-bold text-al-mid-gray mb-3 border-b border-black/5 pb-2 uppercase tracking-wider">
                {format(new Date(data.time), 'MMM d, HH:mm:ss')}
            </p>

            <div className="grid grid-cols-2 gap-y-3 gap-x-4 mb-4">
                <div className="flex flex-col">
                    <span className="text-[11px] text-al-mid-gray">Temperature</span>
                    <div className="flex items-baseline gap-1">
                        {/* Dimming the bright colors with opacity-40 if the reading is stale */}
                        <span className={`text-[14px] font-semibold text-[#ff9500] ${data.temp_is_stale ? 'opacity-40' : ''}`}>
                            {data.temp_continuous?.toFixed(1) ?? '--'}°C
                        </span>
                        {data.temp_is_stale && <span className="text-[8px] text-al-mid-gray/50 uppercase font-bold tracking-wider">Stale</span>}
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-[11px] text-al-mid-gray">Oxygen</span>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-[14px] font-semibold text-[#32ade6] ${data.do_is_stale ? 'opacity-40' : ''}`}>
                            {data.do_continuous?.toFixed(1) ?? '--'} mg/L
                        </span>
                        {data.do_is_stale && <span className="text-[8px] text-al-mid-gray/50 uppercase font-bold tracking-wider">Stale</span>}
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-[11px] text-al-mid-gray">Water pH</span>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-[14px] font-semibold text-[#af52de] ${data.ph_is_stale ? 'opacity-40' : ''}`}>
                            {data.ph_continuous?.toFixed(2) ?? '--'}
                        </span>
                        {data.ph_is_stale && <span className="text-[8px] text-al-mid-gray/50 uppercase font-bold tracking-wider">Stale</span>}
                    </div>
                </div>
                <div className="flex flex-col">
                    <span className="text-[11px] text-al-mid-gray">Fish Speed</span>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-[14px] font-semibold text-al-near-black ${data.speed_is_stale ? 'opacity-40' : ''}`}>
                            {data.speed_continuous?.toFixed(1) ?? '--'} px/s
                        </span>
                        {data.speed_is_stale && <span className="text-[8px] text-al-mid-gray/50 uppercase font-bold tracking-wider">Stale</span>}
                    </div>
                </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-[6px] bg-black/5`}>
                <div className={`w-2 h-2 rounded-full shadow-sm ${statusColor} ${!isTotallyOffline ? 'animate-pulse' : ''}`} />
                <span className={`text-[12px] font-bold ${statusTextColor}`}>{status}</span>
            </div>
        </div>
    );
};

// 3. Main component now utilizes the global props
export default function Insights({ logs, timeWindow, setTimeWindow }: InsightsProps) {
    const [speedThreshold, setSpeedThreshold] = useState<number>(50);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // LIVE TICKER: Decouples the chart from the database so it scrolls in real-time
    const [ticker, setTicker] = useState(() => Date.now());
    useEffect(() => {
        const interval = setInterval(() => setTicker(Date.now()), 5000); // Ticks every 5s
        return () => clearInterval(interval);
    }, []);

    // 1. Force absolute chronological sort on all raw data
    const sortedRawLogs = useMemo(() => {
        return [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [logs]);

    // ---------------------------------------------------------
    // MASTER DATA SYNC: Combine Devices, Fill Gaps, Flag Stale Data
    // ---------------------------------------------------------
    const synchronizedData = useMemo(() => {
        if (sortedRawLogs.length === 0) return [];

        const activeTimeWindow = TIME_WINDOWS.find(w => w.id === timeWindow);
        const cutoffTime = timeWindow === 'all' ? 0 : ticker - (activeTimeWindow?.ms ?? Infinity);

        let initialTemp: number | undefined;
        let initialPh: number | undefined;
        let initialDo: number | undefined;
        let initialSpeed: number | undefined;

        for (let i = sortedRawLogs.length - 1; i >= 0; i--) {
            const logTime = new Date(sortedRawLogs[i].timestamp).getTime();
            if (logTime < cutoffTime) {
                if (initialTemp === undefined && sortedRawLogs[i].temperature != null) initialTemp = sortedRawLogs[i].temperature;
                if (initialPh === undefined && sortedRawLogs[i].ph != null) initialPh = sortedRawLogs[i].ph;
                if (initialDo === undefined && sortedRawLogs[i].dissolved_oxygen != null) initialDo = sortedRawLogs[i].dissolved_oxygen;
                if (initialSpeed === undefined && sortedRawLogs[i].avg_speed != null) initialSpeed = sortedRawLogs[i].avg_speed;
                if (initialTemp !== undefined && initialPh !== undefined && initialDo !== undefined && initialSpeed !== undefined) break;
            }
        }

        const activeLogs = sortedRawLogs.filter(log => new Date(log.timestamp).getTime() >= cutoffTime);
        const BUCKET_MS = 10000;

        interface Bucket {
            time: number;
            temp: number | null;
            ph: number | null;
            do: number | null;
            speed: number | null;
        }

        const buckets = new Map<number, Bucket>();

        activeLogs.forEach(log => {
            const time = new Date(log.timestamp).getTime();
            const bucketTime = Math.floor(time / BUCKET_MS) * BUCKET_MS;
            if (!buckets.has(bucketTime)) {
                buckets.set(bucketTime, { time: bucketTime, temp: null, ph: null, do: null, speed: null });
            }

            const b = buckets.get(bucketTime)!;
            if (log.temperature != null) b.temp = log.temperature;
            if (log.ph != null) b.ph = log.ph;
            if (log.dissolved_oxygen != null) b.do = log.dissolved_oxygen;
            if (log.avg_speed != null) b.speed = log.avg_speed;
        });

        const sortedBuckets = Array.from(buckets.values()).sort((a, b) => a.time - b.time);

        // INJECT THE PRESENT MOMENT: Forces the chart to pull exactly to the current clock time
        if (sortedBuckets.length > 0 && sortedBuckets[sortedBuckets.length - 1].time < ticker) {
            sortedBuckets.push({ time: ticker, temp: null, ph: null, do: null, speed: null });
        } else if (sortedBuckets.length === 0) {
            sortedBuckets.push({ time: ticker, temp: null, ph: null, do: null, speed: null });
        }

        interface SyncState {
            lastTemp: number | undefined;
            lastPh: number | undefined;
            lastDo: number | undefined;
            lastSpeed: number | undefined;
            points: SynchronizedPoint[];
        }

        // Map into Solid (Active) and Continuous (Dashed/Stale) datasets 
        // Using reduce to avoid reassigning outer scope variables inside map
        const finalState = sortedBuckets.reduce<SyncState>((acc, b) => {
            if (b.temp != null) acc.lastTemp = b.temp;
            if (b.ph != null) acc.lastPh = b.ph;
            if (b.do != null) acc.lastDo = b.do;
            if (b.speed != null) acc.lastSpeed = b.speed;

            acc.points.push({
                time: b.time,
                temp_continuous: acc.lastTemp,
                temp_solid: b.temp,
                temp_is_stale: b.temp == null,
                ph_continuous: acc.lastPh,
                ph_solid: b.ph,
                ph_is_stale: b.ph == null,
                do_continuous: acc.lastDo,
                do_solid: b.do,
                do_is_stale: b.do == null,
                speed_continuous: acc.lastSpeed !== undefined ? acc.lastSpeed : 0,
                speed_solid: b.speed,
                speed_is_stale: b.speed == null,
            });

            return acc;
        }, {
            lastTemp: initialTemp,
            lastPh: initialPh,
            lastDo: initialDo,
            lastSpeed: initialSpeed,
            points: []
        });

        return finalState.points;
    }, [sortedRawLogs, timeWindow, ticker]);

    const xDomain = useMemo(() => {
        if (timeWindow === 'all') return ['dataMin', 'dataMax'];
        const windowMs = TIME_WINDOWS.find(w => w.id === timeWindow)?.ms ?? Infinity;
        return [ticker - windowMs, ticker];
    }, [timeWindow, ticker]);

    const heatmapPoints = useMemo(() => {
        const cutoffTime = timeWindow === 'all' ? 0 : ticker - (TIME_WINDOWS.find(w => w.id === timeWindow)?.ms ?? Infinity);
        return sortedRawLogs
            .filter(l => l.x_pos != null && l.y_pos != null && new Date(l.timestamp).getTime() >= cutoffTime)
            .map(l => ({ x: l.x_pos as number, y: l.y_pos as number }));
    }, [sortedRawLogs, timeWindow, ticker]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);
        if (heatmapPoints.length === 0) return;

        const dynamicAlpha = Math.max(0.015, Math.min(0.2, 8 / heatmapPoints.length));

        heatmapPoints.forEach(point => {
            const x = (point.x / 100) * width;
            const y = (point.y / 100) * height;

            const grad = ctx.createRadialGradient(x, y, 0, x, y, 40);
            grad.addColorStop(0, `rgba(0, 0, 0, ${dynamicAlpha})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x, y, 40, 0, 2 * Math.PI);
            ctx.fill();
        });

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const palette = getHeatmapPalette();

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 0) {
                const paletteOffset = alpha * 4;
                const r = palette[paletteOffset];
                const g = palette[paletteOffset + 1];
                const b = palette[paletteOffset + 2];

                if (r !== undefined && g !== undefined && b !== undefined) {
                    data[i] = r;
                    data[i + 1] = g;
                    data[i + 2] = b;
                }
                data[i + 3] = alpha;
            }
        }
        ctx.putImageData(imgData, 0, 0);
    }, [heatmapPoints]);

    const maxSpeed = Math.max(...synchronizedData.map(d => d.speed_continuous), 1);
    const thresholdPercent = Math.max(0, Math.min(100, ((maxSpeed - speedThreshold) / maxSpeed) * 100));

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-[28px] font-semibold tracking-tight text-al-near-black">Ecosystem Trends</h2>
                    <p className="text-[15px] text-al-mid-gray max-w-2xl">
                        Organic behavior mapping and multi-sensor ecosystem diagnostics.
                    </p>
                </div>

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

                {/* 1. Scientific Thermal Heatmap */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px] flex flex-col relative overflow-hidden">
                    <div className="flex items-center justify-between mb-4 z-10">
                        <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest">Spatial Heat Map</h3>
                    </div>

                    {heatmapPoints.length === 0 && (
                        <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[2px] flex items-center justify-center p-8 text-center rounded-[6px]">
                            <p className="text-[13px] font-medium text-al-mid-gray">Waiting for AI tracking data...</p>
                        </div>
                    )}

                    <div className="flex flex-col w-full">
                        <div className="flex flex-row items-stretch w-full aspect-[4/3] max-h-[300px]">
                            <div className="flex flex-col justify-between items-end pr-2 py-1 border-r border-black/10 text-[10px] font-medium text-al-mid-gray w-8 shrink-0">
                                <span>0</span><span>50</span><span>100</span>
                            </div>
                            <div className="relative flex-1 bg-white border-y border-black/5 overflow-hidden">
                                <div className="absolute inset-0 pointer-events-none opacity-40" style={{ backgroundImage: 'radial-gradient(#8e8e93 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                                <canvas ref={canvasRef} width={640} height={480} className="relative z-10 w-full h-full object-contain mix-blend-multiply" />
                            </div>
                            <div className="w-10 flex flex-col items-center justify-between pl-2 border-l border-black/10 shrink-0 py-1">
                                <span className="text-[10px] font-medium text-al-mid-gray">High</span>
                                <div className="w-2.5 flex-1 my-2 rounded-[2px] bg-gradient-to-t from-[#ffffcc] via-[#fd8d3c] to-[#bd0026] border border-black/5 shadow-inner"></div>
                                <span className="text-[10px] font-medium text-al-mid-gray">Low</span>
                            </div>
                        </div>
                        <div className="flex flex-row w-full pl-8 pr-10 mt-1.5 text-[10px] font-medium text-al-mid-gray justify-between">
                            <span>0</span><span>50</span><span>100</span>
                        </div>
                    </div>
                </Card>

                {/* 2. Dynamic Threshold Timeline (Fish Speed) */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest">Average Speed Over Time</h3>

                        <div className="flex items-center gap-2 bg-al-light-gray/30 px-3 py-1.5 rounded-[6px]">
                            <span className="text-[11px] font-bold text-al-dark-gray uppercase">Danger Limit:</span>
                            <input
                                type="number"
                                value={speedThreshold}
                                onChange={(e) => setSpeedThreshold(Number(e.target.value))}
                                className="w-14 bg-white border border-black/10 rounded-[4px] text-center text-[12px] font-medium text-al-near-black py-0.5 focus:outline-none focus:border-[#007aff]"
                            />
                            <span className="text-[11px] text-al-mid-gray">px/s</span>
                        </div>
                    </div>

                    <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={synchronizedData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSpeedBleed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ff3b30" stopOpacity={0.8} />
                                        <stop offset={`${thresholdPercent}%`} stopColor="#ff3b30" stopOpacity={0.6} />
                                        <stop offset={`${thresholdPercent}%`} stopColor="#007aff" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#007aff" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="time" type="number" scale="time" domain={xDomain} tickFormatter={(v) => format(new Date(v), 'HH:mm')} fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip isAnimationActive={false} labelFormatter={(v) => format(new Date(v), 'HH:mm:ss')} contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }} />
                                <ReferenceLine y={speedThreshold} stroke="#ff3b30" strokeDasharray="3 3" strokeWidth={1.5} opacity={0.6} />

                                {/* Dashed offline background trail */}
                                <Area type="monotone" dataKey="speed_continuous" stroke="url(#colorSpeedBleed)" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={0.5} fill="url(#colorSpeedBleed)" isAnimationActive={false} connectNulls />
                                {/* Solid active overlay */}
                                <Line type="monotone" dataKey="speed_solid" stroke="url(#colorSpeedBleed)" strokeWidth={2.5} connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 3. Layered Ecosystem Chart & Diagnostic Brain */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px] lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest">Combined Ecosystem State</h3>
                            <p className="text-[11px] text-al-mid-gray">Hover over the timeline to trigger the Diagnostic Tooltip. Dashed lines indicate sensor is offline.</p>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={synchronizedData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff9500" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#ff9500" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradDO" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#32ade6" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#32ade6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="time" type="number" scale="time" domain={xDomain} tickFormatter={(v) => format(new Date(v), 'HH:mm')} fontSize={10} axisLine={false} tickLine={false} />

                                <YAxis yAxisId="temp" domain={['dataMin - 2', 'dataMax + 2']} hide />
                                <YAxis yAxisId="do" domain={[0, 10]} hide />
                                <YAxis yAxisId="ph" domain={[5, 9]} hide />
                                <YAxis yAxisId="speed" domain={[0, 'dataMax']} hide />

                                <Tooltip content={<EcosystemDiagnosticTooltip speedThreshold={speedThreshold} />} isAnimationActive={false} />

                                {/* Temperature: Dashed Background + Solid Foreground */}
                                <Area yAxisId="temp" type="monotone" dataKey="temp_continuous" stroke="#ff9500" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#gradTemp)" isAnimationActive={false} connectNulls />
                                <Line yAxisId="temp" type="monotone" dataKey="temp_solid" stroke="#ff9500" strokeWidth={2.5} connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />

                                {/* Oxygen: Dashed Background + Solid Foreground */}
                                <Area yAxisId="do" type="monotone" dataKey="do_continuous" stroke="#32ade6" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#gradDO)" isAnimationActive={false} connectNulls />
                                <Line yAxisId="do" type="monotone" dataKey="do_solid" stroke="#32ade6" strokeWidth={2.5} connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />

                                {/* pH: Dashed Background + Solid Foreground */}
                                <Area yAxisId="ph" type="monotone" dataKey="ph_continuous" stroke="#af52de" strokeWidth={1.5} strokeDasharray="4 4" fill="none" isAnimationActive={false} connectNulls />
                                <Line yAxisId="ph" type="monotone" dataKey="ph_solid" stroke="#af52de" strokeWidth={2.5} connectNulls={false} dot={false} activeDot={false} isAnimationActive={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

            </div>
        </div>
    );
}