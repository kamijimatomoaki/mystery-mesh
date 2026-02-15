/**
 * Turn Manager - Urgency Score
 * AI発言タイミングの優先度スコア計算
 */

import { adminDb } from "@/core/db/firestore-admin";
import type { GameState, ActionLog } from "@/core/types";

/**
 * Urgency Score計算結果
 */
export interface UrgencyScore {
  /** エージェントID（キャラクターID） */
  agentId: string;

  /** 総合スコア（0-100） */
  totalScore: number;

  /** 内訳 */
  breakdown: {
    /** 最後の発言からの経過時間スコア（0-30） */
    timeSinceLastSpeak: number;

    /** 新しい情報獲得スコア（0-25） */
    newInformationScore: number;

    /** 他プレイヤーからの言及スコア（0-20） */
    mentionedScore: number;

    /** フェーズ残り時間スコア（0-15） */
    phaseUrgencyScore: number;

    /** 保持カード数スコア（0-10） */
    cardCountScore: number;
  };

  /** 発言すべきか（閾値超過） */
  shouldSpeak: boolean;

  /** 計算時刻 */
  calculatedAt: number;
}

/**
 * Urgency Scoreを計算
 *
 * @param gameId - ゲームID
 * @param agentId - エージェントID（キャラクターID）
 * @param threshold - 発言閾値（デフォルト: 50）
 * @returns Urgency Score
 */
export async function calculateUrgencyScore(
  gameId: string,
  agentId: string,
  threshold: number = 50
): Promise<UrgencyScore> {
  // ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    throw new Error("Game not found");
  }

  const game = gameDoc.data() as GameState;

  // メッセージをサブコレクションから取得（最新50件）
  const messagesSnapshot = await adminDb
    .collection("games")
    .doc(gameId)
    .collection("messages")
    .orderBy("timestamp", "desc")
    .limit(50)
    .get();

  const messages = messagesSnapshot.docs.map((doc) => doc.data() as { senderId: string; content: string; timestamp: any });

  // エージェントブレイン（秘匿情報）を取得
  const brainDoc = await adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId)
    .get();

  // ブレインが存在しない場合はデフォルト値を使用（ゲーム開始直後など）
  const brain = brainDoc.exists ? brainDoc.data() : {
    knownCards: [],
    lastKnowledgeUpdate: null,
  };

  // 各スコアを計算
  const timeSinceLastSpeak = calculateTimeSinceLastSpeak(messages, agentId);
  const newInformationScore = calculateNewInformationScore(brain);
  const mentionedScore = calculateMentionedScore(messages, agentId);
  const phaseUrgencyScore = calculatePhaseUrgencyScore(game);
  const cardCountScore = calculateCardCountScore(brain);

  const totalScore =
    timeSinceLastSpeak +
    newInformationScore +
    mentionedScore +
    phaseUrgencyScore +
    cardCountScore;

  return {
    agentId,
    totalScore,
    breakdown: {
      timeSinceLastSpeak,
      newInformationScore,
      mentionedScore,
      phaseUrgencyScore,
      cardCountScore,
    },
    shouldSpeak: totalScore >= threshold,
    calculatedAt: Date.now(),
  };
}

/**
 * 全AIエージェントのUrgency Scoreを計算
 *
 * @param gameId - ゲームID
 * @returns Urgency Scoreの配列（降順）
 */
export async function calculateAllUrgencyScores(gameId: string): Promise<UrgencyScore[]> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    throw new Error("Game not found");
  }

  const game = gameDoc.data() as GameState;

  // AIプレイヤーのみ（playersはオブジェクト形式）
  const aiPlayers = Object.values(game.players).filter((p) => !p.isHuman && p.characterId);

  const scores = await Promise.all(
    aiPlayers.map((p) => calculateUrgencyScore(gameId, p.characterId!))
  );

  // スコア降順でソート
  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * 最後の発言からの経過時間スコア（0-30）
 * 30秒経過で満点
 */
function calculateTimeSinceLastSpeak(messages: { senderId: string; timestamp: any }[], agentId: string): number {
  const now = Date.now();

  // 最後の発言を探す（messagesは新しい順にソート済み）
  const lastMessage = messages.find((msg) => msg.senderId === agentId);

  if (!lastMessage) {
    return 30; // 一度も発言していない場合は満点
  }

  const lastSpeakTime = lastMessage.timestamp?.toMillis?.() || lastMessage.timestamp?.seconds * 1000 || 0;
  const elapsed = (now - lastSpeakTime) / 1000; // 秒

  // 30秒で満点
  return Math.min(30, (elapsed / 30) * 30);
}

/**
 * 新しい情報獲得スコア（0-25）
 * 最近カードを獲得したり、重要な情報を得た場合に高くなる
 */
function calculateNewInformationScore(brain: any): number {
  const now = Date.now();

  // 最後の知識獲得時刻
  const lastKnowledgeTime = brain.lastKnowledgeUpdate?.toMillis() || 0;
  const elapsed = (now - lastKnowledgeTime) / 1000; // 秒

  // 60秒以内なら高スコア
  if (elapsed < 60) {
    return 25;
  } else if (elapsed < 120) {
    return 15;
  } else if (elapsed < 300) {
    return 5;
  }

  return 0;
}

/**
 * 他プレイヤーからの言及スコア（0-20）
 * 自分について話されている場合に高くなる
 */
function calculateMentionedScore(messages: { senderId: string; content: string; timestamp: any }[], agentId: string): number {
  const now = Date.now();

  // 最近のメッセージ（直近5件、messagesは新しい順にソート済み）
  const recentMessages = messages.slice(0, 5);

  let mentionCount = 0;

  for (const msg of recentMessages) {
    if (msg.senderId === agentId) {
      continue; // 自分の発言は除外
    }

    const elapsed = (now - (msg.timestamp?.toMillis?.() || msg.timestamp?.seconds * 1000 || 0)) / 1000;

    if (elapsed > 60) {
      continue; // 60秒以上前は除外
    }

    // メッセージ内容にエージェントIDが含まれているか（簡易的なチェック）
    if (msg.content.includes(agentId)) {
      mentionCount++;
    }
  }

  // 言及回数に応じてスコア
  return Math.min(20, mentionCount * 10);
}

/**
 * フェーズ残り時間スコア（0-15）
 * フェーズ終了間際になるほど高くなる
 */
function calculatePhaseUrgencyScore(game: GameState): number {
  const now = Date.now();

  if (!game.phaseDeadline) {
    return 0; // 無制限フェーズ
  }

  const endsAt = game.phaseDeadline.toMillis();
  const remainingSeconds = Math.max(0, (endsAt - now) / 1000);

  // 残り60秒以下で高スコア
  if (remainingSeconds < 60) {
    return 15;
  } else if (remainingSeconds < 180) {
    return 10;
  } else if (remainingSeconds < 300) {
    return 5;
  }

  return 0;
}

/**
 * 保持カード数スコア（0-10）
 * カードをたくさん持っているほど発言したい
 */
function calculateCardCountScore(brain: any): number {
  const knownCards = brain.knownCards || [];

  // カード数に応じてスコア
  if (knownCards.length >= 5) {
    return 10;
  } else if (knownCards.length >= 3) {
    return 6;
  } else if (knownCards.length >= 1) {
    return 3;
  }

  return 0;
}

/**
 * 次に発言すべきエージェントを取得
 *
 * @param gameId - ゲームID
 * @param threshold - 発言閾値（デフォルト: 50）
 * @returns 発言すべきエージェントID、なければ null
 */
export async function getNextSpeaker(
  gameId: string,
  threshold: number = 50
): Promise<string | null> {
  const scores = await calculateAllUrgencyScores(gameId);

  // 閾値を超えたエージェントのうち、最もスコアが高いもの
  const topAgent = scores.find((s) => s.shouldSpeak);

  return topAgent ? topAgent.agentId : null;
}
