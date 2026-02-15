/**
 * POST /api/game/[gameId]/select-character
 * キャラクター選択API
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError, ValidationError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState } from "@/core/types";

const logger = createModuleLogger("SelectCharacter");

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

const SelectCharacterSchema = z.object({
  playerId: z.string().min(1),
  characterId: z.string().min(1),
});

/**
 * キャラクター選択
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  context: RouteContext
) => {
  const { gameId } = await context.params;
  const body = await request.json();
  const validated = validateRequest(body, SelectCharacterSchema);

  logger.info("Selecting character", { gameId, playerId: validated.playerId, characterId: validated.characterId });

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

  // 他のプレイヤーが既に選択していないかチェック
  const isCharacterTaken = Object.entries(game.players).some(
    ([pid, player]) => pid !== validated.playerId && player.characterId === validated.characterId
  );

  if (isCharacterTaken) {
    throw new ValidationError("このキャラクターは既に他のプレイヤーが選択しています");
  }

  // キャラクター選択を反映
  await gameRef.update({
    [`players.${validated.playerId}.characterId`]: validated.characterId,
    [`players.${validated.playerId}.isReady`]: true,
  });

  logger.info("Character selected successfully", { gameId, playerId: validated.playerId, characterId: validated.characterId });

  return NextResponse.json({
    success: true,
    playerId: validated.playerId,
    characterId: validated.characterId,
  });
}, "SelectCharacter");
