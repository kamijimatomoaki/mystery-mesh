/**
 * GET /api/game/[gameId]
 * ゲーム情報取得API
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario } from "@/core/types";

const logger = createModuleLogger("GameGet");

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

/**
 * ゲーム情報を取得
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  context: RouteContext
) => {
  const { gameId } = await context.params;

  logger.info("Fetching game", { gameId });

  // Firestoreからゲームを取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", gameId);
  }

  const game = gameDoc.data() as GameState;

  // シナリオも取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();

  if (!scenarioDoc.exists) {
    throw new NotFoundError("Scenario", game.scenarioId);
  }

  const scenario = scenarioDoc.data() as Scenario;

  logger.info("Game fetched successfully", { gameId, scenarioId: game.scenarioId });

  return NextResponse.json({
    game,
    scenario,
  });
}, "GameGet");
