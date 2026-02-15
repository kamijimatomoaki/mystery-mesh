/**
 * POST /api/agent/memory/suspicion
 * エージェントの疑惑度を更新
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import { withErrorHandler } from "@/core/utils/errors";
import { validateRequest } from "@/core/validation/helpers";
import { updateSuspicionLevel } from "@/features/agent/logic/memory";

const logger = createModuleLogger("api-agent-memory-suspicion");

// リクエストスキーマ
const SuspicionRequestSchema = z.object({
  gameId: z.string().min(1),
  agentId: z.string().min(1),
  targetCharacterId: z.string().min(1),
  delta: z.number().min(-100).max(100),
  reason: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = validateRequest(body, SuspicionRequestSchema);

  logger.info("Suspicion update request", {
    gameId: validated.gameId,
    agentId: validated.agentId,
    targetCharacterId: validated.targetCharacterId,
    delta: validated.delta,
  });

  await updateSuspicionLevel(
    validated.gameId,
    validated.agentId,
    validated.targetCharacterId,
    validated.delta,
    validated.reason
  );

  logger.info("Suspicion updated", {
    agentId: validated.agentId,
    targetCharacterId: validated.targetCharacterId,
    delta: validated.delta,
  });

  return NextResponse.json({
    success: true,
    message: "Suspicion level updated successfully",
  });
}, "AgentMemorySuspicion");
