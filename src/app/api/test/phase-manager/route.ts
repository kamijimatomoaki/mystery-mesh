/**
 * POST /api/test/phase-manager
 * Phase Manager テスト
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { GameState } from "@/core/types";
import {
  transitionPhase,
  getPhaseTimer,
  createPhaseTimer,
} from "@/features/gm/logic/phases";

export async function POST(request: NextRequest) {
  try {
    console.log("[Test Phase Manager] Starting...");

    // Step 1: テストゲームを作成
    const testGameId = `test_game_phase_${Date.now()}`;

    const testGame: GameState = {
      id: testGameId,
      scenarioId: "test_scenario",
      hostId: "test_user",
      phase: "lobby",
      turnCount: 0,
      phaseDeadline: null,
      isPaused: false,
      allowHumanInput: false,
      allowAITrigger: false,
      isAISpeaking: false,
      players: {
        player_1: {
          characterId: "char_1",
          isHuman: true,
          displayName: "Player 1",
          isReady: true,
          isOnline: true,
        },
        player_2: {
          characterId: "char_2",
          isHuman: false,
          displayName: "AI Player",
          isReady: true,
          isOnline: true,
        },
      },
      cards: {},
      humanShadowState: {},
    };

    await adminDb.collection("games").doc(testGameId).set(testGame);

    console.log("[Test Phase Manager] Created test game:", testGameId);

    // Step 2: タイマー作成テスト
    const lobbyTimer = createPhaseTimer("lobby");
    const discussionTimer = createPhaseTimer("discussion_1");

    console.log("[Test Phase Manager] Timers created:");
    console.log("  Lobby:", lobbyTimer);
    console.log("  Discussion_1:", discussionTimer);

    // Step 3: フェーズ遷移テスト（lobby → generation）
    console.log("[Test Phase Manager] Transitioning: lobby → generation");
    const phase1 = await transitionPhase(testGameId, "manual", "test_user");

    // Step 4: フェーズ遷移テスト（generation → setup）
    console.log("[Test Phase Manager] Transitioning: generation → setup");
    const phase2 = await transitionPhase(testGameId, "manual", "test_user");

    // Step 5: フェーズ遷移テスト（setup → discussion_1）
    console.log("[Test Phase Manager] Transitioning: setup → discussion_1");
    const phase3 = await transitionPhase(testGameId, "manual", "test_user");

    // Step 6: タイマー状態取得
    const currentTimer = await getPhaseTimer(testGameId);

    console.log("[Test Phase Manager] Current timer:", currentTimer);

    // Step 7: フェーズ遷移履歴を取得
    const transitions = await adminDb
      .collection("phaseTransitions")
      .where("gameId", "==", testGameId)
      .get();

    const transitionHistory = transitions.docs
      .map((doc) => doc.data())
      .sort((a: any, b: any) => a.timestamp - b.timestamp); // クライアント側でソート

    console.log("[Test Phase Manager] Transition history:", transitionHistory);

    // 結果を返す
    return NextResponse.json({
      success: true,
      testGameId,
      phases: {
        initial: "lobby",
        after_1: phase1,
        after_2: phase2,
        after_3: phase3,
      },
      timers: {
        lobby: lobbyTimer,
        discussion: discussionTimer,
        current: currentTimer,
      },
      transitionHistory: transitionHistory.map((t) => ({
        from: t.fromPhase,
        to: t.toPhase,
        reason: t.reason,
      })),
    });
  } catch (error) {
    console.error("[Test Phase Manager] Error:", error);

    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}
