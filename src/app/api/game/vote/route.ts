/**
 * POST /api/game/vote
 * 投票サーバーサイドAPI（原子的投票 + バリデーション）
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, ValidationError, NotFoundError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { checkConditionTransition } from "@/features/gm/logic/phases";
import type { GameState, Scenario } from "@/core/types";

const logger = createModuleLogger("VoteAPI");

const VoteRequestSchema = z.object({
  gameId: z.string().min(1),
  voterId: z.string().min(1),
  targetCharacterId: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = validateRequest(body, VoteRequestSchema);

  logger.info("Vote requested", validated);

  // Firestoreトランザクションで原子的に投票
  const result = await adminDb.runTransaction(async (transaction) => {
    const gameRef = adminDb.collection("games").doc(validated.gameId);
    const gameDoc = await transaction.get(gameRef);

    if (!gameDoc.exists) {
      throw new NotFoundError("Game", validated.gameId);
    }

    const game = gameDoc.data() as GameState;

    // フェーズチェック
    if (game.phase !== "voting") {
      throw new ValidationError("投票フェーズではありません");
    }

    // プレイヤー存在確認
    const player = game.players[validated.voterId];
    if (!player) {
      throw new ValidationError("プレイヤーが見つかりません");
    }

    // キャラクター選択確認
    if (!player.characterId) {
      throw new ValidationError("キャラクターを選択してから投票してください");
    }

    // 二重投票チェック
    const votes = game.votes || {};
    if (votes[validated.voterId]) {
      throw new ValidationError("既に投票済みです");
    }

    // 自分への投票禁止
    if (player.characterId === validated.targetCharacterId) {
      throw new ValidationError("自分自身には投票できません");
    }

    // キャラクター存在確認（シナリオから検証）
    const scenarioDoc = await transaction.get(
      adminDb.collection("scenarios").doc(game.scenarioId)
    );
    if (!scenarioDoc.exists) {
      throw new NotFoundError("Scenario", game.scenarioId);
    }
    const scenario = scenarioDoc.data() as Scenario;
    const targetExists = scenario.data.characters.some(
      (c) => c.id === validated.targetCharacterId
    );
    if (!targetExists) {
      throw new ValidationError("投票先のキャラクターが見つかりません");
    }

    // 投票を保存
    transaction.update(gameRef, {
      [`votes.${validated.voterId}`]: validated.targetCharacterId,
      updatedAt: Timestamp.now(),
    });

    return { success: true };
  });

  // トランザクション完了後に条件チェック（全員投票完了でエンディングへ遷移）
  try {
    await checkConditionTransition(validated.gameId);
  } catch (error) {
    logger.error("Failed to check condition transition after vote", error as Error, {
      gameId: validated.gameId,
    });
  }

  return NextResponse.json({
    success: true,
    message: "投票を記録しました",
  });
}, "VoteAPI");
