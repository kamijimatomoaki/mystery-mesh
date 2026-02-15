/**
 * Agent Thinking Loop
 * Perceive → Memory Update → Think → Act のサイクル
 */

import { adminDb } from "@/core/db/firestore-admin";
import { generateJSON } from "@/core/llm/vertex-text";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { Timestamp as ClientTimestamp } from "firebase/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import type {
  AgentPerception,
  AgentThought,
  AgentAction,
  ThinkingTrigger,
  ThoughtLog,
} from "../types";
import type { GameState, AgentBrain, Scenario } from "@/core/types";
import type { DiscussionSummary } from "@/features/summarizer/types";
import { buildThinkingPrompt, buildSystemInstruction, buildExplorationThinkingPrompt } from "../prompts/thinking";
import { getCharacterPersona } from "../prompts/persona";
import { updateAgentMemory } from "./memory";

/**
 * エージェント思考出力のZodスキーマ
 */
const AgentThoughtSchema = z.object({
  situationAnalysis: z.string(),
  contradictions: z.array(z.string()),
  suspicionRanking: z.array(z.object({
    characterId: z.string(),
    characterName: z.string(),
    suspicionLevel: z.number(),
    reason: z.string(),
  })),
  nextActionPlan: z.string(),
  emotion: z.enum(["calm", "angry", "nervous", "sad", "confident"]),
  plannedStatement: z.string(),
  confidence: z.number(),
  internalThoughts: z.string().optional(),
  shouldRevealCard: z.object({
    cardId: z.string(),
    reason: z.string(),
  }).optional(),
  memoryUpdate: z.string().optional(), // 今回の会話で新たに分かったこと・気づいたこと（100文字以内）
});

/**
 * カード選択出力のZodスキーマ
 */
const CardSelectionSchema = z.object({
  selectedIndex: z.number(),
  reason: z.string(),
});

const logger = createModuleLogger("AgentThinking");

/**
 * エージェントの思考サイクルを実行
 *
 * @param agentId - エージェントID
 * @param gameId - ゲームID
 * @param trigger - トリガー
 * @returns 決定された行動
 */
export async function executeThinkingCycle(
  agentId: string,
  gameId: string,
  trigger: ThinkingTrigger
): Promise<AgentAction> {
  const startTime = Date.now();

  logger.info("Thinking cycle started", { agentId, gameId, trigger });

  try {
    // 1. Perceive（知覚）
    const perception = await perceiveGameState(agentId, gameId);

    logger.debug("Perception complete", {
      agentId,
      messagesCount: perception.recentMessages.length,
      knownCardsCount: perception.knownCards.length,
      actionsCount: perception.otherActions.length,
    });

    // 2. Memory Update（記憶更新）
    logger.debug("Updating memory", { agentId });
    const memoryUpdateResult = await updateAgentMemory(agentId, gameId, perception);

    logger.debug("Memory updated", {
      agentId,
      knowledgeBaseUpdated: memoryUpdateResult.updateEvent.changes.knowledgeBaseUpdated,
      relationshipsUpdated: memoryUpdateResult.updateEvent.changes.relationshipsUpdated.length,
      contradictionsFound: memoryUpdateResult.updateEvent.changes.contradictionsFound,
    });

    // 3. Think（思考）- Gemini で推論（更新された記憶を使用）
    const thought = await generateThought(agentId, gameId, perception, memoryUpdateResult.knowledgeBase);

    logger.debug("Thought generated", {
      agentId,
      emotion: thought.emotion,
      confidence: thought.confidence,
      suspicionRankingCount: thought.suspicionRanking.length,
    });

    // 4. Decide Action（行動決定）
    const action = await decideAction(thought, perception, agentId);

    logger.debug("Action decided", {
      agentId,
      actionType: action.type,
    });

    // 5. 感情状態をAgentBrainに反映
    try {
      await adminDb
        .collection("games")
        .doc(gameId)
        .collection("agentBrains")
        .doc(agentId)
        .update({ emotionalState: thought.emotion });
    } catch (emotionError) {
      logger.warn("Failed to update agent emotion", { agentId, error: String(emotionError) });
    }

    // 6. 思考ログを保存（感想戦用）
    const executionTime = Date.now() - startTime;
    await saveThoughtLog(gameId, agentId, {
      trigger,
      perception,
      thought,
      action,
      executionTime,
    });

    logger.info("Thinking cycle completed", {
      agentId,
      executionTime,
      actionType: action.type,
    });

    return action;
  } catch (error) {
    logger.error("Thinking cycle failed", error as Error, { agentId, gameId, trigger });
    throw error;
  }
}

/**
 * ゲーム状態を知覚する
 */
export async function perceiveGameState(
  agentId: string,
  gameId: string
): Promise<AgentPerception> {
  // Firestoreから並列取得（agentBrainsコレクション + messagesコレクション + discussionSummary）
  const [gameDoc, brainDoc, logsSnapshot, messagesSnapshot, summaryDoc] = await Promise.all([
    adminDb.collection("games").doc(gameId).get(),
    adminDb.collection("games").doc(gameId).collection("agentBrains").doc(agentId).get(),
    adminDb
      .collection("games")
      .doc(gameId)
      .collection("logs")
      .orderBy("timestamp", "desc")
      .limit(50)
      .get(),
    adminDb
      .collection("games")
      .doc(gameId)
      .collection("messages")
      .orderBy("timestamp", "desc")
      .limit(50)
      .get(),
    adminDb
      .collection("games")
      .doc(gameId)
      .collection("discussionSummary")
      .doc("current")
      .get(),
  ]);

  if (!gameDoc.exists) {
    throw new Error(`Game not found: ${gameId}`);
  }

  // agentBrainが存在しない場合はデフォルト値を使用
  if (!brainDoc.exists) {
    logger.warn("Agent brain not found, using default values", { gameId, agentId });
  }

  const gameState = gameDoc.data() as GameState;

  // agentBrainが存在しない場合はデフォルト値を使用
  // 注意: agentBrainが存在しない場合は、ゲーム開始処理（/api/game/[gameId]/start）が
  // 正しく実行されていない可能性があります。
  // agentIdからplayerIdを抽出して、gameState.playersからcharacterIdを解決
  const playerId = agentId.replace("agent_", "");
  const playerData = gameState.players[playerId];
  const resolvedCharacterId = playerData?.characterId || agentId;

  const agentBrain: AgentBrain = brainDoc.exists
    ? (brainDoc.data() as AgentBrain)
    : {
        characterId: resolvedCharacterId,
        emotionalState: "calm",
        relationships: {},
        knowledgeBase: {
          cards: {},
          knownFacts: [],
        },
        lastThought: {
          content: "",
          timestamp: Timestamp.now() as unknown as import("firebase/firestore").Timestamp,
        },
      };

  // agentBrainが存在しない場合は警告ログを出力
  if (!brainDoc.exists) {
    logger.warn("Agent brain not found - game may not have been started correctly", {
      gameId,
      agentId,
      expectedPath: `games/${gameId}/agentBrains/${agentId}`,
    });
  }

  // シナリオからカード定義を取得（gameState.cardsは初期空のためシナリオベースで構築）
  let scenarioCards: { id: string; name: string; location: string }[] = [];
  try {
    const scenarioDoc = await adminDb.collection("scenarios").doc(gameState.scenarioId).get();
    if (scenarioDoc.exists) {
      const scenarioData = scenarioDoc.data() as Scenario;
      scenarioCards = (scenarioData.data.cards || []).map(c => ({
        id: c.id,
        name: c.name,
        location: c.location,
      }));
    }
  } catch (error) {
    logger.warn("Failed to fetch scenario cards for perception", { gameId, error });
  }

  // フェーズの残り時間を計算
  const remainingTime = calculateRemainingTime(gameState);

  return {
    gameId,
    currentPhase: gameState.phase,
    turnCount: gameState.turnCount,
    myCharacterId: agentBrain.characterId,

    // 最近の会話（messagesコレクションから取得 → 人間の発言も含む）
    // カード公開通知（systemメッセージ）も含める
    recentMessages: messagesSnapshot.docs
      .filter((d) => {
        const senderId = d.data().senderId;
        const content = d.data().content || "";
        // GMナレーションは除外するが、システムメッセージのうちカード公開通知のみ含める
        if (senderId === "gm_narrator") return false;
        if (senderId === "system") {
          // Phase B-1.5: カード公開通知のみAIに見せる（他は議事録で代替）
          return content.includes("を公開しました");
        }
        return true;
      })
      .map((d) => {
        const data = d.data();
        const isMyMessage = data.senderId === agentId;
        return {
          speaker: data.senderId,
          speakerName: isMyMessage
            ? `${data.senderName}（あなた）`
            : data.senderName,
          content: data.content || "",
          timestamp: data.timestamp,
        };
      })
      .reverse(), // descで取得→ascに戻す

    // 自分が見たカード + 公開されたカード
    knownCards: (() => {
      const cards: { cardId: string; cardName: string; content: string; location: string; source?: string }[] = [];
      const seenIds = new Set<string>();

      // 1. agentBrainの知識ベースからカード情報を取得
      for (const [cardId, info] of Object.entries(agentBrain.knowledgeBase?.cards || {})) {
        const cardInfo = info as any;
        if (cardInfo.status === "known") {
          cards.push({
            cardId,
            cardName: cardInfo.cardName || cardId,
            content: cardInfo.contentGuess || "",
            location: cardInfo.location || "不明",
            source: cardInfo.source || "direct",
          });
          seenIds.add(cardId);
        }
      }

      // 2. ゲーム状態からisRevealed=trueのカードを追加（まだ知らないもの）
      // シナリオ情報が必要なので、ここではcardIdだけ記録し後で解決する
      for (const [cardId, cardState] of Object.entries(gameState.cards || {})) {
        if (cardState.isRevealed && !seenIds.has(cardId)) {
          cards.push({
            cardId,
            cardName: cardId, // シナリオ情報がないのでIDで代用
            content: "", // 後でシナリオから解決
            location: cardState.location || "不明",
            source: "revealed",
          });
        }
      }

      return cards;
    })(),

    // 利用可能なカード（シナリオベースで構築、取得済みカードを除外）
    availableCards: scenarioCards
      .filter(card => {
        // Handで始まる場所は除外（キャラクター固有カード）
        if (card.location.startsWith("Hand")) return false;
        // 既に誰かが取得済みのカードは除外
        const cardState = gameState.cards?.[card.id];
        if (cardState?.ownerId) return false;
        return true;
      })
      .map((card, index) => ({
        cardId: card.id,
        cardName: card.name || `手がかり${index + 1}`,
        location: card.location,
        relatedCharacterId: undefined,
      })),

    // 他者の行動履歴
    otherActions: logsSnapshot.docs
      .filter((d) => d.data().actorId !== agentId)
      .map((d) => {
        const data = d.data();
        return {
          actor: data.characterId || data.actorId,
          actorName: data.characterName || data.characterId,
          type: data.type,
          target: data.targetId,
          location: data.location || "不明",
          timestamp: data.timestamp,
        };
      }),

    // 自分の行動履歴（調査等）
    myActions: logsSnapshot.docs
      .filter((d) => d.data().actorId === agentId && d.data().type !== "talk")
      .map((d) => {
        const data = d.data();
        return {
          type: data.type,
          target: data.targetId,
          location: data.location || "不明",
          timestamp: data.timestamp,
        };
      }),

    // 自分の感情状態
    emotionalState: agentBrain.emotionalState || "calm",

    // 関係性マトリクス（AgentBrain.relationshipsの型が異なるため型アサーション）
    relationships: (agentBrain.relationships || {}) as AgentPerception["relationships"],

    // 残り時間
    remainingTime,

    // 議論サマリー（共有記憶）
    discussionSummary: summaryDoc.exists
      ? (summaryDoc.data() as DiscussionSummary)
      : undefined,
  };
}

/**
 * フェーズの残り時間を計算（秒）
 */
function calculateRemainingTime(gameState: GameState): number | undefined {
  if (!gameState.phaseDeadline) {
    return undefined;
  }

  const now = Date.now();
  const endsAt = gameState.phaseDeadline.toMillis();
  const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));

  return remaining;
}

/**
 * Gemini で思考を生成
 */
async function generateThought(
  agentId: string,
  gameId: string,
  perception: AgentPerception,
  knowledgeBase?: import("../types").KnowledgeBase
): Promise<AgentThought> {
  // ゲームからシナリオIDを取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  const gameData = gameDoc.data() as GameState;
  const scenarioId = gameData.scenarioId;

  // キャラクターの人格定義を取得
  const persona = await getCharacterPersona(perception.myCharacterId, scenarioId);

  // 参加者リストを構築（human/AI の区別なし — 全員1プレイヤーとして平等に扱う）
  const participants = Object.entries(gameData.players).map(([playerId, player]) => {
    return {
      id: playerId,
      characterId: player.characterId || playerId,
      name: player.characterId || playerId, // 後でシナリオから解決
      isMe: `agent_${playerId}` === agentId,
    };
  });

  // シナリオからキャラクター名を解決
  try {
    const scenarioDoc2 = await adminDb.collection("scenarios").doc(gameData.scenarioId).get();
    if (scenarioDoc2.exists) {
      const scenarioForNames = scenarioDoc2.data() as { data: { characters: { id: string; name: string }[] } };
      for (const p of participants) {
        const charDef = scenarioForNames.data.characters?.find((c: { id: string }) => c.id === p.characterId);
        if (charDef) {
          p.name = charDef.name;
        }
      }
    }
  } catch (error) {
    logger.warn("Failed to resolve participant names from scenario", { gameId, error });
  }

  const systemInstruction = buildSystemInstruction(persona, participants);

  // 議論フェーズ時はカード公開情報を構築
  let cardRevealInfo: { unrevealed: { cardId: string; cardName: string }[]; revealed: string[] } | undefined;
  if (perception.currentPhase.startsWith("discussion")) {
    // 自分（エージェント）のプレイヤーIDを取得
    const myPlayerId = agentId.replace("agent_", "");
    const unrevealed: { cardId: string; cardName: string }[] = [];
    const revealed: string[] = [];

    // シナリオからカード名を解決
    let scenarioCards: { id: string; name: string }[] = [];
    try {
      const scenarioDoc3 = await adminDb.collection("scenarios").doc(gameData.scenarioId).get();
      if (scenarioDoc3.exists) {
        const scenarioData = scenarioDoc3.data() as import("@/core/types").Scenario;
        scenarioCards = (scenarioData.data.cards || []).map(c => ({ id: c.id, name: c.name }));
      }
    } catch { /* フォールバック: IDで表示 */ }

    for (const [cardId, cardState] of Object.entries(gameData.cards || {})) {
      if (cardState.ownerId !== myPlayerId) continue;
      const cardDef = scenarioCards.find(c => c.id === cardId);
      const cardName = cardDef?.name || cardId;
      if (cardState.isRevealed) {
        revealed.push(cardName);
      } else {
        unrevealed.push({ cardId, cardName });
      }
    }

    if (unrevealed.length > 0) {
      cardRevealInfo = { unrevealed, revealed };
    }
  }

  // 前回の疑惑ランキングを取得（アンカリング用）
  let lastSuspicionRanking: { characterId: string; characterName: string; suspicionLevel: number }[] | undefined;
  try {
    const brainForRanking = await adminDb.collection("games").doc(gameId).collection("agentBrains").doc(agentId).get();
    if (brainForRanking.exists) {
      lastSuspicionRanking = brainForRanking.data()?.lastSuspicionRanking;
    }
  } catch {
    // フォールバック: ランキングなし
  }

  const prompt = buildThinkingPrompt(perception, persona, knowledgeBase, cardRevealInfo, lastSuspicionRanking);

  logger.debug("Generating thought", { agentId, characterId: perception.myCharacterId });

  try {
    // JSON形式で思考を生成
    const thought = await generateJSON<AgentThought>(prompt, {
      systemInstruction,
      temperature: 0.8, // 創造性を高めに
      maxTokens: 16384,
      schema: AgentThoughtSchema,
    });

    // バリデーション
    if (!thought.situationAnalysis || !thought.plannedStatement) {
      logger.warn("Incomplete thought generated, skipping turn", { agentId });
      throw new Error("Incomplete thought: missing situationAnalysis or plannedStatement");
    }

    // Phase B-2: 疑惑値ダンピング（前回値からの変動を±15以内に制限）
    const brainDoc2 = await adminDb.collection("games").doc(gameId).collection("agentBrains").doc(agentId).get();
    const brainData = brainDoc2.exists ? brainDoc2.data() : null;
    const lastRanking = brainData?.lastSuspicionRanking as { characterId: string; suspicionLevel: number }[] | undefined;

    if (lastRanking && lastRanking.length > 0) {
      const prevMap = new Map(lastRanking.map(r => [r.characterId, r.suspicionLevel]));
      for (const entry of thought.suspicionRanking) {
        const prev = prevMap.get(entry.characterId);
        if (prev !== undefined) {
          entry.suspicionLevel = dampSuspicion(prev, entry.suspicionLevel);
        }
      }
    }

    // Phase B-4C: フェーズ別疑惑値上限
    const currentPhase = perception.currentPhase;
    const suspicionCap = currentPhase === "discussion_1" || currentPhase === "exploration_1" ? 50 : 95;
    for (const entry of thought.suspicionRanking) {
      entry.suspicionLevel = Math.min(entry.suspicionLevel, suspicionCap);
    }

    // 疑惑ランキングをAgentBrainに保存
    try {
      await adminDb.collection("games").doc(gameId).collection("agentBrains").doc(agentId).update({
        lastSuspicionRanking: thought.suspicionRanking.map(r => ({
          characterId: r.characterId,
          characterName: r.characterName,
          suspicionLevel: r.suspicionLevel,
        })),
      });
    } catch (e) {
      logger.warn("Failed to save suspicion ranking", { agentId, error: String(e) });
    }

    // Phase B-2: ナラティブメモリ更新
    if (thought.memoryUpdate && thought.memoryUpdate.trim()) {
      try {
        await updateNarrativeMemory(gameId, agentId, thought.memoryUpdate.trim());
      } catch (e) {
        logger.warn("Failed to update narrative memory", { agentId, error: String(e) });
      }
    }

    return thought;
  } catch (error) {
    logger.error("Failed to generate thought, skipping turn", error as Error, { agentId });
    throw error; // 呼び出し元にエラーを伝播 → 次のハートビートで再試行
  }
}

/**
 * 調査するカードを選択（AI推論版）
 *
 * キャラクターの視点からカードを選択:
 * - 疑惑ランキング上位のキャラクターに関連するカードを優先
 * - 事件現場（重要度の高い場所）を優先
 * - キャラクターの性格・秘密目標を考慮
 */
async function selectCardToInvestigate(
  perception: AgentPerception,
  thought: AgentThought,
  agentId: string
): Promise<{ cardId: string; location: string; reason: string }> {
  // 既知のカードIDセットを作成
  const knownCardIds = new Set(perception.knownCards.map((c) => c.cardId));

  // 利用可能なカード（未調査のもの）を取得
  const availableCards = (perception.availableCards || []).filter(
    (card) => !knownCardIds.has(card.cardId)
  );

  if (availableCards.length === 0) {
    // 全てのカードを調査済みの場合
    logger.info("No available cards to investigate", { agentId });
    return {
      cardId: "",
      location: "",
      reason: "調査できるカードがありません",
    };
  }

  // カードが1枚しかない場合はそれを選択
  if (availableCards.length === 1) {
    return {
      cardId: availableCards[0].cardId,
      location: availableCards[0].location,
      reason: "唯一の未調査カード",
    };
  }

  try {
    // AI推論でカードを選択
    const selectedCard = await selectCardWithAI(
      perception,
      thought,
      availableCards,
      agentId
    );
    return selectedCard;
  } catch (error) {
    logger.warn("AI card selection failed, using fallback", { agentId, error });
    // フォールバック: ランダム選択
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const selectedCard = availableCards[randomIndex];
    return {
      cardId: selectedCard.cardId,
      location: selectedCard.location,
      reason: "気になるカードを調査するため",
    };
  }
}

/**
 * AIを使用してカードを選択
 */
async function selectCardWithAI(
  perception: AgentPerception,
  thought: AgentThought,
  availableCards: {
    cardId: string;
    cardName: string;
    location: string;
    relatedCharacterId?: string;
  }[],
  agentId: string
): Promise<{ cardId: string; location: string; reason: string }> {
  // カード一覧を整形
  const cardListText = availableCards
    .map((c, i) => {
      const charRelation = c.relatedCharacterId
        ? `（${c.relatedCharacterId}に関連）`
        : "";
      return `${i + 1}. ${c.cardName} - 場所: ${c.location}${charRelation}`;
    })
    .join("\n");

  // 疑惑ランキングを整形
  const suspicionText = thought.suspicionRanking
    .slice(0, 3)
    .map((s) => `- ${s.characterName}: ${s.suspicionLevel}% (${s.reason})`)
    .join("\n");

  const prompt = `あなたは探偵ゲームのプレイヤーとして、次に調査するカードを選びます。

【現在の状況分析】
${thought.situationAnalysis}

【疑惑ランキング（上位3名）】
${suspicionText || "まだ情報が不足しています"}

【発見した矛盾点】
${thought.contradictions.length > 0 ? thought.contradictions.join("\n") : "特になし"}

【調査可能なカード】
${cardListText}

【選択の基準】
- 最も疑わしいキャラクターに関連するカードは重要
- 事件現場のカードは証拠が見つかりやすい
- まだ調査していない場所を優先することも有効

上記を踏まえ、次に調査すべきカードを1つ選んでください。

JSON形式で回答:
{
  "selectedIndex": 選択したカードの番号（1から始まる）,
  "reason": "選んだ理由（20文字以内）"
}`;

  const result = await generateJSON<{ selectedIndex: number; reason: string }>(
    prompt,
    {
      temperature: 0.7,
      maxTokens: 4096,
      schema: CardSelectionSchema,
    }
  );

  // インデックスを検証
  const index = result.selectedIndex - 1;
  if (index < 0 || index >= availableCards.length) {
    logger.warn("Invalid card index from AI", { agentId, selectedIndex: result.selectedIndex });
    // フォールバック: 最初のカード
    return {
      cardId: availableCards[0].cardId,
      location: availableCards[0].location,
      reason: result.reason || "情報収集のため",
    };
  }

  const selectedCard = availableCards[index];

  logger.info("AI selected card", {
    agentId,
    cardId: selectedCard.cardId,
    reason: result.reason,
  });

  return {
    cardId: selectedCard.cardId,
    location: selectedCard.location,
    reason: result.reason,
  };
}

/**
 * 行動を決定
 */
async function decideAction(
  thought: AgentThought,
  perception: AgentPerception,
  agentId: string
): Promise<AgentAction> {
  const currentPhase = perception.currentPhase;

  if (currentPhase.startsWith("discussion")) {
    // 議論フェーズ: カード公開判断（有効なcardIdがある場合のみ）
    const cardId = thought.shouldRevealCard?.cardId;
    if (cardId && cardId !== "null" && cardId.trim() !== "") {
      return {
        type: "reveal_card",
        targetCardId: cardId,
        reason: thought.shouldRevealCard!.reason,
        // フォールバック用: カード公開失敗時に発言として使用
        content: thought.plannedStatement,
        emotion: thought.emotion,
      };
    }
    // 議論フェーズ: 発言
    return {
      type: "talk",
      content: thought.plannedStatement,
      emotion: thought.emotion,
      reason: thought.nextActionPlan,
    };
  }

  if (currentPhase.startsWith("exploration")) {
    // 探索フェーズ: カード調査（AI推論）
    const selectedCard = await selectCardToInvestigate(perception, thought, agentId);

    // カードがない場合は待機
    if (!selectedCard.cardId) {
      return {
        type: "wait",
        reason: selectedCard.reason,
      };
    }

    return {
      type: "investigate",
      targetCardId: selectedCard.cardId,
      location: selectedCard.location,
      reason: selectedCard.reason,
    };
  }

  if (currentPhase === "voting") {
    // 投票フェーズ
    const topSuspect = thought.suspicionRanking[0];

    if (!topSuspect) {
      logger.warn("No suspect ranking available for voting");
      return {
        type: "wait",
        reason: "投票先が決まっていません",
      };
    }

    return {
      type: "vote",
      targetCharacterId: topSuspect.characterId,
      reason: `${topSuspect.characterName}が最も疑わしいため`,
    };
  }

  // その他のフェーズ: 待機
  return {
    type: "wait",
    reason: "現在のフェーズでは行動できません",
  };
}

/**
 * 思考ログを保存
 */
async function saveThoughtLog(
  gameId: string,
  agentId: string,
  data: {
    trigger: ThinkingTrigger;
    perception: AgentPerception;
    thought: AgentThought;
    action: AgentAction;
    executionTime: number;
  }
) {
  const logId = `thought_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const thoughtLog: ThoughtLog = {
    id: logId,
    gameId,
    agentId,
    characterId: data.perception.myCharacterId,

    // トリガー情報
    trigger: data.trigger,
    phase: data.perception.currentPhase,
    turnCount: data.perception.turnCount,

    // 知覚データ（要約版）
    perceptionSummary: {
      messageCount: data.perception.recentMessages.length,
      knownCardsCount: data.perception.knownCards.length,
      otherActionsCount: data.perception.otherActions.length,
    },

    // 思考結果
    thought: data.thought,

    // 決定した行動
    action: data.action,

    // 感情の変化
    emotionBefore: data.perception.emotionalState,
    emotionAfter: data.thought.emotion,

    // 実行時間
    executionTimeMs: data.executionTime,

    // タイムスタンプ（Admin SDK → Client SDK型に変換）
    timestamp: Timestamp.now() as unknown as ClientTimestamp,
  };

  await adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId)
    .collection("thoughts")
    .doc(logId)
    .set(thoughtLog);

  logger.debug("Thought log saved", { logId, agentId, gameId });
}

/**
 * 探索フェーズ専用のZodスキーマ（軽量版、発言なし）
 */
const ExplorationThoughtSchema = z.object({
  situationAnalysis: z.string(),
  selectedCardReason: z.string(),
});

/**
 * 探索フェーズ専用の思考サイクル
 * 発言生成を行わず、カード選択のみに特化
 * トークン消費を大幅に削減
 *
 * @param agentId - エージェントID
 * @param gameId - ゲームID
 * @returns 調査アクション
 */
export async function executeExplorationThinkingCycle(
  agentId: string,
  gameId: string
): Promise<AgentAction> {
  const startTime = Date.now();

  logger.info("Exploration thinking cycle started", { agentId, gameId });

  try {
    // 1. Perceive（知覚）
    const perception = await perceiveGameState(agentId, gameId);

    // 2. Memory Update（記憶更新）
    await updateAgentMemory(agentId, gameId, perception);

    // 3. カード選択（フルの思考サイクルは不要）
    const knownCardIds = new Set(perception.knownCards.map((c) => c.cardId));
    const availableCards = (perception.availableCards || []).filter(
      (card) => !knownCardIds.has(card.cardId)
    );

    // カードがない場合は待機
    if (availableCards.length === 0) {
      logger.info("No available cards for exploration", { agentId });
      return { type: "wait", reason: "調査できるカードがありません" };
    }

    // カードが1枚しかない場合はそのまま選択
    if (availableCards.length === 1) {
      return {
        type: "investigate",
        targetCardId: availableCards[0].cardId,
        location: availableCards[0].location,
        reason: "唯一の未調査カード",
      };
    }

    // AI推論でカードを選択（軽量版）
    try {
      const gameDoc = await adminDb.collection("games").doc(gameId).get();
      const gameData = gameDoc.data() as GameState;
      const persona = await getCharacterPersona(perception.myCharacterId, gameData.scenarioId);

      const prompt = buildExplorationThinkingPrompt(perception, persona);

      // カード一覧テキスト
      const cardListText = availableCards
        .map((c, i) => `${i + 1}. ${c.cardName} - 場所: ${c.location}`)
        .join("\n");

      const selectionPrompt = `${prompt}

## 追加情報: 調査可能なカード一覧
${cardListText}

次に調査すべきカードを1つ選び、JSONで回答してください:
{
  "selectedIndex": 選択したカードの番号（1から始まる）,
  "reason": "選んだ理由（20文字以内）"
}`;

      const result = await generateJSON<{ selectedIndex: number; reason: string }>(
        selectionPrompt,
        {
          temperature: 0.7,
          maxTokens: 2048,
          schema: CardSelectionSchema,
        }
      );

      const index = result.selectedIndex - 1;
      if (index >= 0 && index < availableCards.length) {
        const selectedCard = availableCards[index];
        logger.info("Exploration: AI selected card", { agentId, cardId: selectedCard.cardId });
        return {
          type: "investigate",
          targetCardId: selectedCard.cardId,
          location: selectedCard.location,
          reason: result.reason,
        };
      }
    } catch (error) {
      logger.warn("Exploration AI card selection failed, using random", { agentId, error });
    }

    // フォールバック: ランダム選択
    const randomIndex = Math.floor(Math.random() * availableCards.length);
    const selectedCard = availableCards[randomIndex];

    const executionTime = Date.now() - startTime;
    logger.info("Exploration thinking cycle completed", { agentId, executionTime });

    return {
      type: "investigate",
      targetCardId: selectedCard.cardId,
      location: selectedCard.location,
      reason: "気になるカードを調査",
    };
  } catch (error) {
    logger.error("Exploration thinking cycle failed", error as Error, { agentId, gameId });
    throw error;
  }
}

/**
 * 疑惑値ダンピング関数
 * 前回値からの変動を±15以内に制限し、急激な変動を防ぐ
 */
function dampSuspicion(prev: number, curr: number): number {
  const MAX_DELTA = 15;
  const delta = curr - prev;
  return Math.abs(delta) <= MAX_DELTA ? curr : prev + Math.sign(delta) * MAX_DELTA;
}

/**
 * ナラティブメモリを更新
 * AI自身が記録した記憶を追記していく
 */
async function updateNarrativeMemory(
  gameId: string,
  agentId: string,
  memoryUpdate: string
): Promise<void> {
  const NARRATIVE_MAX_LENGTH = 3000;

  const brainRef = adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId);

  const brainDoc = await brainRef.get();
  if (!brainDoc.exists) return;

  const brain = brainDoc.data();
  const knowledgeBase = brain?.knowledgeBase || {};
  let currentNarrative = knowledgeBase.memoryNarrative || "";

  // 新しい記憶を追記
  const timestamp = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  const newEntry = `[${timestamp}] ${memoryUpdate}`;
  currentNarrative = currentNarrative ? `${currentNarrative}\n${newEntry}` : newEntry;

  // 文字数制限チェック（超過時は古い部分を切り捨て）
  if (currentNarrative.length > NARRATIVE_MAX_LENGTH) {
    // 古い部分をカット（行単位で切り詰め）
    const lines = currentNarrative.split("\n");
    while (currentNarrative.length > NARRATIVE_MAX_LENGTH && lines.length > 1) {
      lines.shift();
      currentNarrative = lines.join("\n");
    }
  }

  await brainRef.update({
    "knowledgeBase.memoryNarrative": currentNarrative,
  });

  logger.debug("Narrative memory updated", {
    agentId,
    narrativeLength: currentNarrative.length,
    newEntry: memoryUpdate.slice(0, 50),
  });
}
