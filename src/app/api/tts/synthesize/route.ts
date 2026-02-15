/**
 * POST /api/tts/synthesize
 * テキストを音声に変換するAPI
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { synthesizeSpeech } from "@/core/llm/vertex-tts";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("TTSAPI");

/**
 * TTS合成リクエストスキーマ
 */
const SynthesizeTTSRequestSchema = z
  .object({
    text: z.string().min(1).max(5000).optional(), // 最大5000文字
    ssml: z.string().min(1).max(10000).optional(), // SSMLフォーマット（textより優先）
    characterId: z.string().optional(), // キャラクターID（CHARACTER_VOICESから選択）
    voiceConfig: z
      .object({
        languageCode: z.string(),
        name: z.string(),
        ssmlGender: z.enum(["MALE", "FEMALE", "NEUTRAL"]),
        pitch: z.number().min(-20).max(20).optional(),
        speakingRate: z.number().min(0.25).max(4.0).optional(),
      })
      .optional(), // カスタム音声設定
    outputFormat: z.enum(["MP3", "OGG_OPUS", "LINEAR16"]).default("MP3"),
    saveToBucket: z.boolean().default(true),
  })
  .refine((data) => data.text || data.ssml, {
    message: "Either text or ssml must be provided",
  });

/**
 * TTS合成API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（TTS APIは制限必要）
  const rateLimitResponse = await checkUserRateLimit(request, "aiApi");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, SynthesizeTTSRequestSchema);

  const inputType = validated.ssml ? "ssml" : "text";
  const inputLength = validated.ssml?.length || validated.text?.length || 0;

  logger.info("TTS synthesis request", {
    inputType,
    inputLength,
    characterId: validated.characterId,
    outputFormat: validated.outputFormat,
  });

  // 音声合成実行
  const result = await synthesizeSpeech({
    text: validated.text,
    ssml: validated.ssml,
    characterId: validated.characterId,
    voiceConfig: validated.voiceConfig,
    outputFormat: validated.outputFormat,
    saveToBucket: validated.saveToBucket,
  });

  logger.info("TTS synthesis completed", {
    audioUrl: result.audioUrl,
    duration: result.duration,
  });

  // 音声データはBase64エンコードして返す（オプション）
  const audioBase64 = validated.saveToBucket ? undefined : result.audioContent.toString("base64");

  return NextResponse.json({
    success: true,
    audioUrl: result.audioUrl,
    audioBase64, // saveToBucket=falseの場合のみ
    duration: result.duration,
    metadata: {
      inputType,
      inputLength,
      characterId: validated.characterId,
      outputFormat: validated.outputFormat,
    },
  });
}, "TTSSynthesize");
