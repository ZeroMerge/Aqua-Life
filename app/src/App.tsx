import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SensorStatus } from '@/types/sensors';
import { useSensorData } from '@/hooks/useSensorData';
import { systemStatusLabel } from '@/lib/sensors';
import { getSupabaseClient } from '@/lib/supabase';
import LiveMonitor from '@/sections/LiveMonitor';
import Analytics from '@/sections/Analytics';
import Thresholds from '@/sections/Thresholds';
import Insights from '@/sections/Insights';
import Login from '@/components/Login';

// Added 'insights' to the TabId type
type TabId = 'live' | 'analytics' | 'insights' | 'thresholds';

// Included the Insights tab in the navigation array
const TABS: { id: TabId; label: string }[] = [
  { id: 'live', label: 'Live Monitor' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'insights', label: 'Insights' },
  { id: 'thresholds', label: 'Thresholds' },
];

function StatusDot({ status }: { status: SensorStatus }) {
  const bg = status === 'safe' ? '#34c759' : status === 'warning' ? '#ff9500' : '#ff3b30';
  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: bg }}
      className={`inline-block w-2 h-2 rounded-full shrink-0 shadow-sm ${status === 'critical' ? 'animate-critical-pulse' : ''}`}
    />
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-1.5 opacity-60">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('live');
  const [session, setSession] = useState<any>(null);

  // Destructuring telemetry and logs for use in child sections
  const { sensorStates, logs, systemStatus, telemetry } = useSensorData();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    // Check session on load
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-al-off-white text-al-near-black font-sans selection:bg-al-blue selection:text-white transition-colors duration-300">

      {/* Apple-style Glass Header */}
      <header className="sticky top-0 z-50 glass-panel px-4 sm:px-6 h-16 flex items-center justify-between shrink-0 border-b border-al-light-gray/50">
        <div className="flex items-center">
          <h1 className="text-[17px] sm:text-[19px] font-semibold tracking-tight text-al-near-black">AquaLife System</h1>
        </div>

        <div className="flex items-center gap-2 sm:gap-5">
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-al-light-gray/40 rounded-[6px]">
            <StatusDot status={systemStatus} />
            <span className="hidden sm:inline text-[13px] font-medium text-al-dark-gray">
              {systemStatusLabel(systemStatus)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-[6px] bg-gradient-to-tr from-[#007aff] to-[#5ac8fa] shadow-sm border border-white/50" />
            {session && (
              <button onClick={() => getSupabaseClient()?.auth.signOut()} className="hidden sm:block text-[13px] font-medium text-al-mid-gray hover:text-[#ff3b30] transition-colors">
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Responsive Segmented Navigation */}
      <div className="flex w-full pt-6 pb-2 px-4 sticky top-16 z-40 bg-al-off-white/80 backdrop-blur-md overflow-x-hidden">
        <div className="relative w-full flex justify-start sm:justify-center overflow-x-auto no-scrollbar">
          <nav className="flex p-1 gap-1 bg-al-light-gray/50 rounded-[8px] shadow-inner border border-black/5 relative shrink-0" role="tablist">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 sm:px-5 py-1.5 text-[13px] sm:text-[14px] font-medium rounded-[6px] transition-colors duration-200 focus-visible:outline-none flex items-center z-10 whitespace-nowrap ${isActive ? 'text-al-near-black' : 'text-al-mid-gray hover:text-al-near-black'
                    }`}
                >
                  {/* The Framer Motion bouncing pill background */}
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute inset-0 bg-white rounded-[6px] shadow-sm z-[-1]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {tab.label}
                  {tab.id === 'thresholds' && !session && <LockIcon />}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content Area with Spring Transitions */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {activeTab === 'live' && <LiveMonitor sensorStates={sensorStates} telemetry={telemetry} logs={logs} />}
            {activeTab === 'analytics' && <Analytics logs={logs} sensorStates={sensorStates} />}
            {/* Added rendering for the new Insights section */}
            {activeTab === 'insights' && <Insights logs={logs} />}
            {activeTab === 'thresholds' && (session ? <Thresholds sensorStates={sensorStates} /> : <Login />)}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="py-6 flex items-center justify-center shrink-0">
        <span className="text-xs font-mono text-al-mid-gray tracking-wider">
          AQUALIFE OS v1.0.4 • SYSTEM OPERATIONAL
        </span>
      </footer>
    </div>
  );
}