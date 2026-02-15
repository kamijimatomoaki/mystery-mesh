/**
 * POST /api/agent/action
 * エージェントの行動をゲームに反映
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import type { AgentAction } from "@/features/agent/types";
import type { ActionLog, GameState } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("AgentActionAPI");

/**
 * 行動リクエストスキーマ
 */
const ActionRequestSchema = z.object({
  gameId: z.string().min(1),
  agentId: z.string().min(1),
  action: z.object({
    type: z.enum(["talk", "investigate", "vote", "wait"]),
    content: z.string().optional(),
    targetCardId: z.string().optional(),
    targetCharacterId: z.string().optional(),
    location: z.string().optional(),
    emotion: z.string().optional(),
    reason: z.string().optional(),
  }),
});

/**
 * エージェント行動API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（エージェント行動のDoS防止）
  const rateLimitResponse = await checkUserRateLimit(request, "agentAction");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, ActionRequestSchema);

  const { gameId, agentId, action } = validated;

  logger.info("Agent action request", {
    gameId,
    agentId,
    actionType: action.type,
  });

  // エージェント情報を取得
  const agentDoc = await adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId)
    .get();

  if (!agentDoc.exists) {
    throw new NotFoundError("Agent", agentId);
  }

  const agentData = agentDoc.data();
  const characterId = agentData?.characterId;

  // ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    throw new NotFoundError("Game", gameId);
  }

  const gameState = gameDoc.data() as GameState;

  // 行動ログを作成
  const log: ActionLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    actorId: agentId,
    characterId: characterId || "unknown",
    characterName: agentData?.characterName || characterId,
    type: action.type,
    targetId: action.targetCardId || action.targetCharacterId,
    location: action.location,
    content: action.content,
    phase: gameState.phase,
    timestamp: Timestamp.now() as any,
  };

  // Firestoreに保存
  await adminDb.collection("games").doc(gameId).collection("logs").doc(log.id).set(log);

  logger.info("Agent action logged", {
    gameId,
    agentId,
    logId: log.id,
    actionType: action.type,
  });

  // もし発言なら、ゲームのメッセージサブコレクションにも追加
  if (action.type === "talk" && action.content) {
    await adminDb
      .collection("games")
      .doc(gameId)
      .collection("messages")
      .doc(log.id)
      .set({
        id: log.id,
        senderId: agentId,
        senderName: agentData?.characterName || characterId,
        characterId: characterId || "unknown",
        content: action.content,
        timestamp: Timestamp.now(),
      });

    logger.debug("Message added to game", { gameId, messageId: log.id });
  }

  return NextResponse.json({
    success: true,
    logId: log.id,
    actionType: action.type,
  });
}, "AgentAction");
