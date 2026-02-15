/**
 * GET /api/ending/status?jobId=xxx
 * エンディング生成ステータス確認
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { withErrorHandler, NotFoundError } from "@/core/utils/errors";
import { validateQuery } from "@/core/validation/helpers";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("EndingStatus");

const EndingStatusQuerySchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const validated = validateQuery(searchParams, EndingStatusQuerySchema);

  logger.info("Ending status check", { jobId: validated.jobId });

  const jobDoc = await adminDb.collection("endingJobs").doc(validated.jobId).get();

  if (!jobDoc.exists) {
    throw new NotFoundError("EndingJob", validated.jobId);
  }

  const job = jobDoc.data();

  return NextResponse.json({
    status: job?.status,
    progress: job?.progress,
    result: job?.result,
    error: job?.error,
  });
}, "EndingStatus");
