import { useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Card } from '@/components/ui/card';

interface InsightsProps {
    logs: any[];
}

export default function Insights({ logs }: InsightsProps) {
    // 0. Safety Check: Determine if the AI is actually sending position data yet
    const hasTrackingData = useMemo(() => logs.some(l => l.x_pos != null), [logs]);

    // 1. Heatmap Data Processing (10x10 grid)
    const heatmapData = useMemo(() => {
        const grid = Array(10).fill(0).map(() => Array(10).fill(0));
        logs.forEach(log => {
            if (log.x_pos != null && log.y_pos != null) {
                const x = Math.floor(Math.min(log.x_pos, 99) / 10);
                const y = Math.floor(Math.min(log.y_pos, 99) / 10);
                grid[y][x] += 1;
            }
        });
        return grid;
    }, [logs]);

    // 2. Daily Energy Processing (Average speed per hour)
    const rhythmData = useMemo(() => {
        const hourlyMap: Record<number, { count: number, totalSpeed: number }> = {};
        logs.forEach(log => {
            const hour = new Date(log.timestamp).getHours();
            if (!hourlyMap[hour]) hourlyMap[hour] = { count: 0, totalSpeed: 0 };
            if (log.avg_speed != null) {
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
    }, [logs]);

    // 3. Comfort Profile (Speed vs Temperature)
    const correlationData = useMemo(() => {
        return logs
            .filter(l => l.avg_speed != null && l.temperature != null)
            .slice(-100) // Last 100 points to keep the chart clean and readable
            .map(l => ({
                x: l.temperature,
                y: l.avg_speed,
            }));
    }, [logs]);

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-700">
            <div className="flex flex-col gap-2">
                <h2 className="text-[28px] font-semibold tracking-tight text-al-near-black">Life Trends</h2>
                <p className="text-[15px] text-al-mid-gray max-w-2xl">
                    Understanding how your fish interact with their environment throughout the day.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Daily Energy Levels (Area Chart) */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px]">
                    <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest mb-6">Daily Energy Levels</h3>
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
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                                />
                                <Area type="monotone" dataKey="speed" stroke="#007aff" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpeed)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {/* Favorite Spots (Heatmap) */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px] flex flex-col relative overflow-hidden">
                    <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest mb-6">Favorite Spots</h3>

                    {/* Glassmorphism Empty State if AI hasn't sent coordinates yet */}
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

                {/* Activity vs Comfort (Scatter Chart) */}
                <Card className="p-6 bg-white border-black/5 shadow-sm rounded-[6px] lg:col-span-2">
                    <h3 className="text-[13px] font-bold text-al-dark-gray uppercase tracking-widest mb-6">Activity vs. Temperature</h3>
                    <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" dataKey="x" name="Temperature" unit="°" fontSize={10} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                                <YAxis type="number" dataKey="y" name="Activity" fontSize={10} axisLine={false} tickLine={false} />
                                <ZAxis type="number" range={[60, 60]} />
                                <Tooltip
                                    cursor={{ strokeDasharray: '3 3' }}
                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px' }}
                                />
                                <Scatter name="Logs" data={correlationData} fill="#007aff" fillOpacity={0.5} />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

            </div>
        </div>
    );
}