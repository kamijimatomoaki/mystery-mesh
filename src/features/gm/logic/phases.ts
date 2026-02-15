/**
 * GM Phase Manager
 * フェーズ遷移ステートマシンとタイマー管理
 */

import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { GamePhase, GameState } from "@/core/types";
import {
  PHASE_DURATIONS,
  PHASE_TRANSITIONS,
  PHASE_CONTROL_FLAGS,
  type PhaseTimer,
  type PhaseTransitionEvent,
  type GMConfig,
} from "../types";
import { executeThinkingCycle } from "@/features/agent/logic/thinking";
import { executeAllAgentVoting } from "@/features/agent/logic/voting";
import { createModuleLogger } from "@/core/utils/logger";
import { executeAgentAction } from "./agent-actions";
import { initializeExplorationPhase, retriggerAIExplorationAction, skipExplorationTurn } from "./exploration-turns";

const logger = createModuleLogger("GM-Phases");

/**
 * フェーズ開始時の定型GMメッセージ
 * 議論フェーズと投票フェーズでAI発言トリガーのために投稿
 */
const PHASE_START_MESSAGES: Partial<Record<GamePhase, string>> = {
  discussion_1:
    "📖 第一章「議論」が始まりました。各自の推理を述べ合い、真相に迫りましょう。",
  discussion_2:
    "📖 第二章「議論」が始まりました。新たな証拠を踏まえ、犯人を絞り込みましょう。",
  voting: "⚖️ 「審判の時」が訪れました。犯人だと思う人物に投票してください。",
};

/**
 * フェーズ開始時のGMメッセージを投稿
 * @param gameId - ゲームID
 * @param phase - 開始するフェーズ
 */
async function postPhaseStartMessage(
  gameId: string,
  phase: GamePhase
): Promise<void> {
  const message = PHASE_START_MESSAGES[phase];
  if (!message) return;

  const messageId = `gm_${phase}_${Date.now()}`;
  await adminDb
    .collection("games")
    .doc(gameId)
    .collection("messages")
    .doc(messageId)
    .set({
      id: messageId,
      senderId: "gm_narrator",
      senderName: "司書（GM）",
      characterId: "gm",
      content: message,
      timestamp: Timestamp.now(),
    });

  logger.info("Posted phase start GM message", { gameId, phase, messageId });
}

/**
 * フェーズを遷移する（トランザクション保護付き）
 *
 * Firestoreトランザクション内でフェーズを検証・更新することで、
 * 同時呼び出しによるレースコンディション（フェーズスキップ）を防止する。
 *
 * @param gameId - ゲームID
 * @param reason - 遷移理由
 * @param triggeredBy - トリガーしたユーザーID（オプション）
 * @param expectedFromPhase - 期待する現在のフェーズ（指定時、一致しなければ遷移をスキップ）
 * @returns 遷移後のフェーズ、null の場合は遷移不可または既に遷移済み
 */
export async function transitionPhase(
  gameId: string,
  reason: "manual" | "timer_expired" | "condition_met",
  triggeredBy?: string,
  expectedFromPhase?: GamePhase
): Promise<GamePhase | null> {
  console.log("[GM] Phase transition requested:", { gameId, reason, triggeredBy, expectedFromPhase });

  const gameRef = adminDb.collection("games").doc(gameId);

  // トランザクション内でフェーズ検証→更新を原子的に実行
  const result = await adminDb.runTransaction(async (transaction) => {
    const gameDoc = await transaction.get(gameRef);

    if (!gameDoc.exists) {
      throw new Error("Game not found");
    }

    const game = gameDoc.data() as GameState;
    const currentPhase = game.phase;

    // expectedFromPhaseが指定されている場合、現在のフェーズが期待通りか検証
    // 既に他のリクエストで遷移済みなら何もしない（重複遷移防止）
    if (expectedFromPhase && currentPhase !== expectedFromPhase) {
      console.log("[GM] Phase already transitioned, skipping:", {
        expected: expectedFromPhase,
        actual: currentPhase,
      });
      return null;
    }

    // 次のフェーズを決定
    const nextPhase = PHASE_TRANSITIONS[currentPhase];

    if (!nextPhase) {
      console.log("[GM] No next phase (game ended)");
      return null;
    }

    console.log("[GM] Transitioning:", currentPhase, "→", nextPhase);

    // タイマーを更新
    const timer = createPhaseTimer(nextPhase);

    // フェーズ制御フラグを取得
    const controlFlags = PHASE_CONTROL_FLAGS[nextPhase];

    // トランザクション内でゲーム状態を原子的に更新
    transaction.update(gameRef, {
      phase: nextPhase,
      phaseDeadline: timer.endsAt ? Timestamp.fromMillis(timer.endsAt) : null,
      allowHumanInput: controlFlags.allowHumanInput,
      allowAITrigger: controlFlags.allowAITrigger,
      isAISpeaking: false, // フェーズ遷移時はリセット
      isAISpeakingLockedAt: null, // C5: ロックタイムスタンプもリセット
      explorationState: currentPhase.startsWith("exploration") ? null : game.explorationState ?? null, // M2: 探索→議論遷移時にクリア
    });

    return { nextPhase, currentPhase };
  });

  // トランザクション結果がnullなら遷移不可または既に遷移済み
  if (!result) {
    return null;
  }

  const { nextPhase, currentPhase } = result;

  // voting → ending 遷移時: 未投票者にランダム自動投票
  if (result.currentPhase === "voting" && result.nextPhase === "ending") {
    try {
      const voteGameDoc = await adminDb.collection("games").doc(gameId).get();
      if (voteGameDoc.exists) {
        const voteGame = voteGameDoc.data() as GameState;
        const allPlayers = Object.entries(voteGame.players).filter(([_, p]) => p.characterId);
        const votes = voteGame.votes || {};
        const characterIds = allPlayers.map(([_, p]) => p.characterId!);

        const unvotedPlayers = allPlayers.filter(([pid]) => !votes[pid]);
        if (unvotedPlayers.length > 0) {
          logger.warn("Unvoted players detected at voting → ending transition", {
            gameId,
            unvotedCount: unvotedPlayers.length,
            unvotedPlayerIds: unvotedPlayers.map(([pid]) => pid),
          });

          const voteUpdates: Record<string, string> = {};
          for (const [pid] of unvotedPlayers) {
            // 自分以外のキャラクターからランダムに選択
            const player = voteGame.players[pid];
            const otherCharacterIds = characterIds.filter(cid => cid !== player?.characterId);
            const randomTarget = otherCharacterIds[Math.floor(Math.random() * otherCharacterIds.length)];
            if (randomTarget) {
              voteUpdates[`votes.${pid}`] = randomTarget;
              logger.warn("Auto-voting for unvoted player", { gameId, playerId: pid, target: randomTarget });
            }
          }

          if (Object.keys(voteUpdates).length > 0) {
            await adminDb.collection("games").doc(gameId).update(voteUpdates);
          }
        }
      }
    } catch (error) {
      logger.error("Failed to auto-vote for unvoted players", error as Error, { gameId });
    }
  }

  // トランザクション外の副作用（べき等性のある操作のみ）
  // フェーズ遷移イベントを記録
  const transitionEvent: PhaseTransitionEvent = {
    id: `transition_${Date.now()}`,
    gameId,
    fromPhase: currentPhase,
    toPhase: nextPhase,
    reason,
    timestamp: Date.now(),
    triggeredBy: triggeredBy || "system",
  };

  await adminDb.collection("phaseTransitions").add(transitionEvent);

  console.log("[GM] Phase transition complete:", nextPhase);

  // フェーズ開始GMメッセージを投稿（議論・投票フェーズ）
  await postPhaseStartMessage(gameId, nextPhase);

  // 探索フェーズの場合、ターン制を初期化
  if (nextPhase === "exploration_1") {
    logger.info("Initializing exploration phase 1", { gameId });
    await initializeExplorationPhase(gameId, 1);
  } else if (nextPhase === "exploration_2") {
    logger.info("Initializing exploration phase 2", { gameId });
    await initializeExplorationPhase(gameId, 2);
  }

  // prologueフェーズの場合、AIエージェントを自動でReady状態にする
  if (nextPhase === "prologue") {
    logger.info("Setting AI agents as prologue ready", { gameId });
    await setAIAgentsPrologueReady(gameId);
  }

  // AIエージェントに通知（phase_changeトリガー）
  // 探索フェーズは個別にターン制で処理するので、ここでは通知しない
  // 議論フェーズもtrigger-speak APIで1人ずつ順番に発言させるため、ここでは通知しない
  if (
    !nextPhase.startsWith("exploration") &&
    !nextPhase.startsWith("discussion")
  ) {
    await notifyAgentsOfPhaseChange(gameId, nextPhase);
  }

  return nextPhase;
}

/**
 * フェーズタイマーを作成
 *
 * @param phase - フェーズ
 * @returns フェーズタイマー
 */
export function createPhaseTimer(phase: GamePhase): PhaseTimer {
  const now = Date.now();
  const duration = PHASE_DURATIONS[phase];

  if (duration === 0) {
    // 無制限
    return {
      currentPhase: phase,
      startedAt: now,
      endsAt: null,
      remainingSeconds: Infinity,
      isActive: false,
    };
  }

  const endsAt = now + duration * 1000;

  return {
    currentPhase: phase,
    startedAt: now,
    endsAt,
    remainingSeconds: duration,
    isActive: true,
  };
}

/**
 * 現在のフェーズタイマー状態を取得
 *
 * @param gameId - ゲームID
 * @returns フェーズタイマー
 */
export async function getPhaseTimer(gameId: string): Promise<PhaseTimer> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    throw new Error("Game not found");
  }

  const game = gameDoc.data() as GameState;
  const phase = game.phase;
  const endsAt = game.phaseDeadline?.toMillis() || null;
  const now = Date.now();

  // startedAtはphaseDeadlineから逆算（または現在時刻を使用）
  // M1: durationは秒、endsAtはミリ秒なので変換が必要
  const duration = PHASE_DURATIONS[phase] || 0;
  const startedAt = endsAt ? endsAt - (duration * 1000) : now;

  if (!endsAt) {
    // 無制限フェーズ
    return {
      currentPhase: phase,
      startedAt: now,
      endsAt: null,
      remainingSeconds: Infinity,
      isActive: false,
    };
  }

  const remainingSeconds = Math.max(0, Math.floor((endsAt - now) / 1000));

  return {
    currentPhase: phase,
    startedAt,
    endsAt,
    remainingSeconds,
    isActive: remainingSeconds > 0,
  };
}

/**
 * タイマー満了チェック（定期実行用）
 *
 * @param gameId - ゲームID
 * @returns タイマーが満了した場合は true
 */
export async function checkTimerExpired(gameId: string): Promise<boolean> {
  const timer = await getPhaseTimer(gameId);

  // 無制限フェーズ（デッドラインなし）
  if (timer.endsAt === null) {
    return false;
  }

  // タイマー切れ
  if (timer.remainingSeconds <= 0) {
    console.log("[GM] Timer expired for game:", gameId, "Phase:", timer.currentPhase);

    // 自動遷移（システムによるタイマー満了）— 現在のフェーズを期待値として渡す
    await transitionPhase(gameId, "timer_expired", "system", timer.currentPhase);

    return true;
  }

  // 探索フェーズのターン停滞検知
  if (timer.currentPhase.startsWith("exploration")) {
    await checkExplorationStall(gameId);
  }

  return false;
}

/**
 * 探索フェーズのターン停滞を検知・回復
 * check_expired ポーリングから呼ばれる
 *
 * - AIターンが15秒以上停滞 → AIアクション再トリガー
 * - 人間ターンが90秒以上停滞 → 自動スキップ
 */
async function checkExplorationStall(gameId: string): Promise<void> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) return;

  const game = gameDoc.data() as GameState;
  const explorationState = game.explorationState;
  if (!explorationState?.currentActiveActor) return;

  const currentActor = explorationState.currentActiveActor;
  const player = game.players[currentActor];
  if (!player) return;

  // turnStartedAt が記録されていない場合はスキップ（後方互換性）
  const turnStartedAt = explorationState.turnStartedAt;
  if (!turnStartedAt) return;

  const turnStartMs: number = typeof turnStartedAt.toMillis === "function"
    ? turnStartedAt.toMillis()
    : Number(turnStartedAt);
  const elapsedMs = Date.now() - turnStartMs;

  if (!player.isHuman) {
    // AIターン: 15秒以上停滞 → 再トリガー
    if (elapsedMs > 15_000) {
      logger.warn("AI exploration turn stalled, retriggering", {
        gameId, actorId: currentActor, elapsedMs,
      });
      await retriggerAIExplorationAction(gameId, currentActor);
    }
  } else {
    // 人間ターン: 90秒以上停滞 → 自動スキップ
    if (elapsedMs > 90_000) {
      logger.warn("Human exploration turn stalled, auto-skipping", {
        gameId, actorId: currentActor, elapsedMs,
      });
      await skipExplorationTurn(gameId, currentActor);
    }
  }
}

/**
 * AIエージェントのプロローグ準備完了フラグをセット
 *
 * @param gameId - ゲームID
 */
async function setAIAgentsPrologueReady(gameId: string): Promise<void> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    logger.warn("Game not found for setting AI prologue ready", { gameId });
    return;
  }

  const game = gameDoc.data() as GameState;

  // AIプレイヤーを取得してisPrologueReadyをtrueに設定
  const updateData: Record<string, boolean> = {};

  for (const [playerId, player] of Object.entries(game.players)) {
    if (!player.isHuman) {
      updateData[`players.${playerId}.isPrologueReady`] = true;
    }
  }

  if (Object.keys(updateData).length > 0) {
    await adminDb.collection("games").doc(gameId).update(updateData);
    logger.info("AI agents set as prologue ready", {
      gameId,
      agentCount: Object.keys(updateData).length,
    });
  }
}

/**
 * AIエージェントにフェーズ変更を通知
 *
 * @param gameId - ゲームID
 * @param newPhase - 新しいフェーズ
 */
async function notifyAgentsOfPhaseChange(gameId: string, newPhase: GamePhase) {
  logger.info("Notifying agents of phase change", { gameId, newPhase });

  // 投票フェーズの場合は特別処理: 全AIが自動投票
  if (newPhase === "voting") {
    logger.info("Voting phase detected, triggering AI voting", { gameId });
    try {
      await executeAllAgentVoting(gameId);
      logger.info("All AI agents have voted", { gameId });
      // AI投票完了後に条件チェック（全員投票完了ならendingへ遷移）
      await checkConditionTransition(gameId);
    } catch (error) {
      logger.error("AI voting failed", error as Error, { gameId });
    }
    return;
  }

  // ゲームの全AIプレイヤーを取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    logger.warn("Game not found", { gameId });
    return;
  }

  const game = gameDoc.data() as GameState;
  // playersはオブジェクト形式: { [playerId]: playerData }
  const aiPlayers = Object.entries(game.players).filter(([_, p]) => !p.isHuman);

  logger.info("Found AI players", { count: aiPlayers.length });

  // 各AIエージェントの思考をトリガー（並列実行）
  const thinkingPromises = aiPlayers.map(async ([playerId, player]) => {
    if (!player.characterId) {
      return; // キャラクター未選択
    }

    const agentId = `agent_${playerId}`;
    logger.debug("Triggering agent thinking", { agentId, characterId: player.characterId });

    try {
      // エージェントの思考サイクルを実行
      const action = await executeThinkingCycle(agentId, gameId, "phase_change");

      logger.info("Agent thinking completed", {
        agentId,
        actionType: action.type,
      });

      // もし発言があれば、自動的に実行
      if (action.type === "talk" && action.content) {
        await executeAgentAction(gameId, agentId, action);
      }
    } catch (error) {
      logger.error("Agent thinking failed", error as Error, { agentId });
    }
  });

  // 全エージェントの思考を並列実行
  await Promise.allSettled(thinkingPromises);

  logger.info("All agents notified", { gameId });
}


/**
 * GM設定を取得
 *
 * @param gameId - ゲームID
 * @returns GM設定
 */
export async function getGMConfig(gameId: string): Promise<GMConfig> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    throw new Error("Game not found");
  }

  const game = gameDoc.data() as GameState;

  // デフォルト設定
  const defaultConfig: GMConfig = {
    autoTransition: true,
    warningThreshold: 60,
    aiSpeakInterval: 30,
    maxTurns: 100,
  };

  // ゲーム固有の設定があればマージ（将来の拡張用）
  return defaultConfig;
}

/**
 * 条件付き遷移チェック
 * 特定の条件（全員投票完了など）でフェーズを遷移
 *
 * @param gameId - ゲームID
 * @returns 遷移した場合は true
 */
export async function checkConditionTransition(gameId: string): Promise<boolean> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    return false;
  }

  const game = gameDoc.data() as GameState;

  // Voting フェーズ: 全員投票完了
  if (game.phase === "voting") {
    // キャラクター選択済みの全プレイヤーが投票対象
    const totalPlayers = Object.values(game.players).filter((p) => p.characterId).length;
    const votes = game.votes || {};
    const votedCount = Object.keys(votes).length;

    if (votedCount >= totalPlayers) {
      console.log("[GM] All players voted, transitioning to ending");
      // C4: expectedFromPhaseを渡して重複遷移を防止
      await transitionPhase(gameId, "condition_met", "system", "voting");
      return true;
    }
  }

  return false;
}
