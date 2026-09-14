'use client';

import React, { useState } from 'react';
import { Track } from '@/lib/types';
import { 
  Play, 
  Pause, 
  Download, 
  FileText, 
  Music, 
  Clock, 
  Trash2,
  CheckCircle2,
  FileCode2,
  Video,
  Pencil,
  Check,
  X,
  Sliders,
  Sparkles,
  PanelRightOpen
} from 'lucide-react';
import { generateLRC, generateSRT, generateLRCFromLines, generateSRTFromLines, downloadTextFile } from '@/lib/subtitle-generator';
import { analyzeAudioVocalTiming } from '@/lib/audio-vocal-aligner';
import { LyricsModal } from '@/components/LyricsModal';
import { remasterAudioToWav, getProxiedAudioUrl } from '@/lib/audio-remaster';

interface TrackFeedProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track) => void;
  onTogglePlay: () => void;
  onDeleteTrack: (id: string) => void;
  onDeleteTracks?: (ids: string[]) => void;
  onRenameTrack?: (id: string, newTitle: string) => void;
  onSaveTrackLyrics?: (trackId: string, newLyrics: string) => void;
  onSeekAudio?: (timeInSeconds: number) => void;
  onOpenInspector?: (track: Track) => void;
}

export const TrackFeed: React.FC<TrackFeedProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onPlayTrack,
  onTogglePlay,
  onDeleteTrack,
  onDeleteTracks,
  onRenameTrack,
  onSaveTrackLyrics,
  onSeekAudio,
  onOpenInspector
}) => {
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [lyricsModalTrack, setLyricsModalTrack] = useState<Track | null>(null);
  const [remasteringTrackId, setRemasteringTrackId] = useState<string | null>(null);
  const [remasterProgress, setRemasterProgress] = useState<number>(0);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [isBatchDownloading, setIsBatchDownloading] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<string>('');

  const handleToggleSelect = (trackId: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e && 'stopPropagation' in e) e.stopPropagation();
    setSelectedTrackIds(prev => 
      prev.includes(trackId) ? prev.filter(id => id !== trackId) : [...prev, trackId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTrackIds.length === tracks.length) {
      setSelectedTrackIds([]);
    } else {
      setSelectedTrackIds(tracks.map(t => t.id));
    }
  };

  const handleBatchDownloadMP3 = async () => {
    const selected = tracks.filter(t => selectedTrackIds.includes(t.id));
    if (selected.length === 0) return;
    setIsBatchDownloading(true);
    for (let i = 0; i < selected.length; i++) {
      setBatchProgress(`MP3 (${i + 1}/${selected.length})...`);
      await handleDownloadMP3(selected[i]);
      await new Promise(r => setTimeout(r, 600)); // 600ms delay between downloads
    }
    setIsBatchDownloading(false);
    setBatchProgress('');
  };

  const handleBatchDownloadWAV = async () => {
    const selected = tracks.filter(t => selectedTrackIds.includes(t.id));
    if (selected.length === 0) return;
    setIsBatchDownloading(true);
    for (let i = 0; i < selected.length; i++) {
      setBatchProgress(`Mastering (${i + 1}/${selected.length})...`);
      await handleDownloadWAV(selected[i]);
      await new Promise(r => setTimeout(r, 600));
    }
    setIsBatchDownloading(false);
    setBatchProgress('');
  };

  const handleBatchDownloadMP4 = async () => {
    const selected = tracks.filter(t => selectedTrackIds.includes(t.id));
    if (selected.length === 0) return;
    setIsBatchDownloading(true);
    for (let i = 0; i < selected.length; i++) {
      setBatchProgress(`Video (${i + 1}/${selected.length})...`);
      await handleDownloadMP4(selected[i]);
      await new Promise(r => setTimeout(r, 600));
    }
    setIsBatchDownloading(false);
    setBatchProgress('');
  };

  const handleBatchDelete = () => {
    const count = selectedTrackIds.length;
    if (count === 0) return;
    const isConfirmed = window.confirm(`តើបងពិតជាចង់លុប ${count} បទដែលបានជ្រើសរើសនេះមែនទេ?\n(Are you sure you want to delete ${count} selected tracks?)`);
    if (isConfirmed) {
      if (onDeleteTracks) {
        onDeleteTracks(selectedTrackIds);
      } else {
        selectedTrackIds.forEach(id => onDeleteTrack(id));
      }
      setSelectedTrackIds([]);
    }
  };

  const handleStartEdit = (track: Track, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTrackId(track.id);
    setEditingTitle(track.title);
  };

  const handleSaveEdit = (trackId: string, e?: React.MouseEvent | React.FormEvent) => {
    if (e) e.stopPropagation();
    if (editingTitle.trim() && onRenameTrack) {
      onRenameTrack(trackId, editingTitle.trim());
    }
    setEditingTrackId(null);
  };

  const handleCancelEdit = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTrackId(null);
  };

  const handleDeleteClick = (track: Track, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isConfirmed = window.confirm(`តើបងពិតជាចង់លុបបទចម្រៀង "${track.title}" នេះមែនទេ?\n(Are you sure you want to delete this track?)`);
    if (isConfirmed) {
      onDeleteTrack(track.id);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleDownloadMP4 = async (track: Track) => {
    const rawTarget = track.videoUrl || (track.audioUrl ? track.audioUrl.replace('.mp3', '.mp4') : '');
    if (!rawTarget) {
      alert('មិនមាន Video URL សម្រាប់បទនេះទេ');
      return;
    }
    const targetUrl = getProxiedAudioUrl(rawTarget);
    try {
      const res = await fetch(targetUrl);
      if (!res.ok) throw new Error('Proxy fetch failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${track.title.replace(/\s+/g, '_')}_Video.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Video MP4 មិនទាន់មាននៅលើ Suno Server នៅឡើយទេ ឬត្រូវបានចាក់សោរ។ សូមទាញយក MP3 ឬ Mastered WAV ជំនួសវិញ!');
    }
  };

  const handleDownloadMP3 = async (track: Track) => {
    try {
      const cleanTitle = (track.title || 'suno_master').replace(/[\\/*?:"<>|]/g, '').trim();
      const downloadEndpoint = `/api/download-mp3?url=${encodeURIComponent(track.audioUrl)}&title=${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(downloadEndpoint);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanTitle}_320k.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        return;
      }
      // Fallback
      const targetUrl = getProxiedAudioUrl(track.audioUrl);
      const fallbackRes = await fetch(targetUrl);
      if (!fallbackRes.ok) throw new Error(`Proxy HTTP ${fallbackRes.status}`);
      const blob = await fallbackRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanTitle}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Download Error:', e);
      alert('មានបញ្ហាក្នុងការទាញយក! សូមព្យាយាមចុច 24-bit Mastered WAV ជំនួសវិញ។');
    }
  };

  const handleDownloadWAV = async (track: Track) => {
    try {
      setRemasteringTrackId(track.id);
      setRemasterProgress(15);
      const cleanTitle = (track.title || 'suno_master').replace(/[\\/*?:"<>|]/g, '').trim();
      const targetUrl = track.audioUrl || track.wavUrl || '';

      // 1. First attempt: Dedicated Studio-Grade 24-bit 48kHz WAV Transcoder Endpoint
      try {
        const downloadEndpoint = `/api/download-wav?url=${encodeURIComponent(targetUrl)}&title=${encodeURIComponent(cleanTitle)}`;
        const res = await fetch(downloadEndpoint);
        if (res.ok) {
          setRemasterProgress(90);
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${cleanTitle}_24bit_Master.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          return;
        }
      } catch (srvErr) {
        console.warn('Server WAV transcode endpoint error, attempting client remastering fallback:', srvErr);
      }

      // 2. Fallback: Client-Side Web Audio API DSP Remastering
      const wavBlob = await remasterAudioToWav(targetUrl, undefined, (progress) => {
        setRemasterProgress(progress);
      });

      const url = window.URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanTitle}_24bit_Master.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('WAV Download Error:', e);
      alert('មានបញ្ហាក្នុងការទាញយក Mastered WAV! សូមព្យាយាមទាញយក MP3 ជំនួសវិញ។');
    } finally {
      setRemasteringTrackId(null);
      setRemasterProgress(0);
    }
  };

  const [lrcScanningId, setLrcScanningId] = useState<string | null>(null);
  const [srtScanningId, setSrtScanningId] = useState<string | null>(null);

  const handleDownloadLRC = async (track: Track) => {
    if (track.audioUrl && track.lyrics) {
      setLrcScanningId(track.id);
      try {
        const timedLines = await analyzeAudioVocalTiming(track.audioUrl, track.lyrics, track.duration || 195);
        const lrcContent = generateLRCFromLines(track.title, track.title, timedLines);
        downloadTextFile(`${track.title.replace(/\s+/g, '_')}_Lyrics.lrc`, lrcContent);
      } catch (e) {
        // Fallback to basic generation
        const lrcContent = generateLRC(track.title, track.title, track.lyrics, track.duration);
        downloadTextFile(`${track.title.replace(/\s+/g, '_')}_Lyrics.lrc`, lrcContent);
      } finally {
        setLrcScanningId(null);
      }
    } else {
      const lrcContent = generateLRC(track.title, track.title, track.lyrics, track.duration);
      downloadTextFile(`${track.title.replace(/\s+/g, '_')}_Lyrics.lrc`, lrcContent);
    }
  };

  const handleDownloadSRT = async (track: Track) => {
    if (track.audioUrl && track.lyrics) {
      setSrtScanningId(track.id);
      try {
        const timedLines = await analyzeAudioVocalTiming(track.audioUrl, track.lyrics, track.duration || 195);
        const srtContent = generateSRTFromLines(timedLines);
        downloadTextFile(`${track.title.replace(/\s+/g, '_')}_YouTube_Captions.srt`, srtContent);
      } catch (e) {
        const srtContent = generateSRT(track.lyrics, track.duration);
        downloadTextFile(`${track.title.replace(/\s+/g, '_')}_YouTube_Captions.srt`, srtContent);
      } finally {
        setSrtScanningId(null);
      }
    } else {
      const srtContent = generateSRT(track.lyrics, track.duration);
      downloadTextFile(`${track.title.replace(/\s+/g, '_')}_YouTube_Captions.srt`, srtContent);
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none bg-studio-900/30">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center mb-4 shadow-xl shadow-violet-500/10 animate-bounce">
          <Music className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="text-base font-bold text-slate-200 mb-1">
          មិនទាន់មានបទចម្រៀងនៅឡើយទេ
        </h3>
        <p className="text-xs text-slate-400 max-w-sm leading-relaxed mb-6">
          សូមជ្រើសរើសចង្វាក់ខ្មែរ រួចចុចប៊ូតុង <strong className="text-violet-400">"បង្កើតបទចម្រៀង (Create Song)"</strong> នៅខាងឆ្វេង ដើម្បីផលិតចម្រៀងថ្មីម្តង ២ បទ!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-5 overflow-y-auto space-y-3.5 custom-scrollbar bg-studio-900/20">
      {/* Header Bar with Batch Action Controls */}
      <div className="flex items-center justify-between pb-2.5 border-b border-studio-800/80 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-2 cursor-pointer group" title="ជ្រើសរើសទាំងអស់ (Select All)">
            <input
              type="checkbox"
              checked={tracks.length > 0 && selectedTrackIds.length === tracks.length}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-studio-700 bg-studio-900 text-violet-600 focus:ring-violet-500 cursor-pointer accent-violet-600"
            />
            <span className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
              ជ្រើសរើសទាំងអស់ (All)
            </span>
          </label>

          <span className="px-2 py-0.5 rounded-md bg-studio-800 text-[11px] font-semibold text-cyan-400 border border-studio-700">
            {tracks.length} Tracks
          </span>
        </div>

        {/* Dynamic Multi-Select Action Bar */}
        {selectedTrackIds.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 px-2 rounded-xl bg-gradient-to-r from-violet-950/80 to-studio-900 border border-violet-500/50 shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <span className="text-[11px] font-bold text-violet-300 px-1">
              {selectedTrackIds.length} បានជ្រើសរើស:
            </span>

            {/* Batch MP3 */}
            <button
              disabled={isBatchDownloading}
              onClick={handleBatchDownloadMP3}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold transition-all shadow-xs active:scale-95"
            >
              <Download className="w-3 h-3" />
              <span>{isBatchDownloading && batchProgress.startsWith('MP3') ? batchProgress : 'Batch MP3'}</span>
            </button>

            {/* Batch Mastered WAV */}
            <button
              disabled={isBatchDownloading}
              onClick={handleBatchDownloadWAV}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[11px] font-bold transition-all shadow-xs active:scale-95"
            >
              <Sparkles className="w-3 h-3 text-cyan-200" />
              <span>{isBatchDownloading && batchProgress.startsWith('Mastering') ? batchProgress : 'Batch WAV'}</span>
            </button>

            {/* Batch MP4 */}
            <button
              disabled={isBatchDownloading}
              onClick={handleBatchDownloadMP4}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-bold transition-all shadow-xs active:scale-95"
            >
              <Video className="w-3 h-3" />
              <span>{isBatchDownloading && batchProgress.startsWith('Video') ? batchProgress : 'Batch MP4'}</span>
            </button>

            {/* Batch Delete */}
            <button
              disabled={isBatchDownloading}
              onClick={handleBatchDelete}
              title="លុបបទដែលបានជ្រើសរើស"
              className="p-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white transition-all ml-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {tracks.map((track) => {
          const isCurrent = currentTrack?.id === track.id;
          const isThisPlaying = isCurrent && isPlaying;
          const isSelected = selectedTrackIds.includes(track.id);

          return (
            <div
              key={track.id}
              className={`p-2.5 px-3 rounded-xl border transition-all duration-200 ${
                isSelected
                  ? 'bg-gradient-to-r from-violet-950/60 via-studio-850 to-studio-900 border-violet-500/80 shadow-md shadow-violet-500/10'
                  : isCurrent
                  ? 'bg-gradient-to-r from-violet-950/40 via-studio-850 to-studio-900 border-violet-500/60 shadow-md shadow-violet-500/10'
                  : 'bg-studio-950/70 border-studio-800/80 hover:border-studio-700 hover:bg-studio-900/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2.5">
                {/* Left: Checkbox + Artwork + Compact Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Select Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleToggleSelect(track.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-studio-700 bg-studio-900 text-violet-600 focus:ring-violet-500 cursor-pointer accent-violet-600 flex-shrink-0"
                  />

                  {/* Compact Artwork with Play Button */}
                  <div 
                    onClick={() => {
                      if (isCurrent) {
                        onTogglePlay();
                      } else {
                        onPlayTrack(track);
                      }
                    }}
                    className="relative w-10 h-10 rounded-lg overflow-hidden bg-studio-800 flex-shrink-0 cursor-pointer group shadow border border-studio-700/60"
                  >
                    <img 
                      src={track.coverUrl} 
                      alt={track.title}
                      onError={(e: any) => {
                        e.target.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';
                      }}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" 
                    />
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                      isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}>
                      <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center shadow">
                        {isThisPlaying ? <Pause className="w-3 h-3 fill-white" /> : <Play className="w-3 h-3 fill-white ml-0.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Title & Metadata (2 compact lines) */}
                  <div className="min-w-0 flex-1">
                    {/* Line 1: Title + Badges */}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {editingTrackId === track.id ? (
                        <div className="flex items-center gap-1 flex-1 max-w-sm" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTitle}
                            autoFocus
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(track.id, e);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="bg-studio-900 border border-violet-500 rounded px-2 py-0.5 text-xs text-white font-bold focus:outline-none flex-1"
                            placeholder="ឈ្មោះបទ..."
                          />
                          <button
                            onClick={(e) => handleSaveEdit(track.id, e)}
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleCancelEdit(e)}
                            className="p-1 rounded bg-studio-800 text-slate-400 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 min-w-0 max-w-md group/title cursor-pointer" onClick={(e) => handleStartEdit(track, e)} title="ចុចដើម្បីកែឈ្មោះ (Click to Rename)">
                          <h3 className="text-xs font-bold text-white truncate hover:text-violet-300 transition-colors">
                            {track.title}
                          </h3>
                          <button 
                            type="button" 
                            onClick={(e) => handleStartEdit(track, e)}
                            className="p-0.5 text-slate-500 group-hover/title:text-violet-400 opacity-50 group-hover/title:opacity-100 transition-opacity"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
                      <span className="px-1.5 py-0.2 rounded bg-violet-600/30 text-violet-300 font-bold text-[9px] border border-violet-500/30 flex-shrink-0">
                        V{track.version}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 font-semibold text-[9px] border border-cyan-500/30 flex-shrink-0 flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                        24-bit HD
                      </span>
                    </div>

                    {/* Line 2: Style & Duration */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="truncate max-w-[200px] text-slate-400 font-normal">{track.style}</span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-slate-400 flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(track.duration)}
                      </span>
                      <span>•</span>
                      <span className="text-slate-500 flex-shrink-0">{new Date(track.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Action Buttons in a Single Compact Row */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* MP3 Download */}
                  <button
                    onClick={() => handleDownloadMP3(track)}
                    title="ទាញយក MP3 320kbps"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/40 text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
                  >
                    <Download className="w-3 h-3" />
                    <span>MP3</span>
                  </button>

                  {/* 24-bit Lossless Mastered WAV */}
                  <button
                    disabled={remasteringTrackId === track.id}
                    onClick={() => handleDownloadWAV(track)}
                    title="ទាញយក 24-bit Lossless Mastered WAV (Auto-Remastered -14 LUFS)"
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                      remasteringTrackId === track.id
                        ? 'bg-cyan-600/30 text-cyan-200 border-cyan-500 animate-pulse cursor-wait'
                        : 'bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 text-cyan-200 border-cyan-400/50 hover:scale-105 active:scale-95'
                    }`}
                  >
                    {remasteringTrackId === track.id ? (
                      <>
                        <div className="w-3 h-3 border-2 border-slate-300 border-t-cyan-400 rounded-full animate-spin" />
                        <span>({remasterProgress}%)</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span>Mastered WAV</span>
                      </>
                    )}
                  </button>

                  {/* MP4 Video */}
                  <button
                    onClick={() => handleDownloadMP4(track)}
                    title="ទាញយក Video MP4"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/40 text-pink-300 border border-pink-500/40 text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
                  >
                    <Video className="w-3 h-3" />
                    <span>MP4</span>
                  </button>

                  {/* SRT YouTube Subtitles (Auto Audio Scan) */}
                  <button
                    onClick={() => handleDownloadSRT(track)}
                    disabled={srtScanningId === track.id}
                    title="⚡ ស្កេន Audio រួច Download SRT ស្វ័យប្រវត្តិ"
                    className={`flex items-center gap-0.5 px-1.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                      srtScanningId === track.id
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                        : 'bg-studio-800 hover:bg-studio-700 text-slate-300 border-studio-700 hover:text-white'
                    }`}
                  >
                    {srtScanningId === track.id ? (
                      <>
                        <div className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <FileCode2 className="w-3 h-3 text-amber-400" />
                        <span>SRT</span>
                      </>
                    )}
                  </button>

                  {/* LRC Karaoke Lyrics (Auto Audio Scan) */}
                  <button
                    onClick={() => handleDownloadLRC(track)}
                    disabled={lrcScanningId === track.id}
                    title="⚡ ស្កេន Audio រួច Download LRC ស្វ័យប្រវត្តិ"
                    className={`flex items-center gap-0.5 px-1.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                      lrcScanningId === track.id
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 animate-pulse'
                        : 'bg-studio-800 hover:bg-studio-700 text-slate-300 border-studio-700 hover:text-white'
                    }`}
                  >
                    {lrcScanningId === track.id ? (
                      <>
                        <div className="w-3 h-3 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3 text-emerald-400" />
                        <span>LRC</span>
                      </>
                    )}
                  </button>

                  {/* Lyrics Studio Modal */}
                  <button
                    onClick={() => setLyricsModalTrack(track)}
                    title="Lyrics & Subtitle Studio"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 border border-violet-500/40 text-[11px] font-semibold transition-all hover:text-white"
                  >
                    <Sliders className="w-3 h-3 text-violet-400" />
                    <span>Lyrics</span>
                  </button>

                  {/* Suno-Style Track Details & Inspector */}
                  {onOpenInspector && (
                    <button
                      onClick={() => onOpenInspector(track)}
                      title="Open Track Inspector (Details & Lyrics Drawer)"
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-all border border-white/5"
                    >
                      <PanelRightOpen className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Button with Confirmation */}
                  <button
                    onClick={(e) => handleDeleteClick(track, e)}
                    title="លុបបទនេះ"
                    className="p-1 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all ml-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lyrics & Subtitle Studio Modal */}
      {lyricsModalTrack && (
        <LyricsModal
          isOpen={!!lyricsModalTrack}
          onClose={() => setLyricsModalTrack(null)}
          track={lyricsModalTrack}
          onSaveTrackLyrics={(trackId, newLyrics) => {
            if (onSaveTrackLyrics) {
              onSaveTrackLyrics(trackId, newLyrics);
            }
            // Also update local copy in modal
            setLyricsModalTrack(prev => prev ? { ...prev, lyrics: newLyrics } : null);
          }}
          onSeekAudio={onSeekAudio}
        />
      )}
    </div>
  );
};
