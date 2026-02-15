/**
 * POST /api/agent/heartbeat
 * ハートビート方式によるAI発言エンドポイント
 * 各AIが独立して定期的に呼び出し、発言すべきかを判断して発言する
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateRequest } from "@/core/validation/helpers";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { adminDb } from "@/core/db/firestore-admin";
import { executeThinkingCycle } from "@/features/agent/logic/thinking";
import { executeAgentAction } from "@/features/gm/logic/agent-actions";
import { revealCardInternal } from "@/features/game/actions/reveal-card";
import type { GameState } from "@/core/types";

const logger = createModuleLogger("AgentHeartbeat");

const HeartbeatRequestSchema = z.object({
  gameId: z.string().min(1),
  agentId: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const { gameId, agentId } = validateRequest(body, HeartbeatRequestSchema);

  logger.info("Heartbeat received", { gameId, agentId });

  // 1. ゲーム状態チェック
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    return NextResponse.json({ spoke: false, reason: "not_found" });
  }

  const game = gameDoc.data() as GameState;

  // 2. フェーズチェック（discussionフェーズのみ）
  if (!game.phase.startsWith("discussion")) {
    return NextResponse.json({ spoke: false, reason: "wrong_phase" });
  }

  // 3. 思考サイクルを実行
  try {
    const action = await executeThinkingCycle(agentId, gameId, "heartbeat");

    // 4. アクションに応じて処理
    if (action.type === "talk" && action.content) {
      // 発言アクション
      await executeAgentAction(gameId, agentId, action);

      logger.info("Heartbeat: agent spoke", {
        gameId,
        agentId,
        contentLength: action.content.length,
      });

      return NextResponse.json({ spoke: true });
    }

    if (action.type === "reveal_card" && action.targetCardId) {
      // カード公開アクション
      const playerId = agentId.replace("agent_", "");
      try {
        const result = await revealCardInternal(gameId, action.targetCardId, playerId);
        logger.info("Heartbeat: agent revealed card", {
          gameId,
          agentId,
          cardId: action.targetCardId,
          cardName: result.cardName,
        });
        return NextResponse.json({ spoke: true, action: "reveal_card", cardName: result.cardName });
      } catch (error) {
        logger.warn("Heartbeat: card reveal failed, falling back to talk", {
          gameId, agentId, cardId: action.targetCardId,
          error: error instanceof Error ? error.message : "unknown",
        });
        // カード公開失敗 → フォールバック: plannedStatementで発言する
        if (action.content) {
          const fallbackAction = {
            type: "talk" as const,
            content: action.content,
            emotion: action.emotion,
            reason: "reveal_card fallback",
          };
          await executeAgentAction(gameId, agentId, fallbackAction);
          logger.info("Heartbeat: agent spoke (fallback from reveal)", {
            gameId, agentId, contentLength: action.content.length,
          });
          return NextResponse.json({ spoke: true, action: "talk_fallback" });
        }
        return NextResponse.json({ spoke: false, reason: "reveal_failed" });
      }
    }

    // 5. 発言しなかった場合
    logger.debug("Heartbeat: agent chose not to speak", {
      gameId,
      agentId,
      actionType: action.type,
    });

    return NextResponse.json({ spoke: false, reason: "no_speech" });
  } catch (error) {
    logger.error("Heartbeat thinking cycle failed", error as Error, {
      gameId,
      agentId,
    });

    return NextResponse.json({ spoke: false, reason: "error" });
  }
}, "AgentHeartbeat");
