/**
 * POST /api/game/[gameId]/toggle-ready
 * プレイヤーの準備完了状態を切り替え
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError, ValidationError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState } from "@/core/types";

const logger = createModuleLogger("ToggleReady");

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

const ToggleReadySchema = z.object({
  playerId: z.string().min(1),
});

/**
 * 準備完了状態を切り替え
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  context: RouteContext
) => {
  const { gameId } = await context.params;
  const body = await request.json();
  const validated = validateRequest(body, ToggleReadySchema);

  logger.info("Toggling ready state", { gameId, playerId: validated.playerId });

  // Firestoreからゲームを取得
  const gameRef = adminDb.collection("games").doc(gameId);
  const gameDoc = await gameRef.get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", gameId);
  }

  const game = gameDoc.data() as GameState;

  // プレイヤーの存在確認
  if (!game.players[validated.playerId]) {
    throw new ValidationError("プレイヤーが見つかりません");
  }

  // 準備完了状態を反転
  const newReadyState = !game.players[validated.playerId].isReady;

  await gameRef.update({
    [`players.${validated.playerId}.isReady`]: newReadyState,
  });

  logger.info("Ready state toggled", { gameId, playerId: validated.playerId, isReady: newReadyState });

  return NextResponse.json({
    success: true,
    playerId: validated.playerId,
    isReady: newReadyState,
  });
}, "ToggleReady");
