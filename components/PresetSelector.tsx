'use client';

import React from 'react';
import { KHMER_PRESETS } from '@/lib/presets';
import { PresetStyle } from '@/lib/types';
import { Sparkles } from 'lucide-react';

interface PresetSelectorProps {
  selectedPresetId: string | null;
  onSelectPreset: (preset: PresetStyle) => void;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
  selectedPresetId,
  onSelectPreset,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>ចង្វាក់ខ្មែរពេញនិយម (Khmer Music Presets):</span>
        </label>
        <span className="text-[11px] text-slate-500">ចុច ១-Click ដើម្បីជ្រើសរើស</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {KHMER_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition-all duration-200 ${
                isSelected
                  ? 'bg-violet-600/25 border-violet-500 text-white shadow-md shadow-violet-500/10'
                  : 'bg-studio-900/80 border-studio-800 text-slate-300 hover:border-studio-700 hover:bg-studio-850'
              }`}
            >
              <span className="text-lg leading-none p-1 rounded-lg bg-studio-800/80">{preset.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate text-slate-100">{preset.nameKh}</p>
                <p className="text-[10px] text-slate-400 truncate">{preset.nameEn}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
