import { Track } from './types';

const STORAGE_KEY = 'ai_music_studio_tracks';

/** Keep the media URL returned by Suno intact so newer CDN URLs are not lost. */
export function sanitizeAudioUrl(url: string): string {
  return url || '';
}

export function getSavedTracks(): Track[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const tracks: Track[] = JSON.parse(raw);
    
    // Preserve the exact source URL; the proxy resolves CDN fallbacks at request time.
    return tracks.map(t => ({
      ...t,
      audioUrl: sanitizeAudioUrl(t.audioUrl),
      wavUrl: sanitizeAudioUrl(t.wavUrl || t.audioUrl)
    }));
  } catch (e) {
    console.error('Error loading tracks from storage:', e);
    return [];
  }
}

export function saveTracks(tracks: Track[]) {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = tracks.map(t => ({
      ...t,
      audioUrl: sanitizeAudioUrl(t.audioUrl),
      wavUrl: sanitizeAudioUrl(t.wavUrl || t.audioUrl)
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch (e) {
    console.error('Error saving tracks to storage:', e);
  }
}
