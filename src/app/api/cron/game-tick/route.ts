/**
 * GET /api/cron/game-tick
 * サーバーサイドCron: アクティブゲームのタイマーチェック + AI自動発言 + ジョブクリーンアップ
 * Vercel Cron または Cloud Scheduler で60秒間隔で呼び出し
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import { checkTimerExpired } from "@/features/gm/logic/phases";
import type { GameState } from "@/core/types";

const logger = createModuleLogger("CronGameTick");

/**
 * Cron認証トークン（環境変数で設定）
 */
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  // 認証チェック（Vercel Cronまたは手動呼び出し）
  const authHeader = request.headers.get("authorization");
  if (!CRON_SECRET) {
    // 開発環境のみ認証なしを許可
    if (process.env.NODE_ENV !== "development") {
      logger.error("CRON_SECRET is not set in production");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
  } else if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  logger.info("Cron game-tick started");

  try {
    // 1. アクティブなゲームを取得（ending/ended以外のフェーズ）
    const activePhases = [
      "prologue", "exploration_1", "discussion_1",
      "exploration_2", "discussion_2", "voting",
    ];

    // Firestoreの 'in' クエリは最大30個まで
    const gamesSnapshot = await adminDb
      .collection("games")
      .where("phase", "in", activePhases)
      .get();

    logger.info("Active games found", { count: gamesSnapshot.size });

    const results: { gameId: string; action: string; success: boolean }[] = [];

    // 2. 各ゲームに対してタイマーチェック + AI発言トリガー
    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data() as GameState;
      const gameId = gameDoc.id;

      try {
        // タイマー満了チェック
        const expired = await checkTimerExpired(gameId);
        if (expired) {
          results.push({ gameId, action: "timer_expired", success: true });
          continue; // フェーズが遷移したのでこのゲームの処理は終了
        }

        // C5: スタックしたisAISpeakingロックを検出して自動解除
        if (game.isAISpeaking) {
          const lockedAt = game.isAISpeakingLockedAt ?? 0;
          const lockAge = Date.now() - lockedAt;
          const LOCK_TIMEOUT_MS = 60_000; // 60秒

          if (lockedAt > 0 && lockAge > 0 && lockAge > LOCK_TIMEOUT_MS) {
            logger.warn("Detected stale AI speaking lock, auto-releasing", {
              gameId,
              lockAge,
              lockedAt,
            });
            await adminDb.collection("games").doc(gameId).update({
              isAISpeaking: false,
              isAISpeakingLockedAt: null,
            });
            results.push({ gameId, action: "stale_lock_released", success: true });
          }
        }

        // 議論フェーズの場合、サマライザーをfire-and-forgetで実行
        if (game.phase.startsWith("discussion")) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
            // ノンブロッキング: サマライザーの完了を待たない
            fetch(`${baseUrl}/api/game/update-summary`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ gameId }),
            }).catch((err) => {
              logger.warn("Summarizer fire-and-forget failed", { gameId, error: String(err) });
            });
          } catch (summarizerError) {
            // サマライザーのエラーはログのみ、ゲーム進行をブロックしない
            logger.warn("Summarizer trigger failed", { gameId, error: String(summarizerError) });
          }
        }

        // 議論フェーズの場合、AI発言をトリガー
        if (game.phase.startsWith("discussion") && !game.isAISpeaking) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
            const response = await fetch(`${baseUrl}/api/game/trigger-speak`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ gameId }),
            });

            if (response.ok) {
              results.push({ gameId, action: "ai_trigger", success: true });
            } else {
              results.push({ gameId, action: "ai_trigger", success: false });
            }
          } catch (triggerError) {
            logger.warn("AI trigger failed for game", { gameId, error: String(triggerError) });
            results.push({ gameId, action: "ai_trigger", success: false });
          }
        }
      } catch (error) {
        logger.error("Game tick failed", error as Error, { gameId });
        results.push({ gameId, action: "error", success: false });
      }
    }

    // 3. ジョブクリーンアップ（24時間以上前の完了/失敗ジョブを削除）
    const cleanupCutoff = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);
    let cleanedJobs = 0;

    for (const collection of ["scenarioJobs", "videoJobs", "endingJobs"]) {
      try {
        const oldJobs = await adminDb
          .collection(collection)
          .where("updatedAt", "<", cleanupCutoff)
          .where("status", "in", ["completed", "failed"])
          .limit(50) // バッチサイズ制限
          .get();

        if (oldJobs.size > 0) {
          const batch = adminDb.batch();
          oldJobs.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          cleanedJobs += oldJobs.size;
        }
      } catch (cleanupError) {
        logger.warn("Job cleanup failed for collection", { collection, error: String(cleanupError) });
      }
    }

    const executionTime = Date.now() - startTime;
    logger.info("Cron game-tick completed", {
      executionTime,
      gamesProcessed: gamesSnapshot.size,
      cleanedJobs,
    });

    return NextResponse.json({
      success: true,
      gamesProcessed: gamesSnapshot.size,
      results,
      cleanedJobs,
      executionTimeMs: executionTime,
    });
  } catch (error) {
    logger.error("Cron game-tick failed", error as Error);
    return NextResponse.json(
      { error: "Cron execution failed", message: String(error) },
      { status: 500 }
    );
  }
}
