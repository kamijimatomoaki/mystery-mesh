/**
 * POST /api/ending/generate-video
 * エンディング動画生成API（Polling Pattern）
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { generateEndingVideo } from "@/core/llm/vertex-video";
import { withRetry } from "@/core/utils/async";
import type { GameState, Scenario } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("EndingVideo");

/**
 * 動画生成リクエストスキーマ
 */
const GenerateVideoRequestSchema = z.object({
  gameId: z.string().min(1),
});

/**
 * 動画生成ジョブ
 */
interface VideoGenerationJob {
  id: string;
  gameId: string;
  status: "processing" | "completed" | "failed";
  progress: number;
  videoUrl?: string;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * エンディング動画生成（非同期）
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（エンディング生成は重い処理なので厳しい制限）
  const rateLimitResponse = await checkUserRateLimit(request, "endingGeneration");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, GenerateVideoRequestSchema);

  logger.info("Ending video generation requested", { gameId: validated.gameId });

  // ゲーム取得
  const gameDoc = await adminDb.collection("games").doc(validated.gameId).get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }

  const game = gameDoc.data() as GameState;

  // シナリオ取得（Firestoreから取得）
  let scenario: Scenario | undefined;
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  if (scenarioDoc.exists) {
    scenario = scenarioDoc.data() as Scenario;
  }

  if (!scenario) {
    throw new NotFoundError("Scenario", game.scenarioId);
  }

  // Job IDを生成
  const jobId = `video_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Firestoreにジョブを作成
  const job: VideoGenerationJob = {
    id: jobId,
    gameId: validated.gameId,
    status: "processing",
    progress: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  await adminDb.collection("videoJobs").doc(jobId).set(job);

  logger.info("Video generation job created", { jobId });

  // バックグラウンドで動画生成開始
  executeVideoGeneration(jobId, game, scenario).catch((error) => {
    logger.error("Video generation failed", error);

    // エラー時はジョブステータスを更新
    adminDb.collection("videoJobs").doc(jobId).update({
      status: "failed",
      error: String(error),
      updatedAt: Timestamp.now(),
    });
  });

  // Job IDを即座に返却
  return NextResponse.json({
    success: true,
    jobId,
    message: "動画生成を開始しました。ステータスを確認してください",
  });
}, "EndingVideoGenerate");

/**
 * バックグラウンドで動画生成を実行
 */
async function executeVideoGeneration(
  jobId: string,
  game: GameState,
  scenario: Scenario
) {
  const jobRef = adminDb.collection("videoJobs").doc(jobId);

  try {
    // 進捗更新: 10%
    await jobRef.update({
      progress: 10,
      updatedAt: Timestamp.now(),
    });

    // 真相タイムラインを取得
    const timeline = scenario.data.truth;

    // 犯人名を取得
    const culprit = scenario.data.characters.find((c) => c.id === timeline.culpritId);
    const culpritName = culprit?.name || "犯人";

    // 進捗更新: 30%
    await jobRef.update({
      progress: 30,
      updatedAt: Timestamp.now(),
    });

    // Veoで動画生成（最大2回リトライ）
    logger.info("Generating video with Veo", { jobId, culpritName });

    const videoUrl = await withRetry(
      () => generateEndingVideo(timeline, culpritName, scenario!.meta.artStyle),
      2, // 最大2回リトライ
      5000, // 5秒間隔
      2
    );

    // 進捗更新: 90%
    await jobRef.update({
      progress: 90,
      updatedAt: Timestamp.now(),
    });

    // 完了
    await jobRef.update({
      status: "completed",
      progress: 100,
      videoUrl,
      updatedAt: Timestamp.now(),
    });

    logger.info("Video generation completed", { jobId, videoUrl });

    // ゲームにも動画URLを保存
    await adminDb.collection("games").doc(game.id).update({
      endingVideoUrl: videoUrl,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error("Video generation execution failed", error as Error, { jobId });

    await jobRef.update({
      status: "failed",
      error: String(error),
      updatedAt: Timestamp.now(),
    });

    throw error;
  }
}
