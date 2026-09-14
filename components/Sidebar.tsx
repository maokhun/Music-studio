'use client';

import React from 'react';
import { 
  Sparkles, 
  Music, 
  Compass, 
  ListMusic, 
  FolderHeart, 
  Settings, 
  Coins, 
  Zap,
  Radio,
  Share2,
  Sliders,
  Layers,
  Wand2
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  credits: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, credits }) => {
  const menuItems = [
    { id: 'create', label: 'Create Music', khmerLabel: 'បង្កើតចម្រៀង', icon: Wand2, badge: 'V5.5 HD' },
    { id: 'library', label: 'My Studio Library', khmerLabel: 'បណ្ណាល័យចម្រៀង', icon: Music },
    { id: 'remaster', label: 'Remaster Studio', khmerLabel: '24-bit HD Master', icon: Sliders, badge: 'DSP' },
    { id: 'explore', label: 'Explore Styles', khmerLabel: 'រុករកចង្វាក់ភ្លេង', icon: Compass },
    { id: 'favorites', label: 'Favorites', khmerLabel: 'បទពេញចិត្ត', icon: FolderHeart },
  ];

  return (
    <aside className="w-64 bg-[#08090e]/95 backdrop-blur-2xl border-r border-white/10 flex flex-col h-full select-none z-30">
      {/* Brand Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-violet-500/30 ring-1 ring-white/20">
            <Radio className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-black text-sm tracking-wide bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                CamMusic Studio
              </h1>
              <span className="px-1.5 py-0.2 text-[8px] font-black uppercase rounded bg-violet-600/30 text-cyan-300 border border-cyan-500/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium tracking-tight">AI Audio & Remaster Suite</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div className="flex-1 py-3 px-2.5 space-y-1 overflow-y-auto custom-scrollbar">
        <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          Studio Navigation
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600/30 via-cyan-500/10 to-transparent text-white border border-violet-500/40 shadow-sm shadow-violet-500/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <p className="leading-tight">{item.label}</p>
                  <p className="text-[9px] text-slate-500 font-normal leading-tight">{item.khmerLabel}</p>
                </div>
              </div>
              {item.badge && (
                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-md ${
                  isActive 
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-xs' 
                    : 'bg-white/5 text-slate-400 border border-white/10'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-2">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-violet-600/30 to-cyan-500/10 text-white border border-violet-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-white/5 text-cyan-400">
                <Settings className="w-3.5 h-3.5" />
              </div>
              <div className="text-left">
                <p className="leading-tight">API Settings</p>
                <p className="text-[9px] text-slate-500 font-normal leading-tight">ការកំណត់ Server</p>
              </div>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-600/30 text-violet-300 font-mono">
              Key
            </span>
          </button>
        </div>
      </div>

      {/* Credit Status & System Footer */}
      <div className="p-3 border-t border-white/10 bg-[#06070b]/60 space-y-2">
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-600/20 text-violet-300">
              <Coins className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Studio Credits</p>
              <p className="text-xs font-black text-white">{credits} / 500</p>
            </div>
          </div>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
            PRO
          </span>
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
            Studio Engine Ready
          </span>
          <span className="font-mono">v2.5</span>
        </div>
      </div>
    </aside>
  );
};
