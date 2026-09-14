'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Track } from '@/lib/types';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Repeat, 
  Download, 
  Music2,
  Sparkles,
  Sliders,
  PanelRightOpen,
  Gauge
} from 'lucide-react';
import { remasterAudioToWav, getProxiedAudioUrl } from '@/lib/audio-remaster';

interface AudioPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onToggleInspector?: () => void;
  isInspectorOpen?: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onToggleInspector,
  isInspectorOpen
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoop, setIsLoop] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isRemastering, setIsRemastering] = useState<boolean>(false);
  const [remasterProgress, setRemasterProgress] = useState<number>(0);

  // Reload audio element when the track source changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    audioRef.current.load();
    if (playbackRate !== 1.0) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [currentTrack?.audioUrl]);

  // Play or pause when state changes
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.play().catch(e => console.log('Audio playback waiting for user interaction:', e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || currentTrack?.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (val > 0) setIsMuted(false);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audioRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const togglePlaybackRate = () => {
    const rates = [1.0, 1.25, 1.5, 0.8];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleDownloadWav = async () => {
    if (!currentTrack?.audioUrl) return;
    setIsRemastering(true);
    setRemasterProgress(0);
    try {
      const blob = await remasterAudioToWav(
        currentTrack.audioUrl,
        undefined,
        (p) => setRemasterProgress(p)
      );
      const url = window.URL.createObjectURL(blob);
      const cleanTitle = (currentTrack.title || 'track').replace(/[\\/*?:"<>|]/g, '').trim();
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

  const formatTime = (timeInSec: number) => {
    if (isNaN(timeInSec)) return '0:00';
    const mins = Math.floor(timeInSec / 60);
    const secs = Math.floor(timeInSec % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <div className="h-20 bg-[#07080d]/95 backdrop-blur-2xl border-t border-white/10 px-6 flex items-center justify-between select-none">
        <div className="flex items-center gap-3 text-slate-500 text-xs font-semibold">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
            <Music2 className="w-4 h-4" />
          </div>
          <span>Select any track to preview & remaster with CamMusic Studio Player</span>
        </div>
      </div>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const proxiedAudioUrl = currentTrack ? getProxiedAudioUrl(currentTrack.audioUrl) : '';

  return (
    <div className="h-24 bg-[#08090f]/95 backdrop-blur-2xl border-t border-white/10 px-6 flex items-center justify-between gap-6 z-50 select-none shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
      <audio
        ref={audioRef}
        src={proxiedAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={onNextTrack}
        loop={isLoop}
      />

      {/* Left: Track Artwork & Title with Equalizer */}
      <div className="flex items-center gap-3.5 w-80 min-w-0">
        <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-white/5 flex-shrink-0 shadow-lg border border-white/10 group cursor-pointer" onClick={onToggleInspector}>
          <img 
            src={currentTrack.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80'} 
            alt={currentTrack.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
          />
          {isPlaying && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center gap-0.5">
              <span className="w-1 bg-cyan-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-4" />
              <span className="w-1 bg-violet-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-6" />
              <span className="w-1 bg-fuchsia-400 rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-3" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-black text-white truncate hover:text-cyan-300 transition-colors cursor-pointer" onClick={onToggleInspector}>
              {currentTrack.title}
            </h4>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono mt-0.5">
            <span className="text-cyan-300 font-bold">24-bit Lossless</span>
            <span>•</span>
            <span className="truncate text-slate-400">{currentTrack.style ? currentTrack.style.split(',')[0] : 'Studio Master'}</span>
          </div>
        </div>
      </div>

      {/* Center: Controls and Scrubber Bar */}
      <div className="flex-1 max-w-2xl flex flex-col items-center gap-1.5">
        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLoop(!isLoop)}
            title={isLoop ? 'Loop On' : 'Loop Off'}
            className={`p-1.5 rounded-xl transition-all ${
              isLoop ? 'text-cyan-300 bg-cyan-500/20 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onPrevTrack}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={onTogglePlay}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-violet-600 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition-all ring-1 ring-white/30"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={onNextTrack}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlaybackRate}
            title="Playback Speed"
            className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono font-bold text-slate-300 hover:text-white border border-white/10"
          >
            {playbackRate}x
          </button>
        </div>

        {/* Progress Scrubber */}
        <div className="w-full flex items-center gap-3">
          <span className="text-[11px] font-mono font-bold text-slate-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>

          <div className="relative flex-1 flex items-center group cursor-pointer">
            {/* Animated Waveform Background Bar */}
            <div className="absolute inset-0 h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500 rounded-full transition-all duration-100 shadow-[0_0_12px_rgba(6,182,212,0.6)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={duration || currentTrack.duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="relative w-full h-2.5 opacity-0 cursor-pointer z-10"
            />
          </div>

          <span className="text-[11px] font-mono font-bold text-slate-400 w-10">
            {formatTime(duration || currentTrack.duration)}
          </span>
        </div>
      </div>

      {/* Right: Volume, Lossless Remaster & Inspector Drawer Toggle */}
      <div className="flex items-center gap-3 w-80 justify-end">
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleMute}
            className="text-slate-400 hover:text-white transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-16 h-1.5 bg-white/10 accent-cyan-400 rounded-lg cursor-pointer"
          />
        </div>

        {/* 24-bit Remaster Button */}
        <button
          onClick={handleDownloadWav}
          disabled={isRemastering}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/30 via-violet-600/30 to-fuchsia-600/30 hover:from-cyan-600/50 hover:to-violet-600/50 text-white font-bold text-xs border border-cyan-500/30 shadow-md transition-all active:scale-95"
        >
          {isRemastering ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
              <span>{remasterProgress}%</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>24-bit WAV</span>
            </>
          )}
        </button>

        {/* Slide-out Inspector Drawer Toggle */}
        <button
          onClick={onToggleInspector}
          title={isInspectorOpen ? 'Close Inspector' : 'Open Track Inspector'}
          className={`p-2 rounded-xl border transition-all ${
            isInspectorOpen
              ? 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-600/30'
              : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:text-white'
          }`}
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

