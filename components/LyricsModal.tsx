'use client';

import React, { useState, useEffect } from 'react';
import { Track } from '@/lib/types';
import { 
  LyricLine, 
  parseLyricsToTimedLines, 
  generateSRTFromLines, 
  generateLRCFromLines, 
  formatSRTTime, 
  formatLRCTime, 
  downloadTextFile 
} from '@/lib/subtitle-generator';
import { analyzeAudioVocalTiming } from '@/lib/audio-vocal-aligner';
import { 
  X, 
  FileCode2, 
  FileText, 
  Download, 
  Play, 
  Check, 
  Clock, 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit3, 
  Copy,
  Zap,
  SlidersHorizontal
} from 'lucide-react';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
  onSaveTrackLyrics: (trackId: string, newLyrics: string) => void;
  onSeekAudio?: (timeInSeconds: number) => void;
}

export const LyricsModal: React.FC<LyricsModalProps> = ({
  isOpen,
  onClose,
  track,
  onSaveTrackLyrics,
  onSeekAudio
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'raw' | 'srt_preview'>('editor');
  const [rawText, setRawText] = useState<string>('');
  const [timedLines, setTimedLines] = useState<LyricLine[]>([]);
  const [copied, setCopied] = useState<boolean>(false);
  const [isScanningAudio, setIsScanningAudio] = useState<boolean>(false);
  const [selectedIntroOffset, setSelectedIntroOffset] = useState<number>(25);

  useEffect(() => {
    if (track) {
      const lyrics = track.lyrics || '';
      setRawText(lyrics);
      if (lyrics.trim()) {
        const parsed = parseLyricsToTimedLines(lyrics, track.duration || 195);
        setTimedLines(parsed);
        setActiveTab('editor');
      } else {
        setTimedLines([]);
        setActiveTab('raw'); // Directly open paste tab if track has no lyrics yet
      }
    }
  }, [track]);

  if (!isOpen || !track) return null;

  const handleUpdateLineText = (id: number, text: string) => {
    setTimedLines(prev => prev.map(line => line.id === id ? { ...line, text } : line));
  };

  const handleAdjustStartTime = (id: number, delta: number) => {
    setTimedLines(prev => prev.map(line => {
      if (line.id === id) {
        const newStart = Math.max(0, Math.round((line.startTime + delta) * 10) / 10);
        const newEnd = Math.max(newStart + 1, line.endTime);
        return { ...line, startTime: newStart, endTime: newEnd };
      }
      return line;
    }));
  };

  const handleAdjustEndTime = (id: number, delta: number) => {
    setTimedLines(prev => prev.map(line => {
      if (line.id === id) {
        const newEnd = Math.max(line.startTime + 0.5, Math.round((line.endTime + delta) * 10) / 10);
        return { ...line, endTime: newEnd };
      }
      return line;
    }));
  };

  const handleRecomputeFromRaw = () => {
    const parsed = parseLyricsToTimedLines(rawText, track.duration || 195);
    setTimedLines(parsed);
    onSaveTrackLyrics(track.id, rawText);
    setActiveTab('editor');
  };

  const handleSaveAll = () => {
    // Generate text from timed lines
    const text = timedLines.map(l => (l.section ? `${l.section}\n${l.text}` : l.text)).join('\n');
    onSaveTrackLyrics(track.id, text);
    alert('✅ បានរក្សាទុកទំនុកច្រៀង និង Timestamps រួចរាល់!');
  };

  const handleDownloadSRT = () => {
    const content = generateSRTFromLines(timedLines);
    downloadTextFile(`${track.title.replace(/\s+/g, '_')}_Subtitles.srt`, content);
  };

  const handleDownloadLRC = () => {
    const content = generateLRCFromLines(track.title, 'AI Music Studio', timedLines);
    downloadTextFile(`${track.title.replace(/\s+/g, '_')}_Karaoke.lrc`, content);
  };

  const handleCopySRT = () => {
    const content = generateSRTFromLines(timedLines);
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAutoScanAudio = async () => {
    if (!track?.audioUrl) return;
    setIsScanningAudio(true);
    try {
      const detected = await analyzeAudioVocalTiming(track.audioUrl, rawText || track.lyrics || '', track.duration || 195);
      setTimedLines(detected);
      setActiveTab('editor');
    } catch (e) {
      console.error('Audio scan error:', e);
    } finally {
      setIsScanningAudio(false);
    }
  };

  const handleShiftAllTimings = (newIntroSec: number) => {
    setSelectedIntroOffset(newIntroSec);
    if (timedLines.length === 0) return;
    const currentFirstStart = timedLines[0].startTime;
    const shiftDelta = newIntroSec - currentFirstStart;
    
    setTimedLines(prev => prev.map((line, idx) => {
      if (idx === 0) {
        const lineDur = Math.max(1, line.endTime - line.startTime);
        return {
          ...line,
          startTime: newIntroSec,
          endTime: Math.round((newIntroSec + lineDur) * 100) / 100
        };
      }
      return {
        ...line,
        startTime: Math.max(0, Math.round((line.startTime + shiftDelta) * 100) / 100),
        endTime: Math.max(0.5, Math.round((line.endTime + shiftDelta) * 100) / 100)
      };
    }));

    if (onSeekAudio) {
      onSeekAudio(newIntroSec);
    }
  };

  const [isTapSyncMode, setIsTapSyncMode] = useState<boolean>(false);
  const [currentTapIndex, setCurrentTapIndex] = useState<number>(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Global stretch or compress all lines by delta (e.g. +1s, +2s, -1s)
  const handleStretchAll = (deltaSecPerLine: number) => {
    if (timedLines.length === 0) return;
    const intro = timedLines[0].startTime;
    let cur = intro;

    setTimedLines(prev => prev.map((line, idx) => {
      const prevDur = line.endTime - line.startTime;
      const newDur = Math.max(3.0, prevDur + deltaSecPerLine);
      const lineStart = Math.round(cur * 100) / 100;
      const lineEnd = Math.round((cur + newDur) * 100) / 100;

      // Spacing gap
      const gap = (idx + 1) % 8 === 0 ? 12 : (idx + 1) % 4 === 0 ? 6 : 1.5;
      cur = lineEnd + gap;

      return {
        ...line,
        startTime: lineStart,
        endTime: lineEnd
      };
    }));
  };

  // Set explicit average line duration (e.g. 8s, 10s, 12s, 14s for slow ballad)
  const handlePacePreset = (targetSecPerLine: number) => {
    if (timedLines.length === 0) return;
    const intro = timedLines[0].startTime;
    let cur = intro;

    setTimedLines(prev => prev.map((line, idx) => {
      const charCount = line.text.length;
      // Proportional to length around targetSecPerLine
      const lineDur = Math.max(4.0, targetSecPerLine * (0.7 + (charCount / 30) * 0.6));
      const lineStart = Math.round(cur * 100) / 100;
      const lineEnd = Math.round((cur + lineDur) * 100) / 100;

      const gap = (idx + 1) % 8 === 0 ? 12 : (idx + 1) % 4 === 0 ? 6 : 1.5;
      cur = lineEnd + gap;

      return {
        ...line,
        startTime: lineStart,
        endTime: lineEnd
      };
    }));
  };

  // Tap Sync Handlers
  const handleStartTapSync = () => {
    setIsTapSyncMode(true);
    setCurrentTapIndex(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setIsAudioPlaying(true);
    }
  };

  const handleStopTapSync = () => {
    setIsTapSyncMode(false);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    }
  };

  const handleRecordTap = () => {
    if (!audioRef.current || timedLines.length === 0) return;
    const now = Math.round(audioRef.current.currentTime * 100) / 100;

    setTimedLines(prev => {
      const updated = [...prev];
      if (currentTapIndex < updated.length) {
        updated[currentTapIndex] = {
          ...updated[currentTapIndex],
          startTime: now,
          endTime: Math.round((now + 6.5) * 100) / 100
        };

        // Close previous line
        if (currentTapIndex > 0) {
          updated[currentTapIndex - 1] = {
            ...updated[currentTapIndex - 1],
            endTime: Math.max(updated[currentTapIndex - 1].startTime + 1, now - 0.2)
          };
        }
      }
      return updated;
    });

    if (currentTapIndex + 1 < timedLines.length) {
      setCurrentTapIndex(prev => prev + 1);
    } else {
      handleStopTapSync();
      alert('🎉 បាន Tap Sync គ្រប់បន្ទាត់រួចរាល់ ១០០%!');
    }
  };

  // Listen to spacebar during tap sync mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTapSyncMode && e.code === 'Space') {
        e.preventDefault();
        handleRecordTap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTapSyncMode, currentTapIndex, timedLines]);

  const handleApplyPace = (paceFactor: number) => {
    if (timedLines.length === 0) return;
    const intro = timedLines[0].startTime;
    let cur = intro;
    
    setTimedLines(prev => prev.map((line, idx) => {
      const charCount = line.text.length;
      const naturalDuration = Math.max(4.5, Math.min(11.0, (3.8 + charCount * 0.14) * paceFactor));
      const lineStart = Math.round(cur * 100) / 100;
      const lineEnd = Math.round((cur + naturalDuration) * 100) / 100;

      if ((idx + 1) % 8 === 0) {
        cur = lineEnd + (12.0 * paceFactor);
      } else if ((idx + 1) % 4 === 0) {
        cur = lineEnd + (5.5 * paceFactor);
      } else {
        cur = lineEnd + (1.0 * paceFactor);
      }

      return {
        ...line,
        startTime: lineStart,
        endTime: lineEnd
      };
    }));
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
      }
    } catch (e) {
      console.log('Clipboard read error:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-studio-950 border border-studio-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-studio-800/80 flex items-center justify-between bg-gradient-to-r from-violet-950/40 via-studio-900 to-studio-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Lyrics & Subtitle Studio (SRT / LRC Timing)</span>
                <span className="px-2 py-0.5 rounded-full bg-violet-600/20 text-[10px] text-violet-300 font-bold border border-violet-500/30">
                  {timedLines.length} Lines
                </span>
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-md">
                បទ៖ <strong className="text-slate-200">{track.title}</strong> • រយៈពេល៖ {Math.floor(track.duration / 60)}:{(track.duration % 60).toString().padStart(2, '0')} នាទី
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSRT}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Export SRT</span>
            </button>
            <button
              onClick={handleDownloadLRC}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export LRC</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-studio-900 hover:bg-studio-800 text-slate-400 hover:text-white transition-all ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-studio-800/60 flex items-center justify-between bg-studio-900/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'editor'
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              ⏱️ Timed Lines Editor (កែសម្រួលម៉ោង)
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'raw'
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              📝 Raw Lyrics (បិទភ្ជាប់ទំនុកច្រៀង)
            </button>
            <button
              onClick={() => setActiveTab('srt_preview')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'srt_preview'
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              👁️ SRT Code Preview
            </button>
          </div>

          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Lyrics</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
          {activeTab === 'editor' && (
            <div className="space-y-2.5">
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-violet-950/60 via-studio-900 to-studio-950 border border-violet-500/30 text-xs text-slate-300 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span>ស្កេនរលកសំឡេង AI Audio Scan (តម្រឹមម៉ោងស្វ័យប្រវត្តិតាម Audio):</span>
                  </div>
                  
                  <button
                    disabled={isScanningAudio}
                    onClick={handleAutoScanAudio}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
                  >
                    {isScanningAudio ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-cyan-300 rounded-full animate-spin" />
                        <span>កំពុងស្កេន Audio Waveform...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                        <span>⚡ ស្កេនតម្រឹមស្វ័យប្រវត្តិ (AI Auto-Sync)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 1-Click Intro Offset Quick Selector */}
                <div className="flex items-center gap-2 pt-1 border-t border-studio-800/80 flex-wrap text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <SlidersHorizontal className="w-3 h-3 text-violet-400" />
                    ភ្លេងក្បាល Intro Delay:
                  </span>
                  {[10, 15, 20, 25, 30, 35, 40, 45, 60].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handleShiftAllTimings(sec)}
                      className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                        selectedIntroOffset === sec
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'bg-studio-800 hover:bg-studio-700 text-slate-300 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                  <span className="text-[10px] text-slate-500 ml-auto">
                    (ចុចជ្រើសរើសវិនាទី Intro ដើម្បីរុញម៉ោងទាំងអស់ក្នុង ១ វិនាទី)
                  </span>
                </div>

                {/* 1-Click Singing Pace / Tempo Scaler & Ballad Presets */}
                <div className="flex items-center gap-1.5 pt-1.5 border-t border-studio-800/80 flex-wrap text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1 font-semibold">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    ប្រវែង ១ បន្ទាត់ (Line Duration):
                  </span>
                  {[8, 10, 12, 14, 16, 18].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => handlePacePreset(sec)}
                      className={`px-2 py-0.5 rounded-lg font-bold border transition-all hover:scale-105 active:scale-95 ${
                        sec === 14 
                          ? 'bg-purple-600/30 border-purple-500/50 text-purple-200' 
                          : 'bg-studio-800 hover:bg-studio-700 text-slate-300 border-studio-700'
                      }`}
                    >
                      {sec}s {sec === 14 ? '(Ballad/យឺត)' : ''}
                    </button>
                  ))}

                  <div className="flex items-center gap-1 ml-auto">
                    <button
                      type="button"
                      onClick={() => handleStretchAll(-1)}
                      title="បង្កើនល្បឿន (កាត់បន្ថយ ១ វិនាទី)"
                      className="px-2 py-0.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 border border-pink-500/40 font-bold"
                    >
                      ⚡ លឿនជាងមុន (-1s)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStretchAll(1)}
                      title="បន្ថយល្បឿន (បន្ថែម ១ វិនាទី)"
                      className="px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 font-bold"
                    >
                      🐢 យឺតជាងមុន (+1s)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStretchAll(2)}
                      title="បន្ថយល្បឿនខ្លាំង (បន្ថែម ២ វិនាទី)"
                      className="px-2 py-0.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 border border-purple-500/40 font-bold"
                    >
                      +2s យឺតខ្លាំង
                    </button>
                  </div>
                </div>

                {/* Live Tap Sync Feature */}
                <div className="flex items-center justify-between pt-1.5 border-t border-studio-800/80 flex-wrap gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                    <span>🖐️ Tap Sync Mode (វិធីងាយស្រួល និងត្រូវ ១០០%):</span>
                  </div>

                  {!isTapSyncMode ? (
                    <button
                      type="button"
                      onClick={handleStartTapSync}
                      className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
                    >
                      <span>🖐️ ចាប់ផ្តើម Tap Sync (ចុច Spacebar ពេលច្រៀង)</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRecordTap}
                        className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-2 shadow-lg shadow-amber-500/30 animate-pulse active:scale-95 text-xs"
                      >
                        <span>🖐️ TAP HERE (ឬចុច SPACEBAR) → ឃ្លាទី {currentTapIndex + 1}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStopTapSync}
                        className="px-2.5 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-700 text-rose-400 font-bold text-xs"
                      >
                        Stop
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Hidden audio element for Tap Sync */}
              {track.audioUrl && (
                <audio
                  ref={audioRef}
                  src={track.audioUrl}
                  onTimeUpdate={(e) => setAudioCurrentTime((e.target as HTMLAudioElement).currentTime)}
                  className="hidden"
                />
              )}

              {timedLines.map((line, idx) => (
                <div
                  key={line.id}
                  className="p-3.5 rounded-2xl bg-studio-900/70 border border-studio-800/80 hover:border-violet-500/40 transition-all flex items-center gap-3.5 group"
                >
                  <div className="w-8 h-8 rounded-xl bg-studio-800 flex items-center justify-center text-xs font-mono font-bold text-slate-400 flex-shrink-0">
                    {idx + 1}
                  </div>

                  {/* Timestamps Controls */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="flex flex-col items-center bg-studio-950 border border-studio-800 px-2 py-1 rounded-xl">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">Start</span>
                      <span className="text-xs font-mono text-cyan-400 font-bold">
                        {formatSRTTime(line.startTime).substring(3, 11)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleAdjustStartTime(line.id, 0.5)}
                        className="px-1.5 py-0.5 bg-studio-800 hover:bg-studio-700 text-[9px] font-bold text-slate-300 rounded"
                        title="Add 0.5s"
                      >
                        +0.5s
                      </button>
                      <button
                        onClick={() => handleAdjustStartTime(line.id, -0.5)}
                        className="px-1.5 py-0.5 bg-studio-800 hover:bg-studio-700 text-[9px] font-bold text-slate-300 rounded"
                        title="Sub 0.5s"
                      >
                        -0.5s
                      </button>
                    </div>

                    <span className="text-slate-600 text-xs">→</span>

                    <div className="flex flex-col items-center bg-studio-950 border border-studio-800 px-2 py-1 rounded-xl">
                      <span className="text-[9px] text-slate-500 uppercase font-bold">End</span>
                      <span className="text-xs font-mono text-violet-400 font-bold">
                        {formatSRTTime(line.endTime).substring(3, 11)}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleAdjustEndTime(line.id, 0.5)}
                        className="px-1.5 py-0.5 bg-studio-800 hover:bg-studio-700 text-[9px] font-bold text-slate-300 rounded"
                        title="Add 0.5s"
                      >
                        +0.5s
                      </button>
                      <button
                        onClick={() => handleAdjustEndTime(line.id, -0.5)}
                        className="px-1.5 py-0.5 bg-studio-800 hover:bg-studio-700 text-[9px] font-bold text-slate-300 rounded"
                        title="Sub 0.5s"
                      >
                        -0.5s
                      </button>
                    </div>
                  </div>

                  {/* Line Text Input */}
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={line.text}
                      onChange={(e) => handleUpdateLineText(line.id, e.target.value)}
                      className="w-full bg-studio-950 border border-studio-800 focus:border-violet-500 rounded-xl px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none transition-all"
                      placeholder="ទំនុកច្រៀង..."
                    />
                  </div>

                  {/* Play from this line */}
                  {onSeekAudio && (
                    <button
                      onClick={() => onSeekAudio(line.startTime)}
                      title="ស្តាប់ត្រង់ចំណុចនេះ"
                      className="p-2 rounded-xl bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white transition-all flex-shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'raw' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">
                    បិទភ្ជាប់ ឬកែសម្រួលទំនុកច្រៀងពេញលេញ (Full Lyrics with tags):
                  </label>
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/40 text-[11px] font-bold transition-all"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Paste from Clipboard (បិទភ្ជាប់)</span>
                  </button>
                </div>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={13}
                  className="w-full bg-studio-900 border border-studio-800 rounded-2xl p-4 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 font-sans leading-relaxed"
                  placeholder="[Intro]\n[Verse 1]\nបិទភ្ជាប់ទំនុកច្រៀងពី Suno នៅទីនេះ...\n\n[Chorus]\n..."
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400">
                  💡 បន្ទាប់ពី Paste រួច ចុច <strong>"Sync & Calculate Timing"</strong> ដើម្បីបំប្លែងទៅជា Subtitle & Karaoke timestamps ដោយស្វ័យប្រវត្តិ!
                </p>
                <button
                  onClick={handleRecomputeFromRaw}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Sync & Calculate Timing ⏱️</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'srt_preview' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-bold text-slate-300">Format SRT (SubRip) សម្រាប់ YouTube Video MV:</span>
                <button
                  onClick={handleCopySRT}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-studio-800 hover:bg-studio-700 text-slate-300 text-xs font-bold transition-all"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>
              <pre className="p-4 rounded-2xl bg-studio-900/90 border border-studio-800 text-xs font-mono text-emerald-300 overflow-x-auto max-h-[55vh] custom-scrollbar">
                {generateSRTFromLines(timedLines)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-studio-800/80 bg-studio-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>SRT (YouTube Captions) & LRC (Karaoke Sync) ready</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-studio-900 hover:bg-studio-800 text-slate-300 text-xs font-bold transition-all"
            >
              បិទ (Close)
            </button>
            <button
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>រក្សាទុកទាំងអស់ (Save & Apply)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
