/**
 * GET /api/ending/secrets?gameId=xxx
 * 全カードの公開情報 + 秘密情報をエンディング用に取得
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { validateQuery } from "@/core/validation/helpers";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario, CardDefinition } from "@/core/types";
import type { EndingCard } from "@/features/ending/types";

const logger = createModuleLogger("EndingSecrets");

const SecretsQuerySchema = z.object({
  gameId: z.string().min(1, "gameId is required"),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const validated = validateQuery(searchParams, SecretsQuerySchema);

  logger.info("Fetching secrets", { gameId: validated.gameId });

  // ゲーム情報を取得
  const gameDoc = await adminDb.collection("games").doc(validated.gameId).get();
  if (!gameDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }
  const game = gameDoc.data() as GameState;

  // シナリオを取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  if (!scenarioDoc.exists) {
    throw new NotFoundError("Scenario", game.scenarioId);
  }
  const scenario = scenarioDoc.data() as Scenario;

  const characterMap = new Map(
    scenario.data.characters.map((c) => [c.id, c.name])
  );

  // ゲーム中のカード状態と照合
  const gameCards = game.cards || {};

  const endingCards: EndingCard[] = scenario.data.cards.map((card) => {
    const gameCardState = gameCards[card.id];
    const wasObtained = !!gameCardState?.ownerId;
    const wasRevealed = !!gameCardState?.isRevealed;

    // 取得者のキャラクター名を解決
    let obtainedBy: string | null = null;
    if (gameCardState?.ownerId) {
      const ownerPlayer = game.players[gameCardState.ownerId];
      if (ownerPlayer?.characterId) {
        obtainedBy = characterMap.get(ownerPlayer.characterId) || ownerPlayer.displayName;
      } else {
        obtainedBy = ownerPlayer?.displayName || gameCardState.ownerId;
      }
    }

    return {
      id: card.id,
      name: card.name,
      type: card.type,
      slotType: card.slotType,
      location: card.location,
      relatedCharacterName: card.relatedCharacterId
        ? characterMap.get(card.relatedCharacterId) || null
        : null,
      secret: {
        title: card.secret.title,
        description: card.secret.description,
        importanceLevel: card.secret.importanceLevel,
        misleadNote: card.secret.misleadNote,
      },
      wasObtained,
      obtainedBy,
      wasRevealed,
    };
  });

  // 重要度順にソート
  endingCards.sort((a, b) => b.secret.importanceLevel - a.secret.importanceLevel);

  return NextResponse.json({
    cards: endingCards,
    totalCards: endingCards.length,
    obtainedCount: endingCards.filter((c) => c.wasObtained).length,
    revealedCount: endingCards.filter((c) => c.wasRevealed).length,
  });
}, "EndingSecrets");
