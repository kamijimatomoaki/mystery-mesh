/**
 * POST /api/test/card-single
 * 単一カード生成のテスト
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateJSON } from "@/core/llm/vertex-text";

const TitleDescriptionSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    console.log("[Test Single Card] Starting...");

    const prompt = `
キャラクター「執事セバスチャン」の動機カードを生成してください。

【要件】
- 殺人の動機
- 極めて簡潔に（10文字以内）

JSON形式で出力：
{
  "title": "動機",
  "description": "遺産目当て"
}
`;

    const result = await generateJSON<{ title: string; description: string }>(prompt, {
      temperature: 0.5,
      maxTokens: 8192, // 十分余裕を持たせる（4倍増）
      schema: TitleDescriptionSchema,
    });

    console.log("[Test Single Card] Success:", result);

    return NextResponse.json({
      success: true,
      card: result
    });

  } catch (error) {
    console.error("[Test Single Card] Error:", error);

    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}
