/**
 * Ending API Client
 * エンディング関連APIの呼び出しヘルパー
 */

import { apiGet, apiPost } from "./client";
import type { RelationshipNode, RelationshipEdge, EndingCard } from "@/features/ending/types";

/**
 * エピローグ生成を開始
 */
export async function startEpilogueGeneration(gameId: string): Promise<{ jobId: string }> {
  return apiPost<{ jobId: string }>("/api/ending/generate", { gameId });
}

/**
 * エピローグ生成ステータスを確認
 */
export async function getEpilogueStatus(jobId: string): Promise<{
  status: string;
  progress?: { percentage: number; message: string };
  result?: {
    epilogueText: string;
    mvpAgentId: string;
    mvpAgentName: string;
    mvpScore: number;
    mvpReasoning?: string;
    characterHighlights?: Array<{
      characterId: string;
      characterName: string;
      highlight: string;
      votedFor: string;
      performance: "excellent" | "good" | "notable";
    }>;
    scoreBreakdown: Record<string, {
      total: number;
      correctVote: number;
      contradictions: number;
      investigation: number;
      reasoning: number;
    }>;
  };
  error?: string;
}> {
  return apiGet(`/api/ending/status?jobId=${jobId}`);
}

/**
 * 関係性グラフデータを取得
 */
export async function getRelationships(gameId: string): Promise<{
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
}> {
  return apiGet(`/api/ending/relationships?gameId=${gameId}`);
}

/**
 * シークレットカードデータを取得
 */
export async function getSecrets(gameId: string): Promise<{
  cards: EndingCard[];
  totalCards: number;
  obtainedCount: number;
  revealedCount: number;
}> {
  return apiGet(`/api/ending/secrets?gameId=${gameId}`);
}

/**
 * 行動ログ + 真相タイムラインを取得
 */
export async function getActionLogs(gameId: string): Promise<{
  actionLogs: Array<{
    id: string;
    actorId: string;
    characterId: string;
    characterName: string;
    type: string;
    targetId?: string;
    location?: string;
    content?: string;
    phase: string;
    timestamp: number;
  }>;
  truthTimeline: Array<{
    time: string;
    event: string;
    isTrue: boolean;
    relatedCharacterName: string | null;
  }>;
  culpritName: string;
}> {
  return apiGet(`/api/ending/action-logs?gameId=${gameId}`);
}

/**
 * シナリオを公開
 */
export async function publishScenario(
  gameId: string,
  authorId: string,
  authorName: string
): Promise<{ success: boolean }> {
  return apiPost("/api/ending/publish", { gameId, authorId, authorName });
}

/**
 * エピローグ生成をポーリング
 */
export async function pollEpilogueGeneration(
  jobId: string,
  onProgress?: (percentage: number, message: string) => void,
  maxAttempts: number = 60,
  interval: number = 3000
): Promise<{
  epilogueText: string;
  mvpAgentId: string;
  mvpAgentName: string;
  mvpScore: number;
  mvpReasoning?: string;
  characterHighlights?: Array<{
    characterId: string;
    characterName: string;
    highlight: string;
    votedFor: string;
    performance: "excellent" | "good" | "notable";
  }>;
  scoreBreakdown: Record<string, {
    total: number;
    correctVote: number;
    contradictions: number;
    investigation: number;
    reasoning: number;
  }>;
}> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getEpilogueStatus(jobId);

    if (result.progress && onProgress) {
      onProgress(result.progress.percentage, result.progress.message);
    }

    if (result.status === "completed" && result.result) {
      return result.result;
    }

    if (result.status === "failed") {
      throw new Error(result.error || "エピローグの生成に失敗しました");
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error("エピローグの生成がタイムアウトしました");
}
