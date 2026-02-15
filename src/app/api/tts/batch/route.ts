/**
 * POST /api/tts/batch
 * 複数のテキストを一度に音声合成するAPI
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { synthesizeBatch } from "@/core/llm/vertex-tts";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("TTSBatchAPI");

/**
 * バッチTTS合成リクエストスキーマ
 */
const BatchTTSRequestSchema = z.object({
  texts: z.array(z.string().min(1).max(5000)).min(1).max(10), // 最大10個のテキスト
  characterId: z.string().optional(), // 全テキストに適用するキャラクターID
});

/**
 * バッチTTS合成API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（バッチ処理は厳しめ）
  const rateLimitResponse = await checkUserRateLimit(request, "strict");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, BatchTTSRequestSchema);

  logger.info("Batch TTS synthesis request", {
    count: validated.texts.length,
    characterId: validated.characterId,
  });

  // バッチ音声合成実行
  const results = await synthesizeBatch(validated.texts, validated.characterId);

  logger.info("Batch TTS synthesis completed", {
    count: results.length,
  });

  return NextResponse.json({
    success: true,
    count: results.length,
    results: results.map((r) => ({
      audioUrl: r.audioUrl,
      duration: r.duration,
    })),
  });
}, "TTSBatch");
