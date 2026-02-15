/**
 * POST /api/scenario/delete
 * シナリオを削除するAPI
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { adminDb } from "@/core/db/firestore-admin";
import { checkUserRateLimit } from "@/core/security/middleware";
import type { Scenario } from "@/core/types";

const logger = createModuleLogger("ScenarioDeleteAPI");

const DeleteRequestSchema = z.object({
  scenarioId: z.string().min(1),
  authorId: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const rateLimitResponse = await checkUserRateLimit(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, DeleteRequestSchema);

  logger.info("Scenario delete request", {
    scenarioId: validated.scenarioId,
    authorId: validated.authorId,
  });

  // シナリオを取得して権限チェック
  const scenarioDoc = await adminDb
    .collection("scenarios")
    .doc(validated.scenarioId)
    .get();

  if (!scenarioDoc.exists) {
    return NextResponse.json(
      { success: false, error: "シナリオが見つかりません" },
      { status: 404 }
    );
  }

  const scenario = scenarioDoc.data() as Scenario;

  if (scenario.authorId !== validated.authorId) {
    return NextResponse.json(
      { success: false, error: "削除権限がありません" },
      { status: 403 }
    );
  }

  // 公開中の場合は先に非公開にする
  if (scenario.isPublished) {
    try {
      await adminDb
        .collection("publishedScenarios")
        .doc(validated.scenarioId)
        .delete();
    } catch {
      logger.warn("Failed to delete published scenario entry", {
        scenarioId: validated.scenarioId,
      });
    }
  }

  // シナリオを削除
  await adminDb.collection("scenarios").doc(validated.scenarioId).delete();

  logger.info("Scenario deleted successfully", {
    scenarioId: validated.scenarioId,
  });

  return NextResponse.json({
    success: true,
    message: "シナリオを削除しました",
  });
}, "ScenarioDelete");
