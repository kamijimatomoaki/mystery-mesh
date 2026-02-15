/**
 * POST /api/scenario/publish
 * シナリオを公開するAPI
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { publishScenario, unpublishScenario } from "@/features/scenario/logic/publish";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("ScenarioPublishAPI");

/**
 * シナリオ公開リクエストスキーマ
 */
const PublishScenarioRequestSchema = z.object({
  scenarioId: z.string().min(1),
  authorId: z.string().min(1),
  authorName: z.string().min(1),
  action: z.enum(["publish", "unpublish"]).default("publish"),
});

/**
 * シナリオ公開API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, PublishScenarioRequestSchema);

  logger.info("Scenario publish request", {
    scenarioId: validated.scenarioId,
    authorId: validated.authorId,
    action: validated.action,
  });

  if (validated.action === "publish") {
    // シナリオを公開
    const publishedScenario = await publishScenario(
      validated.scenarioId,
      validated.authorId,
      validated.authorName
    );

    logger.info("Scenario published successfully", { scenarioId: validated.scenarioId });

    return NextResponse.json({
      success: true,
      message: "シナリオを公開しました",
      publishedScenario,
    });
  } else {
    // シナリオの公開を取り下げる
    await unpublishScenario(validated.scenarioId, validated.authorId);

    logger.info("Scenario unpublished successfully", { scenarioId: validated.scenarioId });

    return NextResponse.json({
      success: true,
      message: "シナリオの公開を取り下げました",
    });
  }
}, "ScenarioPublish");
