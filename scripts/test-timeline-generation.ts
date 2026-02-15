/**
 * タイムライン生成のテストスクリプト
 */

// 環境変数を読み込み
import { config } from "dotenv";
config({ path: ".env.local" });

import { generateMasterTimeline } from "../src/features/scenario/generators/timeline";

async function testTimelineGeneration() {
  console.log("🧪 Testing timeline generation...\n");

  const params = {
    genre: "Mansion",
    playerCount: 4,
    difficulty: "normal" as const,
    userId: "test_user_001",
    userName: "テストユーザー"
  };

  try {
    console.log("📝 Generating timeline with params:", params);
    console.log("⏳ This may take 10-30 seconds...\n");

    const timeline = await generateMasterTimeline(params);

    console.log("\n✅ Timeline generated successfully!\n");
    console.log("=== Timeline Details ===");
    console.log(`Culprit: ${timeline.culpritId}`);
    console.log(`Trick: ${timeline.trickExplanation}`);
    console.log(`Intro: ${timeline.intro}`);
    console.log(`\nEvents (${timeline.masterTimeline.length}):`);
    timeline.masterTimeline.forEach((event, index) => {
      console.log(`  ${index + 1}. [${event.time}] ${event.event} (${event.isTrue ? '真実' : '偽装'})`);
      if (event.relatedCharacterId) {
        console.log(`     → Related: ${event.relatedCharacterId}`);
      }
    });

    console.log("\n✅ Test completed successfully!");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

testTimelineGeneration()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
