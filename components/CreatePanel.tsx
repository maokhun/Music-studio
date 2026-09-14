'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Wand2, 
  Mic, 
  VolumeX, 
  Flame,
  Link,
  Download,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { PresetSelector } from './PresetSelector';
import { GenerateParams, PresetStyle, Track } from '@/lib/types';
import { generateSmartLyrics } from '@/lib/lyrics-generator';

interface CreatePanelProps {
  onGenerate: (params: GenerateParams) => Promise<void>;
  onImportTrack?: (track: Track) => void;
  onImportTracks?: (tracks: Track[]) => void;
  isGenerating: boolean;
  generatingStatus?: string;
}

export const CreatePanel: React.FC<CreatePanelProps> = ({ 
  onGenerate, 
  onImportTrack, 
  onImportTracks,
  isGenerating, 
  generatingStatus 
}) => {
  const [modeTab, setModeTab] = useState<'create' | 'import'>('create');
  const [sunoUrlInput, setSunoUrlInput] = useState<string>('');
  const [sunoLyricsInput, setSunoLyricsInput] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [customMode, setCustomMode] = useState<boolean>(true);
  const [title, setTitle] = useState<string>('ស្នេហ៍ក្នុងក្តីស្រមៃ');
  const [lyrics, setLyrics] = useState<string>(
`[Verse 1]
សម្លឹងមើលទៅមេឃ ឃើញផ្កាយភ្លឺចែងចាំង
ក្នុងចិត្តនឹកដល់អូន គ្រប់ពេលវេលា
ទោះបីជាផ្លូវឆ្ងាយ ក៏បេះដូងនៅក្បែរ
មិនដែលប្រែប្រួល ស្នេហ៍តែរូបអូន។

[Chorus]
ស្នេហាពិតប្រាកដ មានតែអូនម្នាក់គត់
សូមសន្យានឹងគ្នា ថែរក្សាជារៀងរហូត
ទោះមានព្យុះភ្លៀង ក៏មិនបោះបង់
កាន់ដៃគ្នាឆ្លង ទៅដល់ត្រើយសុភមង្គល។`
  );
  const [style, setStyle] = useState<string>('Khmer modern slow pop, sweet female vocal, acoustic guitar, romantic 75 bpm');
  const [model, setModel] = useState<'V4.0' | 'V5.5 HQ' | 'Custom Pro'>('V5.5 HQ');
  const [isInstrumental, setIsInstrumental] = useState<boolean>(false);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>('khmer-slow-pop');
  const [topicPrompt, setTopicPrompt] = useState<string>('');

  const handleSelectPreset = (preset: PresetStyle) => {
    setSelectedPresetId(preset.id);
    setStyle(preset.stylePrompt);
    if (!customMode) {
      setTopicPrompt(preset.suggestedPrompt);
    }
  };

  const handleAutoGenerateLyrics = () => {
    const topic = topicPrompt || title || 'ស្នេហាមនោសញ្ចេតនា';
    const result = generateSmartLyrics(topic, selectedPresetId || '');
    setTitle(result.title);
    setLyrics(result.lyrics);
    if (!style) {
      setStyle(result.style);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;

    onGenerate({
      title,
      lyrics: customMode ? lyrics : topicPrompt,
      style,
      model,
      isInstrumental,
      customMode
    });
  };
  const [importProgress, setImportProgress] = useState<string>('');

  const handleImportSunoLink = async () => {
    if (!sunoUrlInput.trim()) {
      alert('សូមបិទភ្ជាប់ Suno Song Link ឬ Playlist Link ជាមុនសិនបាទ!');
      return;
    }

    // 1. Clean and stitch accidental line breaks within single URLs
    const sanitized = sunoUrlInput
      .replace(/(https?:\/\/[^\s]+)\s*\n\s*([0-9a-fA-F-]{4,})/g, '$1$2')
      .trim();

    // Extract all URLs or links
    let rawLinks: string[] = [];
    const urlMatches = sanitized.match(/(https?:\/\/[^\s,]+)/gi);
    if (urlMatches && urlMatches.length > 0) {
      rawLinks = urlMatches.map(u => u.replace(/[>)"'\]]+$/, '').trim()).filter(Boolean);
    } else {
      rawLinks = sanitized.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 10);
    }

    if (rawLinks.length === 0) {
      alert('សូមបិទភ្ជាប់ Link ត្រឹមត្រូវ!');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;
    const allImportedTracks: Track[] = [];

    // Get user saved token for authorized Suno API calls
    const savedToken = (typeof window !== 'undefined' && (localStorage.getItem('ai_music_api_key') || localStorage.getItem('ai_music_studio_api_key'))) || '';

    for (let i = 0; i < rawLinks.length; i++) {
      const link = rawLinks[i];
      const isPl = link.includes('/playlist');
      setImportProgress(isPl ? `កំពុងទាញយក Playlist ${i + 1} / ${rawLinks.length}...` : `កំពុងទាញយក ${i + 1} / ${rawLinks.length}...`);

      try {
        const res = await fetch('/api/import-suno', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: link, token: savedToken })
        });

        const json = await res.json();
        const tracksToImport: any[] = json.tracks || (json.data ? [json.data] : []);

        if (!json.success || tracksToImport.length === 0) {
          failCount++;
          continue;
        }

        for (let tIdx = 0; tIdx < tracksToImport.length; tIdx++) {
          const item = tracksToImport[tIdx];
          const importedTrack: Track = {
            id: 'suno_imp_' + Date.now() + '_' + i + '_' + tIdx + '_' + Math.random().toString(36).substring(2, 6),
            groupId: 'suno_grp_' + Date.now() + '_' + i + '_' + tIdx,
            version: 1,
            title: item.title || `Suno Track ${i + 1} (${item.songId?.substring(0, 8)})`,
            lyrics: sunoLyricsInput.trim() || item.lyrics || '',
            style: item.style || 'Suno Official 320kbps Master (Unlimited Download)',
            model: 'V5.5 HQ',
            duration: item.duration || 195,
            audioUrl: item.audioUrl,
            wavUrl: item.audioUrl,
            videoUrl: item.videoUrl || (item.songId ? `https://cdn1.suno.ai/${item.songId}.mp4` : undefined),
            coverUrl: item.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
            status: 'ready',
            createdAt: new Date().toISOString()
          };

          allImportedTracks.push(importedTrack);
          successCount++;
        }
      } catch (e: any) {
        console.error('Import error for link:', link, e);
        failCount++;
      }
    }

    // Atomically import all tracks at once to prevent React state overwrite
    if (allImportedTracks.length > 0) {
      if (onImportTracks) {
        onImportTracks(allImportedTracks);
      } else if (onImportTrack) {
        allImportedTracks.forEach(t => onImportTrack(t));
      }
    }

    setSunoUrlInput('');
    setImportProgress('');
    setIsImporting(false);

    if (successCount > 0 && failCount === 0) {
      alert(`🎉 នាំចូល ${successCount} បទជោគជ័យ! ចុច Play ស្តាប់ និងទាញយក MP3, Mastered WAV, SRT បានភ្លាមៗ!`);
    } else if (successCount > 0) {
      alert(`✅ នាំចូលជោគជ័យ ${successCount} បទ, ❌ បរាជ័យ ${failCount} Link`);
    } else {
      alert('❌ មិនអាចនាំចូលបានទេ។ សូមពិនិត្យមើល Link បទចម្រៀង ឬ Playlist ពី Suno (suno.com/song/... ឬ suno.com/playlist/...)');
    }
  };

  return (
    <div className="w-[440px] bg-studio-950/80 border-r border-studio-800/80 flex flex-col h-full overflow-hidden">
      {/* Panel Top Navigation */}
      <div className="p-3 border-b border-studio-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-studio-900 border border-studio-800">
          <button
            type="button"
            onClick={() => setModeTab('create')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              modeTab === 'create' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Studio Create 🎵
          </button>
          <button
            type="button"
            onClick={() => setModeTab('import')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              modeTab === 'import' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Suno Importer ⚡
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-studio-900 border border-studio-800 px-2.5 py-1 rounded-xl">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-slate-300">V5.5 HQ</span>
        </div>
      </div>

      {modeTab === 'import' ? (
        /* Suno 1-Click Importer and Infinite Downloader */
        <div className="flex-1 p-5 space-y-4 overflow-y-auto custom-scrollbar">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-studio-900 border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Sparkles className="w-4.5 h-4.5 animate-pulse" />
              <span>Suno Infinite Downloader (Bypass Limit)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              បំបែកដែនកំណត់ Download ២០ បទរបស់ Suno! គ្រាន់តែបិទភ្ជាប់ Link បទចម្រៀងពី Suno ចូលទីនេះ ដើម្បីទាញយក <strong>MP3 320k, Lossless WAV, និង Subtitle SRT</strong> គ្មានដែនកំណត់!
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-cyan-400" />
              <span>បិទភ្ជាប់ Suno Song ឬ Playlist Links (Paste 1 or more URLs):</span>
            </label>
            <textarea
              value={sunoUrlInput}
              onChange={(e) => setSunoUrlInput(e.target.value)}
              rows={4}
              placeholder={"https://suno.com/song/xxxxxxxx-xxxx-...\nhttps://suno.com/playlist/yyyyyyyy-yyyy-...\nhttps://suno.com/song/zzzzzzzz-zzzz-..."}
              className="w-full bg-studio-900 border border-studio-800 rounded-xl px-3.5 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono shadow-inner resize-none"
            />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              💡 អាច Paste Link បទចម្រៀងទោល ឬ Playlist Link (មួយជួរមួយ Link)។ ប្រព័ន្ធនឹងទាញយកបទទាំងអស់ពី Playlist ចូលក្នុង Studio ដោយស្វ័យប្រវត្តិ!
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-400" />
                <span>ទំនុកច្រៀង (Lyrics - ស្រេចចិត្ត សម្រាប់ SRT / LRC):</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>
            <textarea
              value={sunoLyricsInput}
              onChange={(e) => setSunoLyricsInput(e.target.value)}
              rows={3}
              placeholder="[Intro]\n[Verse 1]\nបិទភ្ជាប់ទំនុកច្រៀងនៅទីនេះ ដើម្បីបង្កើត Subtitle SRT ត្រូវតាមម៉ោង..."
              className="w-full bg-studio-900 border border-studio-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans shadow-inner resize-none"
            />
          </div>

          <button
            type="button"
            disabled={isImporting}
            onClick={handleImportSunoLink}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg transition-all flex items-center justify-center gap-2 ${
              isImporting
                ? 'bg-studio-800 text-slate-400 cursor-not-allowed border border-studio-700 animate-pulse'
                : 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 hover:from-cyan-500 hover:to-violet-500 shadow-cyan-500/20 active:scale-[0.98]'
            }`}
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-cyan-400 rounded-full animate-spin" />
                <span>{importProgress || 'កំពុងទាញយកឯកសារ Audio ពី Suno CDN...'}</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>នាំចូល និងដោះសោទាញយក (Import & Unlock) 🚀</span>
              </>
            )}
          </button>

          <div className="p-3.5 rounded-xl bg-studio-900/60 border border-studio-800 space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>អត្ថប្រយោជន៍ពេល Import ចូល Studio យើង:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li><strong className="text-cyan-300">✨ Auto-Fetch Title & Lyrics:</strong> ទាញយកចំណងជើង និងទំនុកច្រៀងពី Suno ដោយស្វ័យប្រវត្តិ ១០០%!</li>
              <li><strong className="text-violet-300">🎵 MP3 320kbps:</strong> ទាញយកផ្ទាល់ពី Suno CDN (គ្មានដែនកំណត់)</li>
              <li><strong className="text-cyan-300">💎 24-bit WAV:</strong> Auto-Remaster សម្រាប់ Spotify / DistroKid</li>
              <li><strong className="text-amber-300">🎬 Subtitles:</strong> ផលិត SRT (YouTube) & LRC (Karaoke) ត្រូវតាមបទស្វ័យប្រវត្តិ</li>
            </ul>
          </div>
        </div>
      ) : (
        /* Create Form Content */
        <form onSubmit={handleSubmit} className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Khmer Preset Selector */}
          <PresetSelector
            selectedPresetId={selectedPresetId}
            onSelectPreset={handleSelectPreset}
          />

          {/* Custom vs Simple Form */}
          {customMode ? (
            <>
              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  ចំណងជើងបទចម្រៀង (Song Title):
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ឧ. ស្នេហ៍ក្នុងក្តីស្រមៃ..."
                  className="w-full bg-studio-900/90 border border-studio-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
                />
              </div>

              {/* Lyrics Area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <span>ទំនុកច្រៀង (Lyrics & Structure):</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateLyrics}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 border border-violet-500/30 transition-all font-medium"
                  >
                    <Wand2 className="w-3 h-3 text-cyan-400" />
                    <span>AI តែងទំនុកច្រៀង</span>
                  </button>
                </div>
                <textarea
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  rows={7}
                  placeholder="សរសេរទំនុកច្រៀង ឬដាក់ [Verse 1], [Chorus], [Verse 2], [Outro]..."
                  className="w-full bg-studio-900/90 border border-studio-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all leading-relaxed font-mono resize-none"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                រៀបរាប់អំពីបទចម្រៀង (Song Topic / Story):
              </label>
              <textarea
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                rows={4}
                placeholder="ឧ. បទចម្រៀងស្នេហាផ្អែមល្ហែម ច្រៀងបែប slow pop សំឡេងនារី និយាយពីរឿងជួបគ្នានៅសៀមរាប..."
                className="w-full bg-studio-900/90 border border-studio-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all leading-relaxed resize-none"
              />
            </div>
          )}

          {/* Style of Music */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>រចនាប័ទ្មភ្លេង (Style of Music):</span>
              <span className="text-[10px] text-slate-500">Instruments & Tempo</span>
            </label>
            <input
              type="text"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="ឧ. Khmer pop, female vocal, piano, acoustic guitar..."
              className="w-full bg-studio-900/90 border border-studio-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all"
            />
          </div>

          {/* Options Toggles */}
          <div className="p-3 rounded-xl bg-studio-900/60 border border-studio-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-lg ${isInstrumental ? 'bg-amber-500/20 text-amber-400' : 'bg-studio-800 text-slate-400'}`}>
                {isInstrumental ? <VolumeX className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">
                  {isInstrumental ? 'ភ្លេងសុទ្ធ (Instrumental Only)' : 'មានសំឡេងច្រៀង (With Vocals)'}
                </p>
                <p className="text-[10px] text-slate-500">
                  {isInstrumental ? 'គ្មានសំឡេងមនុស្សច្រៀង' : 'សំឡេងច្រៀងច្បាស់កម្រិត Studio'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsInstrumental(!isInstrumental)}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${
                isInstrumental ? 'bg-amber-500' : 'bg-studio-800'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                  isInstrumental ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Generate Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating}
              className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2.5 shadow-lg transition-all duration-300 ${
                isGenerating
                  ? 'bg-studio-800 text-slate-400 cursor-not-allowed border border-studio-700 animate-pulse'
                  : 'bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 shadow-violet-600/25 hover:shadow-violet-600/40 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-cyan-400 rounded-full animate-spin" />
                  <span>{generatingStatus || 'កំពុងបង្កើត ២ បទ (Generating Versions 1 & 2)...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-300 animate-bounce" />
                  <span>បង្កើតបទចម្រៀង (Create Song 🎵)</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
