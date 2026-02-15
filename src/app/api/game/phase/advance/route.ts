/**
 * POST /api/game/phase/advance
 * フェーズ遷移API（手動進行）
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError, AuthorizationError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { transitionPhase } from "@/features/gm/logic/phases";
import { adminDb } from "@/core/db/firestore-admin";
import type { GameState } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("PhaseAdvance");

/**
 * フェーズ進行リクエストスキーマ
 */
const AdvancePhaseRequestSchema = z.object({
  gameId: z.string().min(1),
  requestedBy: z.string().min(1), // プレイヤーID
});

/**
 * フェーズを手動で進める
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, AdvancePhaseRequestSchema);

  logger.info("Phase advance requested", { gameId: validated.gameId, requestedBy: validated.requestedBy });

  // ゲーム取得
  const gameDoc = await adminDb.collection("games").doc(validated.gameId).get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }

  const game = gameDoc.data() as GameState;

  // 権限チェック: ホストのみ
  if (game.hostId !== validated.requestedBy) {
    throw new AuthorizationError("ホストのみがフェーズを進められます");
  }

  // フェーズ遷移実行
  const newPhase = await transitionPhase(validated.gameId, "manual", validated.requestedBy);

  if (!newPhase) {
    return NextResponse.json({
      success: false,
      message: "これ以上フェーズを進められません（ゲーム終了）",
    });
  }

  logger.info("Phase advanced successfully", { gameId: validated.gameId, newPhase });

  return NextResponse.json({
    success: true,
    message: `フェーズを ${newPhase} に進めました`,
    newPhase,
  });
}, "PhaseAdvance");
