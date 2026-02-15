/**
 * POST /api/game/auto-trigger
 * 自発的発言トリガーAPI
 *
 * プレイヤーが発言しなくてもAIが会話を始められるようにする
 * 一定時間会話がない場合に自動でAI発言をトリガー
 *
 * 使用方法:
 * - Vercel Cron または Cloud Scheduler で定期実行
 * - アクティブなゲームのリストを取得して各ゲームに対して実行
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { adminDb } from "@/core/db/firestore-admin";
import type { GameState, ChatMessage } from "@/core/types";
import { PHASE_CONTROL_FLAGS } from "@/features/gm/types";

const logger = createModuleLogger("AutoTrigger");

/**
 * リクエストスキーマ
 */
const AutoTriggerRequestSchema = z.object({
  gameId: z.string().min(1).optional(),
  // 無発言経過時間の閾値（ミリ秒）- デフォルト60秒
  silenceThreshold: z.number().min(10000).max(300000).default(60000),
});

/**
 * 自動発言トリガー条件をチェック
 */
async function shouldAutoTrigger(
  gameId: string,
  silenceThreshold: number
): Promise<{ shouldTrigger: boolean; reason: string; elapsedMs?: number }> {
  // ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    return { shouldTrigger: false, reason: "Game not found" };
  }

  const game = gameDoc.data() as GameState;

  // 自動トリガー対象フェーズかチェック（prologueはハンドアウト確認中なので除外）
  const autoTriggerPhases = [
    "discussion_1",
    "discussion_2",
  ];

  if (!autoTriggerPhases.includes(game.phase)) {
    return {
      shouldTrigger: false,
      reason: `Phase ${game.phase} is not eligible for auto-trigger`,
    };
  }

  // フラグが未定義の場合はフェーズに基づいてフォールバック値を取得（既存データ対応）
  const phaseFlags = PHASE_CONTROL_FLAGS[game.phase] || { allowHumanInput: false, allowAITrigger: false };
  const allowAITrigger = game.allowAITrigger ?? phaseFlags.allowAITrigger;
  const isAISpeaking = game.isAISpeaking ?? false;

  // フラグチェック
  if (!allowAITrigger) {
    return { shouldTrigger: false, reason: "AI trigger is disabled" };
  }

  if (isAISpeaking) {
    return { shouldTrigger: false, reason: "AI is currently speaking" };
  }

  // 最後のメッセージを取得
  const messagesSnapshot = await adminDb
    .collection("games")
    .doc(gameId)
    .collection("messages")
    .orderBy("timestamp", "desc")
    .limit(1)
    .get();

  if (messagesSnapshot.empty) {
    // メッセージがない場合はトリガー
    return {
      shouldTrigger: true,
      reason: "No messages yet, initiating conversation",
    };
  }

  const lastMessage = messagesSnapshot.docs[0].data() as ChatMessage;
  const lastMessageTime =
    lastMessage.timestamp?.toMillis?.() ||
    lastMessage.timestamp?.seconds * 1000 ||
    0;

  const elapsed = Date.now() - lastMessageTime;

  if (elapsed > silenceThreshold) {
    return {
      shouldTrigger: true,
      reason: `Silence detected (${Math.round(elapsed / 1000)}s)`,
      elapsedMs: elapsed,
    };
  }

  return {
    shouldTrigger: false,
    reason: `Recent activity detected (${Math.round(elapsed / 1000)}s ago)`,
    elapsedMs: elapsed,
  };
}

/**
 * 自動発言トリガーを実行
 */
async function executeAutoTrigger(gameId: string): Promise<{
  success: boolean;
  triggered: boolean;
  reason: string;
}> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `http://localhost:${process.env.PORT || 3000}`;

  try {
    const response = await fetch(`${baseUrl}/api/game/trigger-speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        threshold: 30, // 閾値を下げて発言しやすくする
      }),
    });

    if (!response.ok) {
      logger.error("Auto trigger failed", undefined, {
        gameId,
        status: response.status,
      });
      return {
        success: false,
        triggered: false,
        reason: `trigger-speak API returned ${response.status}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      triggered: result.triggered || false,
      reason: result.reason || "Auto trigger executed",
    };
  } catch (error) {
    logger.error("Auto trigger error", error as Error, { gameId });
    return {
      success: false,
      triggered: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 自動トリガー対象のアクティブなゲームをすべて取得
 * prologueは除外（ハンドアウト確認中）
 */
async function getActiveGames(): Promise<string[]> {
  const activePhases = [
    "discussion_1",
    "discussion_2",
  ];

  const gamesSnapshot = await adminDb
    .collection("games")
    .where("phase", "in", activePhases)
    .get();

  return gamesSnapshot.docs.map((doc) => doc.id);
}

/**
 * 自発的発言トリガーAPI
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = validateRequest(body, AutoTriggerRequestSchema);

  // 特定のゲームIDが指定された場合
  if (validated.gameId) {
    logger.info("Auto trigger for specific game", { gameId: validated.gameId });

    const checkResult = await shouldAutoTrigger(
      validated.gameId,
      validated.silenceThreshold
    );

    if (!checkResult.shouldTrigger) {
      return NextResponse.json({
        success: true,
        triggered: false,
        gameId: validated.gameId,
        reason: checkResult.reason,
        elapsedMs: checkResult.elapsedMs,
      });
    }

    const triggerResult = await executeAutoTrigger(validated.gameId);

    return NextResponse.json({
      success: triggerResult.success,
      triggered: triggerResult.triggered,
      gameId: validated.gameId,
      reason: triggerResult.reason,
      checkReason: checkResult.reason,
      elapsedMs: checkResult.elapsedMs,
    });
  }

  // 全アクティブゲームに対して実行
  logger.info("Auto trigger for all active games");

  const activeGameIds = await getActiveGames();

  if (activeGameIds.length === 0) {
    return NextResponse.json({
      success: true,
      message: "No active games found",
      gamesChecked: 0,
      gamesTriggered: 0,
    });
  }

  const results = await Promise.all(
    activeGameIds.map(async (gameId) => {
      const checkResult = await shouldAutoTrigger(
        gameId,
        validated.silenceThreshold
      );

      if (!checkResult.shouldTrigger) {
        return {
          gameId,
          triggered: false,
          reason: checkResult.reason,
        };
      }

      const triggerResult = await executeAutoTrigger(gameId);
      return {
        gameId,
        triggered: triggerResult.triggered,
        reason: triggerResult.reason,
      };
    })
  );

  const triggeredCount = results.filter((r) => r.triggered).length;

  logger.info("Auto trigger completed", {
    gamesChecked: activeGameIds.length,
    gamesTriggered: triggeredCount,
  });

  return NextResponse.json({
    success: true,
    gamesChecked: activeGameIds.length,
    gamesTriggered: triggeredCount,
    results,
  });
}, "AutoTrigger");
