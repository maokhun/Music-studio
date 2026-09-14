'use client';

import React, { useState, useEffect } from 'react';
import { Track } from '@/lib/types';
import { 
  X, 
  Play, 
  Pause, 
  Sparkles, 
  Download, 
  FileCode2, 
  FileText, 
  Video, 
  Music, 
  Sliders, 
  Clock, 
  Tag, 
  Copy, 
  Check, 
  ExternalLink,
  Disc3
} from 'lucide-react';
import { generateLRC, generateSRT, downloadTextFile } from '@/lib/subtitle-generator';
import { remasterAudioToWav } from '@/lib/audio-remaster';

interface TrackInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onOpenLyricsModal: (track: Track) => void;
}

export const TrackInspector: React.FC<TrackInspectorProps> = ({
  isOpen,
  onClose,
  track,
  isPlaying,
  onTogglePlay,
  onOpenLyricsModal
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [isRemastering, setIsRemastering] = useState(false);
  const [remasterProgress, setRemasterProgress] = useState(0);

  if (!isOpen || !track) return null;

  const handleCopyLyrics = () => {
    if (track.lyrics) {
      navigator.clipboard.writeText(track.lyrics);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    }
  };

  const handleDownloadWav = async () => {
    if (!track.audioUrl) return;
    setIsRemastering(true);
    setRemasterProgress(0);
    try {
      const blob = await remasterAudioToWav(
        track.audioUrl,
        undefined,
        (p) => setRemasterProgress(p)
      );
      const url = window.URL.createObjectURL(blob);
      const cleanTitle = (track.title || 'track').replace(/[\\/*?:"<>|]/g, '').trim();
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanTitle}_24bit_Master.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Remaster error:', e);
    } finally {
      setIsRemastering(false);
      setRemasterProgress(0);
    }
  };

  const handleDownloadMp3 = async () => {
    if (!track.audioUrl) return;
    try {
      const res = await fetch(`/api/download-mp3?url=${encodeURIComponent(track.audioUrl)}`);
      if (!res.ok) throw new Error('MP3 download failed');
      const url = window.URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title.replace(/\s+/g, '_')}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('MP3 download error:', e);
      alert('MP3 download failed. Please try again.');
    }
  };

  return (
    <aside className="w-96 bg-[#0a0b12]/95 backdrop-blur-2xl border-l border-white/10 flex flex-col h-full z-40 select-none shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-violet-950/30 to-transparent">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <Disc3 className="w-4 h-4 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
          <span>Track Inspector</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        {/* Big Artwork & Play overlay */}
        <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
          <img
            src={track.coverUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80'}
            alt={track.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-4">
            <button
              onClick={onTogglePlay}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/30 hover:scale-110 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <div className="ml-3">
              <span className="text-[10px] uppercase tracking-wider font-bold text-cyan-300">Audio Preview</span>
              <p className="text-xs text-slate-300">{Math.floor((track.duration || 0) / 60)}:{(Math.floor((track.duration || 0) % 60)).toString().padStart(2, '0')} mins</p>
            </div>
          </div>
        </div>

        {/* Title & Metadata Pills */}
        <div className="space-y-2">
          <h3 className="text-lg font-black text-white leading-tight">{track.title}</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[10px] font-bold">
              ✨ 24-bit HD Master
            </span>
            {track.model && (
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold">
                {track.model}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] font-mono">
              -14 LUFS
            </span>
          </div>
        </div>

        {/* Quick Action Matrix */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadWav}
            disabled={isRemastering}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-gradient-to-r from-cyan-600/30 to-violet-600/30 hover:from-cyan-600/50 hover:to-violet-600/50 text-white border border-cyan-500/30 text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            {isRemastering ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                <span>{remasterProgress}%</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Lossless WAV</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadMp3}
            className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-bold transition-all active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>HQ MP3</span>
          </button>

          <button
            onClick={() => onOpenLyricsModal(track)}
            className="col-span-2 flex items-center justify-center gap-2 p-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/40 text-xs font-bold transition-all active:scale-95"
          >
            <Sliders className="w-4 h-4 text-violet-400" />
            <span>Open Lyrics Studio (LRC / SRT)</span>
          </button>
        </div>

        {/* Style & Tags */}
        {track.style && (
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <Tag className="w-3 h-3 text-cyan-400" />
              <span>Music Style & Genre</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-mono bg-black/30 p-2 rounded-xl border border-white/5">
              {track.style}
            </p>
          </div>
        )}

        {/* Lyrics Preview */}
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3 h-3 text-emerald-400" />
              <span>Lyrics & Prompts</span>
            </span>
            <button
              onClick={handleCopyLyrics}
              className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-md"
            >
              {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="text-xs text-slate-300 font-sans whitespace-pre-wrap max-h-56 overflow-y-auto custom-scrollbar bg-black/40 p-3 rounded-xl border border-white/5 leading-relaxed">
            {track.lyrics || <span className="text-slate-500 italic">No lyrics provided for this track</span>}
          </div>
        </div>
      </div>
    </aside>
  );
};
