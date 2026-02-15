/**
 * POST /api/game/create
 * ゲーム作成API
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { getScenarioById } from "@/core/mock/scenarios";
import type { GameState, Scenario } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("GameCreate");

/**
 * ゲーム作成リクエストスキーマ
 */
const CreateGameRequestSchema = z.object({
  scenarioId: z.string().min(1),
  hostId: z.string().min(1),
  hostName: z.string().min(1),
  roomName: z.string().min(1),
  isPrivate: z.boolean().default(false),
  password: z.string().optional(),
  humanPlayerCount: z.number().int().min(1).max(8).default(1),
  aiPlayerCount: z.number().int().min(0).max(7).default(0),
});

/**
 * ゲーム作成
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（ゲーム作成のspamming防止）
  const rateLimitResponse = await checkUserRateLimit(request, "gameCreation");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, CreateGameRequestSchema);

  logger.info("Creating new game", { scenarioId: validated.scenarioId, hostId: validated.hostId });

  // シナリオの存在確認（Firestore優先、開発環境のみモックをフォールバック）
  let scenario: Scenario | undefined;

  // まずFirestoreから取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(validated.scenarioId).get();
  if (scenarioDoc.exists) {
    scenario = scenarioDoc.data() as Scenario;
    logger.debug("Scenario fetched from Firestore");
  }

  // Firestoreにない場合、開発環境のみモックをフォールバック
  if (!scenario && process.env.NODE_ENV !== "production") {
    logger.debug("Scenario not in Firestore, using mock fallback (development only)");
    scenario = getScenarioById(validated.scenarioId);
  }

  if (!scenario) {
    throw new NotFoundError("Scenario", validated.scenarioId);
  }

  // ゲームIDを生成
  const gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // プレイヤー情報を構築
  const players: GameState["players"] = {
    // ホストプレイヤー
    [validated.hostId]: {
      characterId: "", // まだ未選択
      isHuman: true,
      displayName: validated.hostName,
      isReady: false,
      isOnline: true,
    },
  };

  // AIプレイヤーを追加
  for (let i = 0; i < validated.aiPlayerCount; i++) {
    const aiId = `agent_bot_${gameId}_${i}`;
    players[aiId] = {
      characterId: "", // ゲーム開始時に自動割り当て
      isHuman: false,
      displayName: `AIプレイヤー ${i + 1}`,
      isReady: true, // AIは常に準備完了
      isOnline: true,
    };
  }

  // 初期ゲーム状態を作成（GameState型に合わせる）
  const gameState: GameState = {
    id: gameId,
    scenarioId: validated.scenarioId,
    hostId: validated.hostId,

    // 進行管理
    phase: "setup", // キャラクター選択フェーズ
    turnCount: 0,

    // タイマー管理
    phaseDeadline: null, // setupは無制限
    isPaused: false,

    // 参加プレイヤー（オブジェクト形式）
    players,

    // カードの状態
    cards: {},

    // AI発言制御フラグ（setupフェーズではすべて無効）
    allowHumanInput: false,
    allowAITrigger: false,
    isAISpeaking: false,

    // エンディングデータ（ゲーム終了まで未設定）
    // endingData は後で設定

    // Human Shadow State
    humanShadowState: {},
  };

  // Firestoreに保存
  await adminDb.collection("games").doc(gameId).set(gameState);

  logger.info("Game created successfully", { gameId });

  return NextResponse.json({
    success: true,
    gameId,
    game: {
      id: gameId,
      scenarioId: validated.scenarioId,
      scenarioTitle: scenario.meta.title,
      phase: "setup",
      playerCount: Object.keys(gameState.players).length,
      totalPlayers: validated.humanPlayerCount + validated.aiPlayerCount,
    },
  });
}, "GameCreate");
