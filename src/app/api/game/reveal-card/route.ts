/**
 * POST /api/game/reveal-card
 * カード公開API
 *
 * カードを公開し、チャットにシステムメッセージを投稿、
 * 全AIエージェントの知識ベースに公開情報を追加
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { checkUserRateLimit } from "@/core/security/middleware";
import { revealCardInternal } from "@/features/game/actions/reveal-card";

const RevealCardRequestSchema = z.object({
  gameId: z.string().min(1),
  cardId: z.string().min(1),
  playerId: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "standard");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, RevealCardRequestSchema);

  const { gameId, cardId, playerId } = validated;

  try {
    const result = await revealCardInternal(gameId, cardId, playerId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "カード公開に失敗しました";
    if (message.includes("見つかりません")) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message } }, { status: 404 });
    }
    if (message.includes("所持していない")) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message } }, { status: 403 });
    }
    throw error;
  }
}, "RevealCard");
