'use client';

import { useState, useRef, Suspense, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { RTMClient } from 'agora-rtm';

import type {
  AgoraTokenData,
  ClientStartRequest,
  AgentResponse,
  AgoraRenewalTokens,
} from '../types/conversation';

import { ErrorBoundary } from './ErrorBoundary';
import { LoadingSkeleton } from './LoadingSkeleton';

const ConversationComponent = dynamic(
  () => import('./ConversationComponent'),
  {
    ssr: false,
  }
);

const AgoraProvider = dynamic(
  async () => {
    const { AgoraRTCProvider, default: AgoraRTC } =
      await import('agora-rtc-react');

    return {
      default: function AgoraProviders({
        children,
      }: {
        children: React.ReactNode;
      }) {
        const clientRef = useRef<ReturnType<
          typeof AgoraRTC.createClient
        > | null>(null);

        if (!clientRef.current) {
          clientRef.current = AgoraRTC.createClient({
            mode: 'rtc',
            codec: 'vp8',
          });
        }

        return (
          <AgoraRTCProvider client={clientRef.current}>
            {children}
          </AgoraRTCProvider>
        );
      },
    };
  },
  { ssr: false }
);

export default function LandingPage() {
  const [showConversation, setShowConversation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [agoraData, setAgoraData] =
    useState<AgoraTokenData | null>(null);

  const [rtmClient, setRtmClient] =
    useState<RTMClient | null>(null);

  const [agentJoinError, setAgentJoinError] = useState(false);

  useEffect(() => {
    import('agora-rtc-react').catch(() => {});
    import('agora-rtm').catch(() => {});
  }, []);

  const handleStartConversation = async () => {
    setIsLoading(true);
    setError(null);
    setAgentJoinError(false);

    try {
      // Get Agora token
      const agoraResponse = await fetch(
        '/api/generate-agora-token'
      );

      const responseData = await agoraResponse.json();

      if (!agoraResponse.ok) {
        throw new Error(
          `Failed to generate Agora token: ${JSON.stringify(
            responseData
          )}`
        );
      }

      // Start AI agent and RTM together
      const [agentData, rtm] = await Promise.all([
        fetch('/api/invite-agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            requester_id: responseData.uid,
            channel_name: responseData.channel,
          } as ClientStartRequest),
        })
          .then(async (res) => {
            if (!res.ok) {
              setAgentJoinError(true);
              return null;
            }

            return res.json() as Promise<AgentResponse>;
          })
          .catch((err) => {
            console.error(
              'Failed to start AI agent:',
              err
            );

            setAgentJoinError(true);
            return null;
          }),

        (async () => {
          const { default: AgoraRTM } =
            await import('agora-rtm');

          const rtm: RTMClient = new AgoraRTM.RTM(
            process.env.NEXT_PUBLIC_AGORA_APP_ID!,
            responseData.uid
          );

          await rtm.login({
            token: responseData.token,
          });

          await rtm.subscribe(responseData.channel);

          return rtm;
        })(),
      ]);

      setRtmClient(rtm);

      setAgoraData({
        ...responseData,
        agentId: agentData?.agent_id,
      });

      setShowConversation(true);
    } catch (err) {
      console.error(err);

      setError(
        'Failed to start conversation. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTokenWillExpire = useCallback(
    async (
      uid: string
    ): Promise<AgoraRenewalTokens> => {
      const channel = agoraData?.channel;

      if (!channel) {
        throw new Error(
          'Missing channel for token renewal'
        );
      }

      const [rtcResponse, rtmResponse] =
        await Promise.all([
          fetch(
            `/api/generate-agora-token?channel=${channel}&uid=${uid}`
          ),
          fetch(
            `/api/generate-agora-token?channel=${channel}&uid=${agoraData.uid}`
          ),
        ]);

      const [rtcData, rtmData] =
        await Promise.all([
          rtcResponse.json(),
          rtmResponse.json(),
        ]);

      if (!rtcResponse.ok || !rtmResponse.ok) {
        throw new Error(
          'Failed to generate renewal tokens'
        );
      }

      return {
        rtcToken: rtcData.token,
        rtmToken: rtmData.token,
      };
    },
    [agoraData]
  );

  const handleEndConversation = async () => {
    if (agoraData?.agentId) {
      try {
        await fetch('/api/stop-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            agent_id: agoraData.agentId,
          }),
        });
      } catch (error) {
        console.error(
          'Error stopping agent:',
          error
        );
      }
    }

    rtmClient
      ?.logout()
      .catch((err) =>
        console.error('RTM logout error:', err)
      );

    setRtmClient(null);
    setShowConversation(false);
  };

  return (
    <main className="min-h-screen bg-[#08080c] text-white">

      {!showConversation ? (
        /* ================= LANDING PAGE ================= */
        <div className="min-h-screen flex items-center justify-center px-6">

          <div className="w-full max-w-4xl text-center">

            {/* AI Orb */}
            <div className="mb-10">
              <div className="mx-auto w-24 h-24 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-4xl shadow-2xl">
                🤖
              </div>
            </div>

            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight">
              Voice AI
            </h1>

            <p className="mt-6 text-lg md:text-xl text-white/50 max-w-2xl mx-auto">
              A real-time AI voice assistant that listens,
              understands and speaks with you naturally.
            </p>

            {/* Start Button */}
            <div className="mt-12 flex flex-col items-center">

              <button
                onClick={handleStartConversation}
                disabled={isLoading}
                className="w-28 h-28 rounded-full bg-white text-black text-4xl shadow-2xl transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                {isLoading ? '...' : '🎙'}
              </button>

              <p className="mt-5 text-sm text-white/40">
                {isLoading
                  ? 'Connecting to AI...'
                  : 'Tap to start talking'}
              </p>

            </div>

            {/* Error */}
            {error && (
              <p className="mt-6 text-sm text-red-400">
                {error}
              </p>
            )}

            {/* Features */}
            <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-5">

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <div className="text-3xl mb-4">
                  🎤
                </div>

                <h3 className="font-medium text-lg">
                  Natural Voice
                </h3>

                <p className="mt-2 text-sm text-white/40">
                  Speak naturally instead of typing.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <div className="text-3xl mb-4">
                  🧠
                </div>

                <h3 className="font-medium text-lg">
                  Intelligent AI
                </h3>

                <p className="mt-2 text-sm text-white/40">
                  Get intelligent responses in real time.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <div className="text-3xl mb-4">
                  🔊
                </div>

                <h3 className="font-medium text-lg">
                  Real-Time Speech
                </h3>

                <p className="mt-2 text-sm text-white/40">
                  Hear the AI respond instantly.
                </p>
              </div>

            </div>

            <p className="mt-16 text-xs text-white/20">
              Real-time conversational AI
            </p>

          </div>
        </div>

      ) : agoraData && rtmClient ? (

        /* ================= CONVERSATION ================= */

        <div className="h-screen w-full">

          {agentJoinError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm">
              AI agent connection failed.
            </div>
          )}

          <Suspense
            fallback={<LoadingSkeleton />}
          >
            <ErrorBoundary>
              <AgoraProvider>

                <ConversationComponent
                  agoraData={agoraData}
                  rtmClient={rtmClient}
                  onTokenWillExpire={
                    handleTokenWillExpire
                  }
                  onEndConversation={
                    handleEndConversation
                  }
                />

              </AgoraProvider>
            </ErrorBoundary>
          </Suspense>

        </div>

      ) : (

        <div className="min-h-screen flex items-center justify-center">
          <p className="text-white/50">
            Failed to load conversation.
          </p>
        </div>

      )}

    </main>
  );
}