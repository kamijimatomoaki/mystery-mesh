/**
 * POST /api/test/timeline
 * タイムライン生成のテストエンドポイント
 */

import { NextRequest, NextResponse } from "next/server";
import { generateMasterTimeline } from "@/features/scenario/generators/timeline";
import { z } from "zod";

const TestTimelineRequestSchema = z.object({
  genre: z.string().default("Mansion"),
  playerCount: z.number().min(3).max(8).default(4),
  difficulty: z.enum(["easy", "normal", "hard"]).default("normal")
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = TestTimelineRequestSchema.parse(body);

    console.log("[Test Timeline] Starting with params:", validated);

    const timeline = await generateMasterTimeline({
      ...validated,
      userId: "test_user",
      userName: "Test User"
    });

    console.log("[Test Timeline] Success:", {
      culprit: timeline.culpritId,
      eventsCount: timeline.masterTimeline.length
    });

    return NextResponse.json({
      success: true,
      timeline
    });

  } catch (error) {
    console.error("[Test Timeline] Error:", error);

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
