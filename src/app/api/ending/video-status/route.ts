/**
 * GET /api/ending/video-status?jobId=xxx
 * エンディング動画生成ステータス確認API
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError, ValidationError } from "@/core/utils/errors";
import { validateQuery } from "@/core/validation/helpers";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("VideoStatus");

const VideoStatusQuerySchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
});

/**
 * 動画生成ステータス確認
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const validated = validateQuery(searchParams, VideoStatusQuerySchema);
  const jobId = validated.jobId;

  logger.info("Video status check", { jobId });

  // ジョブ取得
  const jobDoc = await adminDb.collection("videoJobs").doc(jobId).get();

  if (!jobDoc.exists) {
    throw new NotFoundError("VideoJob", jobId);
  }

  const job = jobDoc.data();

  return NextResponse.json({
    jobId,
    status: job?.status,
    progress: job?.progress,
    videoUrl: job?.videoUrl,
    error: job?.error,
    createdAt: job?.createdAt?.toMillis(),
    updatedAt: job?.updatedAt?.toMillis(),
  });
}, "VideoStatus");
