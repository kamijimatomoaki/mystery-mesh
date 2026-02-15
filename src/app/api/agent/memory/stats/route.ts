/**
 * GET /api/agent/memory/stats
 * エージェントの記憶統計を取得
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import { withErrorHandler } from "@/core/utils/errors";
import { validateRequest } from "@/core/validation/helpers";
import { calculateMemoryStats } from "@/features/agent/logic/memory";

const logger = createModuleLogger("api-agent-memory-stats");

// クエリパラメータのスキーマ
const StatsQuerySchema = z.object({
  gameId: z.string().min(1),
  agentId: z.string().min(1),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);

  const query = {
    gameId: searchParams.get("gameId"),
    agentId: searchParams.get("agentId"),
  };

  const validated = validateRequest(query, StatsQuerySchema);

  logger.info("Memory stats request", {
    gameId: validated.gameId,
    agentId: validated.agentId,
  });

  const stats = await calculateMemoryStats(
    validated.gameId,
    validated.agentId
  );

  logger.info("Memory stats calculated", {
    agentId: validated.agentId,
    stats,
  });

  return NextResponse.json({
    success: true,
    stats,
  });
}, "AgentMemoryStats");
