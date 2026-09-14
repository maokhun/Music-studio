import { NextRequest, NextResponse } from 'next/server';

/**
 * Universal Music Generation Task Submission Endpoint
 * Supports: Suno Direct Session Token, PiAPI Udio, and GoAPI
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, lyrics, style, model, isInstrumental, apiKey, customMode, provider } = body;

    const rawKey = apiKey || process.env.AI_MUSIC_API_KEY || '';
    const key = rawKey.replace(/[^\x00-\x7F]/g, '').trim();

    if (!key) {
      return NextResponse.json({
        success: false,
        error: 'No Token/API Key provided. Please enter your API Key in Settings.'
      }, { status: 400 });
    }

    const cleanTitle = title?.trim() || 'CamMusic Track';
    const cleanStyle = (style || 'Khmer modern slow pop, sweet female vocal, acoustic guitar, romantic 80 bpm').trim();
    const isCustom = customMode !== false && lyrics && lyrics.trim().length > 0;
    
    let activeProvider = provider || 'suno';
    if (key.startsWith('pi_')) {
      activeProvider = 'piapi';
    } else if (key.startsWith('eyJ') || key.length > 200) {
      activeProvider = 'suno';
    }

    console.log(`[Submit] Provider: ${activeProvider}, Title: ${cleanTitle}, Custom: ${isCustom}`);

    // ========================================================
    // 1. SUNO DIRECT OFFICIAL ENGINE (FAST 15s, HIGHEST QUALITY)
    // ========================================================
    if (activeProvider === 'suno') {
      const sunoToken = key.startsWith('Bearer ') ? key : `Bearer ${key}`;
      
      const sunoPayload: any = {
        make_instrumental: isInstrumental || false,
        mv: model?.includes('V4') ? 'chirp-v4' : 'chirp-v3-5'
      };

      if (isCustom) {
        sunoPayload.prompt = lyrics.trim();
        sunoPayload.tags = cleanStyle;
        sunoPayload.title = cleanTitle;
      } else {
        sunoPayload.gpt_description_prompt = cleanStyle;
      }

      console.log('Submitting task to Suno Studio API directly...');

      const sunoRes = await fetch('https://studio-api.suno.ai/api/generate/v2/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': sunoToken,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Origin': 'https://suno.com',
          'Referer': 'https://suno.com/'
        },
        body: JSON.stringify(sunoPayload)
      });

      const resText = await sunoRes.text();
      let sunoData: any = {};
      try {
        sunoData = JSON.parse(resText);
      } catch (e) {
        console.error('Suno returned non-JSON:', resText);
        return NextResponse.json({
          success: false,
          error: 'Suno Token មិនត្រឹមត្រូវ ឬផុតកំណត់។ សូមពិនិត្យមើល Token ក្នុង Suno.com ម្តងទៀត។'
        }, { status: 401 });
      }

      if (!sunoRes.ok || !sunoData.clips || sunoData.clips.length === 0) {
        console.error('Suno Submit failed:', sunoData);
        return NextResponse.json({
          success: false,
          error: sunoData.detail || sunoData.message || 'Suno Token Error. Please check your token.'
        }, { status: 400 });
      }

      const clipIds = sunoData.clips.map((c: any) => c.id).join(',');

      return NextResponse.json({
        success: true,
        taskId: clipIds,
        provider: 'suno',
        message: 'Task submitted to Suno Official Engine'
      });
    }

    // ==========================================
    // 2. PIAPI UDIO ENGINE
    // ==========================================
    const inputPayload: any = {
      gpt_description_prompt: cleanStyle,
      negative_tags: '',
      seed: -1
    };

    if (isInstrumental) {
      inputPayload.lyrics_type = 'instrumental';
    } else if (isCustom) {
      inputPayload.lyrics = lyrics.trim();
      inputPayload.lyrics_type = 'user';
    } else {
      inputPayload.lyrics_type = 'generate';
    }

    const piPayload = {
      model: 'music-u',
      task_type: 'generate_music',
      input: inputPayload
    };

    const piRes = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key
      },
      body: JSON.stringify(piPayload)
    });

    const piText = await piRes.text();
    let piData: any = {};
    try {
      piData = JSON.parse(piText);
    } catch (e) {
      return NextResponse.json({ success: false, error: 'PiAPI Server Error' }, { status: 500 });
    }

    if (!piRes.ok || piData.code !== 200) {
      return NextResponse.json({
        success: false,
        error: piData.message || piData.error || 'Failed to submit generation task to PiAPI'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      taskId: piData.data?.task_id,
      provider: 'piapi',
      message: 'Task submitted to PiAPI'
    });
  } catch (error: any) {
    console.error('Submit error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
