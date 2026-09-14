import { NextRequest, NextResponse } from 'next/server';

/**
 * Live PiAPI Udio (music-u) Gateway Router
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, lyrics, style, isInstrumental, apiKey, customMode } = body;

    const key = apiKey || process.env.AI_MUSIC_API_KEY;

    if (!key) {
      return NextResponse.json({
        success: false,
        error: 'No API Key provided. Please enter your PiAPI or GoAPI key in Settings.'
      }, { status: 400 });
    }

    const cleanTitle = title?.trim() || 'CamMusic Track';
    const isCustom = customMode !== false && lyrics && lyrics.trim().length > 0;
    const stylePrompt = (style || 'Khmer modern pop song, sweet female vocal, acoustic guitar, romantic').trim();

    const inputPayload: any = {
      gpt_description_prompt: stylePrompt,
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

    const taskPayload = {
      model: 'music-u',
      task_type: 'generate_music',
      input: inputPayload
    };

    console.log('Submitting PiAPI task payload:', JSON.stringify(taskPayload, null, 2));

    const submitRes = await fetch('https://api.piapi.ai/api/v1/task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key
      },
      body: JSON.stringify(taskPayload)
    });

    const submitData = await submitRes.json();

    if (!submitRes.ok || submitData.code !== 200) {
      console.error('PiAPI Submit failed:', submitData);
      return NextResponse.json({
        success: false,
        error: submitData.message || submitData.error || 'Failed to submit generation task to PiAPI'
      }, { status: 400 });
    }

    const taskId = submitData.data?.task_id;
    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: 'No task_id returned by PiAPI'
      }, { status: 500 });
    }

    console.log('Task submitted successfully! Task ID:', taskId, 'Polling for completion...');

    // Poll for completion (up to 90 seconds)
    let completed = false;
    let attempts = 0;
    let taskResult: any = null;

    while (!completed && attempts < 45) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const checkRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
        headers: {
          'x-api-key': key
        }
      });

      const checkData = await checkRes.json();
      const status = checkData.data?.status;

      console.log(`Poll attempt ${attempts} - Status: ${status}`);

      if (status === 'completed' || status === 'success') {
        completed = true;
        taskResult = checkData.data;
        break;
      } else if (status === 'failed' || status === 'error') {
        return NextResponse.json({
          success: false,
          error: checkData.data?.error || 'Music generation task failed on cloud server.'
        }, { status: 500 });
      }
    }

    if (!completed || !taskResult) {
      return NextResponse.json({
        success: false,
        error: 'Generation timeout (took longer than 90s). Please check PiAPI dashboard.'
      }, { status: 504 });
    }

    const clips = taskResult.output?.clips || {};
    const clipKeys = Object.keys(clips);

    const track1Data = clips[clipKeys[0]] || {};
    const track2Data = clips[clipKeys[1]] || track1Data;

    return NextResponse.json({
      success: true,
      data: {
        track1: {
          audioUrl: track1Data.audio_url || track1Data.audio_file,
          coverUrl: track1Data.image_url || track1Data.image_file,
          duration: Math.round(track1Data.duration || 180),
          title: track1Data.title || cleanTitle
        },
        track2: {
          audioUrl: track2Data.audio_url || track2Data.audio_file || track1Data.audio_url,
          coverUrl: track2Data.image_url || track2Data.image_file || track1Data.image_url,
          duration: Math.round(track2Data.duration || 180),
          title: track2Data.title || cleanTitle
        }
      }
    });
  } catch (error: any) {
    console.error('Server generation error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 });
  }
}
