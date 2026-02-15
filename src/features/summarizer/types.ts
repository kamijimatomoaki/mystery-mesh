/**
 * Discussion Summarizer Types
 * 議論サマライザーの型定義
 */

import { Timestamp } from "firebase-admin/firestore";

/**
 * 確定事実
 * 議論中に確認された事実をソース付きで記録
 */
export interface EstablishedFact {
  id: string;
  content: string;
  source: string;
  confirmedBy: string[];
  confidence: number; // 0-100
  category:
    | "alibi"
    | "evidence"
    | "motive"
    | "relationship"
    | "timeline"
    | "item_transfer"
    | "other";
}

/**
 * 解決済みの質問
 */
export interface ResolvedQuestion {
  question: string;
  askedBy: string;
  answeredBy: string;
  answer: string;
  timestamp: Timestamp;
}

/**
 * トピックエントリ
 * 同一トピックが5回以上言及 → "saturated"
 */
export interface TopicEntry {
  topic: string;
  mentionCount: number;
  lastMentionedAt: Timestamp;
  status: "active" | "saturated" | "concluded";
}

/**
 * RP行動の記録
 * アイテム授受等のゲーム内行動を永続記録
 */
export interface RPAction {
  id: string;
  type: "item_transfer" | "show_item" | "gesture" | "other";
  actor: string;
  target: string;
  item?: string;
  description: string;
  acknowledgedBy: string[];
  timestamp: Timestamp;
}

/**
 * 議論サマリー
 * Firestore: games/{gameId}/discussionSummary/current
 */
export interface DiscussionSummary {
  establishedFacts: EstablishedFact[];
  resolvedQuestions: ResolvedQuestion[];
  openQuestions: string[];
  topicsDiscussed: TopicEntry[];
  rpActions: RPAction[];
  contradictionsNoted: string[];

  lastMessageIdProcessed: string;
  messageCountSinceUpdate: number;
  summaryVersion: number;
  lastUpdatedAt: Timestamp;
  currentPhase: string;
}
