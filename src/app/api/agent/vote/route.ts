/**
 * POST /api/agent/vote
 * AIエージェントの投票を実行
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import {
  executeAgentVoting,
  executeAllAgentVoting,
} from "@/features/agent/logic/voting";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("AgentVoteAPI");

/**
 * 投票リクエストスキーマ
 */
const VoteRequestSchema = z.object({
  gameId: z.string().min(1),
  agentId: z.string().optional(), // 省略時は全AIエージェントが投票
});

/**
 * エージェント投票API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "agentAction");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, VoteRequestSchema);

  logger.info("Agent vote request", {
    gameId: validated.gameId,
    agentId: validated.agentId || "all",
  });

  if (validated.agentId) {
    // 単一エージェントの投票
    const decision = await executeAgentVoting(
      validated.agentId,
      validated.gameId
    );

    logger.info("Agent vote completed", {
      gameId: validated.gameId,
      agentId: validated.agentId,
      target: decision.targetCharacterId,
    });

    return NextResponse.json({
      success: true,
      decision,
    });
  } else {
    // 全AIエージェントの投票
    await executeAllAgentVoting(validated.gameId);

    logger.info("All agent votes completed", {
      gameId: validated.gameId,
    });

    return NextResponse.json({
      success: true,
      message: "All AI agents have voted",
    });
  }
}, "AgentVote");
