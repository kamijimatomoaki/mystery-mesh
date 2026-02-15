/**
 * POST /api/game/update-summary
 * 議論サマリーの更新API（内部API、cronから呼び出し）
 */

import { NextRequest, NextResponse } from "next/server";
import { createModuleLogger } from "@/core/utils/logger";
import {
  shouldUpdateSummary,
  updateDiscussionSummary,
} from "@/features/summarizer/logic/summarize";

const logger = createModuleLogger("UpdateSummaryAPI");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId } = body;

    if (!gameId || typeof gameId !== "string") {
      return NextResponse.json(
        { error: "gameId is required" },
        { status: 400 }
      );
    }

    // 更新が必要か判定
    const needsUpdate = await shouldUpdateSummary(gameId);
    if (!needsUpdate) {
      return NextResponse.json({
        success: true,
        updated: false,
        reason: "Not enough new messages",
      });
    }

    // サマリー更新
    const success = await updateDiscussionSummary(gameId);

    return NextResponse.json({
      success,
      updated: success,
    });
  } catch (error) {
    logger.error("Update summary failed", error as Error);
    return NextResponse.json(
      { error: "Failed to update summary" },
      { status: 500 }
    );
  }
}
