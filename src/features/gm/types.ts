/**
 * GM (Game Master) Feature Types
 * ゲームマスター機能の型定義
 */

import type { GamePhase } from "@/core/types";

/**
 * フェーズ制限時間（秒）
 */
export const PHASE_DURATIONS: Record<GamePhase, number> = {
  setup: 0, // 無制限（キャラクター選択）
  generation: 0, // 無制限（シナリオ生成中）
  lobby: 0, // 無制限
  prologue: 300, // 5分（ハンドアウト確認）
  exploration_1: 300, // 5分
  discussion_1: 1800, // 30分（30 * 60）- constants.tsと統一
  exploration_2: 300, // 5分
  discussion_2: 2700, // 45分（45 * 60）- constants.tsと統一
  voting: 180, // 3分
  ending: 0, // 無制限（動画視聴）
  ended: 0, // ゲーム終了
};

/**
 * フェーズ遷移マップ（2-Cycle System）
 * 各フェーズから次のフェーズへの遷移を定義
 */
export const PHASE_TRANSITIONS: Record<GamePhase, GamePhase | null> = {
  setup: "generation",
  generation: "lobby",
  lobby: "prologue",
  prologue: "exploration_1",
  exploration_1: "discussion_1",
  discussion_1: "exploration_2",
  exploration_2: "discussion_2",
  discussion_2: "voting",
  voting: "ending",
  ending: "ended",
  ended: null, // 終了状態
};

/**
 * フェーズタイマー状態
 */
export interface PhaseTimer {
  /** 現在のフェーズ */
  currentPhase: GamePhase;

  /** フェーズ開始時刻（UnixTime ミリ秒） */
  startedAt: number;

  /** フェーズ終了予定時刻（UnixTime ミリ秒） */
  endsAt: number | null; // null = 無制限

  /** 残り時間（秒） */
  remainingSeconds: number;

  /** タイマーがアクティブか */
  isActive: boolean;
}

/**
 * フェーズ遷移イベント
 */
export interface PhaseTransitionEvent {
  /** 遷移ID */
  id: string;

  /** ゲームID */
  gameId: string;

  /** 前のフェーズ */
  fromPhase: GamePhase;

  /** 次のフェーズ */
  toPhase: GamePhase;

  /** 遷移理由 */
  reason: "manual" | "timer_expired" | "condition_met";

  /** 遷移時刻 */
  timestamp: number;

  /** トリガーしたユーザーID（手動遷移の場合） */
  triggeredBy?: string;
}

/**
 * GM設定
 */
export interface GMConfig {
  /** フェーズ自動遷移を有効にするか */
  autoTransition: boolean;

  /** タイマー警告閾値（秒） */
  warningThreshold: number; // デフォルト: 60秒

  /** AI発言の間隔（秒） */
  aiSpeakInterval: number; // デフォルト: 30秒

  /** 最大ターン数（無限ループ防止） */
  maxTurns: number; // デフォルト: 100
}

/**
 * フェーズごとのAI/入力制御フラグ
 */
export interface PhaseControlFlags {
  /** プレイヤーのチャット入力を許可するか */
  allowHumanInput: boolean;
  /** AI発言トリガーを許可するか */
  allowAITrigger: boolean;
}

/**
 * フェーズごとの制御フラグ設定
 * - prologue: ハンドアウト確認中のため両方無効（静かに読む時間）
 * - exploration: カード調査に集中するため発言無効
 * - discussion: 議論フェーズ（発言可能）
 * - voting: 投票のみ
 */
export const PHASE_CONTROL_FLAGS: Record<GamePhase, PhaseControlFlags> = {
  setup: { allowHumanInput: false, allowAITrigger: false },
  generation: { allowHumanInput: false, allowAITrigger: false },
  lobby: { allowHumanInput: false, allowAITrigger: false },
  prologue: { allowHumanInput: false, allowAITrigger: false }, // ハンドアウト確認中は静寂
  exploration_1: { allowHumanInput: false, allowAITrigger: false }, // 探索に集中
  discussion_1: { allowHumanInput: true, allowAITrigger: true },
  exploration_2: { allowHumanInput: false, allowAITrigger: false }, // 探索に集中
  discussion_2: { allowHumanInput: true, allowAITrigger: true },
  voting: { allowHumanInput: false, allowAITrigger: false },
  ending: { allowHumanInput: false, allowAITrigger: false },
  ended: { allowHumanInput: false, allowAITrigger: false },
};
