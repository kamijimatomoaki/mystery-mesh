/**
 * POST /api/test/cards
 * カード生成のテストエンドポイント
 */

import { NextRequest, NextResponse } from "next/server";
import { generateMasterTimeline } from "@/features/scenario/generators/timeline";
import { generateCardSlots } from "@/features/scenario/generators/cards";
import type { CharacterDefinition } from "@/core/types";

// モックキャラクター生成
function generateMockCharacters(count: number, culpritId: string): CharacterDefinition[] {
  const templates: Array<{ id: string; name: string; job: string; gender: "male" | "female"; age: number }> = [
    { id: "char_butler", name: "執事セバスチャン", job: "執事", gender: "male", age: 45 },
    { id: "char_maid", name: "メイドエマ", job: "メイド", gender: "female", age: 28 },
    { id: "char_guest", name: "客人ヘンリー", job: "探偵", gender: "male", age: 35 },
    { id: "char_owner", name: "館主アラン", job: "貴族", gender: "male", age: 60 }
  ];

  return templates.slice(0, count).map(t => ({
    id: t.id,
    name: t.name,
    job: t.job,
    gender: t.gender,
    age: t.age,
    personality: t.id === culpritId ? "冷静沈着だが計算高い" : "誠実で真面目",
    images: {
      base: "/images/placeholder.png",
      angry: "/images/placeholder.png",
      sad: "/images/placeholder.png",
      nervous: "/images/placeholder.png"
    },
    handout: {
      publicInfo: `${t.name}の公開情報`,
      secretGoal: t.id === culpritId ? "罪を隠し通すこと" : "真相を解明すること",
      timeline: []
    }
  }));
}

export async function POST(request: NextRequest) {
  try {
    console.log("[Test Cards] Starting...");

    // 1. タイムライン生成
    console.log("[Test Cards] Step 1: Generating timeline...");
    const timeline = await generateMasterTimeline({
      genre: "Mansion",
      playerCount: 4,
      difficulty: "normal",
      userId: "test_user",
      userName: "Test User"
    });

    console.log("[Test Cards] Timeline generated:", {
      culprit: timeline.culpritId,
      eventsCount: timeline.masterTimeline.length
    });

    // 2. モックキャラクター生成
    console.log("[Test Cards] Step 2: Creating mock characters...");
    const characters = generateMockCharacters(4, timeline.culpritId);

    // 3. カード生成
    console.log("[Test Cards] Step 3: Generating cards...");
    const cards = await generateCardSlots(timeline, characters);

    console.log("[Test Cards] Success:", {
      totalCards: cards.length,
      characterCards: cards.filter(c => c.relatedCharacterId).length,
      fieldCards: cards.filter(c => !c.relatedCharacterId).length
    });

    return NextResponse.json({
      success: true,
      timeline: {
        culpritId: timeline.culpritId,
        intro: timeline.intro,
        eventsCount: timeline.masterTimeline.length
      },
      cards: {
        total: cards.length,
        characterCards: cards.filter(c => c.relatedCharacterId).length,
        fieldCards: cards.filter(c => !c.relatedCharacterId).length,
        samples: cards.slice(0, 5).map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          slotType: c.slotType,
          importance: c.secret.importanceLevel,
          description: c.secret.description
        }))
      }
    });

  } catch (error) {
    console.error("[Test Cards] Error:", error);

    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}
