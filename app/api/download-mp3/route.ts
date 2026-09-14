import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { decryptSunoMango } from '@/lib/suno-decryptor';

export const dynamic = 'force-dynamic';

/**
 * Robust FFmpeg Audio Transcoder Engine with Mango DRM Decryption
 * Transcodes Suno CloudFront m4a/opus streams to 100% Pure 320kbps 44.1kHz MP3
 */
export async function GET(req: NextRequest) {
  let tmpInPath = '';
  let tmpOutPath = '';
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get('url');
    const userToken = searchParams.get('token') || '';
    const rawTitle = searchParams.get('title') || 'suno_master_320k';

    if (!rawUrl) {
      return new NextResponse('Missing url parameter', { status: 400 });
    }

    const uuidMatch = rawUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const songId = uuidMatch ? uuidMatch[1] : '';

    const candidateUrls = [rawUrl];
    if (songId) {
      candidateUrls.unshift(`https://d2lwuy8qc234o3.cloudfront.net/1/clip/${songId}.m4a`);
      candidateUrls.push(
        `https://cdn1.suno.ai/${songId}.mp3`,
        `https://cdn2.suno.ai/${songId}.mp3`
      );
    }

    const headersConfig: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Referer': 'https://suno.com/',
      'Origin': 'https://suno.com'
    };

    const activeToken = (userToken && userToken.trim()) || process.env.SUNO_TOKEN || process.env.AI_MUSIC_API_KEY || '';
    if (activeToken && activeToken.trim()) {
      const cleanToken = activeToken.replace(/[^\x00-\x7F]/g, '').trim();
      headersConfig['Authorization'] = cleanToken.startsWith('Bearer ') ? cleanToken : `Bearer ${cleanToken}`;
    }

    let inputBuffer: Buffer | null = null;
    for (const streamUrl of candidateUrls) {
      try {
        const audioRes = await fetch(streamUrl, { headers: headersConfig, cache: 'no-store' });
        const contentType = audioRes.headers.get('content-type') || '';
        if (audioRes.ok && audioRes.body && !contentType.includes('xml') && !contentType.includes('text/html')) {
          const ab = await audioRes.arrayBuffer();
          if (ab.byteLength > 1000) {
            inputBuffer = Buffer.from(ab);
            break;
          }
        }
      } catch (e) {
        console.warn(`MP3 source fetch failed for ${streamUrl}:`, e);
      }
    }

    if (!inputBuffer) {
      return new NextResponse('Could not fetch source audio stream', { status: 404 });
    }

    // Decrypt Suno Mango DRM before feeding into FFmpeg
    if (songId) {
      try {
        inputBuffer = await decryptSunoMango(songId, inputBuffer);
      } catch (decryptErr) {
        console.warn(`[Mango DRM] Decryption notice for ${songId}:`, decryptErr);
      }
    }

    // Write input buffer to temporary file
    const uniqueId = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    tmpInPath = path.join(os.tmpdir(), `suno_in_${uniqueId}.m4a`);
    tmpOutPath = path.join(os.tmpdir(), `suno_out_${uniqueId}.mp3`);

    await fs.promises.writeFile(tmpInPath, inputBuffer);

    // Transcode using FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', tmpInPath,
        '-vn',
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '320k',
        tmpOutPath
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg process failed with code ${code}`));
      });
      ffmpeg.on('error', (err) => reject(err));
    });

    const outputBuffer = await fs.promises.readFile(tmpOutPath);

    // Cleanup temp files
    try {
      if (fs.existsSync(tmpInPath)) await fs.promises.unlink(tmpInPath);
      if (fs.existsSync(tmpOutPath)) await fs.promises.unlink(tmpOutPath);
    } catch (e) {
      // ignore cleanup errors
    }

    const cleanFilename = rawTitle.replace(/[\\/*?:"<>|]/g, '').trim() || 'suno_master_320k';
    const headers = new Headers();
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanFilename)}.mp3"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}.mp3`);
    headers.set('Content-Length', outputBuffer.length.toString());
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(outputBuffer as any, { status: 200, headers });
  } catch (error: any) {
    console.error('Download MP3 Transcode error:', error);
    // Cleanup on error
    try {
      if (tmpInPath && fs.existsSync(tmpInPath)) fs.unlinkSync(tmpInPath);
      if (tmpOutPath && fs.existsSync(tmpOutPath)) fs.unlinkSync(tmpOutPath);
    } catch (e) {}
    return new NextResponse(error.message || 'Transcode Error', { status: 500 });
  }
}
