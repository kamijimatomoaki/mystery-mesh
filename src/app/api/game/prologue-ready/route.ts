/**
 * POST /api/game/prologue-ready
 * プロローグ準備完了API
 *
 * プレイヤーがプロローグを確認完了した際に呼び出す。
 * 全員が準備完了になったら自動でフェーズ遷移する。
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/core/db/firestore-admin";
import { FieldValue } from "firebase-admin/firestore";
import { transitionPhase } from "@/features/gm/logic/phases";

// リクエストスキーマ
const PrologueReadyRequestSchema = z.object({
  gameId: z.string(),
  userId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, userId } = PrologueReadyRequestSchema.parse(body);

    console.log("[API] Prologue ready:", { gameId, userId });

    // ゲーム状態を取得
    const gameRef = adminDb.collection("games").doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      return NextResponse.json(
        { error: "Game not found" },
        { status: 404 }
      );
    }

    const gameData = gameDoc.data();

    // プロローグフェーズ以外では何もしない
    if (gameData?.phase !== "prologue") {
      return NextResponse.json({
        success: true,
        message: "Not in prologue phase",
      });
    }

    // プレイヤーの準備完了フラグを更新
    // 同時にAIプレイヤーも自動的にReadyにする（後方互換性対応）
    const players = gameData?.players || {};
    const updateData: Record<string, boolean> = {
      [`players.${userId}.isPrologueReady`]: true,
    };

    // AIプレイヤーを自動的にReadyにする
    for (const [playerId, player] of Object.entries(players)) {
      if (!(player as any).isHuman && !(player as any).isPrologueReady) {
        updateData[`players.${playerId}.isPrologueReady`] = true;
        console.log("[API] Auto-setting AI player as ready:", playerId);
      }
    }

    await gameRef.update(updateData);

    // 全員が準備完了か確認
    const updatedDoc = await gameRef.get();
    const updatedData = updatedDoc.data();
    const updatedPlayers = updatedData?.players || {};

    const allReady = Object.values(updatedPlayers).every(
      (p: any) => p.isPrologueReady === true
    );

    console.log("[API] Prologue ready status:", {
      userId,
      allReady,
      readyCount: Object.values(updatedPlayers).filter((p: any) => p.isPrologueReady).length,
      totalPlayers: Object.keys(updatedPlayers).length,
    });

    // 全員準備完了なら自動でフェーズ遷移
    // C2: expectedFromPhaseを渡して重複遷移を防止
    if (allReady) {
      console.log("[API] All players ready, transitioning to next phase");
      await transitionPhase(gameId, "condition_met", userId, "prologue");
    }

    return NextResponse.json({
      success: true,
      allReady,
    });

  } catch (error) {
    console.error("[API] Prologue ready error:", error);

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
