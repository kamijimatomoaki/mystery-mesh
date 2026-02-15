/**
 * GET /api/scenario/status?jobId=xxx
 * シナリオ生成ジョブの状態を確認
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Missing jobId parameter" },
        { status: 400 }
      );
    }

    const jobDoc = await adminDb.collection("scenarioJobs").doc(jobId).get();

    if (!jobDoc.exists) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const job = jobDoc.data();

    return NextResponse.json({
      status: job?.status,
      progress: job?.progress,
      result: job?.result,
      error: job?.error
    });

  } catch (error) {
    console.error("[API] Scenario status error:", error);

    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}
