/**
 * Agent Memory Management Logic
 * エージェントの記憶管理ロジック
 */

import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import type {
  AgentPerception,
  RelationshipMatrix,
  Relationship,
  KnowledgeBase,
  CardKnowledge,
  Contradiction,
  MemoryUpdateEvent,
  MemoryStats,
} from "../types";
import type { AgentBrain } from "@/core/types";
import {
  detectContradictionsWithGemini,
  mergeContradictions,
  resolveStaleContradictions,
} from "./contradiction-detection";

const logger = createModuleLogger("agent-memory");

/**
 * エージェントの記憶を更新
 *
 * @param agentId - エージェントID
 * @param gameId - ゲームID
 * @param perception - 知覚データ
 * @returns 更新された記憶情報
 */
export async function updateAgentMemory(
  agentId: string,
  gameId: string,
  perception: AgentPerception
): Promise<{
  knowledgeBase: KnowledgeBase;
  relationships: RelationshipMatrix;
  updateEvent: MemoryUpdateEvent;
}> {
  logger.info("Memory update started", { agentId, gameId });

  const brainRef = adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId);

  const brainDoc = await brainRef.get();

  // brainが存在しない場合は自動作成
  let brain: AgentBrain;
  if (!brainDoc.exists) {
    logger.warn("Agent brain not found, creating new one", { gameId, agentId });
    const newBrain: AgentBrain = {
      characterId: agentId,
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
    await brainRef.set(newBrain);
    brain = newBrain;
  } else {
    brain = brainDoc.data() as AgentBrain;
  }

  // 既存の記憶を取得（なければ初期化）
  // AgentBrain.knowledgeBaseの型が異なるため、型アサーションと初期化を行う
  const existingKnowledge = brain.knowledgeBase as unknown as Partial<KnowledgeBase> | undefined;
  let knowledgeBase: KnowledgeBase = {
    cards: existingKnowledge?.cards || {},
    knownFacts: existingKnowledge?.knownFacts || [],
    memoryNarrative: existingKnowledge?.memoryNarrative || "",
    contradictions: existingKnowledge?.contradictions || [],
    timeline: existingKnowledge?.timeline || [],
  };

  // AgentBrain.relationshipsの型が異なるため、型アサーションを行う
  let relationships: RelationshipMatrix = (brain.relationships as unknown as RelationshipMatrix) || {};

  // 変更追跡
  const changes = {
    knowledgeBaseUpdated: false,
    relationshipsUpdated: [] as string[],
    contradictionsFound: 0,
  };

  // 1. カード知識の更新
  const cardUpdates = await updateCardKnowledge(
    knowledgeBase,
    perception,
    agentId
  );
  if (cardUpdates.updated) {
    knowledgeBase = cardUpdates.knowledgeBase;
    changes.knowledgeBaseUpdated = true;
  }

  // 2. 関係性の更新（発言から推論）
  const relationshipUpdates = await updateRelationshipsFromMessages(
    relationships,
    perception,
    knowledgeBase
  );
  if (relationshipUpdates.updated) {
    relationships = relationshipUpdates.relationships;
    changes.relationshipsUpdated = relationshipUpdates.updatedCharacters;
  }

  // 3. 矛盾検出
  const contradictionUpdates = await detectAndRecordContradictions(
    knowledgeBase,
    perception
  );
  if (contradictionUpdates.found > 0) {
    knowledgeBase = contradictionUpdates.knowledgeBase;
    changes.contradictionsFound = contradictionUpdates.found;
    changes.knowledgeBaseUpdated = true;
  }

  // 4. 事実抽出は議事録AI（Discussion Summarizer）に移行したため削除
  // Phase B-1.5: extractFactsFromMessages() はキーワードベースの雑な検出のため全削除

  // 4.5. 矛盾解決（Phase B-2C）
  const messageCount = perception.recentMessages.length;
  knowledgeBase.contradictions = resolveStaleContradictions(
    knowledgeBase.contradictions,
    messageCount
  );

  // 5. Firestoreに保存
  await brainRef.update({
    knowledgeBase,
    relationships,
    updatedAt: Timestamp.now(),
  });

  logger.info("Memory update completed", {
    agentId,
    changes,
  });

  const updateEvent: MemoryUpdateEvent = {
    reason: "new_message",
    timestamp: Timestamp.now(),
    details: {
      type: "perception_update",
      content: `Processed ${perception.recentMessages.length} messages`,
      relatedCharacters: perception.recentMessages.map((m) => m.speaker),
    },
    changes,
  };

  return {
    knowledgeBase,
    relationships,
    updateEvent,
  };
}

/**
 * カード知識の更新
 */
async function updateCardKnowledge(
  knowledgeBase: KnowledgeBase,
  perception: AgentPerception,
  agentId: string
): Promise<{
  updated: boolean;
  knowledgeBase: KnowledgeBase;
}> {
  let updated = false;

  // 自分が見たカードを記録
  for (const card of perception.knownCards) {
    const existing = knowledgeBase.cards[card.cardId];

    if (!existing || existing.status !== "known") {
      knowledgeBase.cards[card.cardId] = {
        cardId: card.cardId,
        status: "known",
        holder: perception.myCharacterId,
        location: card.location || "不明",
        contentGuess: card.content,
        confidence: 100, // 自分で見たので確信度100
        lastUpdated: Timestamp.now(),
        source: "direct",
      };
      updated = true;
    }
  }

  // 他者の行動から推論
  for (const action of perception.otherActions) {
    if (action.type === "investigate" && action.target) {
      const existing = knowledgeBase.cards[action.target];

      // まだ知らないカードなら「誰かが調べた」と記録
      if (!existing || existing.status === "unknown") {
        knowledgeBase.cards[action.target] = {
          cardId: action.target,
          status: "seen_holder",
          holder: action.actor,
          location: action.location || "不明",
          confidence: 70, // 推測なので確信度は低め
          lastUpdated: Timestamp.now(),
          source: "observation",
        };
        updated = true;
      }
    }
  }

  return { updated, knowledgeBase };
}

/**
 * 発言から関係性を更新
 */
async function updateRelationshipsFromMessages(
  relationships: RelationshipMatrix,
  perception: AgentPerception,
  knowledgeBase: KnowledgeBase
): Promise<{
  updated: boolean;
  relationships: RelationshipMatrix;
  updatedCharacters: string[];
}> {
  const updatedCharacters: string[] = [];
  let updated = false;

  for (const msg of perception.recentMessages) {
    // 自分の発言はスキップ
    if (msg.speaker === perception.myCharacterId) {
      continue;
    }

    // 関係性が存在しなければ初期化
    if (!relationships[msg.speaker]) {
      relationships[msg.speaker] = {
        targetCharacterId: msg.speaker,
        targetCharacterName: msg.speakerName,
        trust: 50, // 初期値: 中立
        suspicion: 50, // 初期値: 中立
        note: "",
        emotionalTone: "calm",
        interactions: [],
        lastUpdated: Timestamp.now(),
      };
    }

    const relationship = relationships[msg.speaker];

    // 発言内容から関係性を推論
    const analysis = analyzeMessageForRelationship(msg.content, knowledgeBase);

    // 信頼度・疑惑度を更新
    let trustDelta = 0;
    let suspicionDelta = 0;

    if (analysis.isContradictory) {
      // 矛盾した発言 → 疑惑上昇（半減: 10→5）
      suspicionDelta = 5;
      relationship.note += `[矛盾] ${msg.content.slice(0, 30)}... | `;
    }

    if (analysis.isHelpful) {
      // 有益な情報提供 → 信頼上昇（増加: 5→8, 協力を報酬する）
      trustDelta = 8;
    }

    if (analysis.isAccusatory) {
      // 告発的な発言 → 疑惑上昇（半減: 5→2, 攻撃的行動のインセンティブを下げる）
      suspicionDelta = 2;
    }

    if (analysis.isDefensive) {
      // 防御的な発言 → 疑惑上昇（半減: 3→1）
      suspicionDelta = 1;
    }

    // 信頼度・疑惑度を更新（0-100の範囲）
    relationship.trust = Math.max(
      0,
      Math.min(100, relationship.trust + trustDelta)
    );
    relationship.suspicion = Math.max(
      0,
      Math.min(100, relationship.suspicion + suspicionDelta)
    );

    // インタラクション記録を追加
    if (trustDelta !== 0 || suspicionDelta !== 0) {
      relationship.interactions.push({
        timestamp: msg.timestamp,
        type: "talk",
        content: msg.content.slice(0, 50),
        emotionChange: {
          trustDelta,
          suspicionDelta,
        },
      });

      // インタラクションは最新10件のみ保持
      if (relationship.interactions.length > 10) {
        relationship.interactions = relationship.interactions.slice(-10);
      }

      relationship.lastUpdated = Timestamp.now();
      updatedCharacters.push(msg.speaker);
      updated = true;
    }
  }

  return { updated, relationships, updatedCharacters };
}

/**
 * 発言内容を分析して関係性への影響を判定
 */
function analyzeMessageForRelationship(
  message: string,
  knowledgeBase: KnowledgeBase
): {
  isContradictory: boolean;
  isHelpful: boolean;
  isAccusatory: boolean;
  isDefensive: boolean;
} {
  const lower = message.toLowerCase();

  // 矛盾判定（簡易実装）
  const isContradictory = knowledgeBase.contradictions.some((c) =>
    c.involved.some((i) => message.includes(i.characterName))
  );

  // 有益判定
  const isHelpful =
    lower.includes("証拠") ||
    lower.includes("手がかり") ||
    lower.includes("発見した") ||
    lower.includes("わかった");

  // 告発判定
  const isAccusatory =
    lower.includes("犯人は") ||
    lower.includes("怪しい") ||
    lower.includes("疑わしい") ||
    lower.includes("間違いない");

  // 防御判定
  const isDefensive =
    lower.includes("違う") ||
    lower.includes("そんなことは") ||
    lower.includes("私じゃない") ||
    lower.includes("誤解");

  return { isContradictory, isHelpful, isAccusatory, isDefensive };
}

/**
 * 矛盾を検出して記録
 */
async function detectAndRecordContradictions(
  knowledgeBase: KnowledgeBase,
  perception: AgentPerception
): Promise<{
  found: number;
  knowledgeBase: KnowledgeBase;
}> {
  try {
    // Geminiを使用した高度な矛盾検出
    logger.debug("Starting advanced contradiction detection");

    const newContradictions = await detectContradictionsWithGemini(
      perception,
      knowledgeBase
    );

    logger.debug("Contradictions detected", {
      count: newContradictions.length,
    });

    // 既存の矛盾とマージ（重複を除外）
    knowledgeBase.contradictions = mergeContradictions(
      knowledgeBase.contradictions,
      newContradictions
    );

    // 矛盾は最新50件のみ保持
    if (knowledgeBase.contradictions.length > 50) {
      knowledgeBase.contradictions = knowledgeBase.contradictions
        .sort((a, b) => b.severity - a.severity) // 重要度順
        .slice(0, 50);
    }

    return {
      found: newContradictions.length,
      knowledgeBase,
    };
  } catch (error) {
    logger.error("Contradiction detection failed", error as Error);

    // エラー時は簡易実装にフォールバック
    return detectContradictionsSimple(knowledgeBase, perception);
  }
}

/**
 * 簡易矛盾検出（フォールバック用）
 */
function detectContradictionsSimple(
  knowledgeBase: KnowledgeBase,
  perception: AgentPerception
): {
  found: number;
  knowledgeBase: KnowledgeBase;
} {
  let found = 0;

  // 簡易実装: 発言内容と既知の事実を照合
  for (const msg of perception.recentMessages) {
    // 「知らない」と言っているが、実はカードを持っている場合
    if (
      (msg.content.includes("知らない") ||
        msg.content.includes("わからない")) &&
      knowledgeBase.cards[msg.speaker]
    ) {
      const contradiction: Contradiction = {
        id: `contradiction_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: "statement",
        description: `${msg.speakerName}は「知らない」と言っているが、カードを持っている可能性がある`,
        involved: [
          {
            characterId: msg.speaker,
            characterName: msg.speakerName,
            statement: msg.content,
          },
        ],
        severity: 60,
        discoveredAt: Timestamp.now(),
        status: "unresolved",
      };

      knowledgeBase.contradictions.push(contradiction);
      found++;
    }
  }

  return { found, knowledgeBase };
}

// Phase B-1.5: extractFactsFromMessages() と extractTags() は削除
// 事実抽出は議事録AI（Discussion Summarizer）に完全移行

/**
 * 記憶統計を計算
 */
export async function calculateMemoryStats(
  gameId: string,
  agentId: string
): Promise<MemoryStats> {
  const brainRef = adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId);

  const brainDoc = await brainRef.get();
  if (!brainDoc.exists) {
    // brainが存在しない場合は空の統計を返す
    logger.warn("Agent brain not found for stats", { gameId, agentId });
    return {
      totalCards: 0,
      knownCards: 0,
      unknownCards: 0,
      totalFacts: 0,
      contradictionsFound: 0,
      unresolvedContradictions: 0,
      relationshipsTracked: 0,
      averageSuspicion: 0,
      mostSuspiciousCharacter: undefined,
    };
  }

  const brain = brainDoc.data() as AgentBrain;

  // AgentBrain.knowledgeBaseの型が異なるため、型アサーションと初期化を行う
  const existingKnowledge2 = brain.knowledgeBase as unknown as Partial<KnowledgeBase> | undefined;
  const knowledgeBase: KnowledgeBase = {
    cards: existingKnowledge2?.cards || {},
    knownFacts: existingKnowledge2?.knownFacts || [],
    memoryNarrative: existingKnowledge2?.memoryNarrative || "",
    contradictions: existingKnowledge2?.contradictions || [],
    timeline: existingKnowledge2?.timeline || [],
  };
  const relationships: RelationshipMatrix = (brain.relationships as unknown as RelationshipMatrix) || {};

  const totalCards = Object.keys(knowledgeBase.cards).length;
  const knownCards = Object.values(knowledgeBase.cards).filter(
    (c) => c.status === "known"
  ).length;
  const unknownCards = totalCards - knownCards;

  const unresolvedContradictions = knowledgeBase.contradictions.filter(
    (c) => c.status === "unresolved"
  ).length;

  const suspicionLevels = Object.values(relationships).map((r) => r.suspicion);
  const averageSuspicion =
    suspicionLevels.length > 0
      ? suspicionLevels.reduce((a, b) => a + b, 0) / suspicionLevels.length
      : 0;

  const mostSuspicious = Object.values(relationships).sort(
    (a, b) => b.suspicion - a.suspicion
  )[0];

  return {
    totalCards,
    knownCards,
    unknownCards,
    totalFacts: knowledgeBase.knownFacts.length,
    contradictionsFound: knowledgeBase.contradictions.length,
    unresolvedContradictions,
    relationshipsTracked: Object.keys(relationships).length,
    averageSuspicion,
    mostSuspiciousCharacter: mostSuspicious?.targetCharacterId,
  };
}

/**
 * 特定のキャラクターに対する疑惑度を更新
 */
export async function updateSuspicionLevel(
  gameId: string,
  agentId: string,
  targetCharacterId: string,
  delta: number,
  reason: string
): Promise<void> {
  const brainRef = adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId);

  const brainDoc = await brainRef.get();
  if (!brainDoc.exists) {
    // brainが存在しない場合は自動作成
    logger.warn("Agent brain not found for suspicion update, creating", { gameId, agentId });
    const newBrain: AgentBrain = {
      characterId: agentId,
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
    await brainRef.set(newBrain);
    // 新規作成したので関係性はまだない
    logger.info("New agent brain created, no relationships to update", { agentId, targetCharacterId });
    return;
  }

  const brain = brainDoc.data() as AgentBrain;
  const relationships: RelationshipMatrix = (brain.relationships as unknown as RelationshipMatrix) || {};

  if (!relationships[targetCharacterId]) {
    logger.warn("Relationship not found, creating new one", {
      agentId,
      targetCharacterId,
    });
    return;
  }

  const relationship = relationships[targetCharacterId];
  relationship.suspicion = Math.max(
    0,
    Math.min(100, relationship.suspicion + delta)
  );
  relationship.note += `[疑惑${delta > 0 ? "+" : ""}${delta}] ${reason} | `;
  relationship.lastUpdated = Timestamp.now();

  await brainRef.update({
    relationships,
    updatedAt: Timestamp.now(),
  });

  logger.info("Suspicion level updated", {
    agentId,
    targetCharacterId,
    newLevel: relationship.suspicion,
    reason,
  });
}
