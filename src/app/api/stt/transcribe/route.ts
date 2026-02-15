/**
 * POST /api/stt/transcribe
 * 音声をテキストに変換するAPI
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { transcribeAudio, transcribeAudioFromUrl } from "@/core/llm/vertex-stt";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("STTAPI");

/**
 * STT認識リクエストスキーマ
 */
const TranscribeSTTRequestSchema = z.object({
  // 音声データ（Base64エンコード）またはURL
  audioContent: z.string().optional(), // Base64エンコードされた音声データ
  audioUrl: z.string().optional(), // Cloud StorageなどのURL

  // 認識設定
  languageCode: z.string().default("ja-JP"),
  encoding: z
    .enum(["LINEAR16", "FLAC", "MULAW", "AMR", "AMR_WB", "OGG_OPUS", "SPEEX_WITH_HEADER_BYTE", "WEBM_OPUS"])
    .default("LINEAR16"),
  sampleRateHertz: z.number().default(16000),
  enableAutomaticPunctuation: z.boolean().default(true),
  enableWordTimeOffsets: z.boolean().default(false),
  maxAlternatives: z.number().min(1).max(10).default(1),
});

/**
 * STT認識API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（STT APIは制限必要）
  const rateLimitResponse = await checkUserRateLimit(request, "aiApi");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, TranscribeSTTRequestSchema);

  // audioContentまたはaudioUrlのいずれかが必須
  if (!validated.audioContent && !validated.audioUrl) {
    return NextResponse.json(
      { error: "Either audioContent or audioUrl is required" },
      { status: 400 }
    );
  }

  logger.info("STT transcription request", {
    hasAudioContent: !!validated.audioContent,
    audioUrl: validated.audioUrl,
    languageCode: validated.languageCode,
  });

  // 認識設定
  const config = {
    languageCode: validated.languageCode,
    encoding: validated.encoding,
    sampleRateHertz: validated.sampleRateHertz,
    enableAutomaticPunctuation: validated.enableAutomaticPunctuation,
    enableWordTimeOffsets: validated.enableWordTimeOffsets,
    maxAlternatives: validated.maxAlternatives,
  };

  // 音声認識実行
  let result;
  if (validated.audioContent) {
    // Base64デコード
    const audioBuffer = Buffer.from(validated.audioContent, "base64");
    result = await transcribeAudio({ audioContent: audioBuffer, config });
  } else if (validated.audioUrl) {
    // URLから認識
    result = await transcribeAudioFromUrl(validated.audioUrl, config);
  }

  logger.info("STT transcription completed", {
    transcript: result?.transcript.slice(0, 50),
    confidence: result?.confidence,
  });

  return NextResponse.json({
    success: true,
    transcript: result?.transcript,
    confidence: result?.confidence,
    alternatives: result?.alternatives,
    words: result?.words,
  });
}, "STTTranscribe");
