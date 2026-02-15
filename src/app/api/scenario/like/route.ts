/**
 * POST /api/scenario/like
 * シナリオにいいねするAPI
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { likeScenario, unlikeScenario } from "@/features/scenario/logic/publish";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("ScenarioLikeAPI");

/**
 * いいねリクエストスキーマ
 */
const LikeScenarioRequestSchema = z.object({
  scenarioId: z.string().min(1),
  userId: z.string().min(1),
  action: z.enum(["like", "unlike"]).default("like"),
});

/**
 * シナリオいいねAPI
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, LikeScenarioRequestSchema);

  logger.info("Scenario like request", {
    scenarioId: validated.scenarioId,
    userId: validated.userId,
    action: validated.action,
  });

  if (validated.action === "like") {
    // いいね
    await likeScenario(validated.scenarioId, validated.userId);

    logger.info("Scenario liked successfully", { scenarioId: validated.scenarioId });

    return NextResponse.json({
      success: true,
      message: "いいねしました",
    });
  } else {
    // いいね取り消し
    await unlikeScenario(validated.scenarioId, validated.userId);

    logger.info("Scenario unliked successfully", { scenarioId: validated.scenarioId });

    return NextResponse.json({
      success: true,
      message: "いいねを取り消しました",
    });
  }
}, "ScenarioLike");
