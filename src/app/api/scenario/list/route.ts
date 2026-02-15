/**
 * GET /api/scenario/list
 * 公開シナリオのリスト + マイシナリオのリストを取得するAPI
 *
 * クエリパラメータ:
 * - tab: "public" (デフォルト) | "mine"
 * - userId: マイライブラリ用のユーザーID（tab=mine時に必須）
 * - limit, orderBy, tags, difficulty: 公開シナリオ用フィルタ
 */

import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { listPublishedScenarios } from "@/features/scenario/logic/publish";
import { checkUserRateLimit } from "@/core/security/middleware";
import { adminDb } from "@/core/db/firestore-admin";
import type { Scenario } from "@/core/types";

const logger = createModuleLogger("ScenarioListAPI");

/**
 * マイシナリオの要約型（クライアント表示用）
 */
interface MyScenarioSummary {
  id: string;
  title: string;
  description: string;
  genre: string;
  difficulty: string;
  artStyle: string;
  status: string;
  jobId?: string;
  isPublished: boolean;
  createdAt: number;
}

/**
 * シナリオリスト取得API
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "loose");
  if (rateLimitResponse) return rateLimitResponse;

  // クエリパラメータを取得
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "public";

  // マイライブラリ
  if (tab === "mine") {
    const userId = searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required for tab=mine" },
        { status: 400 }
      );
    }

    logger.info("My scenario list request", { userId });

    // scenariosコレクションからauthorIdでフィルタ（orderByはJS側でソート、コンポジットインデックス不要）
    const snapshot = await adminDb
      .collection("scenarios")
      .where("authorId", "==", userId)
      .limit(50)
      .get();

    const scenarios: MyScenarioSummary[] = snapshot.docs
      .map((doc) => {
        const data = doc.data() as Scenario;
        return {
          id: data.id,
          title: data.meta?.title || "無題",
          description: data.meta?.description || "",
          genre: data.meta?.genre || "",
          difficulty: data.meta?.difficulty || "normal",
          artStyle: data.meta?.artStyle || "anime",
          status: data.status || (data.isPublished ? "published" : "ready"),
          jobId: data.jobId,
          isPublished: data.isPublished || false,
          createdAt: data.createdAt?.toMillis?.() || 0,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    logger.info("My scenario list retrieved", { count: scenarios.length });

    return NextResponse.json({
      success: true,
      count: scenarios.length,
      scenarios,
    });
  }

  // 公開シナリオ（既存ロジック）
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const orderBy = (searchParams.get("orderBy") || "publishedAt") as
    | "playCount"
    | "likeCount"
    | "publishedAt"
    | "averageRating";
  const tags = searchParams.get("tags")?.split(",").filter(Boolean);
  const difficulty = searchParams.get("difficulty") as "easy" | "medium" | "hard" | undefined;

  logger.info("Scenario list request", { limit, orderBy, tags, difficulty });

  // 公開シナリオのリストを取得
  const scenarios = await listPublishedScenarios({
    limit,
    orderBy,
    tags,
    difficulty,
  });

  logger.info("Scenario list retrieved", { count: scenarios.length });

  return NextResponse.json({
    success: true,
    count: scenarios.length,
    scenarios,
  });
}, "ScenarioList");
