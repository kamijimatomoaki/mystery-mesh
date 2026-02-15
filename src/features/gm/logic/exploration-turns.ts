/**
 * Exploration Turn Manager
 * 探索フェーズのターン制管理
 */

import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { GamePhase, GameState, Scenario } from "@/core/types";
import { GAME_CONSTANTS } from "@/core/config/constants";
import { createModuleLogger } from "@/core/utils/logger";
import { executeExplorationThinkingCycle } from "@/features/agent/logic/thinking";
import { executeAgentAction } from "./agent-actions";
import { transitionPhase } from "./phases";
import { resolveCharacterNameFromScenario } from "@/core/utils/character-name";
import { sleep } from "@/core/utils/async";

const logger = createModuleLogger("ExplorationTurns");

/**
 * 探索フェーズの初期化
 * プレイヤーの行動順をランダムに決定し、APを設定
 *
 * @param gameId - ゲームID
 * @param phaseNumber - フェーズ番号（1 or 2）
 */
export async function initializeExplorationPhase(
  gameId: string,
  phaseNumber: 1 | 2
): Promise<void> {
  logger.info("Initializing exploration phase", { gameId, phaseNumber });

  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    throw new Error("Game not found");
  }

  const game = gameDoc.data() as GameState;

  // M4: 残りカード0枚の場合、探索フェーズを即座にスキップ
  try {
    const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
    if (scenarioDoc.exists) {
      const scenario = scenarioDoc.data() as Scenario;
      const uninvestigatedCards = (scenario.data.cards || []).filter((card) => {
        if (card.location.startsWith("Hand")) return false;
        const cardState = game.cards?.[card.id];
        return !cardState?.ownerId;
      });
      if (uninvestigatedCards.length === 0) {
        logger.info("No cards available, skipping exploration phase immediately", { gameId, phaseNumber });
        const currentPhase: GamePhase = phaseNumber === 1 ? "exploration_1" : "exploration_2";
        await transitionPhase(gameId, "condition_met", "system", currentPhase);
        return;
      }
    }
  } catch (error) {
    logger.warn("Failed to check remaining cards, continuing with normal initialization", {
      gameId, error: error instanceof Error ? error.message : "unknown",
    });
  }

  // 全プレイヤー（人間 + AI）を取得
  const allPlayerIds = Object.keys(game.players);

  // ランダムシャッフル（Fisher-Yates）
  const shuffledPlayers = shuffleArray([...allPlayerIds]);

  // 各プレイヤーのAPを設定
  const apPerPlayer = phaseNumber === 1
    ? GAME_CONSTANTS.EXPLORATION_1_AP
    : GAME_CONSTANTS.EXPLORATION_2_AP;

  const remainingAP: Record<string, number> = {};
  allPlayerIds.forEach((playerId) => {
    remainingAP[playerId] = apPerPlayer;
  });

  // 行動順キューを作成（各プレイヤーがAP回ずつ行動できるように）
  // 1ラウンド = 全員が1回ずつ行動
  const actionQueue = createActionQueue(shuffledPlayers, apPerPlayer);

  // 最初のアクティブプレイヤーを設定
  const firstActor = actionQueue[0] || null;

  // Firestoreを更新
  await adminDb.collection("games").doc(gameId).update({
    explorationState: {
      currentActiveActor: firstActor,
      actionQueue,
      remainingAP,
      turnStartedAt: Timestamp.now(),
    },
    updatedAt: Timestamp.now(),
  });

  logger.info("Exploration phase initialized", {
    gameId,
    phaseNumber,
    playerCount: allPlayerIds.length,
    apPerPlayer,
    firstActor,
    queueLength: actionQueue.length,
  });

  // 最初のプレイヤーがAIの場合、自動で行動をトリガー
  // H1: setTimeoutの代わりにsleep + 非同期チェーンを使用（サーバーレス環境対応）
  if (firstActor) {
    const firstPlayer = game.players[firstActor];
    if (firstPlayer && !firstPlayer.isHuman) {
      logger.info("First actor is AI, triggering action", { gameId, actorId: firstActor });
      void (async () => {
        await sleep(1500);
        await triggerAIExplorationAction(gameId, firstActor);
      })().catch((error) => {
        logger.error("AI exploration action failed", error as Error, { gameId, actorId: firstActor });
      });
    }
  }
}

/**
 * 行動順キューを作成
 * ラウンドロビン方式で、各プレイヤーがAPの回数だけ行動できる
 */
function createActionQueue(
  playerOrder: string[],
  apPerPlayer: number
): string[] {
  const queue: string[] = [];

  // apPerPlayer ラウンド分のキューを作成
  for (let round = 0; round < apPerPlayer; round++) {
    queue.push(...playerOrder);
  }

  return queue;
}

/**
 * 配列をシャッフル（Fisher-Yates）
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * 探索アクションを実行し、ターンを進める
 *
 * @param gameId - ゲームID
 * @param actorId - 行動するプレイヤーID
 * @param cardId - 調査するカードID
 * @returns 成功した場合は次のアクター情報
 */
export async function executeExplorationAction(
  gameId: string,
  actorId: string,
  cardId: string
): Promise<{ success: boolean; nextActor: string | null; message: string }> {
  logger.info("Executing exploration action", { gameId, actorId, cardId });

  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    return { success: false, nextActor: null, message: "ゲームが見つかりません" };
  }

  const game = gameDoc.data() as GameState;
  const explorationState = game.explorationState;

  if (!explorationState) {
    return { success: false, nextActor: null, message: "探索状態が初期化されていません" };
  }

  // ターンチェック
  if (explorationState.currentActiveActor !== actorId) {
    return {
      success: false,
      nextActor: explorationState.currentActiveActor,
      message: "あなたのターンではありません",
    };
  }

  // APチェック
  const currentAP = explorationState.remainingAP[actorId] || 0;
  if (currentAP < 1) {
    return { success: false, nextActor: null, message: "APが足りません" };
  }

  // カードが既に調査済みかチェック
  const cardState = game.cards?.[cardId];
  if (cardState?.ownerId) {
    return { success: false, nextActor: explorationState.currentActiveActor, message: "このカードは既に調査済みです" };
  }

  // アクションを実行
  const newAP = currentAP - 1;
  const newQueue = explorationState.actionQueue.slice(1); // 先頭を削除
  const nextActor = newQueue[0] || null;

  const player = game.players[actorId];

  // シナリオからカードのsecret情報を取得（AI知識ベース用）
  let cardSecretDescription = "";
  let cardSecretTitle = "";
  let scenarioData: Scenario | null = null;
  try {
    const scenarioDocForCard = await adminDb.collection("scenarios").doc(game.scenarioId).get();
    if (scenarioDocForCard.exists) {
      scenarioData = scenarioDocForCard.data() as Scenario;
      const cardDef = scenarioData.data.cards?.find((c: { id: string }) => c.id === cardId);
      if (cardDef?.secret) {
        cardSecretDescription = cardDef.secret.description || "";
        cardSecretTitle = cardDef.secret.title || cardDef.name || "";
      }
    }
  } catch (error) {
    logger.warn("Failed to get card secret for knowledge base", {
      gameId, cardId, error: error instanceof Error ? error.message : "unknown",
    });
  }

  // Firestoreを更新
  await adminDb.collection("games").doc(gameId).update({
    [`cards.${cardId}.location`]: `Hand(${actorId})`,
    [`cards.${cardId}.ownerId`]: actorId,
    [`explorationState.remainingAP.${actorId}`]: newAP,
    [`explorationState.actionQueue`]: newQueue,
    [`explorationState.currentActiveActor`]: nextActor,
    [`explorationState.turnStartedAt`]: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // AIプレイヤーの場合、agentBrainの知識ベースにカード内容を保存
  if (!player?.isHuman && cardSecretDescription) {
    const agentId = `agent_${actorId}`;
    try {
      const brainRef = adminDb.collection("games").doc(gameId).collection("agentBrains").doc(agentId);
      await brainRef.update({
        [`knowledgeBase.cards.${cardId}`]: {
          cardId,
          status: "known",
          holder: actorId,
          location: `Hand(${actorId})`,
          contentGuess: cardSecretDescription,
          cardName: cardSecretTitle,
          confidence: 100,
          lastUpdated: Timestamp.now(),
          source: "investigated",
        },
      });
      logger.info("Card secret saved to agent knowledge base", { gameId, agentId, cardId });
    } catch (error) {
      logger.warn("Failed to save card secret to agent brain", {
        gameId, agentId, cardId, error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  // アクションログを記録（キャラクター名をシナリオから解決 — 既に取得済みのscenarioDataを再利用）
  let characterName = player?.characterId || "";
  if (scenarioData) {
    characterName = resolveCharacterNameFromScenario(
      player?.characterId || "",
      scenarioData.data.characters
    );
  } else {
    try {
      const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
      if (scenarioDoc.exists) {
        const scenario = scenarioDoc.data() as Scenario;
        characterName = resolveCharacterNameFromScenario(
          player?.characterId || "",
          scenario.data.characters
        );
      }
    } catch (error) {
      logger.warn("Failed to resolve character name from scenario", {
        gameId,
        characterId: player?.characterId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  await adminDb.collection("games").doc(gameId).collection("logs").add({
    actorId,
    characterId: player?.characterId || "",
    characterName,
    type: "investigate",
    targetId: cardId,
    phase: game.phase,
    timestamp: Timestamp.now(),
  });

  // カード名をシナリオから解決してチャットにシステムメッセージ追加（既に取得済みのscenarioDataを再利用）
  let cardName = cardId;
  if (scenarioData) {
    const card = scenarioData.data.cards?.find((c: { id: string }) => c.id === cardId);
    if (card) cardName = card.name || cardId;
  }

  const sysMsgId = `sys_investigate_${Date.now()}_${actorId}`;
  await adminDb.collection("games").doc(gameId).collection("messages").doc(sysMsgId).set({
    id: sysMsgId,
    senderId: "system",
    senderName: "司書（GM）",
    characterId: "system",
    content: `🔍 ${characterName} が「${cardName}」を調査しました`,
    timestamp: Timestamp.now(),
  });

  logger.info("Exploration action completed", {
    gameId,
    actorId,
    cardId,
    newAP,
    nextActor,
    remainingQueue: newQueue.length,
  });

  // 次のプレイヤーがAIの場合、自動で行動をトリガー
  // H1: setTimeoutの代わりにsleep + 非同期チェーンを使用
  if (nextActor) {
    const nextPlayer = game.players[nextActor];
    if (nextPlayer && !nextPlayer.isHuman) {
      logger.info("Next actor is AI, triggering action", { gameId, actorId: nextActor });
      void (async () => {
        await sleep(2000);
        await triggerAIExplorationAction(gameId, nextActor);
      })().catch((error) => {
        logger.error("AI exploration action failed", error as Error, { gameId, actorId: nextActor });
      });
    }
  }

  return {
    success: true,
    nextActor,
    message: `カードを調査しました`,
  };
}

/**
 * AIの探索アクションをトリガー
 */
async function triggerAIExplorationAction(
  gameId: string,
  agentPlayerId: string
): Promise<void> {
  logger.info("Triggering AI exploration action", { gameId, agentPlayerId });

  const agentId = `agent_${agentPlayerId}`;

  // フェーズ遷移レースコンディション対策: 行動前にフェーズを再チェック
  const phaseCheckDoc = await adminDb.collection("games").doc(gameId).get();
  if (phaseCheckDoc.exists) {
    const phaseCheckGame = phaseCheckDoc.data() as GameState;
    if (!phaseCheckGame.phase.startsWith("exploration")) {
      logger.warn("Phase changed during AI turn, aborting exploration action", {
        gameId, agentPlayerId, currentPhase: phaseCheckGame.phase,
      });
      return;
    }
  }

  try {
    // 探索専用の軽量思考サイクルを実行（発言生成なし、カード選択のみ）
    const action = await executeExplorationThinkingCycle(agentId, gameId);

    logger.info("AI thinking completed", {
      agentId,
      actionType: action.type,
      targetCardId: action.targetCardId,
    });

    // 調査アクションの場合、実行
    if (action.type === "investigate" && action.targetCardId) {
      const result = await executeExplorationAction(
        gameId,
        agentPlayerId,
        action.targetCardId
      );

      if (!result.success) {
        logger.warn("AI exploration action failed", {
          agentId,
          message: result.message,
        });

        // アクションが失敗した場合（カードが既に取られているなど）、
        // ターンをスキップしてスタックを防ぐ
        await skipExplorationTurn(gameId, agentPlayerId);
      } else {
        // 完了チェック: キューが空なら自動遷移
        const complete = await isExplorationComplete(gameId);
        if (complete) {
          // C3: 現在のフェーズを再取得して期待値として渡す（重複遷移防止）
          const currentGame = await adminDb.collection("games").doc(gameId).get();
          const currentPhase = currentGame.data()?.phase as GamePhase | undefined;
          logger.info("Exploration complete after AI action, transitioning", { gameId, agentPlayerId, currentPhase });
          await transitionPhase(gameId, "condition_met", agentPlayerId, currentPhase);
          return;
        }
      }
    } else {
      // 調査以外のアクション（waitなど）の場合、ターンをスキップ
      logger.info("AI chose non-investigate action, skipping turn", { agentId, actionType: action.type });
      await skipExplorationTurn(gameId, agentPlayerId);
    }
  } catch (error) {
    logger.error("AI exploration action error, falling back to random card", error as Error, { agentId });

    // フォールバック: シナリオからカード定義を取得し、未調査のものからランダムに1枚選んで調査
    try {
      const fallbackGameDoc = await adminDb.collection("games").doc(gameId).get();
      if (fallbackGameDoc.exists) {
        const fallbackGame = fallbackGameDoc.data() as GameState;

        // シナリオからカード定義を取得
        let uninvestigatedCards: string[] = [];
        try {
          const scenarioDoc = await adminDb.collection("scenarios").doc(fallbackGame.scenarioId).get();
          if (scenarioDoc.exists) {
            const scenario = scenarioDoc.data() as Scenario;
            uninvestigatedCards = (scenario.data.cards || [])
              .filter(card => {
                if (card.location.startsWith("Hand")) return false;
                const cardState = fallbackGame.cards?.[card.id];
                if (cardState?.ownerId) return false;
                return true;
              })
              .map(card => card.id);
          }
        } catch (scenarioError) {
          logger.warn("Failed to fetch scenario for fallback cards", { gameId, scenarioError });
          // シナリオ取得失敗時はgameState.cardsからフォールバック
          uninvestigatedCards = Object.entries(fallbackGame.cards || {})
            .filter(([_, cardState]) => !cardState.ownerId)
            .map(([cardId]) => cardId);
        }

        if (uninvestigatedCards.length > 0) {
          const randomCardId = uninvestigatedCards[Math.floor(Math.random() * uninvestigatedCards.length)];
          logger.info("Fallback: investigating random card", { agentId, randomCardId });

          const fallbackResult = await executeExplorationAction(gameId, agentPlayerId, randomCardId);
          if (fallbackResult.success) {
            // 完了チェック
            const complete = await isExplorationComplete(gameId);
            if (complete) {
              const currentGame = await adminDb.collection("games").doc(gameId).get();
              const currentPhase = currentGame.data()?.phase as GamePhase | undefined;
              logger.info("Exploration complete after fallback action", { gameId, agentPlayerId, currentPhase });
              await transitionPhase(gameId, "condition_met", agentPlayerId, currentPhase);
              return;
            }
            return; // 成功したのでリターン
          }
        }
      }
    } catch (fallbackError) {
      logger.error("Fallback random card investigation also failed", fallbackError as Error, { agentId });
    }

    // フォールバックも失敗した場合はスキップ
    await skipExplorationTurn(gameId, agentPlayerId);
  }
}

/**
 * ターンをスキップ（APは消費しない）
 */
export async function skipExplorationTurn(
  gameId: string,
  actorId: string
): Promise<void> {
  logger.info("Skipping exploration turn", { gameId, actorId });

  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) return;

  const game = gameDoc.data() as GameState;
  const explorationState = game.explorationState;

  if (!explorationState || explorationState.currentActiveActor !== actorId) {
    return;
  }

  const newQueue = explorationState.actionQueue.slice(1);
  const nextActor = newQueue[0] || null;

  await adminDb.collection("games").doc(gameId).update({
    [`explorationState.actionQueue`]: newQueue,
    [`explorationState.currentActiveActor`]: nextActor,
    [`explorationState.turnStartedAt`]: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // スキップ時のチャットメッセージ
  const skipPlayer = game.players[actorId];
  let skipCharName = skipPlayer?.characterId || actorId;
  try {
    const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
    if (scenarioDoc.exists) {
      const scenario = scenarioDoc.data() as Scenario;
      skipCharName = resolveCharacterNameFromScenario(
        skipPlayer?.characterId || "",
        scenario.data.characters
      );
    }
  } catch { /* フォールバック */ }

  const skipMsgId = `sys_skip_${Date.now()}_${actorId}`;
  await adminDb.collection("games").doc(gameId).collection("messages").doc(skipMsgId).set({
    id: skipMsgId,
    senderId: "system",
    senderName: "司書（GM）",
    characterId: "system",
    content: `⏭️ ${skipCharName} は調査を見送りました`,
    timestamp: Timestamp.now(),
  });

  // キューが空になった場合の完了チェック
  if (!nextActor) {
    const complete = await isExplorationComplete(gameId);
    if (complete) {
      // C3: 現在のフェーズを期待値として渡す（重複遷移防止）
      const currentGame = await adminDb.collection("games").doc(gameId).get();
      const currentPhase = currentGame.data()?.phase as GamePhase | undefined;
      logger.info("Exploration complete after skip, transitioning", { gameId, actorId, currentPhase });
      await transitionPhase(gameId, "condition_met", actorId, currentPhase);
      return;
    }
  }

  // 次のプレイヤーがAIの場合、自動で行動をトリガー
  // H1: setTimeoutの代わりにsleep + 非同期チェーンを使用
  if (nextActor) {
    const nextPlayer = game.players[nextActor];
    if (nextPlayer && !nextPlayer.isHuman) {
      void (async () => {
        await sleep(1500);
        await triggerAIExplorationAction(gameId, nextActor);
      })().catch((error) => {
        logger.error("AI exploration action failed", error as Error, { gameId, actorId: nextActor });
      });
    }
  }
}

/**
 * 探索フェーズが完了したかチェック
 * Firestoreトランザクションで原子的にチェックし、レースコンディションを防止
 */
export async function isExplorationComplete(gameId: string): Promise<boolean> {
  return adminDb.runTransaction(async (transaction) => {
    const gameRef = adminDb.collection("games").doc(gameId);
    const gameDoc = await transaction.get(gameRef);
    if (!gameDoc.exists) return true;

    const game = gameDoc.data() as GameState;
    const explorationState = game.explorationState;

    if (!explorationState) return true;

    // キューが空 = 全員が全APを使い切った
    return explorationState.actionQueue.length === 0;
  });
}

/**
 * 現在のターン情報を取得
 */
export async function getCurrentTurnInfo(gameId: string): Promise<{
  currentActor: string | null;
  currentActorName: string | null;
  isHumanTurn: boolean;
  remainingTurns: number;
  playerAP: Record<string, number>;
} | null> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) return null;

  const game = gameDoc.data() as GameState;
  const explorationState = game.explorationState;

  if (!explorationState) return null;

  const currentActor = explorationState.currentActiveActor;
  const currentPlayer = currentActor ? game.players[currentActor] : null;

  // キャラクター名をシナリオから解決
  let actorName: string | null = null;
  if (currentPlayer?.characterId) {
    try {
      const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
      if (scenarioDoc.exists) {
        const scenario = scenarioDoc.data() as Scenario;
        actorName = resolveCharacterNameFromScenario(
          currentPlayer.characterId,
          scenario.data.characters
        );
      }
    } catch (error) {
      logger.warn("Failed to resolve actor name from scenario", {
        gameId,
        characterId: currentPlayer.characterId,
        error: error instanceof Error ? error.message : "unknown",
      });
      actorName = currentPlayer.characterId;
    }
  }

  return {
    currentActor,
    currentActorName: actorName || currentPlayer?.characterId || null,
    isHumanTurn: currentPlayer?.isHuman ?? false,
    remainingTurns: explorationState.actionQueue.length,
    playerAP: explorationState.remainingAP,
  };
}

/**
 * AIの探索アクションを再トリガー（停滞回復用）
 * checkTimerExpired → checkExplorationStall から呼ばれる
 */
export async function retriggerAIExplorationAction(
  gameId: string,
  agentPlayerId: string
): Promise<void> {
  logger.info("Retriggering AI exploration action (stall recovery)", { gameId, agentPlayerId });

  // turnStartedAt を更新して再トリガーのループを防止
  await adminDb.collection("games").doc(gameId).update({
    [`explorationState.turnStartedAt`]: Timestamp.now(),
  });

  await triggerAIExplorationAction(gameId, agentPlayerId);
}
