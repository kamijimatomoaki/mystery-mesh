/**
 * 開発環境用シードデータスクリプト
 *
 * 使用方法:
 * npx tsx scripts/seed-development-data.ts [--scenarios] [--games] [--all]
 *
 * オプション:
 *   --scenarios  モックシナリオをFirestoreにシード
 *   --games      テストゲームをシード
 *   --all        すべてのデータをシード (デフォルト)
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { mockScenarios, getScenarioById } from "../src/core/mock/scenarios";
import type { Scenario, GameState } from "../src/core/types";

// Firebase Admin SDK初期化
let app: import("firebase-admin/app").App;
if (getApps().length === 0) {
  app = initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
} else {
  app = getApps()[0];
}
const db = getFirestore(app, "mistery-mesh");

/**
 * シナリオをFirestoreにシード
 */
async function seedScenarios(): Promise<void> {
  console.log("📚 Seeding scenarios to Firestore...\n");

  let successCount = 0;
  let errorCount = 0;

  for (const scenario of mockScenarios) {
    try {
      // シナリオデータを準備（Firestoreのフォーマットに合わせる）
      const scenarioData = {
        ...scenario,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await db.collection("scenarios").doc(scenario.id).set(scenarioData, { merge: true });
      console.log(`✅ Scenario seeded: ${scenario.id} (${scenario.meta.title})`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to seed scenario: ${scenario.id}`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Scenarios seed result: ${successCount} success, ${errorCount} errors`);
}

/**
 * テストゲームをFirestoreにシード
 */
async function seedTestGames(): Promise<void> {
  console.log("🎮 Seeding test games to Firestore...\n");

  const testGames: Array<{ game: GameState; scenarioId: string }> = [
    {
      scenarioId: "scenario_001",
      game: {
        id: "dev_game_001",
        scenarioId: "scenario_001",
        hostId: "dev_user_001",
        phase: "lobby",
        turnCount: 0,
        phaseDeadline: null,
        isPaused: false,
        allowHumanInput: false,
        allowAITrigger: false,
        isAISpeaking: false,
        players: {
          dev_user_001: {
            characterId: "",
            isHuman: true,
            displayName: "開発者テスト",
            isReady: false,
            isOnline: true,
          },
        },
        cards: {},
        humanShadowState: {},
      },
    },
    {
      scenarioId: "scenario_002",
      game: {
        id: "dev_game_002",
        scenarioId: "scenario_002",
        hostId: "dev_user_001",
        phase: "discussion_1",
        turnCount: 5,
        phaseDeadline: Timestamp.fromDate(new Date(Date.now() + 600000)) as any,
        isPaused: false,
        allowHumanInput: true,
        allowAITrigger: true,
        isAISpeaking: false,
        players: {
          dev_user_001: {
            characterId: "char_detective",
            isHuman: true,
            displayName: "開発者テスト",
            isReady: true,
            isOnline: true,
          },
          agent_bot_001: {
            characterId: "char_butler",
            isHuman: false,
            displayName: "AIプレイヤー1",
            isReady: true,
            isOnline: true,
          },
          agent_bot_002: {
            characterId: "char_maid",
            isHuman: false,
            displayName: "AIプレイヤー2",
            isReady: true,
            isOnline: true,
          },
        },
        cards: {},
        humanShadowState: {},
      },
    },
  ];

  let successCount = 0;
  let errorCount = 0;

  for (const { game, scenarioId } of testGames) {
    try {
      // シナリオが存在するか確認
      const scenarioDoc = await db.collection("scenarios").doc(scenarioId).get();
      if (!scenarioDoc.exists) {
        console.warn(`⚠️ Scenario ${scenarioId} not found, skipping game ${game.id}`);
        continue;
      }

      await db.collection("games").doc(game.id).set({
        ...game,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      console.log(`✅ Game seeded: ${game.id} (scenario: ${scenarioId})`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to seed game: ${game.id}`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Games seed result: ${successCount} success, ${errorCount} errors`);
}

/**
 * 開発用ユーザーデータをシード
 */
async function seedDevUsers(): Promise<void> {
  console.log("👤 Seeding development users...\n");

  const devUsers = [
    {
      id: "dev_user_001",
      displayName: "開発者テスト",
      email: "dev@example.com",
      stats: {
        gamesPlayed: 0,
        gamesWon: 0,
        scenariosCreated: 0,
      },
    },
  ];

  for (const user of devUsers) {
    try {
      await db.collection("users").doc(user.id).set({
        ...user,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });

      console.log(`✅ User seeded: ${user.id} (${user.displayName})`);
    } catch (error) {
      console.error(`❌ Failed to seed user: ${user.id}`, error);
    }
  }
}

/**
 * メイン関数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const seedAll = args.length === 0 || args.includes("--all");
  const seedScenariosOnly = args.includes("--scenarios");
  const seedGamesOnly = args.includes("--games");

  console.log("╔════════════════════════════════════════════╗");
  console.log("║   MisteryMesh Development Data Seeder     ║");
  console.log("╚════════════════════════════════════════════╝\n");

  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Project: ${process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "unknown"}\n`);

  // 本番環境でのシード実行を防止
  if (process.env.NODE_ENV === "production") {
    console.error("❌ ERROR: Cannot run seed script in production environment!");
    process.exit(1);
  }

  try {
    if (seedAll || seedScenariosOnly) {
      await seedScenarios();
      console.log("");
    }

    if (seedAll) {
      await seedDevUsers();
      console.log("");
    }

    if (seedAll || seedGamesOnly) {
      await seedTestGames();
      console.log("");
    }

    console.log("╔════════════════════════════════════════════╗");
    console.log("║           ✨ Seed Complete! ✨             ║");
    console.log("╚════════════════════════════════════════════╝");

    console.log("\n📝 Next steps:");
    console.log("   1. Run `npm run dev` to start the development server");
    console.log("   2. Visit http://localhost:3000/library to see seeded scenarios");
    console.log("   3. Create a new game from a scenario\n");

  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

// 実行
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
