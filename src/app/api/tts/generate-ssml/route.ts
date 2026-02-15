/**
 * POST /api/tts/generate-ssml
 * Geminiを使ってナレーションテキストからSSMLを生成
 */

import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import { generateText } from "@/core/llm/vertex-text";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("GenerateSSML");

/**
 * SSML生成リクエストスキーマ
 */
const GenerateSSMLRequestSchema = z.object({
  text: z.string().min(1).max(10000), // 最大10000文字
  type: z.enum(["narration", "character_line"]).default("narration"),
});

/**
 * SSMLの基本検証
 * @param ssml - 検証するSSML文字列
 * @returns 有効かどうか
 */
function validateSSML(ssml: string): boolean {
  // 基本的な構造チェック
  if (!ssml.includes("<speak>") || !ssml.includes("</speak>")) {
    return false;
  }

  // タグのバランスチェック（簡易版）
  const openTags = (ssml.match(/<[a-z][^/>]*>/gi) || []).length;
  const closeTags = (ssml.match(/<\/[a-z]+>/gi) || []).length;
  const selfClosingTags = (ssml.match(/<[^>]+\/>/gi) || []).length;

  // 許容範囲内のバランスチェック（完全一致は求めない）
  const diff = Math.abs(openTags - closeTags - selfClosingTags);
  return diff <= 2; // 小さな誤差は許容
}

/**
 * プレーンテキストを最小限のSSMLでラップ（フォールバック用）
 * @param text - 元のテキスト
 * @returns SSMLでラップされたテキスト
 */
function wrapPlainTextAsSSML(text: string): string {
  // 特殊文字をエスケープ
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `<speak>${escaped}</speak>`;
}

/**
 * SSML生成用プロンプトを構築
 * @param text - 変換するテキスト
 * @param type - テキストタイプ
 * @returns プロンプト文字列
 */
function buildSSMLPrompt(text: string, type: string): string {
  const basePrompt = `
あなたはマーダーミステリーゲームのナレーション原稿を作成する専門家です。
以下のテキストをGoogle Cloud Text-to-Speech用のSSML形式に変換してください。

## 必須要件
1. <speak>タグで全体を囲む
2. 難読漢字や固有名詞には<phoneme>タグで読み仮名を設定
   例: <phoneme alphabet="x-amazon-pron-kana" ph="シンジツ">真実</phoneme>
3. 句読点での適切な間（<break time="300ms"/>）
4. 文末には少し長めの間（<break time="500ms"/>）

## 注意事項（エラー防止）
- <emphasis>タグは使用しない（Google TTSでエラーになりやすい）
- <prosody>タグは使用しない（Google TTSでエラーになりやすい）
- 入れ子になったタグは避ける
- 属性値は必ずダブルクォートで囲む

## 読み仮名が必要な漢字の例
- 真実 → シンジツ
- 殺人 → サツジン
- 探偵 → タンテイ
- 証拠 → ショウコ
- 容疑者 → ヨウギシャ
- 犯人 → ハンニン
- 事件 → ジケン
- 謎 → ナゾ
- 推理 → スイリ
- 秘密 → ヒミツ
- 館 → ヤカタ/カン（文脈による）
- 黄昏 → タソガレ
- 仄暗い → ホノグライ

${type === "character_line" ? `
## キャラクターのセリフの場合
- 感情表現は間（break）で表現
- 驚きや疑問は長めの間を入れる
` : `
## ナレーションの場合
- ゆっくりとした語り口を意識
- 段落の切れ目には長めの間（<break time="800ms"/>）
`}

## 入力テキスト
${text}

## 出力
SSMLのみを出力してください。説明文やマークダウンは不要です。
<speak>から始めてください。
`;

  return basePrompt;
}

/**
 * SSML生成API
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // Rate Limit Check
  const rateLimitResponse = await checkUserRateLimit(request, "aiApi");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, GenerateSSMLRequestSchema);

  logger.info("SSML generation request", {
    textLength: validated.text.length,
    type: validated.type,
  });

  try {
    // GeminiでSSML生成
    const prompt = buildSSMLPrompt(validated.text, validated.type);
    const generatedSSML = await generateText(prompt, {
      temperature: 0.3, // 低温度で安定した出力
      maxTokens: 16384,
      systemInstruction:
        "あなたはSSML変換の専門家です。入力テキストをGoogle Cloud TTS用のSSMLに変換してください。",
    });

    // SSMLを抽出（余計なテキストを削除）
    let ssml = generatedSSML.trim();

    // <speak>タグで囲まれた部分を抽出
    const speakMatch = ssml.match(/<speak>[\s\S]*<\/speak>/);
    if (speakMatch) {
      ssml = speakMatch[0];
    }

    // SSMLの検証
    const isValid = validateSSML(ssml);

    if (!isValid) {
      logger.warn("Generated SSML validation failed, using fallback", {
        ssmlPreview: ssml.substring(0, 200),
      });
    }

    const finalSSML = isValid ? ssml : wrapPlainTextAsSSML(validated.text);

    logger.info("SSML generation completed", {
      isGenerated: isValid,
      ssmlLength: finalSSML.length,
    });

    return NextResponse.json({
      success: true,
      ssml: finalSSML,
      isGenerated: isValid,
      originalTextLength: validated.text.length,
    });
  } catch (error) {
    logger.error("SSML generation failed, using fallback", error as Error);

    // エラー時はフォールバック
    const fallbackSSML = wrapPlainTextAsSSML(validated.text);

    return NextResponse.json({
      success: true,
      ssml: fallbackSSML,
      isGenerated: false,
      originalTextLength: validated.text.length,
      fallbackReason: "SSML generation failed",
    });
  }
}, "GenerateSSML");
