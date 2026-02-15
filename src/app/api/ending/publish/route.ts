/**
 * POST /api/ending/publish
 * エンディング画面からシナリオを公開する
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import { adminDb } from "@/core/db/firestore-admin";
import { publishScenario } from "@/features/scenario/logic/publish";
import type { GameState } from "@/core/types";

const logger = createModuleLogger("EndingPublish");

const PublishRequestSchema = z.object({
  gameId: z.string().min(1, "gameId is required"),
  authorId: z.string().min(1, "authorId is required"),
  authorName: z.string().min(1, "authorName is required"),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = validateRequest(body, PublishRequestSchema);

  logger.info("Publish scenario from ending", {
    gameId: validated.gameId,
    authorId: validated.authorId,
  });

  // ゲーム情報からscenarioIdを取得
  const gameDoc = await adminDb.collection("games").doc(validated.gameId).get();
  if (!gameDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }
  const game = gameDoc.data() as GameState;

  // シナリオを公開
  const published = await publishScenario(
    game.scenarioId,
    validated.authorId,
    validated.authorName
  );

  logger.info("Scenario published successfully", {
    scenarioId: game.scenarioId,
    publishedId: published.id,
  });

  return NextResponse.json({
    success: true,
    publishedScenario: {
      id: published.id,
      title: published.title,
    },
  });
}, "EndingPublish");
