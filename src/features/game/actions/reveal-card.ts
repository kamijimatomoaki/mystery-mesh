/**
 * カード公開の共通ロジック
 * API route と agent heartbeat の両方から利用される
 */

import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario } from "@/core/types";
import { resolveCharacterNameFromScenario } from "@/core/utils/character-name";

const logger = createModuleLogger("RevealCardInternal");

/**
 * カードを公開する（内部共通関数）
 *
 * @param gameId - ゲームID
 * @param cardId - カードID
 * @param playerId - プレイヤーID（カード所有者）
 * @returns 公開結果
 */
export async function revealCardInternal(
  gameId: string,
  cardId: string,
  playerId: string
): Promise<{ success: boolean; cardName: string; characterName: string; message: string }> {
  logger.info("Reveal card internal", { gameId, cardId, playerId });

  // 1. ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    throw new Error("ゲームが見つかりません");
  }

  const game = gameDoc.data() as GameState;

  // 2. カード所有チェック
  const cardState = game.cards?.[cardId];
  if (!cardState || cardState.ownerId !== playerId) {
    throw new Error("所持していないカードは公開できません");
  }

  if (cardState.isRevealed) {
    return { success: true, cardName: cardId, characterName: "", message: "このカードは既に公開済みです" };
  }

  // 3. シナリオからカード情報を取得
  let cardName = cardId;
  let cardDescription = "";
  let characterName = "";

  try {
    const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
    if (scenarioDoc.exists) {
      const scenario = scenarioDoc.data() as Scenario;
      const cardDef = scenario.data.cards?.find((c: { id: string }) => c.id === cardId);
      if (cardDef) {
        cardName = cardDef.name || cardId;
        cardDescription = cardDef.secret?.description || "";
      }

      // プレイヤーのキャラクター名を解決
      const player = game.players[playerId];
      if (player?.characterId) {
        characterName = resolveCharacterNameFromScenario(
          player.characterId,
          scenario.data.characters
        );
      }
    }
  } catch (error) {
    logger.warn("Failed to get card/character info from scenario", {
      gameId, cardId, error: error instanceof Error ? error.message : "unknown",
    });
  }

  if (!characterName) {
    characterName = game.players[playerId]?.characterId || playerId;
  }

  // 4. カードを公開状態に更新
  await adminDb.collection("games").doc(gameId).update({
    [`cards.${cardId}.isRevealed`]: true,
    updatedAt: Timestamp.now(),
  });

  // 5. チャットにシステムメッセージを投稿
  const sysMsgId = `sys_reveal_${Date.now()}_${playerId}`;
  const revealMessage = cardDescription
    ? `📖 ${characterName} が「${cardName}」を公開しました\n内容: ${cardDescription}`
    : `📖 ${characterName} が「${cardName}」を公開しました`;

  await adminDb.collection("games").doc(gameId).collection("messages").doc(sysMsgId).set({
    id: sysMsgId,
    senderId: "system",
    senderName: "司書（GM）",
    characterId: "system",
    content: revealMessage,
    timestamp: Timestamp.now(),
  });

  // 6. 全AIエージェントの知識ベースにカード情報を追加
  const aiPlayers = Object.entries(game.players).filter(([_, p]) => !p.isHuman);

  const updatePromises = aiPlayers.map(async ([aiPlayerId]) => {
    const agentId = `agent_${aiPlayerId}`;
    const updateData = {
      [`knowledgeBase.cards.${cardId}`]: {
        cardId,
        status: "known",
        holder: playerId,
        location: `Hand(${playerId})`,
        contentGuess: cardDescription,
        cardName: cardName,
        confidence: 100,
        lastUpdated: Timestamp.now(),
        source: "revealed",
      },
    };
    const brainRef = adminDb.collection("games").doc(gameId).collection("agentBrains").doc(agentId);

    // M3: 失敗時に1回リトライ（AI知識ベースの整合性を保つ）
    try {
      await brainRef.update(updateData);
    } catch (firstError) {
      logger.warn("First attempt to update AI agent knowledge base failed, retrying", {
        gameId, agentId, cardId,
        error: firstError instanceof Error ? firstError.message : "unknown",
      });
      try {
        await brainRef.update(updateData);
      } catch (retryError) {
        logger.error("Retry also failed for AI agent knowledge base update", retryError as Error, {
          gameId, agentId, cardId,
        });
      }
    }
  });

  await Promise.allSettled(updatePromises);

  logger.info("Card revealed successfully", {
    gameId, cardId, playerId, characterName, aiAgentsNotified: aiPlayers.length,
  });

  return {
    success: true,
    cardName,
    characterName,
    message: `「${cardName}」を公開しました`,
  };
}
