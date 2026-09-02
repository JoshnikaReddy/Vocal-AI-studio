'use client';

import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type QuickstartConversationLayoutProps = {
  statusPanel: ReactNode;
  pipelineMetrics: ReactNode;
  transcriptPanel: ReactNode;
  visualizer: ReactNode;
  controls: ReactNode;
  onEndConversation: () => void;
};

export function QuickstartConversationLayout({
  statusPanel,
  pipelineMetrics,
  transcriptPanel,
  visualizer,
  controls,
  onEndConversation,
}: QuickstartConversationLayoutProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState('');

  const [script, setScript] = useState('');
  const [voice, setVoice] = useState('female');

  const [generating, setGenerating] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] =
    useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file.');
      return;
    }

    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    if (generatedVideoUrl) {
      URL.revokeObjectURL(generatedVideoUrl);
      setGeneratedVideoUrl(null);
    }

    const url = URL.createObjectURL(file);

    setVideoFile(file);
    setVideoUrl(url);
    setVideoName(file.name);
    setError(null);
  };

  const handleRemoveVideo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }

    if (generatedVideoUrl) {
      URL.revokeObjectURL(generatedVideoUrl);
    }

    setVideoFile(null);
    setVideoUrl(null);
    setGeneratedVideoUrl(null);
    setVideoName('');
    setScript('');
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleGenerateVoiceover = async () => {
    if (!videoFile) {
      setError('Please upload a video first.');
      return;
    }

    if (!script.trim()) {
      setError('Please enter a voiceover script.');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const formData = new FormData();

      formData.append('video', videoFile);
      formData.append('script', script);
      formData.append('voice', voice);

      const response = await fetch(
        '/api/generate-voiceover',
        {
          method: 'POST',
          body: formData,
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);

        throw new Error(
          data?.error ||
            'Failed to generate AI voiceover.',
        );
      }

      const blob = await response.blob();

      const resultUrl = URL.createObjectURL(blob);

      if (generatedVideoUrl) {
        URL.revokeObjectURL(generatedVideoUrl);
      }

      setGeneratedVideoUrl(resultUrl);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : 'Voiceover generation failed.',
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#08080c] text-white">

      {/* HEADER */}

      <header className="flex shrink-0 flex-col gap-4 border-b border-white/10 px-4 py-4 md:h-[82px] md:flex-row md:items-center md:justify-between md:px-6 md:py-0">

        <div className="flex min-w-0 items-center gap-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <span className="text-lg font-bold">
              V
            </span>
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-1">

            <span className="truncate text-lg font-semibold leading-none tracking-[-0.025em] text-white">
              VocaAI Studio
            </span>

            <span className="text-xs text-white/40">
              Real-Time AI Voice Assistant
            </span>

          </div>

          <div className="hidden lg:block">
            {pipelineMetrics}
          </div>

        </div>

        <div className="flex items-center gap-2 md:pr-1">

          {statusPanel}

          <Button
            variant="destructive"
            size="sm"
            className="h-8 rounded-md border border-red-500/40 bg-transparent px-3 text-xs font-medium text-red-400 hover:bg-red-500/10"
            onClick={onEndConversation}
          >
            End Conversation
          </Button>

        </div>

      </header>


      {/* MAIN */}

      <div className="flex min-h-0 w-full flex-1 flex-col gap-4 overflow-y-auto px-4 pb-8 pt-4 md:px-6">

        {/* LIVE CONVERSATION */}

        <div className="flex min-h-[520px] w-full flex-col gap-4 lg:flex-row lg:gap-0">

          <aside className="order-2 h-64 min-h-0 w-full shrink-0 lg:order-1 lg:h-auto lg:w-[26rem]">
            {transcriptPanel}
          </aside>

          <main className="order-1 flex min-h-[420px] min-w-0 flex-1 flex-col lg:order-2 lg:border-l lg:border-white/10 lg:pl-6">

            <div className="flex min-h-0 flex-1 flex-col pb-2 pt-3 md:pb-6">

              <div className="flex min-h-0 flex-1 items-center justify-center">
                {visualizer}
              </div>

              <div className="shrink-0 pt-4">
                {controls}
              </div>

            </div>

          </main>

        </div>


        {/* VIDEO VOICEOVER */}

        <section className="w-full border-t border-white/10 pt-8">

          <div className="mb-5">

            <div className="flex items-center gap-3">

              <h2 className="text-xl font-semibold text-white">
                Video Voiceover
              </h2>

              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/40">
                AI Voice
              </span>

            </div>

            <p className="mt-1 text-sm text-white/40">
              Upload a video and create a natural AI voiceover.
            </p>

          </div>


          {!videoUrl ? (

            <div
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="group flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] transition hover:border-white/30 hover:bg-white/[0.04]"
            >

              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-2xl">
                +
              </div>

              <h3 className="text-base font-medium">
                Add a video
              </h3>

              <p className="mt-2 text-sm text-white/35">
                MP4, MOV or WebM
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />

            </div>

          ) : (

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.025]">

              {/* ORIGINAL VIDEO */}

              <div className="relative flex w-full items-center justify-center bg-black">

                <video
                  src={videoUrl}
                  controls
                  className="max-h-[520px] w-full object-contain"
                />

              </div>


              {/* VIDEO INFO */}

              <div className="flex flex-col gap-4 border-t border-white/10 p-5 md:flex-row md:items-center md:justify-between">

                <div className="min-w-0">

                  <p className="text-sm font-medium">
                    {videoName}
                  </p>

                  <p className="mt-1 text-xs text-white/35">
                    Video ready for AI voiceover
                  </p>

                </div>

                <div className="flex flex-wrap gap-2">

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                  >
                    Change Video
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRemoveVideo}
                    className="border-red-500/20 bg-transparent text-red-400 hover:bg-red-500/10"
                  >
                    Remove
                  </Button>

                </div>

              </div>


              {/* VOICEOVER SETTINGS */}

              <div className="border-t border-white/10 p-5">

                <div className="mb-5">

                  <label
                    htmlFor="voice-script"
                    className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40"
                  >
                    Voiceover Script
                  </label>

                  <textarea
                    id="voice-script"
                    value={script}
                    onChange={(event) =>
                      setScript(event.target.value)
                    }
                    placeholder="Enter what you want the AI voice to say in the video..."
                    rows={5}
                    className="w-full resize-y rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
                  />

                  <p className="mt-2 text-xs text-white/30">
                    Write the narration you want the AI to speak.
                  </p>

                </div>


                <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">

                  <div>

                    <label
                      htmlFor="voice-selection"
                      className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40"
                    >
                      AI Voice
                    </label>

                    <select
                      id="voice-selection"
                      value={voice}
                      onChange={(event) =>
                        setVoice(event.target.value)
                      }
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
                    >

                      <option
                        value="female"
                        className="bg-[#111116]"
                      >
                        English — Female
                      </option>

                      <option
                        value="male"
                        className="bg-[#111116]"
                      >
                        English — Male
                      </option>

                    </select>

                  </div>


                  <Button
                    type="button"
                    onClick={handleGenerateVoiceover}
                    disabled={
                      generating ||
                      !script.trim()
                    }
                    className="h-11 bg-white px-6 text-sm font-medium text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generating
                      ? 'Generating...'
                      : 'Generate AI Voiceover'}
                  </Button>

                </div>


                {error && (
                  <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
                    {error}
                  </div>
                )}

              </div>


              {/* GENERATED VIDEO */}

              {generatedVideoUrl && (

                <div className="border-t border-white/10 p-5">

                  <div className="mb-4">

                    <h3 className="text-base font-semibold">
                      AI Voiceover Result
                    </h3>

                    <p className="mt-1 text-xs text-white/35">
                      Your video now contains the generated AI voice.
                    </p>

                  </div>


                  <div className="overflow-hidden rounded-xl bg-black">

                    <video
                      src={generatedVideoUrl}
                      controls
                      className="max-h-[520px] w-full"
                    />

                  </div>


                  <div className="mt-4">

                    <a
                      href={generatedVideoUrl}
                      download="vocaai-voiceover.mp4"
                      className="inline-flex h-11 items-center justify-center rounded-lg bg-white px-6 text-sm font-medium text-black transition hover:bg-white/90"
                    >
                      Download Voiceover Video
                    </a>

                  </div>

                </div>

              )}

            </div>

          )}

        </section>

      </div>

    </div>
  );
}