import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function extractTracksFromSunoFeed(clips: any[]) {
  if (!clips || clips.length === 0) return null;

  const c1 = clips[0] || {};
  const c2 = clips[1] || c1;

  // Check if at least clip 1 has audio_url
  if (!c1.audio_url) return null;

  return {
    track1: {
      audioUrl: c1.audio_url,
      coverUrl: c1.image_url || c1.image_large_url || '',
      duration: Math.round(c1.duration || 180),
      title: c1.title || ''
    },
    track2: {
      audioUrl: c2.audio_url || c1.audio_url,
      coverUrl: c2.image_url || c2.image_large_url || c1.image_url || '',
      duration: Math.round(c2.duration || 180),
      title: c2.title || ''
    }
  };
}

/**
 * Task Status Polling Endpoint (Supports Direct Suno Feed and PiAPI)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const rawKey = searchParams.get('apiKey') || process.env.AI_MUSIC_API_KEY || '';
    const cleanKey = rawKey.replace(/[^\x00-\x7F]/g, '').trim();
    const provider = searchParams.get('provider') || 'suno';

    if (!taskId) return NextResponse.json({ success: false, error: 'taskId is required' }, { status: 400 });
    if (!cleanKey) return NextResponse.json({ success: false, error: 'apiKey is required' }, { status: 400 });

    let activeProvider = provider || 'suno';
    if (cleanKey.startsWith('pi_')) {
      activeProvider = 'piapi';
    } else if (cleanKey.startsWith('eyJ') || cleanKey.length > 200) {
      activeProvider = 'suno';
    }

    // ==========================================
    // 1. SUNO DIRECT FEED POLLING (FAST 15s)
    // ==========================================
    if (activeProvider === 'suno') {
      const sunoToken = cleanKey.startsWith('Bearer ') ? cleanKey : `Bearer ${cleanKey}`;

      const feedRes = await fetch(`https://studio-api.suno.ai/api/feed/v2?ids=${encodeURIComponent(taskId)}`, {
        headers: {
          'Authorization': sunoToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
        }
      });

      const feedText = await feedRes.text();
      let feedData: any = {};
      try {
        feedData = JSON.parse(feedText);
      } catch (e) {
        return NextResponse.json({ success: false, error: 'Suno Feed parse error' }, { status: 500 });
      }

      const clips = feedData.clips || (Array.isArray(feedData) ? feedData : []);
      const isComplete = clips.length > 0 && clips.every((c: any) => c.status === 'complete' || c.status === 'streaming');

      if (isComplete && clips[0]?.audio_url) {
        const parsed = extractTracksFromSunoFeed(clips);
        if (parsed) {
          return NextResponse.json({ success: true, status: 'completed', data: parsed });
        }
      }

      return NextResponse.json({ success: true, status: 'processing', progress: 65 });
    }

    // ==========================================
    // 2. PIAPI POLLING
    // ==========================================
    const piRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: { 'x-api-key': cleanKey }
    });
    const piData = await piRes.json();

    if (piData.data?.status === 'completed' || piData.data?.status === 'success') {
      const output = piData.data?.output || {};
      const songs = output.songs || [];
      if (songs.length > 0) {
        return NextResponse.json({
          success: true,
          status: 'completed',
          data: {
            track1: { audioUrl: songs[0].audio_url, coverUrl: songs[0].image_url || '', duration: 180, title: songs[0].title },
            track2: { audioUrl: (songs[1] || songs[0]).audio_url, coverUrl: (songs[1] || songs[0]).image_url || '', duration: 180, title: (songs[1] || songs[0]).title }
          }
        });
      }
    }

    return NextResponse.json({ success: true, status: piData.data?.status || 'processing', progress: 50 });
  } catch (error: any) {
    console.error('Status error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
