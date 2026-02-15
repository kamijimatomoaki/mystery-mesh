/**
 * GET /api/ending/action-logs?gameId=xxx
 * 行動ログと真相タイムラインの比較データを取得
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { validateQuery } from "@/core/validation/helpers";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario, ActionLog } from "@/core/types";

const logger = createModuleLogger("EndingActionLogs");

const ActionLogsQuerySchema = z.object({
  gameId: z.string().min(1, "gameId is required"),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const validated = validateQuery(searchParams, ActionLogsQuerySchema);

  logger.info("Fetching action logs for ending", { gameId: validated.gameId });

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

  // キャラクター名マップ
  const characterMap = new Map(
    scenario.data.characters.map((c) => [c.id, c.name])
  );

  // 行動ログを取得
  const logsSnapshot = await adminDb
    .collection("games")
    .doc(validated.gameId)
    .collection("logs")
    .orderBy("timestamp", "asc")
    .get();

  const actionLogs = logsSnapshot.docs.map((doc) => {
    const data = doc.data() as ActionLog;
    return {
      id: data.id,
      actorId: data.actorId,
      characterId: data.characterId,
      characterName: data.characterName || characterMap.get(data.characterId) || data.characterId,
      type: data.type,
      targetId: data.targetId,
      location: data.location,
      content: data.content,
      phase: data.phase,
      timestamp: data.timestamp?.toMillis?.() || 0,
    };
  });

  // 真相タイムライン
  const truthTimeline = scenario.data.truth.masterTimeline.map((event) => ({
    time: event.time,
    event: event.event,
    isTrue: event.isTrue,
    relatedCharacterName: event.relatedCharacterId
      ? characterMap.get(event.relatedCharacterId) || event.relatedCharacterId
      : null,
  }));

  return NextResponse.json({
    actionLogs,
    truthTimeline,
    culpritName: characterMap.get(scenario.data.truth.culpritId) || "不明",
  });
}, "EndingActionLogs");
