'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Key, Sparkles, Check, X, ShieldCheck, Zap, ExternalLink, HelpCircle } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string, provider: string) => void;
  provider: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  provider,
}) => {
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [selectedProvider, setSelectedProvider] = useState(provider || 'suno');
  const [saved, setSaved] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeyInput(apiKey || '');
      setSelectedProvider(provider || 'suno');
    }
  }, [isOpen, apiKey, provider]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = keyInput.trim();
    // Smart Auto-Detection
    let detectedProv = selectedProvider;
    if (trimmed.startsWith('pi_')) {
      detectedProv = 'piapi';
    } else if (trimmed.startsWith('eyJ') || trimmed.length > 200) {
      detectedProv = 'suno';
    }

    onSaveApiKey(trimmed, detectedProv);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-studio-900 border border-studio-700/80 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between border-b border-studio-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">ការកំណត់ AI Engine (Settings)</h3>
              <p className="text-xs text-slate-400">ភ្ជាប់ទៅកាន់ Suno ផ្លូវការ ឬ PiAPI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-studio-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Provider Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">
            ជ្រើសរើស AI Music Engine:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {/* Suno Direct (Recommended) */}
            <button
              type="button"
              onClick={() => setSelectedProvider('suno')}
              className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
                selectedProvider === 'suno'
                  ? 'bg-violet-600/25 border-violet-500 text-white shadow-md ring-1 ring-violet-500'
                  : 'bg-studio-950 border-studio-800 text-slate-400 hover:border-studio-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-100 flex items-center gap-1">
                  <span>Suno Direct Token</span>
                  <span className="text-[9px] px-1 py-0.2 bg-emerald-500/20 text-emerald-400 rounded">15s ($0)</span>
                </span>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <p className="text-[10px] text-slate-400">Suno.com ផ្លូវការ (លឿនបំផុត)</p>
            </button>

            {/* PiAPI Udio */}
            <button
              type="button"
              onClick={() => setSelectedProvider('piapi')}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedProvider === 'piapi'
                  ? 'bg-violet-600/25 border-violet-500 text-white shadow-md ring-1 ring-violet-500'
                  : 'bg-studio-950 border-studio-800 text-slate-400 hover:border-studio-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-100">PiAPI Udio</span>
                <Zap className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-[10px] text-slate-400">Udio Music-U Engine</p>
            </button>
          </div>
        </div>

        {/* Suno Token Guide */}
        {selectedProvider === 'suno' && (
          <div className="p-3.5 rounded-xl bg-violet-950/30 border border-violet-500/30 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-violet-300">
              <span className="flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                <span>របៀបយក Suno Token (ចំណាយពេល ២០ វិនាទី):</span>
              </span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] leading-relaxed">
              <li>បើក Tab ចូល <a href="https://suno.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-mono">suno.com</a> រួច Login គណនីរបស់អ្នក</li>
              <li>ចុច <strong>F12</strong> (ឬ Right-click ➡️ Inspect) ➡️ ចុចលើផ្ទាំង <strong>Network</strong></li>
              <li>ចុចប៊ូតុង <strong>Create</strong> បទណាមួយលើ Suno នោះវានឹងចេញ request ឈ្មោះ <strong>generate</strong></li>
              <li>ចុចលើពាក្យ <strong>generate</strong> នោះ ➡️ Copy កូដវែងនៅកន្លែង <strong>authorization: Bearer ...</strong></li>
            </ol>
          </div>
        )}

        {/* Input Box */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            <span>{selectedProvider === 'suno' ? 'Suno Bearer Token' : 'PiAPI API Key'}:</span>
          </label>

          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={selectedProvider === 'suno' ? 'eyJhbGciOiJSUzI1NiIs...' : 'piapi_live_xxx...'}
            className="w-full bg-studio-950 border border-studio-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
          />
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-emerald-300" />
                <span>បានរក្សាទុកដោយជោគជ័យ!</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>រក្សាទុកការកំណត់ (Save Settings)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
