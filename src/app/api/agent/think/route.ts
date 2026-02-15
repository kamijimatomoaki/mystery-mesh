/**
 * POST /api/agent/think
 * エージェントの思考サイクルを実行
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { executeThinkingCycle } from "@/features/agent/logic/thinking";
import type { ThinkingTrigger } from "@/features/agent/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("AgentThinkAPI");

/**
 * 思考リクエストスキーマ
 */
const ThinkRequestSchema = z.object({
  gameId: z.string().min(1),
  agentId: z.string().min(1),
  trigger: z.enum([
    "phase_change",
    "new_message",
    "timer_tick",
    "card_revealed",
    "player_joined",
    "manual",
  ]),
});

/**
 * エージェント思考API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（エージェント思考のDoS防止）
  const rateLimitResponse = await checkUserRateLimit(request, "agentAction");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, ThinkRequestSchema);

  logger.info("Agent think request", {
    gameId: validated.gameId,
    agentId: validated.agentId,
    trigger: validated.trigger,
  });

  // 思考サイクル実行
  const action = await executeThinkingCycle(
    validated.agentId,
    validated.gameId,
    validated.trigger as ThinkingTrigger
  );

  logger.info("Agent think completed", {
    gameId: validated.gameId,
    agentId: validated.agentId,
    actionType: action.type,
  });

  return NextResponse.json({
    success: true,
    action,
  });
}, "AgentThink");
