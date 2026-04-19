import { useState, useMemo, useEffect, useRef } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Card } from '@/components/ui/card';
import type { SensorLog } from '@/types/sensors';
import { format } from 'date-fns';

interface InsightsProps {
    logs: SensorLog[];
}

type TimeWindow = '1h' | '24h' | '7d' | 'all';

const TIME_WINDOWS: { id: TimeWindow; label: string; ms: number }[] = [
    { id: '1h', label: 'Last 1 Hour', ms: 60 * 60 * 1000 },
    { id: '24h', label: 'Last 24 Hours', ms: 24 * 60 * 60 * 1000 },
    { id: '7d', label: 'Last 7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
    { id: 'all', label: 'All Time', ms: Infinity },
];

// Helper: Generates a 256-color thermal gradient array for the light-mode canvas heatmap
function getHeatmapPalette() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8ClampedArray(0);

    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    // Light Mode Thermal Palette (White -> Yellow -> Orange -> Red)
    grad.addColorStop(0, "rgba(255, 255, 255, 0)");      // Transparent base
    grad.addColorStop(0.15, "rgba(255, 255, 204, 0.8)"); // Pale Yellow
    grad.addColorStop(0.4, "rgba(255, 237, 160, 1)");    // Bright Yellow
    grad.addColorStop(0.65, "rgba(254, 178, 76, 1)");    // Orange
    grad.addColorStop(0.85, "rgba(240, 59, 32, 1)");     // Orange-Red
    grad.addColorStop(1, "rgba(189, 0, 38, 1)");         // Deep Red

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1, 256);
    return ctx.getImageData(0, 0, 1, 256).data;
}

// ---------------------------------------------------------
// COMPONENT: Ecosystem Tooltip (Diagnostic Brain)
// ---------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const EcosystemDiagnosticTooltip = ({ active, payload, speedThreshold }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;

    let status = "Ecosystem Stable";
    let statusColor = "bg-[#34c759]"; // Green
    let statusTextColor = "text-[#34c759]";

    if (data.do < 4.0 && data.speed > speedThreshold) {
        status = "Hypoxia Panic / Suffocation Risk";
        statusColor = "bg-[#ff3b30]";
        statusTextColor = "text-[#ff3b30]";
    } else if (data.temp > 29.0 && data.do < 5.0) {
        status = "Heat Stress / Depleted Oxygen";
        statusColor = "bg-[#ff9500]";
        statusTextColor = "text-[#ff9500]";
    } else if (data.temp < 22.0) {
        status = "Cold Shock Risk";
        statusColor = "bg-[#007aff]";
        statusTextColor = "text-[#007aff]";
    } else if (data.ph < 6.5 || data.ph > 8.0) {
        status = "pH Imbalance";
        statusColor = "bg-[#ffcc00]";
        statusTextColor = "text-[#ffcc00]";
    } else if (data.speed > speedThreshold) {
        status = "Unexplained High Activity / Panic";
        statusColor = "bg-[#ff3b30]";
        statusTextColor = "text-[#ff3b30]";
    }

    return (
        <div className="bg-white/95 backdrop-blur-md p-4 rounded-[8px] shadow-xl border border-black/5 min-w-[240px]">
            <p className="text-[12px] font-bold text-al-mid-gray mb-3 border-b border-black/5 pb-2 uppercase tracking-wider">
                {format(new Date(data.time), 'MMM d, HH:mm:ss')}
            </p>

            <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                <div className="flex flex-col">
                    <span className="text-[11px] text-al-mid-gray">Temperature</span>
                    <span className="text-[14px] font-semibold text-[#ff9500]">{data.temp.toFixed(1)}°C</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[11px] text-al-mid-gray">Oxygen</span>
                    <span className="text-[14px] font-semibold text-[#32ade6]">{data.do.toFixed(1)} mg/L</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[11px] text-al-mid-gray">Water pH</span>
                    <span className="text-[14px] font-semibold text-[#af52de]">{data.ph.toFixed(2)}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[11px] text-al-mid-gray">Fish Speed</span>
                    <span className="text-[14px] font-semibold text-al-near-black">{data.speed.toFixed(1)} px/s</span>
                </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-[6px] bg-black/5`}>
                <div className={`w-2 h-2 rounded-full shadow-sm ${statusColor} animate-pulse`} />
                <span className={`text-[12px] font-bold ${statusTextColor}`}>{status}</span>
            </div>
        </div>
    );
};

export default function Insights({ logs }: InsightsProps) {
    const [timeWindow, setTimeWindow] = useState<TimeWindow>('1h');
    const [speedThreshold, setSpeedThreshold] = useState<number>(50);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 1. Master Filter: Slice logs by the selected time window
    const filteredLogs = useMemo(() => {
        if (logs.length === 0) return [];
        if (timeWindow === 'all') return logs;

        const latestTime = new Date(logs[logs.length - 1].timestamp).getTime();
        const windowMs = TIME_WINDOWS.find(w => w.id === timeWindow)?.ms ?? Infinity;
        const cutoffTime = latestTime - windowMs;

        return logs.filter(log => new Date(log.timestamp).getTime() >= cutoffTime);
    }, [logs, timeWindow]);

    const hasTrackingData = useMemo(() => filteredLogs.some(l => l.x_pos != null), [filteredLogs]);

    // ---------------------------------------------------------
    // TOOL 1: Organic Scientific Heatmap Data Extraction
    // ---------------------------------------------------------
    const heatmapPoints = useMemo(() => {
        return filteredLogs
            .filter(l => l.x_pos != null && l.y_pos != null)
            .map(l => ({ x: l.x_pos as number, y: l.y_pos as number }));
    }, [filteredLogs]);

    // Draw the HTML5 Canvas Heatmap
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        // Clear previous render
        ctx.clearRect(0, 0, width, height);

        if (heatmapPoints.length === 0) return;

        // Auto-Normalization: Dynamically scale the brush opacity based on data volume
        // This prevents 5 points from being invisible, and 5000 points from turning into a solid red block.
        const dynamicAlpha = Math.max(0.015, Math.min(0.2, 8 / heatmapPoints.length));

        // Step A: Draw black blurred alpha circles where the fish went
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

        // Step B: Grab the alpha channel and map it to our color palette
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const palette = getHeatmapPalette();

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha > 0) {
                // Map the 0-255 alpha value to the 256-color palette index
                const paletteOffset = alpha * 4;
                const r = palette![paletteOffset];
                const g = palette![paletteOffset + 1];
                const b = palette![paletteOffset + 2];

                if (r !== undefined && g !== undefined && b !== undefined) {
                    data[i] = r;
                    data[i + 1] = g;
                    data[i + 2] = b;
                }
                // Keep original alpha for smooth, transparent edges over the grid
                data[i + 3] = alpha;
            }
        }

        ctx.putImageData(imgData, 0, 0);
    }, [heatmapPoints, timeWindow]);


    // ---------------------------------------------------------
    // TOOL 2: Dynamic Threshold Timeline (Rolling Speed)
    // ---------------------------------------------------------
    const rollingSpeedData = useMemo(() => {
        return filteredLogs
            .filter(l => l.avg_speed != null)
            .map(l => ({
                time: new Date(l.timestamp).getTime(),
                speed: l.avg_speed || 0
            }));
    }, [filteredLogs]);

    const maxSpeed = Math.max(...rollingSpeedData.map(d => d.speed), 1);
    const thresholdPercent = Math.max(0, Math.min(100, ((maxSpeed - speedThreshold) / maxSpeed) * 100));


    // ---------------------------------------------------------
    // TOOL 3: Layered Ecosystem Chart & Diagnostic Brain
    // ---------------------------------------------------------
    const ecosystemData = useMemo(() => {
        let temp = 25.0;
        let ph = 7.0;
        let do_val = 6.0;
        let speed = 0;

        const result = [];
        for (const log of filteredLogs) {
            if (log.temperature != null) temp = log.temperature;
            if (log.ph != null) ph = log.ph;
            if (log.dissolved_oxygen != null) do_val = log.dissolved_oxygen;
            if (log.avg_speed != null) speed = log.avg_speed;

            result.push({
                time: new Date(log.timestamp).getTime(),
                temp,
                ph,
                do: do_val,
                speed
            });
        }
        return result;
    }, [filteredLogs]);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-700">
            {/* Header & Global Controls */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h2 className="text-[28px] font-semibold tracking-tight text-al-near-black">Life Trends</h2>
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

                    {!hasTrackingData && (
                        <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-[2px] flex items-center justify-center p-8 text-center rounded-[6px]">
                            <p className="text-[13px] font-medium text-al-mid-gray">Waiting for AI tracking data...</p>
                        </div>
                    )}

                    <div className="flex flex-col w-full">
                        <div className="flex flex-row items-stretch w-full aspect-[4/3] max-h-[300px]">

                            {/* Y-Axis (Depth) */}
                            <div className="flex flex-col justify-between items-end pr-2 py-1 border-r border-black/10 text-[10px] font-medium text-al-mid-gray w-8 shrink-0">
                                <span>0</span>
                                <span>50</span>
                                <span>100</span>
                            </div>

                            {/* Main Canvas & Grid Container */}
                            <div className="relative flex-1 bg-white border-y border-black/5 overflow-hidden">
                                {/* Dotted Cartesian Grid Background */}
                                <div
                                    className="absolute inset-0 pointer-events-none opacity-40"
                                    style={{ backgroundImage: 'radial-gradient(#8e8e93 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                                />

                                {/* 640x480 native aspect ratio canvas for mapping */}
                                <canvas
                                    ref={canvasRef}
                                    width={640}
                                    height={480}
                                    className="relative z-10 w-full h-full object-contain mix-blend-multiply"
                                />
                            </div>

                            {/* Thermal Scale Legend (Right Side) */}
                            <div className="w-10 flex flex-col items-center justify-between pl-2 border-l border-black/10 shrink-0 py-1">
                                <span className="text-[10px] font-medium text-al-mid-gray">High</span>
                                <div className="w-2.5 flex-1 my-2 rounded-[2px] bg-gradient-to-t from-[#ffffcc] via-[#fd8d3c] to-[#bd0026] border border-black/5 shadow-inner"></div>
                                <span className="text-[10px] font-medium text-al-mid-gray">Low</span>
                            </div>
                        </div>

                        {/* X-Axis (Width) */}
                        <div className="flex flex-row w-full pl-8 pr-10 mt-1.5 text-[10px] font-medium text-al-mid-gray justify-between">
                            <span>0</span>
                            <span>50</span>
                            <span>100</span>
                        </div>
                    </div>
                </Card>

                {/* 2. Dynamic Threshold Timeline (Fish Speed) */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest">Average Speed Over Time</h3>

                        {/* Dynamic Threshold Input */}
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
                            <AreaChart data={rollingSpeedData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    {/* The Dynamic Bleed Gradient */}
                                    <linearGradient id="colorSpeedBleed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ff3b30" stopOpacity={0.8} />
                                        <stop offset={`${thresholdPercent}%`} stopColor="#ff3b30" stopOpacity={0.6} />
                                        <stop offset={`${thresholdPercent}%`} stopColor="#007aff" stopOpacity={0.4} />
                                        <stop offset="100%" stopColor="#007aff" stopOpacity={0.0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="time"
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    tickFormatter={(v) => format(new Date(v), 'HH:mm')}
                                    fontSize={10} axisLine={false} tickLine={false}
                                />
                                <YAxis fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip
                                    isAnimationActive={false}
                                    labelFormatter={(v) => format(new Date(v), 'HH:mm:ss')}
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                                />
                                <ReferenceLine y={speedThreshold} stroke="#ff3b30" strokeDasharray="3 3" strokeWidth={1.5} opacity={0.6} />
                                <Area
                                    type="monotone"
                                    dataKey="speed"
                                    stroke="url(#colorSpeedBleed)"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorSpeedBleed)"
                                    isAnimationActive={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* 3. Layered Ecosystem Chart & Diagnostic Brain */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px] lg:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest">Combined Ecosystem State</h3>
                            <p className="text-[11px] text-al-mid-gray">Hover over the timeline to trigger the Diagnostic Tooltip.</p>
                        </div>
                    </div>

                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={ecosystemData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradTemp" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ff9500" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#ff9500" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradDO" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#32ade6" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#32ade6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradSpeed" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#000000" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

                                <XAxis
                                    dataKey="time"
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    tickFormatter={(v) => format(new Date(v), 'HH:mm')}
                                    fontSize={10} axisLine={false} tickLine={false}
                                />

                                {/* Hidden Multiple Y-Axes to normalize the scales */}
                                <YAxis yAxisId="temp" domain={['dataMin - 2', 'dataMax + 2']} hide />
                                <YAxis yAxisId="do" domain={[0, 10]} hide />
                                <YAxis yAxisId="ph" domain={[5, 9]} hide />
                                <YAxis yAxisId="speed" domain={[0, 'dataMax']} hide />

                                {/* The Diagnostic Brain Tooltip */}
                                <Tooltip content={<EcosystemDiagnosticTooltip speedThreshold={speedThreshold} />} isAnimationActive={false} />

                                {/* The Smooth Layered Waves */}
                                <Area yAxisId="temp" type="monotone" dataKey="temp" stroke="#ff9500" strokeWidth={2} fill="url(#gradTemp)" isAnimationActive={false} />
                                <Area yAxisId="do" type="monotone" dataKey="do" stroke="#32ade6" strokeWidth={2} fill="url(#gradDO)" isAnimationActive={false} />
                                <Area yAxisId="ph" type="monotone" dataKey="ph" stroke="#af52de" strokeWidth={2} fill="none" isAnimationActive={false} />
                                <Area yAxisId="speed" type="monotone" dataKey="speed" stroke="#000000" strokeWidth={1} fill="url(#gradSpeed)" isAnimationActive={false} strokeDasharray="4 4" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

            </div>
        </div>
    );
}