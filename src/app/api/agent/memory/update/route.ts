/**
 * POST /api/agent/memory/update
 * エージェントの記憶を手動で更新
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import { withErrorHandler } from "@/core/utils/errors";
import { validateRequest } from "@/core/validation/helpers";
import { updateAgentMemory } from "@/features/agent/logic/memory";
import { perceiveGameState } from "@/features/agent/logic/thinking";

const logger = createModuleLogger("api-agent-memory-update");

// リクエストスキーマ
const UpdateRequestSchema = z.object({
  gameId: z.string().min(1),
  agentId: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = validateRequest(body, UpdateRequestSchema);

  logger.info("Memory update request", {
    gameId: validated.gameId,
    agentId: validated.agentId,
  });

  // ゲーム状態を知覚
  const perception = await perceiveGameState(
    validated.agentId,
    validated.gameId
  );

  // 記憶を更新
  const result = await updateAgentMemory(
    validated.agentId,
    validated.gameId,
    perception
  );

  logger.info("Memory update completed", {
    agentId: validated.agentId,
    changes: result.updateEvent.changes,
  });

  return NextResponse.json({
    success: true,
    updateEvent: result.updateEvent,
    stats: {
      knownCardsCount: Object.keys(result.knowledgeBase.cards).length,
      factsCount: result.knowledgeBase.knownFacts.length,
      contradictionsCount: result.knowledgeBase.contradictions.length,
      relationshipsCount: Object.keys(result.relationships).length,
    },
  });
}, "AgentMemoryUpdate");
