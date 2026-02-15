/**
 * GET /api/ending/relationships?gameId=xxx
 * 全AIエージェントの関係性マトリクスを取得
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { validateQuery } from "@/core/validation/helpers";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario } from "@/core/types";
import type { RelationshipEdge, RelationshipNode } from "@/features/ending/types";

const logger = createModuleLogger("EndingRelationships");

const RelationshipsQuerySchema = z.object({
  gameId: z.string().min(1, "gameId is required"),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const validated = validateQuery(searchParams, RelationshipsQuerySchema);

  logger.info("Fetching relationships", { gameId: validated.gameId });

  // ゲーム情報を取得
  const gameDoc = await adminDb.collection("games").doc(validated.gameId).get();
  if (!gameDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }
  const game = gameDoc.data() as GameState;

  // シナリオからキャラクター名を取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  if (!scenarioDoc.exists) {
    throw new NotFoundError("Scenario", game.scenarioId);
  }
  const scenario = scenarioDoc.data() as Scenario;

  const characterMap = new Map(
    scenario.data.characters.map((c) => [c.id, c.name])
  );

  // 全AgentBrainを取得
  const brainsSnapshot = await adminDb
    .collection("games")
    .doc(validated.gameId)
    .collection("agentBrains")
    .get();

  const nodes: RelationshipNode[] = [];
  const edges: RelationshipEdge[] = [];

  // プレイヤーノードを作成
  for (const [playerId, player] of Object.entries(game.players)) {
    nodes.push({
      characterId: player.characterId,
      characterName: characterMap.get(player.characterId) || player.displayName,
      isHuman: player.isHuman,
      emotionalState: "calm",
    });
  }

  // エッジを作成
  for (const brainDoc of brainsSnapshot.docs) {
    const brain = brainDoc.data();
    const fromCharacterId = brain.characterId;
    const fromName = brain.characterName || characterMap.get(fromCharacterId) || fromCharacterId;

    // emotionalStateをノードに反映
    const node = nodes.find((n) => n.characterId === fromCharacterId);
    if (node) {
      node.emotionalState = brain.emotionalState || "calm";
    }

    // 関係性からエッジを生成
    const relationships = brain.relationships || {};
    for (const [targetId, rel] of Object.entries(relationships)) {
      const relationship = rel as { trust: number; suspicion: number; note: string };
      edges.push({
        fromId: fromCharacterId,
        fromName,
        toId: targetId,
        toName: characterMap.get(targetId) || targetId,
        trust: relationship.trust ?? 50,
        suspicion: relationship.suspicion ?? 50,
        note: relationship.note || "",
      });
    }
  }

  return NextResponse.json({ nodes, edges });
}, "EndingRelationships");
