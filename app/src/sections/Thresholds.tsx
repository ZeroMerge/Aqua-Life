import { useState } from 'react';
import type { SensorStates } from '@/types/sensors';
import { THRESHOLDS } from '@/lib/sensors';
import { getSupabaseClient } from '@/lib/supabase';

interface ThresholdsProps {
  sensorStates: SensorStates;
}

const SENSOR_KEYS = ['ph', 'temperature', 'turbidity', 'dissolved_oxygen', 'avg_speed'] as const;

export default function Thresholds({ sensorStates }: ThresholdsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<Record<string, { min: number; max: number }>>(() => {
    const init: Record<string, { min: number; max: number }> = {};
    SENSOR_KEYS.forEach((k) => {
      init[k] = { min: THRESHOLDS[k]?.min ?? 0, max: THRESHOLDS[k]?.max ?? 100 };
    });
    return init;
  });

  const handleInputChange = (key: string, field: 'min' | 'max', value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: Number(value) },
    }));
  };

  const handleSave = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setIsSaving(true);

    try {
      for (const key of SENSOR_KEYS) {
        await supabase
          .from('sensor_configs')
          // @ts-expect-error - ignore table type mismatch for dynamically updated thresholds
          .update({
            min_val: form[key].min,
            max_val: form[key].max,
          })
          .eq('sensor_key', key);

        if (THRESHOLDS[key]) {
          THRESHOLDS[key].min = form[key].min;
          THRESHOLDS[key].max = form[key].max;
        }
      }
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save thresholds:', error);
      alert('Failed to sync with database. Check connection.');
    }

    setIsSaving(false);
  };

  const handleCancel = () => {
    const reset: Record<string, { min: number; max: number }> = {};
    SENSOR_KEYS.forEach((k) => {
      reset[k] = { min: THRESHOLDS[k]?.min ?? 0, max: THRESHOLDS[k]?.max ?? 100 };
    });
    setForm(reset);
    setIsEditing(false);
  };

  return (
    <div className="w-full flex flex-col gap-8 animate-in fade-in duration-500">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
        <div className="flex flex-col gap-2">
          <h2 className="text-[24px] sm:text-[28px] font-semibold tracking-tight text-al-near-black">
            Safety Limits
          </h2>
          <p className="text-[14px] sm:text-[15px] text-al-mid-gray max-w-2xl leading-relaxed">
            Define the ideal conditions for your tank. The system continuously tracks these levels, filtering out brief changes to ensure reliable, safe monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="px-4 py-2 text-[13px] font-medium text-al-dark-gray bg-al-light-gray/40 hover:bg-al-light-gray/60 rounded-[6px] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 text-[13px] font-medium text-white bg-[#007aff] hover:bg-[#005bb5] rounded-[6px] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving && (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                {isSaving ? 'Saving...' : 'Save Limits'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-[13px] font-medium text-white bg-[#1c1c1e] hover:bg-black rounded-[6px] transition-colors shadow-sm w-full sm:w-auto"
            >
              Edit Limits
            </button>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto no-scrollbar rounded-[6px] border border-black/5 bg-white shadow-sm">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr] border-b border-al-light-gray/50 bg-[#f5f5f7] text-[12px] font-semibold text-al-mid-gray uppercase tracking-wider">
            <div className="px-6 py-3.5">Measurement</div>
            <div className="px-6 py-3.5">Minimum</div>
            <div className="px-6 py-3.5">Maximum</div>
            <div className="px-6 py-3.5">Unit</div>
            <div className="px-6 py-3.5 text-right">Current Status</div>
          </div>

          <div className="flex flex-col">
            {SENSOR_KEYS.map((key, index) => {
              const thresh = THRESHOLDS[key] || { label: key, unit: '' };
              const state = sensorStates[key];
              const isLast = index === SENSOR_KEYS.length - 1;

              const statusColor = !state ? '#86868b' : state.status === 'safe' ? '#34c759' : state.status === 'warning' ? '#ff9500' : '#ff3b30';
              const displayValue = state ? state.value.toFixed(key === 'ph' ? 2 : 1) : '--';

              return (
                <div
                  key={key}
                  className={`grid grid-cols-[2fr_1fr_1fr_1fr_1.5fr] items-center transition-colors ${!isLast ? 'border-b border-al-light-gray/40' : ''} ${isEditing ? 'bg-al-blue/5' : 'hover:bg-al-off-white/50'}`}
                >
                  <div className="px-6 py-4">
                    <span className="text-[15px] font-medium text-al-near-black">{thresh.label}</span>
                  </div>

                  <div className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={form[key].min}
                        onChange={(e) => handleInputChange(key, 'min', e.target.value)}
                        className="w-20 px-2 py-1.5 text-[15px] text-al-near-black bg-white border border-black/10 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all font-mono"
                      />
                    ) : (
                      <span className="text-[15px] text-al-dark-gray font-mono">{thresh.min}</span>
                    )}
                  </div>

                  <div className="px-6 py-4">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        value={form[key].max}
                        onChange={(e) => handleInputChange(key, 'max', e.target.value)}
                        className="w-20 px-2 py-1.5 text-[15px] text-al-near-black bg-white border border-black/10 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all font-mono"
                      />
                    ) : (
                      <span className="text-[15px] text-al-dark-gray font-mono">{thresh.max}</span>
                    )}
                  </div>

                  <div className="px-6 py-4 text-[14px] text-al-mid-gray">{thresh.unit}</div>

                  <div className="px-6 py-4 flex items-center justify-end gap-3">
                    <span className="text-[17px] font-semibold text-al-near-black tabular-nums">
                      {displayValue}
                    </span>
                    <div
                      className={`w-2.5 h-2.5 rounded-full shadow-sm ${state?.status === 'critical' ? 'animate-critical-pulse' : ''}`}
                      style={{ backgroundColor: statusColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 mt-2">
        <h3 className="text-[12px] font-semibold text-al-mid-gray uppercase tracking-wider pl-1">
          Understanding Your Metrics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 w-full">
          {SENSOR_KEYS.map((key) => {
            const thresh = THRESHOLDS[key];
            if (!thresh) return null;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-[#007aff] rounded-full shadow-sm" />
                  <span className="text-[14px] font-semibold text-al-near-black">{thresh.label}</span>
                </div>
                <p className="text-[13.5px] text-al-dark-gray leading-relaxed pl-3.5">
                  {thresh.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}