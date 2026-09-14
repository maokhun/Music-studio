/**
 * Professional Synchronized Lyrics & Subtitle Timing Engine
 * Accurately aligns lyrics with musical structure (Intro, Verse, Chorus, Solo, Outro)
 */

export interface LyricLine {
  id: number;
  text: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  section?: string;  // e.g. '[Verse 1]', '[Chorus]'
}

/**
 * Format seconds to SRT timestamp: 00:01:23,450
 */
export function formatSRTTime(t: number): string {
  const hrs = Math.floor(t / 3600);
  const mins = Math.floor((t % 3600) / 60);
  const secs = Math.floor(t % 60);
  const ms = Math.floor((t % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format seconds to LRC timestamp: [01:23.45]
 */
export function formatLRCTime(t: number): string {
  const mins = Math.floor(t / 60);
  const secs = Math.floor(t % 60);
  const hundredths = Math.floor((t % 1) * 100);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}]`;
}

/**
 * Check if a line is a style description, vocal direction, or prompt instruction rather than sung lyrics
 */
export function isPromptOrStyleLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // 1. Direct keywords in uppercase/instruction format
  const upper = trimmed.toUpperCase();
  if (
    upper.startsWith('IMPORTANT') ||
    upper.startsWith('VOCAL DIRECTION') ||
    upper.startsWith('DIRECTION:') ||
    upper.startsWith('STYLE:') ||
    upper.startsWith('GENRE:') ||
    upper.startsWith('PROMPT:') ||
    upper.startsWith('TEMPO:') ||
    upper.startsWith('BPM:') ||
    upper.startsWith('INSTRUMENTS:') ||
    upper.startsWith('NEGATIVE PROMPT:') ||
    upper.startsWith('VOICE:') ||
    upper.startsWith('NOTE:') ||
    upper.startsWith('TAGS:')
  ) {
    return true;
  }

  // 2. Prompt guidance sentences (e.g. "Female singer ONLY...", "No male vocals...")
  if (
    /female singer only|male singer only|no male vocals|no female vocals|no backing vocals|no duet|no male harmonies|vocal range|clear diction|phrasing|vibrato|tempo \d+|bpm/i.test(trimmed)
  ) {
    return true;
  }

  // 3. Comma-separated style tags (e.g. "Ballad, Female Vocal, Guitar, Drums, Melancholic Mood...")
  const commaCount = (trimmed.match(/,/g) || []).length;
  if (commaCount >= 3) {
    const styleKeywords = /ballad|pop|rock|vocal|guitar|bass|drums|piano|violin|strings|synth|tempo|mood|atmosphere|recording|studio|khmer|instrument/i;
    if (styleKeywords.test(trimmed)) {
      return true;
    }
  }

  // 4. Non-section bracket tags (e.g. "[2 voices singing]", "[Style: Pop]")
  const bracketMatch = trimmed.match(/^\[(.*?)\]$/);
  if (bracketMatch) {
    const tagContent = bracketMatch[1].toLowerCase();
    const isSectionTag = /^(intro|verse|chorus|hook|bridge|pre-chorus|post-chorus|outro|solo|break|drop)(\s*\d*)?$/i.test(tagContent);
    if (!isSectionTag) {
      return true; // remove tags like [2 voices singing], [Fast Tempo]
    }
  }

  return false;
}

/**
 * Filter out prompt instructions and style tags from raw lyrics
 */
export function cleanRawLyrics(rawLyrics: string): string {
  if (!rawLyrics) return '';
  return rawLyrics
    .split('\n')
    .filter(line => !isPromptOrStyleLine(line))
    .join('\n')
    .trim();
}

/**
 * Parse raw lyrics text into timed LyricLines based on musical timing heuristics
 */
export function parseLyricsToTimedLines(rawLyrics: string, durationSeconds: number): LyricLine[] {
  const cleaned = cleanRawLyrics(rawLyrics);
  if (!cleaned) {
    return [
      { id: 1, text: '🎵 [Music Intro]', startTime: 0, endTime: Math.min(10, durationSeconds), section: '[Intro]' }
    ];
  }

  const rawLines = cleaned.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const parsedItems: { text: string; isTag: boolean; tag?: string; weight: number }[] = [];

  let currentTag = '';
  for (const line of rawLines) {
    const isTagMatch = line.match(/^\[(.*?)\]$/);
    if (isTagMatch) {
      currentTag = line;
      parsedItems.push({ text: line, isTag: true, tag: line, weight: getTagWeight(line) });
    } else {
      // Vocal line - weight based on length (words/characters)
      const len = line.length;
      const weight = Math.max(2.5, Math.min(6.5, 1.5 + len * 0.08));
      parsedItems.push({ text: line, isTag: false, tag: currentTag, weight });
    }
  }

  const vocalItems = parsedItems.filter(item => !item.isTag);
  if (vocalItems.length === 0) {
    return [
      { id: 1, text: cleaned.replace(/[\[\]]/g, '').trim() || '🎵 Instrumental Music', startTime: 2, endTime: Math.max(5, durationSeconds - 2) }
    ];
  }

  // Calculate natural singing cadence phrasing
  // A standard lyric line in Khmer/Suno is sung in 6.0s - 9.5s
  const introLeadIn = 25.0; // standard 25s intro
  const result: LyricLine[] = [];
  let currentTime = introLeadIn;
  let lineId = 1;
  let vocalLineIndex = 0;

  for (let i = 0; i < parsedItems.length; i++) {
    const item = parsedItems[i];

    if (item.isTag) {
      const lower = item.text.toLowerCase();
      if (lower.includes('solo') || lower.includes('instrumental') || lower.includes('break') || lower.includes('drop')) {
        currentTime += 16.0; // 16s musical solo
      } else if (lower.includes('bridge') || lower.includes('chorus')) {
        currentTime += 4.0; // 4s musical breath before chorus
      }
      continue;
    }

    // Natural human line singing duration based on character count (6.0s - 9.5s)
    const charCount = item.text.length;
    const naturalLineDuration = Math.max(5.5, Math.min(10.0, 3.8 + charCount * 0.14));
    
    const startTime = currentTime;
    const endTime = Math.min(currentTime + naturalLineDuration, durationSeconds - 1);

    result.push({
      id: lineId++,
      text: item.text,
      startTime: Math.round(startTime * 100) / 100,
      endTime: Math.round(endTime * 100) / 100,
      section: item.tag || undefined
    });

    vocalLineIndex++;

    // Add musical breathing gap:
    // Every 4 lines (1 Stanza / Verse), add a 6-10s musical pause
    // In middle of song (after 8 lines), add a 14s solo interlude
    if (vocalLineIndex % 8 === 0) {
      currentTime = endTime + 14.0; // mid-song interlude
    } else if (vocalLineIndex % 4 === 0) {
      currentTime = endTime + 6.5;  // stanza/verse break
    } else {
      currentTime = endTime + 1.2;  // normal line pause
    }

    if (currentTime >= durationSeconds - 2) {
      break;
    }
  }

  return result;
}

function getTagWeight(tag: string): number {
  const t = tag.toLowerCase();
  if (t.includes('solo') || t.includes('instrumental')) return 10;
  if (t.includes('intro') || t.includes('outro')) return 8;
  return 2;
}

/**
 * Generate SRT format from timed lines
 */
export function generateSRTFromLines(lines: LyricLine[]): string {
  let srt = '';
  lines.forEach((line, index) => {
    srt += `${index + 1}\n`;
    srt += `${formatSRTTime(line.startTime)} --> ${formatSRTTime(line.endTime)}\n`;
    srt += `${line.text}\n\n`;
  });
  return srt;
}

/**
 * Generate LRC format from timed lines
 */
export function generateLRCFromLines(title: string, artist: string, lines: LyricLine[]): string {
  const cleanArtist = (artist && artist !== 'AI Music Studio' && artist !== 'CamMusic AI') ? artist : title;
  let lrc = `[ti:${title}]\n[ar:${cleanArtist}]\n[al:Studio Master]\n[by:Studio Master]\n\n`;
  lines.forEach((line) => {
    lrc += `${formatLRCTime(line.startTime)}${line.text}\n`;
  });
  return lrc;
}

/**
 * Direct generation wrappers for backward compatibility
 */
export function generateSRT(lyrics: string, durationSeconds: number): string {
  const timedLines = parseLyricsToTimedLines(lyrics, durationSeconds);
  return generateSRTFromLines(timedLines);
}

export function generateLRC(title: string, artist: string, lyrics: string, durationSeconds: number): string {
  const timedLines = parseLyricsToTimedLines(lyrics, durationSeconds);
  return generateLRCFromLines(title, artist, timedLines);
}

export function downloadTextFile(filename: string, content: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
