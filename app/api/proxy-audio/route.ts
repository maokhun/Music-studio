import { NextRequest, NextResponse } from 'next/server';
import { decryptSunoMango } from '@/lib/suno-decryptor';

export const dynamic = 'force-dynamic';

/**
 * Universal Multi-Stage Suno & AI Audio Stream Proxy Engine
 * Overcomes Suno V3.5 / V4 / V5 CDN stream shifts & CloudFront restrictions
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const audioUrl = searchParams.get('url');
    const userToken = searchParams.get('token') || searchParams.get('apiKey') || '';

    if (!audioUrl) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    const uuidMatch = audioUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const songId = uuidMatch ? uuidMatch[1] : '';

    // Candidate URLs to attempt in sequence. Always try the exact URL first:
    // Suno's current CDN URLs may be signed or hosted on a new CloudFront path.
    const candidateUrls: string[] = audioUrl.startsWith('http') ? [audioUrl] : [];

    if (songId) {
      // Known public fallbacks for older and newer Suno clip formats.
      candidateUrls.push(`https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`);
      candidateUrls.push(`https://cdn1.suno.ai/${songId}.mp3`);
      candidateUrls.push(`https://cdn2.suno.ai/${songId}.mp3`);
      candidateUrls.push(`https://audiopipe.suno.ai/v2/${songId}`);
    }

    // Build headers with Suno Session Bearer Token if available
    const headersConfig: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': 'https://suno.com/',
      'Origin': 'https://suno.com'
    };

    const activeToken = (userToken && userToken.trim()) || process.env.SUNO_TOKEN || process.env.AI_MUSIC_API_KEY || '';
    if (activeToken && activeToken.trim()) {
      const cleanToken = activeToken.replace(/[^\x00-\x7F]/g, '').trim();
      headersConfig['Authorization'] = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
    }

    // If songId is present, attempt to fetch media_urls from Suno Clip API
    if (songId) {
      try {
        const clipRes = await fetch(`https://studio-api.prod.suno.com/api/clip/${songId}`, {
          headers: headersConfig,
          cache: 'no-store'
        });
        if (clipRes.ok) {
          const clipData = await clipRes.json();
          if (clipData?.media_urls && Array.isArray(clipData.media_urls)) {
            for (const media of clipData.media_urls) {
              if (media?.url && !media.url.includes('/api/forbidden')) {
              if (!candidateUrls.includes(media.url)) candidateUrls.unshift(media.url);
              }
            }
          }
        }
      } catch (e) {
        console.warn('Clip API fetch attempt failed:', e);
      }
    }

    // Iterate through candidates until a valid audio stream is found
    for (const urlTarget of candidateUrls) {
      try {
        const upstreamHeaders = { ...headersConfig };
        const range = req.headers.get('range');
        if (range) upstreamHeaders.Range = range;
        const res = await fetch(urlTarget, {
          headers: upstreamHeaders,
          cache: 'no-store'
        });

        const contentType = res.headers.get('content-type') || '';
        const isXmlError = contentType.includes('xml') || contentType.includes('text/html') || urlTarget.includes('/api/forbidden');

        if (res.ok && res.body && !isXmlError) {
          let buffer: any = Buffer.from(await res.arrayBuffer());
          if (songId) {
            try {
              buffer = await decryptSunoMango(songId, buffer);
            } catch (decErr) {
              console.warn('[Proxy Audio] Mango decryption notice:', decErr);
            }
          }
          const headers = new Headers();
          headers.set('Content-Type', contentType || 'audio/mp4');
          headers.set('Access-Control-Allow-Origin', '*');
          headers.set('Cache-Control', 'public, max-age=3600');
          headers.set('Content-Length', buffer.length.toString());
          headers.set('Accept-Ranges', 'bytes');
          return new NextResponse(buffer as any, { status: 200, headers });
        }
      } catch (e) {
        console.warn(`Candidate fetch failed for ${urlTarget}:`, e);
      }
    }

    return new NextResponse('Audio stream not available or link expired', { status: 403 });
  } catch (error: any) {
    console.error('Audio proxy error:', error);
    return new NextResponse(error.message || 'Internal Proxy Error', { status: 500 });
  }
}
