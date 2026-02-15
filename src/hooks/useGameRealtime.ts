/**
 * useGameRealtime Hook
 * ゲーム状態のリアルタイム同期（Firestore Listeners）
 */

"use client";

import { useEffect, useState } from "react";
import { db } from "@/core/db/firestore-client";
import { doc, onSnapshot, collection, query, orderBy, limit } from "firebase/firestore";
import type { GameState, ChatMessage, ActionLog } from "@/core/types";

const DEBUG_MODE = process.env.NODE_ENV === "development";

/**
 * GameStateの軽量等価チェック
 * JSON.stringify を避け、UI に影響するフィールドのみ浅く比較
 */
function shallowCompareGameState(prev: GameState, next: GameState): boolean {
  // プリミティブフィールド
  if (prev.phase !== next.phase) return false;
  if (prev.isAISpeaking !== next.isAISpeaking) return false;
  if (prev.allowAITrigger !== next.allowAITrigger) return false;
  if (prev.allowHumanInput !== next.allowHumanInput) return false;
  if (prev.hostId !== next.hostId) return false;

  // cards: isRevealed/ownerId変更を検出
  const prevCardKeys = Object.keys(prev.cards || {});
  const nextCardKeys = Object.keys(next.cards || {});
  if (prevCardKeys.length !== nextCardKeys.length) return false;
  for (const k of nextCardKeys) {
    if (prev.cards?.[k]?.isRevealed !== next.cards?.[k]?.isRevealed) return false;
    if (prev.cards?.[k]?.ownerId !== next.cards?.[k]?.ownerId) return false;
  }

  // players: isReady/isOnline/characterId変更を検出
  const prevPlayerKeys = Object.keys(prev.players || {});
  const nextPlayerKeys = Object.keys(next.players || {});
  if (prevPlayerKeys.length !== nextPlayerKeys.length) return false;
  for (const k of nextPlayerKeys) {
    if (prev.players[k]?.isReady !== next.players[k]?.isReady) return false;
    if (prev.players[k]?.isOnline !== next.players[k]?.isOnline) return false;
    if (prev.players[k]?.characterId !== next.players[k]?.characterId) return false;
  }

  // explorationState: currentActiveActor / turnStartedAt 変更を検出
  if (prev.explorationState?.currentActiveActor !== next.explorationState?.currentActiveActor) return false;
  const prevTurnStarted = prev.explorationState?.turnStartedAt;
  const nextTurnStarted = next.explorationState?.turnStartedAt;
  const prevTurnMs = prevTurnStarted && typeof prevTurnStarted.toMillis === "function" ? prevTurnStarted.toMillis() : prevTurnStarted;
  const nextTurnMs = nextTurnStarted && typeof nextTurnStarted.toMillis === "function" ? nextTurnStarted.toMillis() : nextTurnStarted;
  if (prevTurnMs !== nextTurnMs) return false;

  // votes: キー数変更を検出
  const prevVoteCount = Object.keys(prev.votes || {}).length;
  const nextVoteCount = Object.keys(next.votes || {}).length;
  if (prevVoteCount !== nextVoteCount) return false;

  return true;
}

/**
 * ゲーム状態のリアルタイム購読
 * @param userId 認証済みユーザーID（未認証時はnull → リスナーを開始しない）
 */
export function useGameState(gameId: string | null, userId: string | null = null) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!gameId) {
      setLoading(false);
      return;
    }
    // userIdがnull（認証ロード中）の場合はloadingをtrueのまま維持
    // → ゲームページで一瞬「ゲームが見つかりません」が表示されるのを防ぐ
    if (!userId) {
      return;
    }

    if (DEBUG_MODE) console.log("[Realtime] Subscribing to game:", gameId);

    const unsubscribe = onSnapshot(
      doc(db, "games", gameId),
      (snapshot) => {
        if (snapshot.exists()) {
          setGameState((prev) => {
            const next = snapshot.data() as GameState;
            if (prev && shallowCompareGameState(prev, next)) {
              return prev;
            }
            return next;
          });
          setLoading(false);
        } else {
          setError(new Error("Game not found"));
          setLoading(false);
        }
      },
      (err) => {
        console.error("[Realtime] Error subscribing to game:", err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => {
      if (DEBUG_MODE) console.log("[Realtime] Unsubscribing from game:", gameId);
      unsubscribe();
    };
  }, [gameId, userId]);

  return { gameState, loading, error };
}

/**
 * チャットメッセージのリアルタイム購読
 * @param userId 認証済みユーザーID（未認証時はnull → リスナーを開始しない）
 */
export function useGameMessages(gameId: string | null, userId: string | null = null, maxMessages: number = 50) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId || !userId) {
      setLoading(false);
      return;
    }

    if (DEBUG_MODE) console.log("[Realtime] Subscribing to messages for game:", gameId);

    // 最新のメッセージを購読（最大50件）
    const q = query(
      collection(db, "games", gameId, "messages"),
      orderBy("timestamp", "desc"),
      limit(maxMessages)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs
        .map((doc) => doc.data() as ChatMessage)
        .reverse(); // 古い順に並び替え

      // 内容が同じなら前の参照を維持（不要なre-render防止）
      setMessages((prev) => {
        if (
          prev.length === newMessages.length &&
          prev.every((msg, i) => msg.id === newMessages[i].id)
        ) {
          return prev;
        }
        return newMessages;
      });
      setLoading(false);
    },
    (err) => {
      console.error("[Realtime] Error subscribing to messages:", err);
      setLoading(false);
    });

    return () => {
      if (DEBUG_MODE) console.log("[Realtime] Unsubscribing from messages");
      unsubscribe();
    };
  }, [gameId, userId, maxMessages]);

  return { messages, loading };
}

/**
 * アクションログのリアルタイム購読
 * @param userId 認証済みユーザーID（未認証時はnull → リスナーを開始しない）
 */
export function useGameActions(gameId: string | null, userId: string | null = null, maxActions: number = 20) {
  const [actions, setActions] = useState<ActionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId || !userId) {
      setLoading(false);
      return;
    }

    if (DEBUG_MODE) console.log("[Realtime] Subscribing to actions for game:", gameId);

    const q = query(
      collection(db, "games", gameId, "actions"),
      orderBy("timestamp", "desc"),
      limit(maxActions)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newActions = snapshot.docs
        .map((doc) => doc.data() as ActionLog)
        .reverse();

      setActions(newActions);
      setLoading(false);
    },
    (err) => {
      console.error("[Realtime] Error subscribing to actions:", err);
      setLoading(false);
    });

    return () => {
      if (DEBUG_MODE) console.log("[Realtime] Unsubscribing from actions");
      unsubscribe();
    };
  }, [gameId, userId, maxActions]);

  return { actions, loading };
}

/**
 * AI思考状態のリアルタイム購読
 * 注意: thinkingLogsコレクションは存在しないため、Firestoreリスナーを除去し
 * 常に空Mapを返す。AI思考インジケーターは既存のisAISpeakingフラグで代替。
 */
export function useAIThinkingStates(_gameId: string | null, _userId: string | null = null) {
  const [thinkingAgents] = useState<Map<string, "thinking" | "writing">>(new Map());
  return { thinkingAgents };
}

/**
 * フェーズタイマーのリアルタイム計算
 */
export function usePhaseTimer(gameState: GameState | null) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);

  // phaseDeadlineのミリ秒値を取得（オブジェクト参照ではなくプリミティブ値で比較）
  const deadlineMs = gameState?.phaseDeadline?.toMillis() ?? null;

  useEffect(() => {
    if (!deadlineMs) {
      setIsActive(false);
      setRemainingSeconds(0);
      return;
    }

    setIsActive(true);

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));

      setRemainingSeconds(remaining);

      if (remaining === 0) {
        setIsActive(false);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadlineMs]);

  return { remainingSeconds, isActive };
}
