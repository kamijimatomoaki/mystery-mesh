/**
 * POST /api/game/exploration/action
 * 探索アクション実行API（ターン制）
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError, AuthorizationError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { adminDb } from "@/core/db/firestore-admin";
import { executeExplorationAction, isExplorationComplete, skipExplorationTurn } from "@/features/gm/logic/exploration-turns";
import { transitionPhase } from "@/features/gm/logic/phases";
import type { GameState } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("ExplorationAction");

/**
 * 探索アクションリクエストスキーマ
 */
const ExplorationActionRequestSchema = z.object({
  gameId: z.string().min(1),
  playerId: z.string().min(1),
  cardId: z.string().optional(),
  action: z.enum(["investigate", "skip"]).optional(),
});

/**
 * 探索アクションを実行
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, ExplorationActionRequestSchema);

  logger.info("Exploration action requested", {
    gameId: validated.gameId,
    playerId: validated.playerId,
    cardId: validated.cardId,
  });

  // ゲーム取得
  const gameDoc = await adminDb.collection("games").doc(validated.gameId).get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }

  const game = gameDoc.data() as GameState;

  // フェーズチェック
  if (!game.phase.startsWith("exploration")) {
    throw new AuthorizationError("探索フェーズではありません");
  }

  // プレイヤー確認
  const player = game.players[validated.playerId];
  if (!player) {
    throw new AuthorizationError("このゲームの参加者ではありません");
  }

  // スキップアクション
  if (validated.action === "skip") {
    logger.info("Player skipping exploration turn", {
      gameId: validated.gameId,
      playerId: validated.playerId,
    });

    await skipExplorationTurn(validated.gameId, validated.playerId);

    return NextResponse.json({
      success: true,
      message: "ターンをスキップしました",
      nextActor: null,
      isExplorationComplete: false,
    });
  }

  // 調査アクション（cardIdが必須）
  if (!validated.cardId) {
    return NextResponse.json({
      success: false,
      message: "カードIDが必要です",
    }, { status: 400 });
  }

  // 探索アクションを実行
  const result = await executeExplorationAction(
    validated.gameId,
    validated.playerId,
    validated.cardId
  );

  if (!result.success) {
    return NextResponse.json({
      success: false,
      message: result.message,
      nextActor: result.nextActor,
    }, { status: 400 });
  }

  // 探索フェーズ完了チェック
  const isComplete = await isExplorationComplete(validated.gameId);

  if (isComplete) {
    logger.info("Exploration phase complete, transitioning", { gameId: validated.gameId });
    await transitionPhase(validated.gameId, "condition_met", validated.playerId);
  }

  logger.info("Exploration action completed", {
    gameId: validated.gameId,
    playerId: validated.playerId,
    nextActor: result.nextActor,
    isComplete,
  });

  return NextResponse.json({
    success: true,
    message: result.message,
    nextActor: result.nextActor,
    isExplorationComplete: isComplete,
  });
}, "ExplorationAction");

/**
 * GET /api/game/exploration/action
 * 現在のターン情報を取得
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return NextResponse.json({ error: "gameId is required" }, { status: 400 });
  }

  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", gameId);
  }

  const game = gameDoc.data() as GameState;
  const explorationState = game.explorationState;

  if (!explorationState) {
    return NextResponse.json({
      currentActor: null,
      isYourTurn: false,
      remainingTurns: 0,
      playerAP: {},
    });
  }

  const currentActor = explorationState.currentActiveActor;
  const currentPlayer = currentActor ? game.players[currentActor] : null;

  return NextResponse.json({
    currentActor,
    currentActorName: currentPlayer?.displayName || null,
    currentActorCharacter: currentPlayer?.characterId || null,
    isHumanTurn: currentPlayer?.isHuman ?? false,
    remainingTurns: explorationState.actionQueue.length,
    playerAP: explorationState.remainingAP,
    actionQueue: explorationState.actionQueue.slice(0, 5), // 次の5人まで表示
  });
}, "ExplorationTurnInfo");
