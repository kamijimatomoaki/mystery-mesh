/**
 * GET /api/ending/profiling?gameId=xxx&humanPlayerId=xxx
 * 各AIエージェントが人間プレイヤーに対して行ったプロファイリング結果を取得
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { validateQuery } from "@/core/validation/helpers";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario } from "@/core/types";

const logger = createModuleLogger("EndingProfiling");

const ProfilingQuerySchema = z.object({
  gameId: z.string().min(1, "gameId is required"),
  humanPlayerId: z.string().min(1, "humanPlayerId is required"),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const validated = validateQuery(searchParams, ProfilingQuerySchema);

  logger.info("Fetching profiling data", {
    gameId: validated.gameId,
    humanPlayerId: validated.humanPlayerId,
  });

  // ゲーム情報を取得
  const gameDoc = await adminDb.collection("games").doc(validated.gameId).get();
  if (!gameDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }
  const game = gameDoc.data() as GameState;

  // シナリオからキャラクター名マップを作成
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  const characterMap = new Map<string, string>();
  if (scenarioDoc.exists) {
    const scenario = scenarioDoc.data() as Scenario;
    scenario.data.characters.forEach((c) => characterMap.set(c.id, c.name));
  }

  // 全AgentBrainを取得してhumanProfilesを抽出
  const brainsSnapshot = await adminDb
    .collection("games")
    .doc(validated.gameId)
    .collection("agentBrains")
    .get();

  const profiles: Array<{
    agentId: string;
    agentCharacterName: string;
    profile: {
      suspectedCharacters: Array<{
        characterId: string;
        estimatedSuspicion: number;
        reason: string;
        confidence: number;
      }>;
      behaviorAnalysis: {
        speakingFrequency: number;
        aggressiveness: number;
        defensiveness: number;
        logicalReasoning: number;
      };
      predictedRole: {
        isCulprit: boolean;
        confidence: number;
        reasoning: string;
      };
    };
  }> = [];

  for (const brainDoc of brainsSnapshot.docs) {
    const brain = brainDoc.data();
    const agentCharacterId = brain.characterId;
    const agentCharacterName =
      brain.characterName || characterMap.get(agentCharacterId) || agentCharacterId;

    // humanProfilesから対象プレイヤーのプロファイルを探す
    const humanProfiles = brain.humanProfiles || {};
    const targetProfile = humanProfiles[validated.humanPlayerId];

    if (targetProfile) {
      profiles.push({
        agentId: brainDoc.id,
        agentCharacterName,
        profile: {
          suspectedCharacters: targetProfile.suspectedCharacters || [],
          behaviorAnalysis: targetProfile.behaviorAnalysis || {
            speakingFrequency: 0,
            aggressiveness: 50,
            defensiveness: 50,
            logicalReasoning: 50,
          },
          predictedRole: targetProfile.predictedRole || {
            isCulprit: false,
            confidence: 0,
            reasoning: "データなし",
          },
        },
      });
    } else {
      // humanProfilesがなくても、関係性データから簡易プロファイルを生成
      const relationships = brain.relationships || {};
      const humanPlayer = game.players[validated.humanPlayerId];
      const humanCharacterId = humanPlayer?.characterId;

      if (humanCharacterId && relationships[humanCharacterId]) {
        const rel = relationships[humanCharacterId] as {
          trust: number;
          suspicion: number;
          note: string;
        };
        profiles.push({
          agentId: brainDoc.id,
          agentCharacterName,
          profile: {
            suspectedCharacters: [],
            behaviorAnalysis: {
              speakingFrequency: 0,
              aggressiveness: 50,
              defensiveness: 50,
              logicalReasoning: 50,
            },
            predictedRole: {
              isCulprit: rel.suspicion > 70,
              confidence: rel.suspicion,
              reasoning: rel.note || `信頼度: ${rel.trust}, 疑惑度: ${rel.suspicion}`,
            },
          },
        });
      }
    }
  }

  return NextResponse.json({ profiles });
}, "EndingProfiling");
