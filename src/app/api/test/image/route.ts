/**
 * POST /api/test/image
 * Gemini Image生成のテスト
 */

import { NextRequest, NextResponse } from "next/server";
import { generateBaseCharacterImage } from "@/core/llm/vertex-image";
import type { CharacterDefinition, ArtStyle } from "@/core/types";

export async function POST(request: NextRequest) {
  try {
    console.log("[Test Image] Starting...");

    // テスト用キャラクター
    const testCharacter: CharacterDefinition = {
      id: "char_butler",
      name: "執事セバスチャン",
      job: "執事",
      gender: "male",
      age: 45,
      personality: "冷静沈着で礼儀正しい。感情を表に出さない。",
      images: {
        base: "",
        angry: "",
        sad: "",
        nervous: ""
      },
      handout: {
        publicInfo: "館の執事として長年勤務",
        secretGoal: "主人の名誉を守る",
        timeline: []
      }
    };

    const artStyle: ArtStyle = "anime";

    console.log("[Test Image] Generating image for:", testCharacter.name);

    // 画像生成
    const imageUrl = await generateBaseCharacterImage(testCharacter, artStyle);

    console.log("[Test Image] Success, image length:", imageUrl.length);

    // Data URLの場合はサイズを確認
    const isDataUrl = imageUrl.startsWith("data:");
    const imageSize = isDataUrl ? Math.floor(imageUrl.length * 0.75) : null; // Base64は約1.33倍

    return NextResponse.json({
      success: true,
      character: testCharacter.name,
      artStyle,
      imageUrl: imageUrl.substring(0, 100) + "...", // 最初の100文字だけ返す
      isDataUrl,
      imageSizeBytes: imageSize,
      fullImageUrl: imageUrl // 実際のテストでは全体を返す
    });

  } catch (error) {
    console.error("[Test Image] Error:", error);

    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}
