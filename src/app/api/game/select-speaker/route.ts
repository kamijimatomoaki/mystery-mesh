/**
 * POST /api/game/select-speaker
 * Geminiによる発言者ランキングAPI
 *
 * 入力:
 * - gameId: ゲームID
 *
 * 出力:
 * - ranking: agentIdと理由の配列（発言優先度順）
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { adminDb } from "@/core/db/firestore-admin";
import { generateJSON } from "@/core/llm/vertex-text";
import type { GameState, ChatMessage, AgentBrain } from "@/core/types";

/**
 * 発言者ランキングレスポンスのZodスキーマ
 */
const SpeakerRankingResponseSchema = z.object({
  ranking: z.array(z.object({
    characterId: z.string(),
    characterName: z.string(),
    priority: z.number(),
    reason: z.string(),
    wantsToSpeak: z.boolean(),
  })),
});

const logger = createModuleLogger("SelectSpeaker");

/**
 * リクエストスキーマ
 */
const SelectSpeakerRequestSchema = z.object({
  gameId: z.string().min(1),
});

/**
 * ランキングエントリ
 */
interface SpeakerRankingEntry {
  agentId: string;
  characterId: string;
  characterName: string;
  priority: number;
  reason: string;
  wantsToSpeak: boolean;
}

/**
 * 発言者選定コンテキスト
 */
interface SpeakerSelectionContext {
  recentMessages: {
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
  }[];
  agentStates: {
    agentId: string;
    characterId: string;
    characterName: string;
    lastSpokeAt: number | null;
    knownFactsCount: number;
    wantedToSpeak: boolean;
  }[];
  previousRanking: SpeakerRankingEntry[] | null;
  currentPhase: string;
}

/**
 * 発言者選定コンテキストを収集
 */
async function gatherSpeakerSelectionContext(
  gameId: string
): Promise<SpeakerSelectionContext> {
  // 並列でデータ取得
  const [gameDoc, messagesSnapshot, previousRankingDoc] = await Promise.all([
    adminDb.collection("games").doc(gameId).get(),
    adminDb
      .collection("games")
      .doc(gameId)
      .collection("messages")
      .orderBy("timestamp", "desc")
      .limit(10)
      .get(),
    adminDb
      .collection("games")
      .doc(gameId)
      .collection("speakerRankings")
      .orderBy("timestamp", "desc")
      .limit(1)
      .get(),
  ]);

  if (!gameDoc.exists) {
    throw new Error("Game not found");
  }

  const game = gameDoc.data() as GameState;

  // メッセージを整形
  const recentMessages = messagesSnapshot.docs.map((doc) => {
    const data = doc.data() as ChatMessage;
    return {
      senderId: data.senderId,
      senderName: data.senderName,
      content: data.content,
      timestamp: data.timestamp?.toMillis?.() || data.timestamp?.seconds * 1000 || 0,
    };
  });

  // 各AIエージェントの状態を構築
  const aiPlayerEntries = Object.entries(game.players).filter(
    ([_, player]) => !player.isHuman && player.characterId
  );

  const agentStates = await Promise.all(
    aiPlayerEntries.map(async ([playerId, player]) => {
      const agentId = `agent_${playerId}`;
      const characterId = player.characterId!;

      // エージェントブレインを取得（キーはagentId = `agent_${playerId}`）
      const brainDoc = await adminDb
        .collection("games")
        .doc(gameId)
        .collection("agentBrains")
        .doc(agentId)
        .get();

      const brain = brainDoc.exists ? (brainDoc.data() as AgentBrain) : null;

      // 最後の発言時刻を取得
      const lastSpoke = recentMessages.find(
        (msg) => msg.senderId === agentId || msg.senderId === characterId
      );

      return {
        agentId,
        characterId,
        characterName:
          brain?.characterName ||
          player.displayName?.replace(/^AIエージェント: /, "") ||
          characterId,
        lastSpokeAt: lastSpoke?.timestamp || null,
        knownFactsCount: brain?.knowledgeBase?.knownFacts?.length || 0,
        wantedToSpeak: brain?.wantedToSpeak || false,
      };
    })
  );

  // 前回のランキングを取得
  const previousRanking = previousRankingDoc.empty
    ? null
    : (previousRankingDoc.docs[0].data().ranking as SpeakerRankingEntry[]);

  return {
    recentMessages,
    agentStates,
    previousRanking,
    currentPhase: game.phase,
  };
}

/**
 * ランキングプロンプトを構築
 */
function buildSpeakerRankingPrompt(context: SpeakerSelectionContext): string {
  const now = Date.now();

  // 経過時間をフォーマット
  const formatTimeSince = (timestamp: number | null): string => {
    if (!timestamp) return "まだ発言なし";
    const elapsed = Math.floor((now - timestamp) / 1000);
    if (elapsed < 60) return `${elapsed}秒前`;
    return `${Math.floor(elapsed / 60)}分前`;
  };

  // 会話履歴
  const messagesText = context.recentMessages
    .map((m) => `[${m.senderName}]: ${m.content.substring(0, 200)}${m.content.length > 200 ? "..." : ""}`)
    .join("\n");

  // AIキャラクター状態
  const agentStatesText = context.agentStates
    .map(
      (a) => `
### ${a.characterName} (${a.characterId})
- 最終発言: ${formatTimeSince(a.lastSpokeAt)}
- 知っている情報数: ${a.knownFactsCount}
- 前回発言希望: ${a.wantedToSpeak ? "はい" : "いいえ"}`
    )
    .join("\n");

  // 前回ランキング
  const previousRankingText = context.previousRanking
    ? context.previousRanking
        .map((r, i) => `${i + 1}. ${r.characterName}`)
        .join("\n")
    : "なし（初回）";

  return `あなたはマーダーミステリーゲームの進行役（GM）です。
AIキャラクターの中から、次に発言すべき人物のランキングを作成してください。

## 現在のフェーズ
${context.currentPhase}

## 直近の会話（新しい順）
${messagesText || "まだ会話がありません"}

## AIキャラクターの状態
${agentStatesText}

## 前回のランキング
${previousRankingText}

## 判断基準（優先度順）
1. **呼びかけ**: 直近の会話で名指しされた、または質問された
2. **関連情報**: 話題に関連する情報を持っている
3. **発言間隔**: しばらく発言していない（会話のバランス）
4. **発言希望**: 前回発言したがっていたが機会がなかった
5. **連続回避**: 前回1位だったキャラは順位を下げる

## 出力形式
全AIキャラクターを発言優先度順にランキングし、各キャラクターの選定理由を記載してください。
JSON形式で以下の構造で出力:
{
  "ranking": [
    {
      "characterId": "キャラクターID",
      "characterName": "キャラクター名",
      "priority": 1,
      "reason": "選定理由（30文字以内）",
      "wantsToSpeak": true/false
    }
  ]
}`;
}

/**
 * ランキング結果をFirestoreに保存
 */
async function saveSpeakerRanking(
  gameId: string,
  ranking: SpeakerRankingEntry[]
): Promise<void> {
  const rankingId = `ranking_${Date.now()}`;

  await adminDb
    .collection("games")
    .doc(gameId)
    .collection("speakerRankings")
    .doc(rankingId)
    .set({
      id: rankingId,
      ranking,
      timestamp: Date.now(),
    });

  logger.debug("Speaker ranking saved", { gameId, rankingId });
}

/**
 * Geminiでランキングを生成
 */
async function generateSpeakerRanking(
  context: SpeakerSelectionContext
): Promise<SpeakerRankingEntry[]> {
  const prompt = buildSpeakerRankingPrompt(context);

  try {
    const result = await generateJSON<{ ranking: Array<{ characterId: string; characterName: string; priority: number; reason: string; wantsToSpeak: boolean }> }>(
      prompt,
      {
        temperature: 0.7,
        maxTokens: 16384,
        schema: SpeakerRankingResponseSchema,
      }
    );

    // characterIdからagentIdへのマッピングを作成
    const characterToAgent = new Map(
      context.agentStates.map((a) => [a.characterId, a.agentId])
    );

    // agentIdを正しく設定
    const ranking: SpeakerRankingEntry[] = result.ranking.map((entry) => ({
      ...entry,
      agentId: characterToAgent.get(entry.characterId) || entry.characterId,
    }));

    return ranking;
  } catch (error) {
    logger.error("Failed to generate speaker ranking", error as Error);

    // フォールバック: 最終発言時刻でソート
    return context.agentStates
      .sort((a, b) => {
        // 発言していないエージェントを優先
        if (!a.lastSpokeAt && b.lastSpokeAt) return -1;
        if (a.lastSpokeAt && !b.lastSpokeAt) return 1;
        if (!a.lastSpokeAt && !b.lastSpokeAt) return 0;
        // 古い方を優先
        return (a.lastSpokeAt || 0) - (b.lastSpokeAt || 0);
      })
      .map((a, index) => ({
        agentId: a.agentId,
        characterId: a.characterId,
        characterName: a.characterName,
        priority: index + 1,
        reason: "発言間隔によるフォールバック",
        wantsToSpeak: a.wantedToSpeak,
      }));
  }
}

/**
 * 発言者ランキングAPI
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = validateRequest(body, SelectSpeakerRequestSchema);

  logger.info("Select speaker requested", { gameId: validated.gameId });

  // 1. コンテキストを収集
  const context = await gatherSpeakerSelectionContext(validated.gameId);

  if (context.agentStates.length === 0) {
    logger.info("No AI agents in game", { gameId: validated.gameId });
    return NextResponse.json({
      success: true,
      ranking: [],
      message: "No AI agents available",
    });
  }

  // 2. Geminiでランキング生成
  const ranking = await generateSpeakerRanking(context);

  // 3. ランキング結果をFirestoreに保存
  await saveSpeakerRanking(validated.gameId, ranking);

  logger.info("Speaker ranking generated", {
    gameId: validated.gameId,
    topSpeaker: ranking[0]?.characterName,
    totalAgents: ranking.length,
  });

  return NextResponse.json({
    success: true,
    ranking,
  });
}, "SelectSpeaker");
