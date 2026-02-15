/**
 * Vertex AI Client (Singleton)
 * Google Cloud Vertex AIへの接続クライアント
 *
 * マルチリージョンフェイルオーバー対応:
 * - env.GOOGLE_CLOUD_LOCATION（デフォルト: "global"）から初期リージョンを取得
 * - 429/エンドポイント非対応時に次のリージョンへ自動切り替え
 * - リージョンごとにクライアントをキャッシュ
 */

import { VertexAI, GenerativeModel } from "@google-cloud/vertexai";
import { env } from "@/core/config/env";

/**
 * サポートするリージョン型
 */
type VertexLocation = "global" | "us-central1" | "us-east4" | "europe-west1" | "asia-northeast1";

/**
 * フェイルオーバー順序
 * us-central1 → us-east4 → europe-west1 → asia-northeast1 → global
 *
 * 注意: globalエンドポイントは一部モデル（gemini-2.5-flash等）で
 * HTMLエラーページを返すことがあるため、リージョナルを優先する
 */
const FAILOVER_REGIONS: VertexLocation[] = [
  "us-central1",     // 最優先: 安定性が高い
  "us-east4",        // フォールバック1
  "europe-west1",    // フォールバック2
  "asia-northeast1", // フォールバック3
  "global",          // フォールバック4: 一部モデルで非対応の可能性
];

/**
 * 現在のロケーション設定
 * env.GOOGLE_CLOUD_LOCATION から初期値を取得（デフォルト: "global"）
 */
let currentLocation: VertexLocation = (env.GOOGLE_CLOUD_LOCATION as VertexLocation) || "global";

/**
 * VertexAIクライアントのキャッシュ（リージョンごと）
 */
const vertexAICache = new Map<string, VertexAI>();

/**
 * Vertex AIクライアントを取得
 * 現在のリージョンに対応するキャッシュ済みクライアントを返す
 */
export function getVertexAI(): VertexAI {
  const location = currentLocation;
  if (!vertexAICache.has(location)) {
    vertexAICache.set(location, new VertexAI({
      project: env.GOOGLE_CLOUD_PROJECT,
      location,
    }));
    console.log(`[VertexAI] Initialized client for ${location}`);
  }
  return vertexAICache.get(location)!;
}

/**
 * 次のリージョンに切り替え
 * @returns 切り替え成功（まだ未試行のリージョンがある）かどうか
 */
function switchToNextRegion(): boolean {
  const currentIndex = FAILOVER_REGIONS.indexOf(currentLocation);
  const nextIndex = currentIndex + 1;
  if (nextIndex < FAILOVER_REGIONS.length) {
    currentLocation = FAILOVER_REGIONS[nextIndex];
    console.log(`[VertexAI] Switched to ${currentLocation}`);
    return true;
  }
  // 全リージョン試行済み → globalに戻す
  currentLocation = FAILOVER_REGIONS[0];
  return false;
}

/**
 * モデル名を環境変数から取得
 */
export const MODELS = {
  TEXT: env.VERTEX_MODEL_TEXT || "gemini-2.0-flash-exp",
  IMAGE: env.VERTEX_MODEL_IMAGE || "gemini-2.0-flash-exp-image",
  VIDEO: env.VERTEX_MODEL_VIDEO || "veo-001",
} as const;

/**
 * テキスト生成用モデルを取得
 */
export function getTextModel(modelId: string = MODELS.TEXT): GenerativeModel {
  const client = getVertexAI();
  return client.getGenerativeModel({ model: modelId });
}

/**
 * 画像生成用モデルを取得
 */
export function getImageModel(modelId: string = MODELS.IMAGE): GenerativeModel {
  const client = getVertexAI();
  return client.getGenerativeModel({ model: modelId });
}

/**
 * エラーがエンドポイント非対応エラーかどうか判定
 *
 * 検知パターン:
 * - 明示的な "not found" / "not supported" / "404" 等
 * - HTMLレスポンス返却（SyntaxError: Unexpected token <）
 *   → エンドポイントがモデル非対応時にHTMLエラーページを返すことがある
 */
function isEndpointNotSupportedError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // HTMLレスポンスが返された場合（エンドポイントがJSONではなくHTMLエラーページを返す）
    if (error.name === "SyntaxError" && message.includes("unexpected token")) {
      console.warn(`[VertexAI] HTML/non-JSON response detected (likely endpoint incompatibility): ${error.message}`);
      return true;
    }

    return (
      message.includes("not found") ||
      message.includes("not supported") ||
      message.includes("invalid location") ||
      message.includes("404") ||
      message.includes("does not exist")
    );
  }
  return false;
}

/**
 * マルチリージョンフェイルオーバー付きリトライロジック
 *
 * - エンドポイント非対応: 次リージョンへ即座に切り替え（attemptリセット）
 * - 429/ResourceExhausted: 次リージョンへ切り替え + 指数バックオフ
 * - その他エラー: 指数バックオフでリトライ
 *
 * @param operation - 実行する処理
 * @param operationName - ログ用の操作名
 * @param maxRetries - 最大リトライ回数（デフォルト: 3）
 * @returns 処理結果
 */
export async function executeWithRetry<R>(
  operation: () => Promise<R>,
  operationName: string = "operation",
  maxRetries: number = 3
): Promise<R> {
  let lastError: Error | null = null;
  const startLocation = currentLocation;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[VertexAI] Attempting ${operationName} (attempt ${attempt}/${maxRetries}, location: ${currentLocation})`);
      const result = await operation();
      console.log(`[VertexAI] ${operationName} succeeded`);
      return result;
    } catch (error) {
      lastError = error as Error;

      // エラー詳細をログ出力
      console.error(`[VertexAI] ${operationName} failed:`, {
        attempt,
        location: currentLocation,
        errorMessage: lastError.message,
        errorName: lastError.name,
        errorStack: lastError.stack?.substring(0, 500),
      });

      // エンドポイント非対応: 次リージョンへ即座に切り替え（attemptカウントリセット）
      if (isEndpointNotSupportedError(error)) {
        console.warn(`[VertexAI] Endpoint not supported for ${operationName} on ${currentLocation}`);
        if (switchToNextRegion()) {
          attempt = 0; // リトライカウントリセット
          continue;
        }
      }

      // 429/ResourceExhausted: 次リージョンへ切り替え + バックオフ
      if (isRateLimitError(error)) {
        console.warn(`[VertexAI] Rate limit on ${currentLocation} for ${operationName}`);
        switchToNextRegion(); // 切り替え可能なら切り替え
        if (attempt < maxRetries) {
          const backoffTime = calculateBackoff(attempt);
          console.log(`[VertexAI] Waiting ${backoffTime}ms before retry...`);
          await sleep(backoffTime);
          continue;
        }
      } else {
        // その他のエラーもリトライ可能に（一時的なエラーの場合に備える）
        if (attempt < maxRetries) {
          const backoffTime = calculateBackoff(attempt);
          console.log(`[VertexAI] Retrying after error, waiting ${backoffTime}ms...`);
          await sleep(backoffTime);
          continue;
        }
      }
    }
  }

  // 全リトライ失敗後、元のリージョンに戻す
  currentLocation = startLocation;
  throw new Error(
    `[VertexAI] ${operationName} failed after ${maxRetries} attempts across regions: ${lastError?.message}`
  );
}

/**
 * レート制限エラーかどうか判定
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("quota exceeded") ||
      message.includes("resource exhausted") ||
      message.includes("too many requests")
    );
  }

  // HTTP Response の場合
  if (typeof error === "object" && error !== null) {
    const statusCode = (error as { status?: number; statusCode?: number }).status ||
                       (error as { status?: number; statusCode?: number }).statusCode;
    return statusCode === 429;
  }

  return false;
}

/**
 * 指数バックオフの待機時間を計算
 */
function calculateBackoff(attempt: number): number {
  const baseDelay = 2000; // 2秒
  const maxDelay = 30000; // 30秒
  const jitter = Math.random() * 1000; // ジッター追加
  return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay) + jitter;
}

/**
 * スリープユーティリティ
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
