/**
 * テスト用ゲームデータのシード
 * Agent Thinking Systemの動作確認用
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Firebase Admin SDK初期化
const app = initializeApp();
const db = getFirestore(app, "mistery-mesh");

/**
 * テスト用ゲームデータを作成
 */
async function seedTestGame() {
  const gameId = "test_game_001";
  const agentIds = ["agent_bot_001", "agent_bot_002", "agent_bot_003"];
  const characterIds = ["char_butler", "char_maid", "char_guest"];

  console.log("🎮 Creating test game:", gameId);

  // 1. ゲームステートを作成
  await db.collection("games").doc(gameId).set({
    id: gameId,
    scenarioId: "scenario_test_001",
    hostId: "user_host_001",
    phase: "discussion_1",
    turnCount: 5,
    phaseDeadline: Timestamp.fromDate(new Date(Date.now() + 600000)), // 10分後
    isPaused: false,

    explorationState: {
      currentActiveActor: null,
      actionQueue: [],
      remainingAP: {
        "agent_bot_001": 3,
        "agent_bot_002": 3,
        "agent_bot_003": 3
      }
    },

    players: {
      "agent_bot_001": {
        characterId: "char_butler",
        isHuman: false,
        displayName: "執事",
        isReady: true,
        isOnline: true
      },
      "agent_bot_002": {
        characterId: "char_maid",
        isHuman: false,
        displayName: "メイド",
        isReady: true,
        isOnline: true
      },
      "agent_bot_003": {
        characterId: "char_guest",
        isHuman: false,
        displayName: "客人",
        isReady: true,
        isOnline: true
      }
    },

    cards: {
      "card_001": {
        location: "Hand(agent_bot_001)",
        ownerId: "agent_bot_001",
        isRevealed: false
      },
      "card_002": {
        location: "LivingRoom",
        ownerId: null,
        isRevealed: false
      }
    },

    humanShadowState: {}
  });

  console.log("✅ Game state created");

  // 2. エージェントブレインを作成
  for (let i = 0; i < agentIds.length; i++) {
    const agentId = agentIds[i];
    const characterId = characterIds[i];

    await db
      .collection("games").doc(gameId)
      .collection("agents").doc(agentId)
      .set({
        characterId: characterId,
        emotionalState: "calm",

        relationships: {
          "char_butler": {
            trust: 50,
            suspicion: 30,
            note: "冷静な態度が気になる"
          },
          "char_maid": {
            trust: 60,
            suspicion: 40,
            note: "何か隠している様子"
          },
          "char_guest": {
            trust: 70,
            suspicion: 20,
            note: "推理力が高そう"
          }
        },

        knowledgeBase: {
          cards: {
            "card_001": {
              status: "known",
              holder: agentId,
              contentGuess: "ナイフが写っている証拠写真"
            }
          },
          knownFacts: [
            "被害者は10:00に書斎で発見された",
            "凶器はナイフと思われる"
          ]
        },

        lastThought: {
          content: "Initial state",
          timestamp: Timestamp.now()
        }
      });

    console.log(`✅ Agent brain created: ${agentId} (${characterId})`);
  }

  // 3. テスト用のログを作成（会話履歴）
  const testLogs = [
    {
      id: "log_001",
      actorId: "agent_bot_001",
      characterId: "char_butler",
      type: "talk",
      content: "私は10時に書斎で被害者を発見しました。その時、すでに冷たくなっていました。",
      phase: "discussion_1",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 300000)) // 5分前
    },
    {
      id: "log_002",
      actorId: "agent_bot_002",
      characterId: "char_maid",
      type: "talk",
      content: "私は9時半ごろ、廊下で何か物音を聞きました。でも、確認には行きませんでした。",
      phase: "discussion_1",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 240000)) // 4分前
    },
    {
      id: "log_003",
      actorId: "agent_bot_003",
      characterId: "char_guest",
      type: "talk",
      content: "執事殿、あなたは本当に10時に発見したのですか？メイドの証言と矛盾している気がします。",
      phase: "discussion_1",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 180000)) // 3分前
    },
    {
      id: "log_004",
      actorId: "agent_bot_002",
      characterId: "char_maid",
      type: "investigate",
      target: "card_002",
      location: "LivingRoom",
      phase: "exploration_1",
      timestamp: Timestamp.fromDate(new Date(Date.now() - 600000)) // 10分前
    }
  ];

  for (const log of testLogs) {
    await db
      .collection("games").doc(gameId)
      .collection("logs")
      .doc(log.id)
      .set(log);
  }

  console.log(`✅ ${testLogs.length} test logs created`);

  console.log("\n🎉 Test game setup complete!");
  console.log(`\n📝 Test commands:`);
  console.log(`\n# Test thinking API:`);
  console.log(`curl -X POST http://localhost:3000/api/agent/think \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"gameId": "${gameId}", "agentId": "agent_bot_001", "trigger": "new_message"}'`);
  console.log(`\n# View debug UI:`);
  console.log(`http://localhost:3000/game/${gameId}/debug\n`);
}

// 実行
seedTestGame()
  .then(() => {
    console.log("✅ Seed completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  });
