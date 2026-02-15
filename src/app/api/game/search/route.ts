/**
 * GET /api/game/search
 * ゲーム検索API
 * ルームIDでゲームを検索し、シナリオ情報と共に返却
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { getScenarioById } from "@/core/mock/scenarios";
import type { GameState, Scenario } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("GameSearch");

/**
 * ゲーム検索API
 * クエリパラメータ: ?gameId=xxx
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "loose");
  if (rateLimitResponse) return rateLimitResponse;

  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

  if (!gameId || !gameId.trim()) {
    return NextResponse.json(
      { success: false, error: "gameIdパラメータが必要です" },
      { status: 400 }
    );
  }

  logger.info("Searching for game", { gameId });

  // Firestoreからゲームを取得
  const gameDoc = await adminDb.collection("games").doc(gameId.trim()).get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", gameId);
  }

  const game = gameDoc.data() as GameState;

  // シナリオ情報を取得（Firestore優先、開発環境のみモックをフォールバック）
  let scenario: Scenario | undefined;

  // まずFirestoreから取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  if (scenarioDoc.exists) {
    scenario = scenarioDoc.data() as Scenario;
    logger.debug("Scenario fetched from Firestore");
  }

  // Firestoreにない場合、開発環境のみモックをフォールバック
  if (!scenario && process.env.NODE_ENV !== "production") {
    logger.debug("Scenario not in Firestore, using mock fallback (development only)");
    scenario = getScenarioById(game.scenarioId);
  }

  if (!scenario) {
    throw new NotFoundError("Scenario", game.scenarioId);
  }

  // プレイヤー数と定員を計算
  const currentPlayerCount = Object.keys(game.players).length;
  const humanPlayerCount = Object.values(game.players).filter((p) => p.isHuman).length;
  const aiPlayerCount = Object.values(game.players).filter((p) => !p.isHuman).length;
  const maxPlayers = scenario.data.characters.length;

  // 参加可能かチェック（setupまたはlobbyフェーズ）
  const canJoin = (game.phase === "setup" || game.phase === "lobby") && currentPlayerCount < maxPlayers;

  logger.info("Game found", { gameId, phase: game.phase, canJoin });

  return NextResponse.json({
    success: true,
    game: {
      id: game.id,
      phase: game.phase,
      isPrivate: false, // TODO: 将来的にパスワード保護対応
      currentPlayerCount,
      humanPlayerCount,
      aiPlayerCount,
      maxPlayers,
      canJoin,
    },
    scenario: {
      id: scenario.id,
      title: scenario.meta.title,
      description: scenario.meta.description,
      difficulty: scenario.meta.difficulty,
      genre: scenario.meta.genre,
      characterCount: scenario.data.characters.length,
    },
  });
}, "GameSearch");
