/**
 * POST /api/agent/solve
 * AIによるミステリー解決API
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { solveMystery, verifySolution } from "@/features/agent/logic/solver";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("SolverAPI");

/**
 * Solver リクエストスキーマ
 */
const SolveRequestSchema = z.object({
  gameId: z.string().min(1),
  verifyAnswer: z.boolean().default(true), // 真相と答え合わせするか
});

/**
 * AIによるミステリー解決API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check（Solverは重い処理なので厳しい制限）
  const rateLimitResponse = await checkUserRateLimit(request, "strict");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, SolveRequestSchema);

  logger.info("Solver request", { gameId: validated.gameId, verifyAnswer: validated.verifyAnswer });

  // AIによる推理実行
  const solveResult = await solveMystery(validated.gameId);

  logger.info("Solver completed", {
    gameId: validated.gameId,
    culpritId: solveResult.culpritId,
    confidence: solveResult.confidence,
  });

  // 真相と答え合わせ
  let verification = null;
  if (validated.verifyAnswer) {
    verification = await verifySolution(validated.gameId, solveResult);

    logger.info("Solution verified", {
      gameId: validated.gameId,
      isCorrect: verification.isCorrect,
    });
  }

  return NextResponse.json({
    success: true,
    solveResult,
    verification,
  });
}, "SolverSolve");
