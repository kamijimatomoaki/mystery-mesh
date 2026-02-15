/**
 * POST /api/game/join
 * ゲーム参加API
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError, ValidationError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("GameJoin");

/**
 * ゲーム参加リクエストスキーマ
 */
const JoinGameRequestSchema = z.object({
  gameId: z.string().min(1),
  playerId: z.string().min(1),
  playerName: z.string().min(1),
});

/**
 * ゲーム参加
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（ゲーム参加のspamming防止）
  const rateLimitResponse = await checkUserRateLimit(request, "gameJoin");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, JoinGameRequestSchema);

  logger.info("Player joining game", { gameId: validated.gameId, playerId: validated.playerId });

  // ゲーム取得
  const gameRef = adminDb.collection("games").doc(validated.gameId);
  const gameDoc = await gameRef.get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }

  const game = gameDoc.data() as GameState;

  // バリデーション: setupまたはlobbyフェーズでのみ参加可能
  if (game.phase !== "setup" && game.phase !== "lobby") {
    throw new ValidationError("このゲームは既に開始されています");
  }

  const playerCount = Object.keys(game.players).length;

  // 既に参加済みかチェック
  if (validated.playerId in game.players) {
    throw new ValidationError("既にこのゲームに参加しています");
  }

  // プレイヤーを追加（オブジェクト形式）
  const updatedPlayers = {
    ...game.players,
    [validated.playerId]: {
      characterId: "", // まだ未選択
      isHuman: true,
      displayName: validated.playerName,
      isReady: false,
      isOnline: true,
    },
  };

  await gameRef.update({
    players: updatedPlayers,
  });

  logger.info("Player joined successfully", { gameId: validated.gameId, playerId: validated.playerId });

  return NextResponse.json({
    success: true,
    message: "ゲームに参加しました",
    game: {
      id: game.id,
      playerCount: playerCount + 1,
    },
  });
}, "GameJoin");
