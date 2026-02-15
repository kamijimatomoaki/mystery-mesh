/**
 * Agent Memory Management Types
 * エージェントの記憶管理に関する型定義
 */

import { Timestamp } from "firebase-admin/firestore";
import type { EmotionalState } from "@/core/types";

/**
 * カード情報の状態
 */
export type CardKnowledgeStatus =
  | "unknown" // まだ見ていない
  | "seen_holder" // 誰が持っているかだけ知っている
  | "known" // 内容を知っている
  | "deduced"; // 推論で内容を推測した

/**
 * カード知識
 */
export interface CardKnowledge {
  cardId: string;
  status: CardKnowledgeStatus;
  holder?: string; // 所持者のキャラクターID
  location?: string; // カードの場所
  contentGuess?: string; // 内容の推測
  confidence?: number; // 確信度 (0-100)
  lastUpdated: Timestamp;
  source: "direct" | "observation" | "deduction"; // 情報源
}

/**
 * 既知の事実
 */
export interface KnownFact {
  id: string;
  content: string; // 事実の内容
  source: string; // 情報源（カードID、キャラクターIDなど）
  confidence: number; // 確信度 (0-100)
  timestamp: Timestamp;
  relatedCharacters?: string[]; // 関連するキャラクター
  tags?: string[]; // タグ（motive, alibi, evidence など）
}

/**
 * 矛盾情報
 */
export interface Contradiction {
  id: string;
  type: "statement" | "action" | "timeline" | "knowledge" | "alibi"; // 矛盾のタイプ
  description: string; // 矛盾の説明
  involved: {
    characterId: string;
    characterName: string;
    statement?: string; // 矛盾する発言
    action?: string; // 矛盾する行動
  }[];
  severity: number; // 重要度 (0-100)
  discoveredAt: Timestamp;
  status: "unresolved" | "explained" | "dismissed";
}

/**
 * 関係性情報
 */
export interface Relationship {
  targetCharacterId: string;
  targetCharacterName: string;
  trust: number; // 信頼度 (0-100)
  suspicion: number; // 疑惑度 (0-100)
  note: string; // メモ
  emotionalTone: EmotionalState; // 相手に対する感情
  interactions: InteractionRecord[]; // 相互作用の履歴
  lastUpdated: Timestamp;
}

/**
 * 相互作用の記録
 */
export interface InteractionRecord {
  timestamp: Timestamp;
  type: "talk" | "accuse" | "defend" | "cooperate";
  content: string;
  emotionChange: {
    trustDelta: number; // 信頼度の変化
    suspicionDelta: number; // 疑惑度の変化
  };
}

/**
 * Knowledge Base（知識ベース）
 */
export interface KnowledgeBase {
  cards: Record<string, CardKnowledge>; // カードID → カード知識
  knownFacts: KnownFact[]; // 既知の事実（レガシー、移行期間中は残す）
  memoryNarrative: string; // AI自身が追記していく記憶ナラティブ（文字数上限: 3000文字）
  contradictions: Contradiction[]; // 発見した矛盾
  timeline: TimelineKnowledge[]; // タイムラインの知識
}

/**
 * タイムラインの知識
 */
export interface TimelineKnowledge {
  time: string; // 時刻（例: "10:00"）
  event: string; // イベント内容
  source: string; // 情報源
  confidence: number; // 確信度 (0-100)
  relatedCharacters: string[];
  isVerified: boolean; // 検証済みかどうか
}

/**
 * Relationship Matrix（関係性マトリクス）
 */
export type RelationshipMatrix = Record<string, Relationship>;

/**
 * 記憶更新の理由
 */
export type MemoryUpdateReason =
  | "new_message" // 新しい発言
  | "card_revealed" // カード公開
  | "contradiction_found" // 矛盾発見
  | "deduction" // 推論
  | "observation"; // 観察

/**
 * 記憶更新イベント
 */
export interface MemoryUpdateEvent {
  reason: MemoryUpdateReason;
  timestamp: Timestamp;
  details: {
    type: string;
    content: string;
    relatedCharacters?: string[];
    relatedCards?: string[];
  };
  changes: {
    knowledgeBaseUpdated: boolean;
    relationshipsUpdated: string[]; // 更新された関係性のキャラクターID
    contradictionsFound: number;
  };
}

/**
 * 記憶統計
 */
export interface MemoryStats {
  totalCards: number;
  knownCards: number;
  unknownCards: number;
  totalFacts: number;
  contradictionsFound: number;
  unresolvedContradictions: number;
  relationshipsTracked: number;
  averageSuspicion: number; // 平均疑惑度
  mostSuspiciousCharacter?: string;
}
