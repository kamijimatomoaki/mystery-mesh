/**
 * Game API Client
 * ゲーム関連APIの呼び出しヘルパー
 */

import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("GameAPI");

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * API呼び出しの基本ヘルパー
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  logger.debug("API call", { url, method: options.method || "GET" });

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: response.statusText,
    }));

    logger.error("API call failed", new Error(error.error), {
      url,
      status: response.status,
    });

    throw new Error(error.error || `API call failed: ${response.status}`);
  }

  const data = await response.json();

  logger.debug("API call success", { url, data });

  return data;
}

/**
 * ゲーム作成
 */
export interface CreateGameRequest {
  scenarioId: string;
  hostId: string;
  hostName: string;
  isPrivate?: boolean;
  maxPlayers?: number;
}

export interface CreateGameResponse {
  success: boolean;
  gameId: string;
  game: {
    id: string;
    scenarioId: string;
    scenarioTitle: string;
    status: string;
    currentPhase: string;
    playerCount: number;
    maxPlayers: number;
  };
}

export async function createGame(
  request: CreateGameRequest
): Promise<CreateGameResponse> {
  logger.info("Creating game", { scenarioId: request.scenarioId });

  return apiCall<CreateGameResponse>("/api/game/create", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * ゲーム参加
 */
export interface JoinGameRequest {
  gameId: string;
  playerId: string;
  playerName: string;
}

export interface JoinGameResponse {
  success: boolean;
  message: string;
  game: {
    id: string;
    playerCount: number;
    maxPlayers: number;
  };
}

export async function joinGame(
  request: JoinGameRequest
): Promise<JoinGameResponse> {
  logger.info("Joining game", { gameId: request.gameId });

  return apiCall<JoinGameResponse>("/api/game/join", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * フェーズ進行
 */
export interface AdvancePhaseRequest {
  gameId: string;
  requestedBy: string;
}

export interface AdvancePhaseResponse {
  success: boolean;
  message: string;
  newPhase?: string;
}

export async function advancePhase(
  request: AdvancePhaseRequest
): Promise<AdvancePhaseResponse> {
  logger.info("Advancing phase", { gameId: request.gameId });

  return apiCall<AdvancePhaseResponse>("/api/game/phase/advance", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * AI発言トリガー
 */
export interface TriggerSpeakRequest {
  gameId: string;
  threshold?: number;
}

export interface TriggerSpeakResponse {
  success: boolean;
  message: string;
  nextSpeaker: string | null;
  allScores: Array<{
    agentId: string;
    totalScore: number;
    shouldSpeak: boolean;
  }>;
}

export async function triggerAISpeak(
  request: TriggerSpeakRequest
): Promise<TriggerSpeakResponse> {
  logger.info("Triggering AI speak", { gameId: request.gameId });

  return apiCall<TriggerSpeakResponse>("/api/game/trigger-speak", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * エンディング動画生成
 */
export interface GenerateVideoRequest {
  gameId: string;
}

export interface GenerateVideoResponse {
  success: boolean;
  jobId: string;
  message: string;
}

export async function generateEndingVideo(
  request: GenerateVideoRequest
): Promise<GenerateVideoResponse> {
  logger.info("Generating ending video", { gameId: request.gameId });

  return apiCall<GenerateVideoResponse>("/api/ending/generate-video", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * 動画生成ステータス確認
 */
export interface VideoStatusResponse {
  jobId: string;
  status: "processing" | "completed" | "failed";
  progress: number;
  videoUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export async function getVideoStatus(
  jobId: string
): Promise<VideoStatusResponse> {
  logger.debug("Checking video status", { jobId });

  return apiCall<VideoStatusResponse>(`/api/ending/video-status?jobId=${jobId}`, {
    method: "GET",
  });
}

/**
 * 動画生成をポーリング
 * ステータスが completed になるまで定期的に確認
 */
export async function pollVideoGeneration(
  jobId: string,
  onProgress?: (progress: number) => void,
  intervalMs: number = 5000,
  maxAttempts: number = 60
): Promise<string> {
  logger.info("Polling video generation", { jobId, intervalMs, maxAttempts });

  let consecutiveFailures = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const status = await getVideoStatus(jobId);
      consecutiveFailures = 0; // リセット

      logger.debug(`Polling attempt ${attempt}/${maxAttempts}`, {
        status: status.status,
        progress: status.progress,
      });

      // 進捗コールバック
      if (onProgress) {
        onProgress(status.progress);
      }

      // 完了
      if (status.status === "completed") {
        if (!status.videoUrl) {
          throw new Error("Video completed but no URL provided");
        }

        logger.info("Video generation completed", { videoUrl: status.videoUrl });
        return status.videoUrl;
      }

      // 失敗
      if (status.status === "failed") {
        logger.error("Video generation failed", new Error(status.error || "Unknown error"));
        throw new Error(status.error || "動画生成に失敗しました。もう一度お試しください。");
      }
    } catch (error) {
      // ネットワークエラー等の場合はバックオフして再試行
      if ((error as Error).message?.includes("動画生成に失敗")) {
        throw error; // 明示的な失敗は再スロー
      }
      consecutiveFailures++;
      logger.warn("Polling request failed, will retry with backoff", {
        attempt,
        consecutiveFailures,
      });
    }

    // 待機（失敗時はバックオフ）
    if (attempt < maxAttempts) {
      const backoff = consecutiveFailures > 0
        ? Math.min(intervalMs * Math.pow(1.5, consecutiveFailures), 30000)
        : intervalMs;
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw new Error("動画生成がタイムアウトしました。しばらくしてからもう一度お試しください。");
}
