/**
 * POST /api/game/trigger-speak
 * AI発言トリガーAPI（Gemini発言者ランキングベース）
 *
 * 改善版:
 * - Geminiによる発言者選定（ルールベースから完全委任）
 * - isAISpeakingフラグによるロック機構
 * - 発言希望フラグの管理
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { checkUserRateLimit } from "@/core/security/middleware";
import { adminDb } from "@/core/db/firestore-admin";
import type { GameState } from "@/core/types";
import { PHASE_CONTROL_FLAGS } from "@/features/gm/types";
import { executeAgentAction } from "@/features/gm/logic/agent-actions";

const logger = createModuleLogger("TriggerSpeak");

/**
 * 発言トリガーリクエストスキーマ
 */
const TriggerSpeakRequestSchema = z.object({
  gameId: z.string().min(1),
  threshold: z.number().min(0).max(100).default(50), // 互換性のため残す（未使用）
});

/**
 * AI発言をトリガー
 * Geminiランキングに基づいてエージェントに発言させる
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, TriggerSpeakRequestSchema);

  logger.info("Trigger speak requested", { gameId: validated.gameId });

  // 1. Firestore Transactionでアトミックにcheck-and-set（Race Condition防止）
  const gameRef = adminDb.collection("games").doc(validated.gameId);

  const { triggered, reason, game, remainingSeconds, speakingPlayer } = await adminDb.runTransaction(async (transaction) => {
    const gameDoc = await transaction.get(gameRef);

    if (!gameDoc.exists) {
      return { triggered: false, reason: "Game not found", game: null, remainingSeconds: 0, speakingPlayer: "" };
    }

    const gameData = gameDoc.data() as GameState;
    const now = Date.now();

    // フラグが未定義の場合はフェーズに基づいてフォールバック値を取得（既存データ対応）
    const phaseFlags = PHASE_CONTROL_FLAGS[gameData.phase] || { allowHumanInput: false, allowAITrigger: false };
    const allowAITrigger = gameData.allowAITrigger ?? phaseFlags.allowAITrigger;
    const isAISpeaking = gameData.isAISpeaking ?? false;

    // 探索フェーズなど会話が禁止されるフェーズの明示的チェック（二重ガード）
    if (!gameData.phase.startsWith("discussion")) {
      return {
        triggered: false,
        reason: `Phase ${gameData.phase} does not allow AI speaking`,
        game: gameData,
        remainingSeconds: 0,
        speakingPlayer: ""
      };
    }

    // isAISpeakingフラグをチェック（新ロック機構 + タイムアウト防御）
    if (isAISpeaking) {
      // C5: ロックが60秒以上経過していたら自動解除（スタック防止）
      const lockedAt = gameData.isAISpeakingLockedAt ?? 0;
      const lockAge = now - lockedAt;
      const LOCK_TIMEOUT_MS = 60_000; // 60秒

      if (lockedAt > 0 && lockAge > 0 && lockAge > LOCK_TIMEOUT_MS) {
        logger.warn("AI speaking lock timed out, auto-releasing", {
          gameId: gameData.id || validated.gameId,
          lockAge,
          lockedAt,
        });
        // タイムアウト — このリクエストがロックを奪取する
      } else {
        return { triggered: false, reason: "AI is currently speaking", game: gameData, remainingSeconds: 0, speakingPlayer: "" };
      }
    }

    // allowAITriggerフラグをチェック
    if (!allowAITrigger) {
      return {
        triggered: false,
        reason: "AI trigger is disabled for this phase",
        game: gameData,
        remainingSeconds: 0,
        speakingPlayer: ""
      };
    }

    // 従来のスピーチロック確認（TTS重複防止・後方互換）
    if (gameData.speechLock && gameData.speechLock.lockedUntil > now) {
      const remaining = Math.ceil((gameData.speechLock.lockedUntil - now) / 1000);
      return {
        triggered: false,
        reason: "speech_locked",
        game: gameData,
        remainingSeconds: remaining,
        speakingPlayer: gameData.speechLock.speakingPlayerId,
      };
    }

    // アトミックにロック取得（C5: タイムスタンプ付き）
    transaction.update(gameRef, { isAISpeaking: true, isAISpeakingLockedAt: now });
    return { triggered: true, reason: "lock_acquired", game: gameData, remainingSeconds: 0, speakingPlayer: "" };
  });

  // トランザクション結果に基づいて早期リターン
  if (!triggered) {
    if (reason === "Game not found") {
      logger.warn("Game not found", { gameId: validated.gameId });
      return NextResponse.json({ success: false, message: "Game not found" }, { status: 404 });
    }

    if (reason?.startsWith("Phase ")) {
      logger.info("Phase does not allow AI speaking", {
        gameId: validated.gameId,
        phase: game?.phase,
        reason,
      });
      return NextResponse.json({ success: true, triggered: false, reason });
    }

    if (reason === "AI is currently speaking") {
      logger.info("AI is currently speaking, skipping trigger", { gameId: validated.gameId });
      return NextResponse.json({ success: true, triggered: false, reason });
    }

    if (reason === "AI trigger is disabled for this phase") {
      logger.info("AI trigger is disabled for this phase", {
        gameId: validated.gameId,
        phase: game?.phase,
        flagSource: game?.allowAITrigger !== undefined ? "explicit" : "fallback",
      });
      return NextResponse.json({ success: true, triggered: false, reason });
    }

    if (reason === "speech_locked") {
      logger.info("Speech locked, skipping trigger", {
        gameId: validated.gameId,
        speakingPlayer,
        remainingSeconds,
      });
      return NextResponse.json({
        success: true,
        triggered: false,
        reason: "speech_locked",
        speakingPlayer,
        remainingSeconds,
      });
    }
  }

  logger.info("AI speaking lock acquired via transaction", { gameId: validated.gameId });

  try {
    // 3. Geminiでランキング生成
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const rankingResponse = await fetch(`${baseUrl}/api/game/select-speaker`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: validated.gameId }),
    });

    if (!rankingResponse.ok) {
      logger.error("Select speaker API failed", undefined, {
        gameId: validated.gameId,
        status: rankingResponse.status,
      });
      throw new Error("Failed to get speaker ranking");
    }

    const rankingResult = await rankingResponse.json();

    if (!rankingResult.ranking || rankingResult.ranking.length === 0) {
      logger.info("No speakers available", { gameId: validated.gameId });
      return NextResponse.json({
        success: true,
        triggered: false,
        reason: "No speakers available",
      });
    }

    // 4. ランキング1位のAIに発言させる
    const topSpeaker = rankingResult.ranking[0];
    logger.info("Top speaker selected", {
      gameId: validated.gameId,
      agentId: topSpeaker.agentId,
      characterName: topSpeaker.characterName,
      reason: topSpeaker.reason,
    });

    // スピーチロックを設定（TTS用・デフォルト15秒）
    const defaultLockDuration = 15000;
    await adminDb.collection("games").doc(validated.gameId).update({
      speechLock: {
        lockedUntil: Date.now() + defaultLockDuration,
        speakingPlayerId: topSpeaker.agentId,
      },
    });

    // Agent Thinking APIを呼び出して発言を生成
    const thinkResponse = await fetch(`${baseUrl}/api/agent/think`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: validated.gameId,
        agentId: topSpeaker.agentId,
        trigger: "new_message",
      }),
    });

    if (!thinkResponse.ok) {
      logger.error("Agent think API failed", undefined, {
        gameId: validated.gameId,
        agentId: topSpeaker.agentId,
        status: thinkResponse.status,
      });
      // エラー時はロックを解除
      await adminDb.collection("games").doc(validated.gameId).update({
        speechLock: null,
      });
    } else {
      logger.info("Agent think API succeeded", {
        gameId: validated.gameId,
        agentId: topSpeaker.agentId,
      });

      // メッセージ長に応じたロック時間を再設定
      const thinkResult = await thinkResponse.json();
      if (thinkResult.action?.content) {
        // メッセージをFirestoreに保存（これがないとUIに表示されない）
        await executeAgentAction(validated.gameId, topSpeaker.agentId, {
          type: "talk",
          content: thinkResult.action.content,
        });
        logger.info("Agent message saved via executeAgentAction", {
          gameId: validated.gameId,
          agentId: topSpeaker.agentId,
          messageLength: thinkResult.action.content.length,
        });

        // メッセージ保存完了後にスピーチロックを設定（保存完了を保証）
        const messageLength = thinkResult.action.content.length;
        const lockDuration = Math.min(messageLength * 100 + 5000, 30000);
        await adminDb.collection("games").doc(validated.gameId).update({
          speechLock: {
            lockedUntil: Date.now() + lockDuration,
            speakingPlayerId: topSpeaker.agentId,
          },
        });
        logger.info("Speech lock updated after message save", {
          gameId: validated.gameId,
          agentId: topSpeaker.agentId,
          messageLength,
          lockDuration,
        });
      } else {
        // 発言がなかった場合はロックを解除
        await adminDb.collection("games").doc(validated.gameId).update({
          speechLock: null,
        });
        logger.info("No message generated, speech lock released", {
          gameId: validated.gameId,
          agentId: topSpeaker.agentId,
        });
      }
    }

    // 5. 発言希望フラグを更新（2位以下で wantsToSpeak: true のエージェント）
    const wantedToSpeakAgents = rankingResult.ranking
      .slice(1)
      .filter((entry: { wantsToSpeak: boolean }) => entry.wantsToSpeak);

    for (const entry of wantedToSpeakAgents) {
      try {
        // agentIdを使ってagentBrainを更新（キーはagent_${playerId}）
        await adminDb
          .collection("games")
          .doc(validated.gameId)
          .collection("agentBrains")
          .doc(entry.agentId)
          .update({ wantedToSpeak: true });

        logger.debug("Marked agent as wanted to speak", {
          gameId: validated.gameId,
          agentId: entry.agentId,
        });
      } catch (err) {
        logger.warn("Failed to update wantedToSpeak flag", {
          gameId: validated.gameId,
          agentId: entry.agentId,
        });
      }
    }

    // 発言したエージェントのwantedToSpeakフラグをリセット
    try {
      await adminDb
        .collection("games")
        .doc(validated.gameId)
        .collection("agentBrains")
        .doc(topSpeaker.agentId)
        .update({ wantedToSpeak: false });
    } catch (err) {
      logger.warn("Failed to reset wantedToSpeak flag", {
        gameId: validated.gameId,
        agentId: topSpeaker.agentId,
      });
    }

    return NextResponse.json({
      success: true,
      triggered: true,
      agentId: topSpeaker.agentId,
      characterName: topSpeaker.characterName,
      reason: topSpeaker.reason,
      ranking: rankingResult.ranking.map((r: { agentId: string; characterName: string; priority: number; reason: string }) => ({
        agentId: r.agentId,
        characterName: r.characterName,
        priority: r.priority,
        reason: r.reason,
      })),
    });
  } catch (err) {
    logger.error("Trigger speak failed", err instanceof Error ? err : undefined, {
      gameId: validated.gameId,
    });

    // エラー時もロックを解除
    try {
      await adminDb.collection("games").doc(validated.gameId).update({
        speechLock: null,
      });
    } catch {
      logger.error("Failed to release speech lock on error", undefined, {
        gameId: validated.gameId,
      });
    }

    throw err;
  } finally {
    // 6. ロック解除（isAISpeaking = false + タイムスタンプクリア）
    try {
      await adminDb.collection("games").doc(validated.gameId).update({
        isAISpeaking: false,
        isAISpeakingLockedAt: null,
      });
      logger.info("AI speaking lock released", { gameId: validated.gameId });
    } catch (err) {
      logger.error("Failed to release AI speaking lock", err instanceof Error ? err : undefined, {
        gameId: validated.gameId,
      });
    }
  }
}, "TriggerSpeak");
