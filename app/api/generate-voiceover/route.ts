import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';

export const runtime = 'nodejs';

function runFFmpeg(
  ffmpegPath: string,
  inputVideo: string,
  audioFile: string,
  outputVideo: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i',
      inputVideo,
      '-i',
      audioFile,

      '-map',
      '0:v:0',
      '-map',
      '1:a:0',

      '-c:v',
      'copy',
      '-c:a',
      'aac',
      '-b:a',
      '192k',

      '-shortest',
      '-movflags',
      '+faststart',

      outputVideo,
    ];

    console.log('Starting FFmpeg...');

    const child = spawn(ffmpegPath, args);

    let stderr = '';

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `FFmpeg failed with code ${code}: ${stderr.slice(-4000)}`,
          ),
        );
      }
    });
  });
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    console.log('=== VOICEOVER REQUEST STARTED ===');

    const formData = await request.formData();

    const video = formData.get('video');
    const script = formData.get('script');
    const voice = formData.get('voice');

    console.log(
      'Video:',
      video instanceof File ? video.name : 'missing',
    );

    console.log(
      'Script received:',
      typeof script === 'string',
    );

    console.log('Voice:', voice);

    if (!(video instanceof File)) {
      return NextResponse.json(
        {
          error: 'Please upload a video file.',
        },
        { status: 400 },
      );
    }

    if (
      typeof script !== 'string' ||
      !script.trim()
    ) {
      return NextResponse.json(
        {
          error: 'Please enter a voiceover script.',
        },
        { status: 400 },
      );
    }

    if (
      video.size >
      200 * 1024 * 1024
    ) {
      return NextResponse.json(
        {
          error:
            'Video must be smaller than 200 MB.',
        },
        { status: 400 },
      );
    }

    /*
     * Use FFmpeg installed on the Mac.
     * DO NOT use @ffmpeg-installer/ffmpeg here.
     */
    const ffmpegPath = 'ffmpeg';

    console.log(
      'Using system FFmpeg:',
      ffmpegPath,
    );

    /*
     * Load Edge TTS only when the request is made.
     */
    console.log('Loading Edge TTS...');

    const ttsModule = await import(
      'node-edge-tts'
    );

    const EdgeTTS = ttsModule.EdgeTTS;

    console.log('Edge TTS loaded.');

    tempDir = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        'vocaai-',
      ),
    );

    const inputVideo = path.join(
      tempDir,
      'input-video',
    );

    const audioFile = path.join(
      tempDir,
      'voice.mp3',
    );

    const outputVideo = path.join(
      tempDir,
      'vocaai-voiceover.mp4',
    );

    /*
     * Save uploaded video.
     */
    const videoBuffer = Buffer.from(
      await video.arrayBuffer(),
    );

    await fs.writeFile(
      inputVideo,
      videoBuffer,
    );

    console.log(
      'Video saved:',
      video.size,
      'bytes',
    );

    /*
     * Select AI voice.
     */
    const selectedVoice =
      voice === 'male'
        ? 'en-US-GuyNeural'
        : 'en-US-AriaNeural';

    console.log(
      'Generating AI voice:',
      selectedVoice,
    );

    /*
     * Generate speech.
     */
    const tts = new EdgeTTS({
      voice: selectedVoice,
      lang: 'en-US',
      outputFormat:
        'audio-24khz-96kbitrate-mono-mp3',
      rate: 'default',
      pitch: 'default',
      volume: 'default',
      timeout: 60000,
    });

    await tts.ttsPromise(
      script.trim(),
      audioFile,
    );

    console.log(
      'AI voice generated successfully.',
    );

    /*
     * Verify audio file.
     */
    const audioStats = await fs.stat(
      audioFile,
    );

    console.log(
      'Audio size:',
      audioStats.size,
      'bytes',
    );

    if (audioStats.size === 0) {
      throw new Error(
        'AI voice generation produced an empty audio file.',
      );
    }

    /*
     * Combine original video with AI voice.
     */
    console.log(
      'Combining video and AI voice...',
    );

    await runFFmpeg(
      ffmpegPath,
      inputVideo,
      audioFile,
      outputVideo,
    );

    console.log(
      'Final video created successfully.',
    );

    /*
     * Read final video.
     */
    const finalVideo =
      await fs.readFile(
        outputVideo,
      );

    console.log(
      'Final video size:',
      finalVideo.length,
      'bytes',
    );

    /*
     * Return final MP4.
     */
    return new NextResponse(
      finalVideo,
      {
        status: 200,
        headers: {
          'Content-Type':
            'video/mp4',

          'Content-Disposition':
            'attachment; filename="vocaai-voiceover.mp4"',

          'Cache-Control':
            'no-store',
        },
      },
    );
  } catch (error) {
    console.error(
      '=== VOICEOVER ERROR ===',
    );

    console.error(error);

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        error:
          `Voiceover generation failed: ${message}`,
      },
      { status: 500 },
    );
  } finally {
    /*
     * Remove temporary files.
     */
    if (tempDir) {
      await fs.rm(
        tempDir,
        {
          recursive: true,
          force: true,
        },
      );
    }
  }
}