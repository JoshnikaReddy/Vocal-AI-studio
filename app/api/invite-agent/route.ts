import { NextRequest, NextResponse } from 'next/server';

import {
  AgoraClient,
  Agent,
  Area,
  DeepgramSTT,
  ExpiresIn,
  MiniMaxTTS,
  OpenAI,
} from 'agora-agents';

const AGENT_UID = String(
  process.env.NEXT_PUBLIC_AGENT_UID ?? '123456'
);

const AGENT_PROMPT = `
You are a friendly AI voice assistant.

Your job is to have natural, helpful real-time conversations
with the user.

Keep responses concise and conversational.
Do not mention Agora, Deepgram, OpenAI, or MiniMax unless
the user specifically asks about the technology.

Speak naturally and clearly.
If the user asks a question, answer directly.
If the request is unclear, ask one short clarification.
`;

const GREETING =
  process.env.NEXT_AGENT_GREETING ??
  "Hi! I'm your AI voice assistant. It's great to meet you. What would you like to talk about?";

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { requester_id, channel_name } = body;

    if (!requester_id || !channel_name) {
      return NextResponse.json(
        {
          error:
            'requester_id and channel_name are required',
        },
        { status: 400 }
      );
    }

    const appId = requireEnv(
      'NEXT_PUBLIC_AGORA_APP_ID'
    );

    const appCertificate = requireEnv(
      'NEXT_AGORA_APP_CERTIFICATE'
    );

    const client = new AgoraClient({
      area: Area.US,
      appId,
      appCertificate,
    });

    const agent = new Agent({
      client,

      instructions: AGENT_PROMPT,

      greeting: GREETING,

      failureMessage:
        'Sorry, something went wrong. Please try again.',

      maxHistory: 50,

      turnDetection: {
        config: {
          speech_threshold: 0.5,

          start_of_speech: {
            mode: 'vad',
            vad_config: {
              interrupt_duration_ms: 160,
              prefix_padding_ms: 300,
            },
          },

          end_of_speech: {
            mode: 'vad',
            vad_config: {
              silence_duration_ms: 480,
            },
          },
        },
      },

      advancedFeatures: {
        enable_rtm: true,
        enable_tools: true,
      },

      parameters: {
        audio_scenario: 'chorus',
        data_channel: 'rtm',
        enable_error_message: true,
        enable_metrics: true,
      },
    })

      .withStt(
        new DeepgramSTT({
          model: 'nova-3',
          language: 'en',
        })
      )

      .withLlm(
        new OpenAI({
          model: 'gpt-4o-mini',

          greetingMessage: GREETING,

          failureMessage:
            'Sorry, something went wrong. Please try again.',

          maxHistory: 15,

          params: {
            max_tokens: 1024,
            temperature: 0.7,
            top_p: 0.95,
          },
        })
      )

      .withTts(
        new MiniMaxTTS({
          model: 'speech_2_6_turbo',
          voiceId: 'English_captivating_female1',
        })
      );

    const session = agent.createSession({
      name: `conversation-${Date.now()}`,

      channel: channel_name,

      agentUid: AGENT_UID,

      remoteUids: [String(requester_id)],

      idleTimeout: 30,

      expiresIn: ExpiresIn.hours(1),

      debug: false,
    });

    const agentId = await session.start();

    console.log(
      'Agora AI agent started:',
      agentId
    );

    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
    });
  } catch (error) {
    console.error(
      'Error starting conversation:',
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      },
      { status: 500 }
    );
  }
}