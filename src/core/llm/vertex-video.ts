/**
 * Vertex AI Video Generation (Veo 2)
 * エンディング動画生成
 *
 * Veoはグローバルエンドポイントに対応していないため、
 * us-central1リージョンを直接使用
 */

import { getServerEnv } from "../config/env";
import { createModuleLogger } from "../utils/logger";
import { AIGenerationError } from "../utils/errors";
import { isRateLimitError } from "./vertex-client";

/**
 * Veo対応リージョン（限定的）
 */
const VEO_REGION = "us-central1";

/**
 * エンディング動画生成用のタイムライン型
 * Scenario.data.truthと同じ構造
 */
interface VideoTimelineData {
  culpritId: string;
  trickExplanation: string;
  masterTimeline: {
    time: string;
    event: string;
    isTrue: boolean;
    relatedCharacterId?: string | null;
    eventType?: string;
    description?: string;
    actor?: string;
  }[];
}

const logger = createModuleLogger("VertexVideo");

/**
 * エンディング動画を生成（Text-to-Video）
 *
 * @param timeline - マスタータイムライン
 * @param culpritName - 犯人の名前
 * @param artStyle - 画風（optional）
 * @returns 生成された動画URL（GCS URL）
 */
export async function generateEndingVideo(
  timeline: VideoTimelineData,
  culpritName: string,
  artStyle: string = "cinematic anime style"
): Promise<string> {
  const env = getServerEnv();

  const prompt = buildEndingVideoPrompt(timeline, culpritName, artStyle);

  logger.info("Generating ending video with Veo", {
    culprit: culpritName,
    artStyle,
    eventsCount: timeline.masterTimeline.length,
  });

  logger.debug("Video prompt", { prompt: prompt.substring(0, 200) + "..." });

  try {
    // Veo 2を使った動画生成
    const videoUrl = await generateVideoWithRetry(prompt, env.VERTEX_MODEL_VIDEO);

    logger.info("Video generated successfully", { videoUrl });

    return videoUrl;
  } catch (error) {
    logger.error("Video generation failed", error as Error);

    throw new AIGenerationError(
      `Failed to generate ending video: ${error}`,
      env.VERTEX_MODEL_VIDEO,
      prompt
    );
  }
}

/**
 * Veo REST API経由で動画生成を開始（LRO）
 *
 * @param prompt 動画生成プロンプト
 * @param modelName モデル名
 * @returns Operation Name（ポーリング用）
 */
async function startVideoGenerationLRO(
  prompt: string,
  modelName: string
): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");
  const env = getServerEnv();

  const auth = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  // Veoはus-central1のみ対応
  const endpoint = `https://${VEO_REGION}-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_CLOUD_PROJECT}/locations/${VEO_REGION}/publishers/google/models/${modelName}:predictLongRunning`;

  logger.info("Starting Veo video generation (LRO)", { model: modelName, region: VEO_REGION, endpoint });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        videoLength: "6s",
        aspectRatio: "16:9",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const statusCode = response.status;

    // レート制限エラーの場合は特別なエラーを投げる
    if (statusCode === 429 || errorText.toLowerCase().includes("rate limit") || errorText.toLowerCase().includes("quota")) {
      const error = new Error(`Rate limit exceeded: ${statusCode} ${errorText}`);
      (error as any).status = statusCode;
      throw error;
    }

    logger.error("Veo LRO start failed", new Error(errorText));
    throw new AIGenerationError(`Veo LRO start failed: ${statusCode} ${errorText}`);
  }

  const data = await response.json();
  logger.info("Veo LRO started", { operationName: data.name, region: VEO_REGION });

  return data.name; // Operation ID
}

/**
 * LROのステータスをポーリング
 */
async function pollVideoOperationLRO(operationName: string): Promise<string> {
  const { GoogleAuth } = await import("google-auth-library");

  const auth = new GoogleAuth({
    scopes: "https://www.googleapis.com/auth/cloud-platform",
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();

  const endpoint = `https://${VEO_REGION}-aiplatform.googleapis.com/v1/${operationName}`;

  logger.debug("Polling Veo LRO", { operationName });

  const maxAttempts = 60; // 5分間
  const basePollInterval = 5000; // 5秒
  let consecutiveFailures = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token.token}` },
    });

    if (!response.ok) {
      consecutiveFailures++;
      const backoff = Math.min(basePollInterval * Math.pow(1.5, consecutiveFailures), 30000);
      logger.warn("Veo LRO poll failed", { status: response.status, backoff, consecutiveFailures });
      await new Promise((resolve) => setTimeout(resolve, backoff));
      continue;
    }

    consecutiveFailures = 0; // 成功時リセット

    const data = await response.json();

    if (data.done) {
      if (data.error) {
        logger.error("Veo generation failed", new Error(data.error.message));
        throw new AIGenerationError(`Veo generation failed: ${data.error.message}`);
      }

      // 生成完了 - 動画URLを抽出
      const videos = data.response?.videos || data.response?.predictions;
      if (videos && videos.length > 0) {
        const videoData = videos[0];

        // GCS URIまたはBase64データ
        if (videoData.gcsUri) {
          logger.info("Veo video generated (GCS)", { uri: videoData.gcsUri });
          return videoData.gcsUri;
        }

        if (videoData.bytesBase64Encoded) {
          logger.info("Veo video generated (Base64), uploading to storage");
          return await uploadVideoToStorage(videoData.bytesBase64Encoded, "video/mp4");
        }
      }

      throw new AIGenerationError("No video data in Veo response");
    }

    logger.debug("Veo generation in progress", { attempt: attempt + 1, maxAttempts });
    await new Promise((resolve) => setTimeout(resolve, basePollInterval));
  }

  throw new AIGenerationError("Veo generation timed out");
}

/**
 * リトライロジック付きで動画生成を実行
 */
async function generateVideoWithRetry(
  prompt: string,
  modelName: string,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Attempting video generation (attempt ${attempt}/${maxRetries})`);

      // LROで動画生成を開始
      const operationName = await startVideoGenerationLRO(prompt, modelName);

      // ポーリングで完了を待機
      const videoUrl = await pollVideoOperationLRO(operationName);

      return videoUrl;
    } catch (error) {
      lastError = error as Error;

      if (isRateLimitError(error)) {
        logger.warn("Rate limit hit for video generation", { attempt, error });

        if (attempt < maxRetries) {
          // 指数バックオフで待機
          const backoffTime = calculateBackoff(attempt);
          logger.info(`Waiting ${backoffTime}ms before retry...`);
          await sleep(backoffTime);
          continue;
        }
      } else {
        // レート制限以外のエラーは即座に投げる
        throw error;
      }
    }
  }

  throw new Error(`Video generation failed after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * 指数バックオフの待機時間を計算
 */
function calculateBackoff(attempt: number): number {
  const baseDelay = 5000; // 5秒
  const maxDelay = 60000; // 60秒
  const jitter = Math.random() * 2000;
  return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay) + jitter;
}

/**
 * スリープユーティリティ
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 動画データをCloud Storageにアップロード
 */
async function uploadVideoToStorage(base64Data: string, mimeType: string): Promise<string> {
  const { uploadBase64ToStorage } = await import("../storage/cloud-storage");

  const fileName = `ending-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;

  logger.info("Uploading video to Cloud Storage", { fileName });

  try {
    const publicUrl = await uploadBase64ToStorage(
      base64Data,
      fileName,
      mimeType || "video/mp4"
    );

    return publicUrl;
  } catch (error) {
    logger.error("Failed to upload video to storage", error as Error);

    throw new AIGenerationError("Failed to upload video to storage");
  }
}

/**
 * エンディング動画プロンプトを構築
 *
 * @param timeline - マスタータイムライン
 * @param culpritName - 犯人の名前
 * @param artStyle - 画風
 * @returns プロンプト文字列
 */
function buildEndingVideoPrompt(
  timeline: VideoTimelineData,
  culpritName: string,
  artStyle: string
): string {
  // タイムラインから重要イベントを抽出
  const murderEvent = timeline.masterTimeline.find((e) => e.eventType === "murder");
  const criticalEvents = timeline.masterTimeline
    .filter(
      (e) =>
        e.eventType === "critical_action" ||
        e.eventType === "clue_placement" ||
        e.actor === culpritName
    )
    .slice(0, 8);

  const prompt = `
Create a dramatic 30-second reveal video in ${artStyle}.

STORY SUMMARY:
Crime: ${murderEvent?.description || "A mysterious murder occurred"}
Culprit: ${culpritName}
Method: ${timeline.trickExplanation}

KEY EVENTS (chronological):
${criticalEvents.map((e, i) => `${i + 1}. ${e.time} - ${e.description}`).join("\n")}

VISUAL REQUIREMENTS:
- Dark, mysterious atmosphere (library/mansion setting)
- Dramatic camera movements (slow zoom, pan)
- Emphasis on the culprit's actions
- Evidence highlighted (glowing or focused shots)
- Final reveal: culprit's face with guilt expression

PACING:
0-10s: Set the scene (location, atmosphere)
10-20s: Show critical events (quick cuts)
20-25s: Reveal the culprit and method
25-30s: Closing shot (justice served, fade to black)

MOOD: Suspenseful, dramatic, satisfying resolution

NO TEXT ON SCREEN. Pure visual storytelling.
`;

  return prompt.trim();
}


/**
 * 非同期動画生成を開始（Operation IDを返す）
 * フロントエンドからのポーリング用
 */
export async function startVideoGenerationAsync(prompt: string): Promise<string> {
  const env = getServerEnv();
  return await startVideoGenerationLRO(prompt, env.VERTEX_MODEL_VIDEO);
}
