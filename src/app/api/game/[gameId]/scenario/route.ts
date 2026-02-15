/**
 * GET /api/game/[gameId]/scenario
 * ゲームコンテキスト付きシナリオ取得API
 *
 * セキュリティ対策:
 * - culpritId、trickExplanation を返さない
 * - タイムラインをプレイヤーのキャラクターに基づいてフィルタリング
 * - isCulprit フラグのみ返す（UI表示用）
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError, ValidationError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario, MasterTimelineEvent } from "@/core/types";

const logger = createModuleLogger("GameScenarioAPI");

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

/**
 * タイムラインをフィルタリング
 * - public: 全員に表示
 * - private: relatedCharacterId のキャラのみ表示
 */
function filterTimeline(
  timeline: MasterTimelineEvent[],
  characterId: string | undefined
): MasterTimelineEvent[] {
  if (!timeline) return [];

  return timeline.filter((event) => {
    // 後方互換: visibility 未定義の場合は public として扱う
    const visibility = event.visibility || "public";

    // public は全員に見せる
    if (visibility === "public") return true;

    // private は関連キャラのみ（犯人も無実も同じルール）
    if (visibility === "private") {
      return event.relatedCharacterId === characterId;
    }

    return false;
  });
}

/**
 * ゲームコンテキスト付きシナリオを取得
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  context: RouteContext
) => {
  const { gameId } = await context.params;

  // クエリパラメータからuserIdを取得
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    throw new ValidationError("userId is required");
  }

  logger.info("Fetching game scenario with context", { gameId, userId });

  // 1. ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", gameId);
  }

  const game = gameDoc.data() as GameState;

  // 2. シナリオを取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();

  if (!scenarioDoc.exists) {
    throw new NotFoundError("Scenario", game.scenarioId);
  }

  const scenario = scenarioDoc.data() as Scenario;

  // 3. ユーザーのキャラクターIDを取得
  const player = game.players[userId];
  if (!player) {
    throw new ValidationError(`User ${userId} is not a player in this game`);
  }
  const characterId = player.characterId;

  // 4. 犯人かどうか判定
  const isCulprit = characterId === scenario.data.truth.culpritId;

  // 5. フェーズに応じてシナリオをフィルタリング
  let filteredScenario: Scenario;

  if (game.phase === "ended" || game.phase === "ending") {
    // エンディング: 真相を全て公開（culpritId, trickExplanation含む）
    filteredScenario = {
      ...scenario,
      data: {
        ...scenario.data,
        truth: {
          culpritId: scenario.data.truth.culpritId,
          victimId: scenario.data.truth.victimId,
          trickExplanation: scenario.data.truth.trickExplanation,
          masterTimeline: scenario.data.truth.masterTimeline || [],
        },
      },
    };
  } else {
    // ゲーム中: 従来通りフィルタリング（culpritId, trickExplanation は返さない）
    filteredScenario = {
      ...scenario,
      data: {
        ...scenario.data,
        truth: {
          culpritId: "", // 空文字列で上書き
          victimId: scenario.data.truth.victimId,
          trickExplanation: "", // 空文字列で上書き
          masterTimeline: filterTimeline(
            scenario.data.truth.masterTimeline,
            characterId
          ),
        },
      },
    };
  }

  logger.info("Game scenario fetched successfully", {
    gameId,
    userId,
    characterId,
    isCulprit,
    originalTimelineCount: scenario.data.truth.masterTimeline?.length || 0,
    filteredTimelineCount: filteredScenario.data.truth.masterTimeline.length,
  });

  return NextResponse.json({
    scenario: filteredScenario,
    isCulprit,
  });
}, "GameScenarioAPI");
