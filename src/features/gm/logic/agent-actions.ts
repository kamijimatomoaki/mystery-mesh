/**
 * Agent Action Execution
 * エージェントの行動をゲームに反映
 */

import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import type { AgentAction } from "@/features/agent/types";
import type { GameState } from "@/core/types";
import { incrementMessageCount } from "@/features/summarizer/logic/summarize";

const logger = createModuleLogger("GM-AgentActions");

/**
 * エージェントの行動を実行
 */
export async function executeAgentAction(
  gameId: string,
  agentId: string,
  action: AgentAction
): Promise<void> {
  logger.info("Executing agent action", {
    gameId,
    agentId,
    actionType: action.type,
  });

  // エージェント情報を取得
  const agentDoc = await adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId)
    .get();

  if (!agentDoc.exists) {
    logger.warn("Agent not found", { agentId });
    return;
  }

  const agentData = agentDoc.data();
  const characterId = agentData?.characterId;
  const characterName = agentData?.characterName || characterId;

  // ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    logger.warn("Game not found", { gameId });
    return;
  }

  const gameState = gameDoc.data() as GameState;

  // 行動ログを作成
  // targetId と location が undefined の場合は null を使用（Firestoreは null を許可するが undefined はエラー）
  const log = {
    id: `log_${Date.now()}_${agentId}`,
    actorId: agentId,
    characterId: characterId || "unknown",
    characterName: characterName || "unknown",
    type: action.type,
    targetId: action.targetCardId || action.targetCharacterId || null,
    location: action.location || null,
    content: action.content || "",
    phase: gameState.phase,
    timestamp: Timestamp.now(),
  };

  // Firestoreに保存
  await adminDb
    .collection("games")
    .doc(gameId)
    .collection("logs")
    .doc(log.id)
    .set(log);

  logger.debug("Action log saved", { logId: log.id });

  // もし発言なら、ゲームのメッセージサブコレクションにも追加
  if (action.type === "talk" && action.content) {
    const messageId = `msg_${Date.now()}_${agentId}`;
    await adminDb
      .collection("games")
      .doc(gameId)
      .collection("messages")
      .doc(messageId)
      .set({
        id: messageId,
        senderId: agentId,
        senderName: characterName,
        characterId: characterId || "unknown",
        content: action.content,
        timestamp: Timestamp.now(),
      });

    logger.info("Agent message added to game", {
      agentId,
      characterName,
      messageLength: action.content.length,
    });

    // サマライザー用メッセージカウント更新（ノンブロッキング）
    incrementMessageCount(gameId).catch(() => {});
  }
}
