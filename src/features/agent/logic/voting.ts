/**
 * AI Agent Voting Logic
 * AIエージェントの投票ロジック
 */

import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { generateJSON } from "@/core/llm/vertex-text";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import { withRetry } from "@/core/utils/async";
import type { GameState, AgentBrain, Scenario } from "@/core/types";
import type { AgentPerception, AgentThought } from "../types";
import { perceiveGameState } from "./thinking";
import { buildSystemInstruction } from "../prompts/thinking";
import { getCharacterPersona } from "../prompts/persona";

/**
 * 投票決定のZodスキーマ
 */
const VotingDecisionSchema = z.object({
  targetCharacterId: z.string(),
  targetCharacterName: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
  suspicionRanking: z.array(z.object({
    characterId: z.string(),
    characterName: z.string(),
    suspicionLevel: z.number(),
    reason: z.string(),
  })),
});

const logger = createModuleLogger("AgentVoting");

/**
 * 投票決定のための思考結果
 */
interface VotingDecision {
  targetCharacterId: string;
  targetCharacterName: string;
  confidence: number;
  reasoning: string;
  suspicionRanking: Array<{
    characterId: string;
    characterName: string;
    suspicionLevel: number;
    reason: string;
  }>;
}

/**
 * AIエージェントの投票を実行
 *
 * @param agentId - エージェントID
 * @param gameId - ゲームID
 * @returns 投票結果
 */
export async function executeAgentVoting(
  agentId: string,
  gameId: string
): Promise<VotingDecision> {
  logger.info("Agent voting started", { agentId, gameId });

  try {
    // 1. ゲーム状態を知覚
    const perception = await perceiveGameState(agentId, gameId);

    // 2. シナリオ情報を取得（キャラクター一覧）
    const gameDoc = await adminDb.collection("games").doc(gameId).get();
    const gameData = gameDoc.data() as GameState;
    const scenarioDoc = await adminDb
      .collection("scenarios")
      .doc(gameData.scenarioId)
      .get();

    if (!scenarioDoc.exists) {
      throw new Error("Scenario not found");
    }

    const scenario = scenarioDoc.data() as Scenario;
    const characters = scenario.data.characters;

    // 自分以外のキャラクター（投票可能な対象）
    const votableCharacters = characters.filter(
      (c) => c.id !== perception.myCharacterId
    );

    // 3. エージェントの脳内情報を取得
    const brainDoc = await adminDb
      .collection("games")
      .doc(gameId)
      .collection("agentBrains")
      .doc(agentId)
      .get();

    const agentBrain = brainDoc.data() as AgentBrain;

    // 4. 投票先を決定（Geminiで推論）
    const decision = await generateVotingDecision(
      agentId,
      perception,
      agentBrain,
      votableCharacters
    );

    // 5. Firestoreに投票を保存
    await saveVote(gameId, agentId, decision.targetCharacterId);

    logger.info("Agent voting completed", {
      agentId,
      target: decision.targetCharacterId,
      confidence: decision.confidence,
    });

    return decision;
  } catch (error) {
    logger.error("Agent voting failed", error as Error, { agentId, gameId });
    throw error;
  }
}

/**
 * Geminiで投票先を決定
 */
async function generateVotingDecision(
  agentId: string,
  perception: AgentPerception,
  agentBrain: AgentBrain,
  votableCharacters: Array<{ id: string; name: string; job: string }>
): Promise<VotingDecision> {
  // ゲームからシナリオIDを取得
  const gameDoc = await adminDb.collection("games").doc(perception.gameId).get();
  const gameData = gameDoc.data() as GameState;
  const scenarioId = gameData.scenarioId;

  // キャラクターの人格定義を取得
  const persona = await getCharacterPersona(perception.myCharacterId, scenarioId);
  const systemInstruction = buildSystemInstruction(persona);

  // 関係性情報を整理
  const relationshipSummary = Object.entries(agentBrain.relationships || {})
    .map(([targetId, rel]) => {
      const char = votableCharacters.find((c) => c.id === targetId);
      return `- ${char?.name || targetId}: 信頼度 ${rel.trust}, 疑惑度 ${rel.suspicion}${rel.note ? ` (${rel.note})` : ""}`;
    })
    .join("\n");

  // 知識ベースの情報
  const knownFacts = agentBrain.knowledgeBase?.knownFacts?.join("\n- ") || "なし";

  // 最近の会話を整理
  const recentConversation = perception.recentMessages
    .slice(-10)
    .map((m) => `${m.speakerName}: ${m.content}`)
    .join("\n");

  const prompt = `
あなたは犯人を当てる推理ゲームのプレイヤーです。
投票フェーズです。誰が犯人か、推理して投票してください。

## 投票可能なキャラクター
${votableCharacters.map((c) => `- ${c.id}: ${c.name}（${c.job}）`).join("\n")}

## あなたの関係性情報
${relationshipSummary || "まだ十分な情報がありません"}

## あなたが知っている事実
- ${knownFacts}

## 最近の会話
${recentConversation || "会話履歴がありません"}

## あなたの現在の感情状態
${perception.emotionalState}

上記の情報を総合的に判断し、犯人だと思うキャラクターに投票してください。

以下のJSON形式で回答してください：
{
  "targetCharacterId": "投票するキャラクターのID",
  "targetCharacterName": "投票するキャラクターの名前",
  "confidence": 0から100の確信度,
  "reasoning": "投票理由を1〜2文で",
  "suspicionRanking": [
    {
      "characterId": "キャラクターID",
      "characterName": "キャラクター名",
      "suspicionLevel": 0から100の疑惑度,
      "reason": "疑惑の理由"
    }
  ]
}
`;

  try {
    const decision = await generateJSON<VotingDecision>(prompt, {
      systemInstruction,
      temperature: 0.6, // 投票は少し慎重に
      maxTokens: 8192,
      schema: VotingDecisionSchema,
    });

    // バリデーション
    if (
      !decision.targetCharacterId ||
      !votableCharacters.some((c) => c.id === decision.targetCharacterId)
    ) {
      logger.warn("Invalid voting decision, using fallback", { agentId });
      return createFallbackDecision(votableCharacters, agentBrain);
    }

    return decision;
  } catch (error) {
    logger.error("Failed to generate voting decision", error as Error, {
      agentId,
    });
    return createFallbackDecision(votableCharacters, agentBrain);
  }
}

/**
 * フォールバック投票決定
 * JSON生成に失敗した場合は、疑惑度が最も高いキャラクターに投票
 */
function createFallbackDecision(
  votableCharacters: Array<{ id: string; name: string; job: string }>,
  agentBrain: AgentBrain
): VotingDecision {
  // 疑惑度が最も高いキャラクターを選択
  let maxSuspicion = -1;
  let targetChar = votableCharacters[0];

  for (const char of votableCharacters) {
    const rel = agentBrain.relationships?.[char.id];
    const suspicion = rel?.suspicion || 0;
    if (suspicion > maxSuspicion) {
      maxSuspicion = suspicion;
      targetChar = char;
    }
  }

  // もし疑惑度が全員0なら、ランダムに選択
  if (maxSuspicion <= 0) {
    targetChar =
      votableCharacters[Math.floor(Math.random() * votableCharacters.length)];
  }

  return {
    targetCharacterId: targetChar.id,
    targetCharacterName: targetChar.name,
    confidence: 30,
    reasoning: "情報が不足しているため、直感で投票しました。",
    suspicionRanking: votableCharacters.map((c) => ({
      characterId: c.id,
      characterName: c.name,
      suspicionLevel: agentBrain.relationships?.[c.id]?.suspicion || 0,
      reason: "詳細不明",
    })),
  };
}

/**
 * Firestoreに投票を保存
 */
async function saveVote(
  gameId: string,
  agentId: string,
  targetCharacterId: string
): Promise<void> {
  // エージェントIDからプレイヤーIDを抽出（"agent_xxx" → "xxx"）
  const playerId = agentId.replace("agent_", "");

  await adminDb
    .collection("games")
    .doc(gameId)
    .update({
      [`votes.${playerId}`]: targetCharacterId,
      updatedAt: Timestamp.now(),
    });

  logger.debug("Vote saved", { gameId, agentId, playerId, targetCharacterId });
}

/**
 * 全AIエージェントの投票を実行
 *
 * @param gameId - ゲームID
 */
export async function executeAllAgentVoting(gameId: string): Promise<void> {
  logger.info("Executing all agent voting", { gameId });

  // ゲームの全AIプレイヤーを取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    throw new Error("Game not found");
  }

  const game = gameDoc.data() as GameState;
  const aiPlayers = Object.entries(game.players).filter(([_, p]) => !p.isHuman);

  logger.info("Found AI players for voting", { count: aiPlayers.length });

  // 各AIエージェントの投票を並列実行
  const votingPromises = aiPlayers.map(async ([playerId, player]) => {
    if (!player.characterId) {
      return; // キャラクター未選択
    }

    const agentId = `agent_${playerId}`;

    try {
      await withRetry(
        () => executeAgentVoting(agentId, gameId),
        3, // 最大3回リトライ
        2000, // 2秒間隔
        2 // 指数バックオフ
      );
    } catch (error) {
      logger.error("Agent voting failed after retries", error as Error, { agentId });
    }
  });

  await Promise.allSettled(votingPromises);

  logger.info("All agent voting completed", { gameId });
}
