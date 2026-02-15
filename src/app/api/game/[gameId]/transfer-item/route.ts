/**
 * POST /api/game/[gameId]/transfer-item
 * アイテムカードの譲渡API
 * 議論フェーズ中にtype: "item"のカードを他プレイヤーに渡す
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario } from "@/core/types";
import { incrementMessageCount } from "@/features/summarizer/logic/summarize";

const logger = createModuleLogger("TransferItem");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { cardId, fromPlayerId, toPlayerId } = body;

    if (!cardId || !fromPlayerId || !toPlayerId) {
      return NextResponse.json(
        { error: "cardId, fromPlayerId, toPlayerId are required" },
        { status: 400 }
      );
    }

    // ゲーム状態を取得
    const gameRef = adminDb.collection("games").doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const gameState = gameDoc.data() as GameState;

    // 議論フェーズチェック
    if (!gameState.phase.startsWith("discussion")) {
      return NextResponse.json(
        { error: "Item transfer is only allowed during discussion phase" },
        { status: 400 }
      );
    }

    // カード存在チェック
    const cardState = gameState.cards[cardId];
    if (!cardState) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // 所有権チェック
    if (cardState.ownerId !== fromPlayerId) {
      return NextResponse.json(
        { error: "You do not own this card" },
        { status: 403 }
      );
    }

    // 譲渡可能チェック
    if (!cardState.isTransferable) {
      return NextResponse.json(
        { error: "This card is not transferable" },
        { status: 400 }
      );
    }

    // 相手プレイヤー存在チェック
    if (!gameState.players[toPlayerId]) {
      return NextResponse.json(
        { error: "Target player not found" },
        { status: 404 }
      );
    }

    // シナリオからカード名とキャラクター名を取得
    let cardName = cardId;
    let fromCharName = fromPlayerId;
    let toCharName = toPlayerId;

    try {
      const scenarioDoc = await adminDb.collection("scenarios").doc(gameState.scenarioId).get();
      if (scenarioDoc.exists) {
        const scenario = scenarioDoc.data() as Scenario;
        const cardDef = scenario.data.cards?.find((c) => c.id === cardId);
        if (cardDef) cardName = cardDef.name;

        const fromChar = scenario.data.characters?.find(
          (c) => c.id === gameState.players[fromPlayerId]?.characterId
        );
        const toChar = scenario.data.characters?.find(
          (c) => c.id === gameState.players[toPlayerId]?.characterId
        );
        if (fromChar) fromCharName = fromChar.name;
        if (toChar) toCharName = toChar.name;
      }
    } catch {
      // フォールバック: IDで表示
    }

    // 所有権を移転
    await gameRef.update({
      [`cards.${cardId}.ownerId`]: toPlayerId,
      [`cards.${cardId}.location`]: `Hand(${toPlayerId})`,
    });

    // システムメッセージを投稿
    const messageId = `msg_transfer_${Date.now()}`;
    await adminDb
      .collection("games")
      .doc(gameId)
      .collection("messages")
      .doc(messageId)
      .set({
        id: messageId,
        senderId: "system",
        senderName: "システム",
        characterId: "system",
        content: `📦 ${fromCharName} が ${toCharName} に「${cardName}」を渡しました`,
        timestamp: Timestamp.now(),
      });

    // 全AIのknowledgeBaseを更新
    const agentBrainsSnapshot = await adminDb
      .collection("games")
      .doc(gameId)
      .collection("agentBrains")
      .get();

    const updatePromises = agentBrainsSnapshot.docs.map(async (doc) => {
      try {
        await doc.ref.update({
          [`knowledgeBase.cards.${cardId}.holder`]: toPlayerId,
          [`knowledgeBase.cards.${cardId}.location`]: `Hand(${toPlayerId})`,
        });
      } catch {
        // 個別のエージェント更新失敗は無視
      }
    });
    await Promise.allSettled(updatePromises);

    // サマライザー用メッセージカウント更新
    incrementMessageCount(gameId).catch(() => {});

    logger.info("Item transferred", {
      gameId,
      cardId,
      cardName,
      from: fromPlayerId,
      to: toPlayerId,
    });

    return NextResponse.json({
      success: true,
      cardName,
      fromCharName,
      toCharName,
      message: `${fromCharName} が ${toCharName} に「${cardName}」を渡しました`,
    });
  } catch (error) {
    logger.error("Item transfer failed", error as Error);
    return NextResponse.json(
      { error: "Failed to transfer item" },
      { status: 500 }
    );
  }
}
