/**
 * GET /api/scenario/[id]
 * シナリオ詳細を取得
 *
 * 優先順位:
 * 1. Firestore (本番データ)
 * 2. モックデータ (開発環境のみ、フォールバック)
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { getScenarioById as getMockScenarioById } from "@/core/mock/scenarios";
import type { Scenario } from "@/core/types";
import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("ScenarioAPI");

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "シナリオIDが必要です" },
        { status: 400 }
      );
    }

    // Firestoreから取得（優先）
    const scenarioDoc = await adminDb.collection("scenarios").doc(id).get();

    if (scenarioDoc.exists) {
      const scenario = scenarioDoc.data() as Scenario;
      logger.info("Scenario fetched from Firestore", { id });
      return NextResponse.json({ scenario });
    }

    // Firestoreに存在しない場合、開発環境のみモックをフォールバック
    if (process.env.NODE_ENV !== "production") {
      const mockScenario = getMockScenarioById(id);
      if (mockScenario) {
        logger.debug("Scenario fetched from mock (development fallback)", { id });
        return NextResponse.json({ scenario: mockScenario });
      }
    }

    logger.warn("Scenario not found", { id });
    return NextResponse.json(
      { error: "シナリオが見つかりません" },
      { status: 404 }
    );
  } catch (error) {
    logger.error("Scenario fetch error", error as Error);
    return NextResponse.json(
      { error: "シナリオの取得に失敗しました" },
      { status: 500 }
    );
  }
}
