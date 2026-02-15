/**
 * Agent Domain Types
 * AIエージェントのドメイン型定義
 */

import { Timestamp } from "firebase/firestore";
import { GamePhase, EmotionalState } from "@/core/types";
import type { RelationshipMatrix as RelationshipMatrixType } from "./types/memory";
import type { DiscussionSummary } from "@/features/summarizer/types";

// Memory Management Types
export type {
  CardKnowledge,
  CardKnowledgeStatus,
  KnownFact,
  Contradiction,
  Relationship,
  RelationshipMatrix,
  InteractionRecord,
  KnowledgeBase,
  TimelineKnowledge,
  MemoryUpdateReason,
  MemoryUpdateEvent,
  MemoryStats,
} from "./types/memory";

// ローカルで使用するための型エイリアス
type RelationshipMatrix = RelationshipMatrixType;

/**
 * エージェントの知覚データ
 * ゲーム状態から得られる情報をまとめたもの
 */
export interface AgentPerception {
  gameId: string;
  currentPhase: GamePhase;
  turnCount: number;
  myCharacterId: string;

  // 最近の会話（直近20件）
  recentMessages: {
    speaker: string;
    speakerName: string;
    content: string;
    timestamp: Timestamp;
  }[];

  // 自分が見たカード
  knownCards: {
    cardId: string;
    cardName: string;
    content: string;
    location: string;
  }[];

  // 利用可能なカード（ゲーム内の全カード情報）
  availableCards?: {
    cardId: string;
    cardName: string;
    location: string;
    relatedCharacterId?: string;
  }[];

  // 他者の行動履歴
  otherActions: {
    actor: string;
    actorName: string;
    type: string;
    target?: string;
    location?: string;
    timestamp: Timestamp;
  }[];

  // 自分の行動履歴（調査等）
  myActions: {
    type: string;
    target?: string;
    location?: string;
    timestamp: Timestamp;
  }[];

  // 自分の感情状態
  emotionalState: EmotionalState;

  // 関係性マトリクス（新しいRelationship型を使用）
  relationships: RelationshipMatrix;

  // 現在のフェーズの残り時間（秒）
  remainingTime?: number;

  // 議論サマリー（共有記憶）
  discussionSummary?: DiscussionSummary;
}

/**
 * エージェントの思考結果
 * Geminiによる推論結果
 */
export interface AgentThought {
  situationAnalysis: string; // 状況分析
  contradictions: string[]; // 矛盾点
  nextActionPlan: string; // 行動方針
  plannedStatement: string; // 発言内容
  emotion: EmotionalState; // 感情
  suspicionRanking: {
    // 疑惑ランキング
    characterId: string;
    characterName: string;
    suspicionLevel: number; // 0-100
    reason: string;
  }[];
  confidence: number; // 推理の確信度 0-100
  internalThoughts?: string; // 内部思考（デバッグ用）
  shouldRevealCard?: { cardId: string; reason: string }; // カード公開判断
  memoryUpdate?: string; // 今回の会話で新たに分かったこと・気づいたこと
}

/**
 * エージェントの行動
 * 思考結果に基づいて決定される行動
 */
export interface AgentAction {
  type: "talk" | "investigate" | "vote" | "wait" | "reveal_card";
  content?: string; // 発言内容
  targetCardId?: string; // 調査対象カード / 公開対象カード
  targetCharacterId?: string; // 投票対象
  location?: string; // 移動先
  emotion?: EmotionalState; // 表情
  reason?: string; // 行動の理由（内部ログ用）
}

/**
 * 思考トリガー
 * 何がきっかけで思考サイクルが起動したか
 */
export type ThinkingTrigger =
  | "phase_change" // フェーズ変更
  | "new_message" // 新しい発言
  | "timer_tick" // 定期的なタイマー
  | "card_revealed" // カードが公開された
  | "player_joined" // プレイヤーが参加
  | "exploration_turn" // 探索ターン（自分の番）
  | "heartbeat" // ハートビート（議論フェーズの定期発言判断）
  | "manual"; // 手動トリガー

/**
 * 思考ログ
 * Firestoreに保存される思考プロセスのログ
 */
export interface ThoughtLog {
  id: string;
  gameId: string;
  agentId: string;
  characterId: string;

  // トリガー情報
  trigger: ThinkingTrigger;
  phase: GamePhase;
  turnCount: number;

  // 知覚データ（要約版）
  perceptionSummary: {
    messageCount: number;
    knownCardsCount: number;
    otherActionsCount: number;
  };

  // 思考結果
  thought: AgentThought;

  // 決定した行動
  action: AgentAction;

  // 感情の変化
  emotionBefore: EmotionalState;
  emotionAfter: EmotionalState;

  // 実行時間（ms）
  executionTimeMs: number;

  // タイムスタンプ
  timestamp: Timestamp;
}

/**
 * キャラクター人格定義
 * 各キャラクターの性格、目標、勝利条件
 */
export interface CharacterPersona {
  id: string;
  name: string;
  personality: string;
  secretGoal: string;
  winCondition: string;
  speakingStyle: string; // 話し方の特徴
  backstory: string; // 背景ストーリー
  timeline?: string[]; // キャラクターの行動記憶（ハンドアウト）
  // H3: isCulpritフィールドは削除済み。犯人情報はwinConditionで伝達する。
}

// 旧型定義は types/memory.ts に移動しました
// CardKnowledge, Relationship, MemoryEvent などは types/memory.ts から re-export されています
