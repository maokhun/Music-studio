import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { decryptSunoMango } from '@/lib/suno-decryptor';

export const dynamic = 'force-dynamic';

/**
 * Professional Studio-Grade 24-bit Lossless Mastered WAV Transcoder Engine
 * Decrypts Suno Mango DRM and applies AI Remastering DSP Filter Chain:
 * - Sub rumble cutoff (<32Hz)
 * - 90Hz Low-shelf punch (+3dB)
 * - 380Hz Mid-mud cut (-1.5dB)
 * - 3.4kHz Vocal presence (+2.5dB)
 * - 11kHz Crystal air shimmer (+3.5dB)
 * - EBU R128 / -14 LUFS True Peak loudness limiter
 * - 48kHz 24-bit PCM Lossless Audio
 */
export async function GET(req: NextRequest) {
  let tmpInPath = '';
  let tmpOutPath = '';
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get('url');
    const userToken = searchParams.get('token') || '';
    const rawTitle = searchParams.get('title') || 'suno_24bit_master';

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
        `https://cdn2.suno.ai/${songId}.mp3`,
        `https://audiopipe.suno.ai/v2/${songId}`
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

    // Try fetching fresh media_urls from Suno Clip API if songId exists
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
        console.warn('Clip API fetch attempt failed in download-wav:', e);
      }
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
        console.warn(`WAV source fetch failed for ${streamUrl}:`, e);
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
    tmpInPath = path.join(os.tmpdir(), `suno_wav_in_${uniqueId}.m4a`);
    tmpOutPath = path.join(os.tmpdir(), `suno_wav_out_${uniqueId}.wav`);

    await fs.promises.writeFile(tmpInPath, inputBuffer);

    // Run FFmpeg: Attempt DSP Mastered 24-bit 48kHz WAV first, fallback to clean 24-bit WAV if filters fail
    const dspFilter = 'highpass=f=32,lowshelf=f=90:g=3,equalizer=f=380:t=q:w=1.2:g=-1.5,equalizer=f=3400:t=q:w=1.0:g=2.5,highshelf=f=11000:g=3.5,loudnorm=I=-14:TP=-1:LRA=11';
    
    const runFfmpeg = (filters?: string): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        const args = ['-y', '-i', tmpInPath, '-vn'];
        if (filters) {
          args.push('-af', filters);
        }
        args.push('-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', tmpOutPath);

        const ffmpeg = spawn('ffmpeg', args);
        ffmpeg.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg process exited with code ${code}`));
        });
        ffmpeg.on('error', (err) => reject(err));
      });
    };

    try {
      await runFfmpeg(dspFilter);
    } catch (filterErr) {
      console.warn('FFmpeg DSP filter mastering failed, retrying with direct 24-bit PCM:', filterErr);
      await runFfmpeg(); // fallback without audio filter
    }

    const outputBuffer = await fs.promises.readFile(tmpOutPath);

    // Cleanup temp files
    try {
      if (fs.existsSync(tmpInPath)) await fs.promises.unlink(tmpInPath);
      if (fs.existsSync(tmpOutPath)) await fs.promises.unlink(tmpOutPath);
    } catch (e) {
      // ignore cleanup errors
    }

    const cleanFilename = rawTitle.replace(/[\\/*?:"<>|]/g, '').trim() || 'suno_24bit_master';
    const headers = new Headers();
    headers.set('Content-Type', 'audio/wav');
    headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanFilename)}.wav"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}.wav`);
    headers.set('Content-Length', outputBuffer.length.toString());
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(outputBuffer as any, { status: 200, headers });
  } catch (error: any) {
    console.error('Download WAV Transcode error:', error);
    // Cleanup on error
    try {
      if (tmpInPath && fs.existsSync(tmpInPath)) fs.unlinkSync(tmpInPath);
      if (tmpOutPath && fs.existsSync(tmpOutPath)) fs.unlinkSync(tmpOutPath);
    } catch (e) {}
    return new NextResponse(error.message || 'WAV Transcode Error', { status: 500 });
  }
}
