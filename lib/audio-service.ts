import { GenerateParams, Track } from './types';

/**
 * Procedural stereo audio synthesizer (ONLY used when user has NO API Key)
 */
export function generateProceduralAudioBlob(style: string, isInstrumental: boolean, seed: number): { blobUrl: string; duration: number } {
  if (typeof window === 'undefined') {
    return { blobUrl: '', duration: 180 };
  }

  const sampleRate = 44100;
  const duration = 120 + (seed % 60);
  const totalSamples = sampleRate * duration;
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const buffer = audioContext.createBuffer(2, totalSamples, sampleRate);
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = buffer.getChannelData(1);

  const isKantrum = style.toLowerCase().includes('kantrum') || style.toLowerCase().includes('remix');
  const bpm = isKantrum ? 130 : 80;
  const beatSamples = Math.floor(sampleRate * (60 / bpm));

  const baseFreq = isKantrum ? 220 : 196;
  const notes = isKantrum ? [1, 1.2, 1.333, 1.5, 1.777, 2] : [1, 1.125, 1.25, 1.5, 1.667, 2];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const beatIndex = Math.floor(i / beatSamples);
    const noteRatio = notes[(beatIndex * (seed + 1)) % notes.length];
    const freq = baseFreq * noteRatio;

    const bass = Math.sin(2 * Math.PI * (baseFreq / 2) * t) * 0.25;
    const melody = Math.sin(2 * Math.PI * freq * t) * Math.exp(-((i % beatSamples) / beatSamples) * 3) * 0.2;
    const harmony = Math.sin(2 * Math.PI * (freq * 1.5) * t) * 0.1;

    const kickPhase = (i % beatSamples) / sampleRate;
    const kick = kickPhase < 0.1 ? Math.sin(2 * Math.PI * 60 * (1 - kickPhase * 10) * kickPhase) * 0.4 : 0;
    const hihat = ((i % (beatSamples / 2)) < 500) ? (Math.random() * 2 - 1) * 0.05 : 0;

    const panLeft = 0.5 + Math.sin(t * 0.5) * 0.3;
    const panRight = 1 - panLeft;

    const sample = bass + melody + harmony + kick + hihat;
    leftChannel[i] = sample * panLeft;
    rightChannel[i] = sample * panRight;
  }

  const wavBlob = audioBufferToWav(buffer);
  const blobUrl = URL.createObjectURL(wavBlob);

  return { blobUrl, duration };
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sample: number = 0;
  let offset: number = 0;
  let pos: number = 0;

  function setUint16(data: number) { out.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { out.setUint32(pos, data, true); pos += 4; }

  out.setUint32(0, 0x46464952, true);
  out.setUint32(4, length - 8, true);
  out.setUint32(8, 0x45564157, true);
  out.setUint32(12, 0x20746d66, true);
  out.setUint32(16, 16, true);
  pos = 20;
  setUint16(1);
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16);
  setUint32(0x61746164);
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < length) {
    for (let i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

export async function createTrackPair(
  params: GenerateParams, 
  apiKey?: string, 
  provider?: string,
  onStatusUpdate?: (statusText: string) => void
): Promise<[Track, Track]> {
  const groupId = 'group_' + Date.now();
  const cleanTitle = params.title?.trim() || 'បទចម្រៀងថ្មី (New Track)';

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('សូមបញ្ចូល API Key របស់អ្នកនៅក្នុង Settings ជាមុនសិន');
  }

  if (onStatusUpdate) onStatusUpdate('កំពុងបញ្ជូនទំនុកច្រៀងទៅកាន់ AI Cloud (Submitting)...');

  // 1. Submit task
  const submitRes = await fetch('/api/generate/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...params,
      apiKey,
      provider
    })
  });

  const submitJson = await submitRes.json();
  if (!submitJson.success || !submitJson.taskId) {
    throw new Error(submitJson.error || 'Failed to submit generation task');
  }

  const taskId = submitJson.taskId;
  console.log('Task submitted successfully! Polling taskId:', taskId);

  // 2. Poll for completion (up to 60 attempts * 3s = 180s / 3 minutes)
  let completed = false;
  let attempts = 0;
  let resultData: any = null;

  while (!completed && attempts < 60) {
    await new Promise(r => setTimeout(r, 3000));
    attempts++;

    const progressPct = Math.min(98, Math.round((attempts / 45) * 100));
    if (onStatusUpdate) {
      onStatusUpdate(`AI កំពុងច្រៀង និង Master សំឡេង (${progressPct}%)...`);
    }

    try {
      const activeProv = provider || 'suno';
      const statusRes = await fetch(`/api/generate/status?taskId=${taskId}&apiKey=${encodeURIComponent(apiKey)}&provider=${encodeURIComponent(activeProv)}`);
      const statusJson = await statusRes.json();

      console.log(`Poll #${attempts} (${activeProv}):`, statusJson);

      if (statusJson.status === 'completed' && statusJson.data) {
        completed = true;
        resultData = statusJson.data;
        break;
      } else if (statusJson.status === 'failed') {
        throw new Error(statusJson.error || 'Music generation failed on AI server.');
      }
    } catch (err: any) {
      console.warn('Poll attempt error (will retry):', err);
    }
  }

  if (!completed || !resultData || !resultData.track1?.audioUrl) {
    throw new Error('AI Server កំពុងរវល់ ឬចំណាយពេលយូរជាងធម្មតា។ សូមពិនិត្យផ្ទាំង PiAPI Dashboard ឬចុចបង្កើតម្តងទៀត។');
  }

  if (onStatusUpdate) onStatusUpdate('រួចរាល់ ១០០% (Finalizing tracks)!');

  const { track1: t1, track2: t2 } = resultData;

  const track1: Track = {
    id: 'trk_' + Date.now() + '_1',
    groupId,
    version: 1,
    title: t1.title || cleanTitle,
    lyrics: params.lyrics,
    style: params.style,
    model: params.model,
    duration: t1.duration || 195,
    audioUrl: t1.audioUrl,
    wavUrl: t1.audioUrl,
    coverUrl: t1.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    status: 'ready',
    createdAt: new Date().toISOString(),
    isInstrumental: params.isInstrumental
  };

  const track2: Track = {
    id: 'trk_' + Date.now() + '_2',
    groupId,
    version: 2,
    title: t2.title || cleanTitle,
    lyrics: params.lyrics,
    style: params.style,
    model: params.model,
    duration: t2.duration || 210,
    audioUrl: t2.audioUrl,
    wavUrl: t2.audioUrl,
    coverUrl: t2.coverUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    status: 'ready',
    createdAt: new Date().toISOString(),
    isInstrumental: params.isInstrumental
  };

  return [track1, track2];
}
