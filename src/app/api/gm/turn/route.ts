/**
 * POST /api/gm/turn
 * Turn Manager API（Urgency Score）
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  calculateUrgencyScore,
  calculateAllUrgencyScores,
  getNextSpeaker,
} from "@/features/gm/logic/urgency";

// リクエストスキーマ
const TurnRequestSchema = z.object({
  gameId: z.string(),
  action: z.enum(["calculate", "calculate_all", "next_speaker"]),
  agentId: z.string().optional(), // "calculate" の場合は必須
  threshold: z.number().min(0).max(100).optional(), // デフォルト: 50
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = TurnRequestSchema.parse(body);

    console.log("[API] Turn request:", validated);

    const threshold = validated.threshold ?? 50;

    switch (validated.action) {
      case "calculate":
        // 特定エージェントのUrgency Score計算
        if (!validated.agentId) {
          return NextResponse.json(
            { error: "agentId is required for 'calculate' action" },
            { status: 400 }
          );
        }

        const score = await calculateUrgencyScore(
          validated.gameId,
          validated.agentId,
          threshold
        );

        return NextResponse.json({
          success: true,
          score,
        });

      case "calculate_all":
        // 全AIエージェントのUrgency Score計算
        const scores = await calculateAllUrgencyScores(validated.gameId);

        return NextResponse.json({
          success: true,
          scores,
        });

      case "next_speaker":
        // 次に発言すべきエージェントを取得
        const nextSpeaker = await getNextSpeaker(validated.gameId, threshold);

        return NextResponse.json({
          success: true,
          nextSpeaker,
          message: nextSpeaker
            ? `Agent ${nextSpeaker} should speak`
            : "No agent needs to speak",
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[API] Turn error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}
