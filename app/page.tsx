'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { CreatePanel } from '@/components/CreatePanel';
import { TrackFeed } from '@/components/TrackFeed';
import { AudioPlayer } from '@/components/AudioPlayer';
import { SettingsModal } from '@/components/SettingsModal';
import { TrackInspector } from '@/components/TrackInspector';
import { LyricsModal } from '@/components/LyricsModal';
import { GenerateParams, Track } from '@/lib/types';
import { createTrackPair } from '@/lib/audio-service';
import { getSavedTracks, saveTracks } from '@/lib/storage';

export default function StudioPage() {
  const [activeTab, setActiveTab] = useState<string>('create');
  const [credits, setCredits] = useState<number>(480);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatingStatus, setGeneratingStatus] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [lyricsModalTrack, setLyricsModalTrack] = useState<Track | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [apiProvider, setApiProvider] = useState<string>('piapi');

  // Load saved tracks and API key on initial client mount
  useEffect(() => {
    const savedKey = localStorage.getItem('ai_music_api_key');
    const savedProvider = localStorage.getItem('ai_music_api_provider');
    if (savedKey) setApiKey(savedKey);
    if (savedProvider) setApiProvider(savedProvider);

    const saved = getSavedTracks();
    if (saved && saved.length > 0) {
      setTracks(saved);
      setCurrentTrack(saved[0]);
    } else {
      setTracks([]);
    }
  }, []);

  const handleGenerate = async (params: GenerateParams) => {
    if (!apiKey || apiKey.trim().length === 0) {
      alert('សូមបញ្ចូល API Key របស់អ្នកនៅក្នុង "⚙️ ការកំណត់ API (Settings)" ជាមុនសិន ដើម្បីឱ្យ AI ច្រៀងចេញសំឡេងមនុស្សពិតប្រាកដបាទ!');
      setIsSettingsOpen(true);
      return;
    }

    setIsGenerating(true);
    setGeneratingStatus('កំពុងចាប់ផ្តើម...');
    try {
      setCredits(prev => Math.max(0, prev - 10));

      const [newTrack1, newTrack2] = await createTrackPair(
        params, 
        apiKey, 
        apiProvider,
        (statusText) => setGeneratingStatus(statusText)
      );

      const updated = [newTrack1, newTrack2, ...tracks];
      setTracks(updated);
      saveTracks(updated);

      setCurrentTrack(newTrack1);
      setIsPlaying(true);
    } catch (e: any) {
      console.error('Error generating tracks:', e);
      alert('AI Server Message: ' + (e.message || 'មានបញ្ហាក្នុងការបង្កើតបទចម្រៀង សូមព្យាយាមម្តងទៀត!'));
    } finally {
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  };

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleNextTrack = () => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % tracks.length;
    setCurrentTrack(tracks[nextIndex]);
  };

  const handlePrevTrack = () => {
    if (!currentTrack || tracks.length === 0) return;
    const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
    const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    setCurrentTrack(tracks[prevIndex]);
  };

  const handleDeleteTrack = (id: string) => {
    setTracks(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveTracks(updated);
      return updated;
    });
    if (currentTrack?.id === id) {
      setCurrentTrack(null);
      setIsPlaying(false);
    }
  };

  const handleDeleteTracks = (ids: string[]) => {
    const idSet = new Set(ids);
    setTracks(prev => {
      const updated = prev.filter(t => !idSet.has(t.id));
      saveTracks(updated);
      return updated;
    });
    if (currentTrack && idSet.has(currentTrack.id)) {
      setCurrentTrack(null);
      setIsPlaying(false);
    }
  };

  const handleRenameTrack = (id: string, newTitle: string) => {
    const updated = tracks.map(t => t.id === id ? { ...t, title: newTitle } : t);
    setTracks(updated);
    saveTracks(updated);
    if (currentTrack?.id === id) {
      setCurrentTrack({ ...currentTrack, title: newTitle });
    }
  };

  const handleSaveTrackLyrics = (id: string, newLyrics: string) => {
    const updated = tracks.map(t => t.id === id ? { ...t, lyrics: newLyrics } : t);
    setTracks(updated);
    saveTracks(updated);
    if (currentTrack?.id === id) {
      setCurrentTrack({ ...currentTrack, lyrics: newLyrics });
    }
  };

  const handleImportTracks = (importedTracks: Track[]) => {
    if (!importedTracks || importedTracks.length === 0) return;
    setTracks(prev => {
      const existingIds = new Set(prev.map(t => t.id));
      const fresh = importedTracks.filter(t => !existingIds.has(t.id));
      const updated = [...fresh, ...prev];
      saveTracks(updated);
      return updated;
    });
    setCurrentTrack(importedTracks[0]);
    setIsPlaying(true);
  };

  const handleImportTrack = (importedTrack: Track) => {
    handleImportTracks([importedTrack]);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-studio-950 text-slate-100">
      {/* Main 3-Column Studio Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Sidebar Navigation */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            if (tab === 'settings') {
              setIsSettingsOpen(true);
            } else {
              setActiveTab(tab);
            }
          }} 
          credits={credits} 
        />

        {/* Center: Creation Workstation Panel */}
        <CreatePanel 
          onGenerate={handleGenerate} 
          onImportTrack={handleImportTrack}
          onImportTracks={handleImportTracks}
          isGenerating={isGenerating} 
          generatingStatus={generatingStatus}
        />

        {/* Right: Tracks & Workspaces Feed */}
        <TrackFeed 
          tracks={tracks}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onPlayTrack={handlePlayTrack}
          onTogglePlay={handleTogglePlay}
          onDeleteTrack={handleDeleteTrack}
          onDeleteTracks={handleDeleteTracks}
          onRenameTrack={handleRenameTrack}
          onSaveTrackLyrics={handleSaveTrackLyrics}
          onOpenInspector={(track) => {
            setCurrentTrack(track);
            setIsInspectorOpen(true);
          }}
        />

        {/* Far Right: Suno-Style Track Inspector Slide-out Drawer */}
        {isInspectorOpen && (
          <TrackInspector
            isOpen={isInspectorOpen}
            onClose={() => setIsInspectorOpen(false)}
            track={currentTrack}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlay}
            onOpenLyricsModal={(track) => setLyricsModalTrack(track)}
          />
        )}
      </div>

      {/* Bottom: Sticky Studio Audio Player */}
      <AudioPlayer 
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onNextTrack={handleNextTrack}
        onPrevTrack={handlePrevTrack}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        isInspectorOpen={isInspectorOpen}
      />

      {/* Global Lyrics Modal */}
      {lyricsModalTrack && (
        <LyricsModal
          isOpen={!!lyricsModalTrack}
          onClose={() => setLyricsModalTrack(null)}
          track={lyricsModalTrack}
          onSaveTrackLyrics={handleSaveTrackLyrics}
        />
      )}

      {/* API Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        provider={apiProvider}
        onSaveApiKey={(key, prov) => {
          setApiKey(key);
          setApiProvider(prov);
          localStorage.setItem('ai_music_api_key', key);
          localStorage.setItem('ai_music_api_provider', prov);
          localStorage.setItem('ai_music_studio_api_key', key);
        }}
      />
    </div>
  );
}
