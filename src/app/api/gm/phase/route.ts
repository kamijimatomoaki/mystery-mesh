/**
 * POST /api/gm/phase
 * フェーズ遷移API
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { validateRequest } from "@/core/validation/helpers";
import { createModuleLogger } from "@/core/utils/logger";
import {
  transitionPhase,
  getPhaseTimer,
  checkTimerExpired,
  checkConditionTransition,
} from "@/features/gm/logic/phases";

const logger = createModuleLogger("GMPhase");

// リクエストスキーマ
const PhaseTransitionRequestSchema = z.object({
  gameId: z.string().min(1, "gameId is required"),
  action: z.enum(["transition", "get_timer", "check_expired", "check_condition"]),
  triggeredBy: z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = validateRequest(body, PhaseTransitionRequestSchema);

  logger.info("Phase request", { gameId: validated.gameId, action: validated.action });

  switch (validated.action) {
    case "transition": {
      const nextPhase = await transitionPhase(
        validated.gameId,
        "manual",
        validated.triggeredBy
      );

      return NextResponse.json({
        success: true,
        nextPhase,
        message: nextPhase ? `Transitioned to ${nextPhase}` : "Game ended",
      });
    }

    case "get_timer": {
      const timer = await getPhaseTimer(validated.gameId);

      return NextResponse.json({
        success: true,
        timer,
      });
    }

    case "check_expired": {
      const expired = await checkTimerExpired(validated.gameId);

      return NextResponse.json({
        success: true,
        expired,
        message: expired ? "Timer expired, phase transitioned" : "Timer still active",
      });
    }

    case "check_condition": {
      const transitioned = await checkConditionTransition(validated.gameId);

      return NextResponse.json({
        success: true,
        transitioned,
        message: transitioned ? "Condition met, phase transitioned" : "Condition not met",
      });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}, "GMPhase");
