import { NextRequest, NextResponse } from 'next/server';
import { cleanRawLyrics } from '@/lib/subtitle-generator';

export const dynamic = 'force-dynamic';

interface SunoClipResponse {
  id?: string;
  title?: string;
  audio_url?: string;
  video_url?: string;
  image_url?: string;
  image_large_url?: string;
  metadata?: {
    prompt?: string;
    tags?: string;
    duration?: number;
  };
  media_urls?: Array<{ url?: string }>;
}

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Origin': 'https://suno.com'
};

/**
 * Fetch official clip metadata directly from Suno Production API
 */
async function fetchSunoClipData(songId: string, authHeader?: string): Promise<SunoClipResponse | null> {
  try {
    const headers: Record<string, string> = {
      ...COMMON_HEADERS,
      'Referer': `https://suno.com/song/${songId}`
    };
    if (authHeader) headers['Authorization'] = authHeader;

    const url = `https://studio-api.prod.suno.com/api/clip/${songId}`;
    const res = await fetch(url, { headers, cache: 'no-store' });

    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.warn(`Could not fetch clip data for ${songId}:`, e);
  }
  return null;
}

/**
 * Fetch all clips from a Suno Playlist with multi-stage fallback & parallel resolution
 */
async function fetchSunoPlaylistData(playlistId: string, authHeader?: string): Promise<{ title: string; clips: SunoClipResponse[] }> {
  const clips: SunoClipResponse[] = [];
  let playlistTitle = '';

  const headers: Record<string, string> = {
    ...COMMON_HEADERS,
    'Referer': `https://suno.com/playlist/${playlistId}`
  };
  if (authHeader) headers['Authorization'] = authHeader;

  // 1. Studio API Pagination & Candidate Endpoints
  let page = 1;
  const maxPages = 10;
  while (page <= maxPages) {
    let gotPage = false;
    const candidateUrls = [
      `https://studio-api.prod.suno.com/api/playlist/${playlistId}/?page=${page}`,
      `https://studio-api.prod.suno.com/api/playlist/${playlistId}?page=${page}`,
      `https://studio-api.prod.suno.com/api/playlist/${playlistId}/`,
      `https://studio-api.prod.suno.com/api/playlist/${playlistId}`
    ];

    for (const apiUrl of candidateUrls) {
      try {
        const res = await fetch(apiUrl, { headers, cache: 'no-store' });
        if (!res.ok) continue;

        const data = await res.json();
        if (data.name && !playlistTitle) {
          playlistTitle = data.name.trim();
        }

        const pageClips = data.playlist_clips || data.clips || data.items || [];
        if (Array.isArray(pageClips) && pageClips.length > 0) {
          for (const item of pageClips) {
            const c = item.clip || item;
            const cid = c?.id || c?.songId;
            if (cid && !clips.some(x => (x.id || (x as any).songId) === cid)) {
              clips.push(c);
            }
          }
          gotPage = true;
          // If the endpoint doesn't support pagination, no need to retry other candidates
          if (data.has_more === false || (!apiUrl.includes('page=') && pageClips.length > 0)) {
            page = maxPages + 1;
          }
          break;
        }
      } catch (e) {
        // continue to next candidate
      }
    }

    if (!gotPage) break;
    page++;
  }

  // 2. Web fallback scraping if Studio API didn't return clips
  if (clips.length === 0) {
    try {
      const webUrl = `https://suno.com/playlist/${playlistId}`;
      const pageRes = await fetch(webUrl, { headers, cache: 'no-store' });
      if (pageRes.ok) {
        const html = await pageRes.text();

        // Extract title from metadata
        const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          playlistTitle = titleMatch[1].replace(/\s*\|\s*Suno/gi, '').replace(/\s*on\s*Suno/gi, '').trim();
        }

        const foundSongIds = new Set<string>();

        // A. Match explicit /song/<uuid> links in HTML
        const songLinkRegex = /\/song\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
        let m: RegExpExecArray | null;
        while ((m = songLinkRegex.exec(html)) !== null) {
          const sid = m[1].toLowerCase();
          if (sid !== playlistId.toLowerCase()) {
            foundSongIds.add(sid);
          }
        }

        // B. Match "clip":{"id":"<uuid>"} or "clip_id":"<uuid>"
        const clipObjRegex = /"clip(?:_id)?":\s*(?:{"id":\s*)?"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/gi;
        while ((m = clipObjRegex.exec(html)) !== null) {
          const sid = m[1].toLowerCase();
          if (sid !== playlistId.toLowerCase()) {
            foundSongIds.add(sid);
          }
        }

        // C. Fallback: all UUIDs if no song links found
        if (foundSongIds.size === 0) {
          const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;
          while ((m = uuidRegex.exec(html)) !== null) {
            const sid = m[1].toLowerCase();
            if (sid !== playlistId.toLowerCase()) {
              foundSongIds.add(sid);
            }
          }
        }

        // Parallel fetch metadata for extracted song IDs
        const idsArray = Array.from(foundSongIds).slice(0, 50);
        const resolved = await Promise.all(
          idsArray.map(async (u) => {
            try {
              const clip = await fetchSunoClipData(u, authHeader);
              if (clip && clip.id) return clip;
            } catch (err) {}
            return null;
          })
        );

        for (const c of resolved) {
          if (c && !clips.some(x => x.id === c.id)) {
            clips.push(c);
          }
        }
      }
    } catch (scrapErr) {
      console.warn('Playlist web fallback notice:', scrapErr);
    }
  }

  // 3. Resilient fallback: if playlist ID was actually a single clip/song ID
  if (clips.length === 0) {
    try {
      const singleClip = await fetchSunoClipData(playlistId, authHeader);
      if (singleClip && singleClip.id) {
        clips.push(singleClip);
      }
    } catch (clipErr) {
      console.warn('Single clip fallback check failed:', clipErr);
    }
  }

  return { title: playlistTitle || 'Suno Playlist', clips };
}

function formatClipToTrack(clip: any, songId: string) {
  let title = clip?.title?.trim() || `Suno Master (${songId ? songId.substring(0, 8) : 'Track'})`;
  let lyrics = '';
  if (clip?.metadata?.prompt && clip.metadata.prompt.trim()) {
    lyrics = cleanRawLyrics(clip.metadata.prompt.trim());
  }
  let style = clip?.metadata?.tags?.trim() || 'Suno Official 320kbps Master (Unlimited Download)';
  let duration = Math.round(clip?.metadata?.duration || 195);
  let audioUrl = songId ? `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a` : '';
  if (clip?.media_urls && Array.isArray(clip.media_urls) && clip.media_urls.length > 0) {
    audioUrl = clip.media_urls[0].url || audioUrl;
  } else if (clip?.audio_url && !clip.audio_url.includes('/api/forbidden')) {
    audioUrl = clip.audio_url;
  }
  let videoUrl = clip?.video_url || (songId ? `https://cdn1.suno.ai/${songId}.mp4` : undefined);
  let coverUrl = clip?.image_large_url || clip?.image_url || (songId ? `https://cdn1.suno.ai/image_${songId}.png` : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80');

  return {
    songId,
    title,
    lyrics,
    style,
    audioUrl,
    wavUrl: audioUrl,
    videoUrl,
    coverUrl,
    duration
  };
}

export async function POST(req: NextRequest) {
  try {
    const { url, token } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
    }

    const cleanUrl = url.trim();

    // Prepare authorization header if token provided or env set
    const activeToken = (token && token.trim()) || process.env.SUNO_TOKEN || process.env.AI_MUSIC_API_KEY || '';
    let authHeader = '';
    if (activeToken) {
      const cleanToken = activeToken.replace(/[^\x00-\x7F]/g, '').trim();
      authHeader = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
    }

    // Check if input is a playlist link
    const isPlaylist = cleanUrl.includes('/playlist');
    const playlistMatch = cleanUrl.match(/\/playlist\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
      || cleanUrl.match(/\/playlist\/([a-zA-Z0-9_-]+)/i);

    if (isPlaylist && playlistMatch && playlistMatch[1]) {
      const playlistId = playlistMatch[1];
      const { title: playlistTitle, clips } = await fetchSunoPlaylistData(playlistId, authHeader);

      if (clips.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'មិនអាចស្វែងរកបទចម្រៀងក្នុង Playlist នេះបានទេ។ សូមប្រាកដថា Playlist ត្រូវបានកំណត់ជា Public។'
        }, { status: 404 });
      }

      const formattedTracks = clips.map((c, idx) => {
        const sid = c.id || '';
        const track = formatClipToTrack(c, sid);
        if (!track.title || track.title.startsWith('Suno Master')) {
          track.title = `${playlistTitle} #${idx + 1}`;
        }
        return track;
      });

      return NextResponse.json({
        success: true,
        isPlaylist: true,
        playlistTitle,
        tracks: formattedTracks,
        data: formattedTracks[0]
      });
    }

    // Otherwise handle as a single song / clip
    let songId = '';
    const uuidMatch = cleanUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    if (uuidMatch && uuidMatch[1]) {
      songId = uuidMatch[1];
    }

    if (!songId) {
      return NextResponse.json({
        success: false,
        error: 'មិនអាចស្វែងរក Song ID ឬ Playlist ID ពី Link នេះបានទេ។ សូមពិនិត្យមើល Link ម្តងទៀត។'
      }, { status: 400 });
    }

    const clip = await fetchSunoClipData(songId, authHeader);
    const trackData = formatClipToTrack(clip || {}, songId);

    if (!trackData.audioUrl) {
      return NextResponse.json({
        success: false,
        error: 'មិនអាចស្វែងរក Audio URL ពី Link នេះបានទេ។ សូមពិនិត្យមើល Link ម្តងទៀត។'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      isPlaylist: false,
      tracks: [trackData],
      data: trackData
    });
  } catch (error: any) {
    console.error('Import route error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
