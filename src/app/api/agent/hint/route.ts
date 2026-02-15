/**
 * POST /api/agent/hint
 * ミステリー解決のヒント生成API
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { generateHint } from "@/features/agent/logic/solver";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("HintAPI");

/**
 * ヒント生成リクエストスキーマ
 */
const HintRequestSchema = z.object({
  gameId: z.string().min(1),
});

/**
 * ヒント生成API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, HintRequestSchema);

  logger.info("Hint request", { gameId: validated.gameId });

  // ヒント生成
  const hint = await generateHint(validated.gameId);

  logger.info("Hint generated", { gameId: validated.gameId, hint: hint.slice(0, 50) });

  return NextResponse.json({
    success: true,
    hint,
  });
}, "HintGenerate");
