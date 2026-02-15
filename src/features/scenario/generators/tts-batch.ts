/**
 * TTS Batch Generation
 * シナリオ生成時にプロローグナレーションを事前生成
 */

import { createModuleLogger } from "@/core/utils/logger";
import { synthesizeSpeech, CHARACTER_VOICES } from "@/core/llm/vertex-tts";

const logger = createModuleLogger("TTSBatch");

/**
 * プロローグナレーションを生成してCloud Storageに保存
 *
 * @param introText - プロローグテキスト
 * @param scenarioId - シナリオID（ファイル名用）
 * @returns Cloud Storage URL
 */
export async function generatePrologueNarration(
  introText: string,
  scenarioId: string
): Promise<string | null> {
  try {
    logger.info("Generating prologue narration", {
      scenarioId,
      textLength: introText.length,
    });

    // SSMLでナレーション向けに調整
    const ssml = buildNarrationSSML(introText);

    logger.debug("Generated SSML", { ssmlLength: ssml.length });

    // 音声合成を実行（Cloud Storageに保存）
    const result = await synthesizeSpeech({
      ssml,
      characterId: "mysterious", // ナレーション用の落ち着いた声
      outputFormat: "MP3",
      saveToBucket: true,
    });

    if (result.audioUrl) {
      logger.info("Prologue narration generated successfully", {
        scenarioId,
        audioUrl: result.audioUrl,
        duration: result.duration,
      });
      return result.audioUrl;
    }

    logger.warn("No audio URL returned from TTS", { scenarioId });
    return null;
  } catch (error) {
    logger.error("Failed to generate prologue narration", error as Error, {
      scenarioId,
    });
    // エラーでもシナリオ生成は続行（ナレーションはオプション）
    return null;
  }
}

/**
 * ナレーション用のSSMLを構築
 * 適切な間（ポーズ）と抑揚を追加
 */
function buildNarrationSSML(text: string): string {
  // 段落を検出して適切なポーズを挿入
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  const processedParagraphs = paragraphs.map((paragraph) => {
    // 文末のポーズを追加
    let processed = paragraph
      // 句読点の後にポーズを追加
      .replace(/。/g, '。<break time="500ms"/>')
      .replace(/、/g, '、<break time="200ms"/>')
      .replace(/[…]/g, '…<break time="700ms"/>')
      .replace(/[──]/g, '──<break time="400ms"/>')
      // 感嘆符・疑問符の後に長めのポーズ
      .replace(/[！!]/g, '！<break time="600ms"/>')
      .replace(/[？?]/g, '？<break time="600ms"/>');

    return processed;
  });

  // 段落間に長めのポーズを追加
  const content = processedParagraphs.join('<break time="1000ms"/>');

  // SSMLでラップ（やや速め、低めのピッチでミステリー感）
  return `<speak>
<prosody rate="105%" pitch="-1st">
${content}
</prosody>
</speak>`;
}

/**
 * 複数のナレーションを一括生成（将来的な拡張用）
 *
 * @param narrations - ナレーション配列（{id, text}）
 * @returns {id, audioUrl}[]
 */
export async function generateNarrationBatch(
  narrations: Array<{ id: string; text: string }>
): Promise<Array<{ id: string; audioUrl: string | null }>> {
  logger.info("Batch narration generation started", { count: narrations.length });

  const results: Array<{ id: string; audioUrl: string | null }> = [];

  // 順次生成（レート制限を考慮）
  for (const narration of narrations) {
    try {
      const audioUrl = await generatePrologueNarration(narration.text, narration.id);
      results.push({ id: narration.id, audioUrl });

      // レート制限を避けるため少し待機
      await sleep(500);
    } catch (error) {
      logger.warn("Failed to generate narration", { id: narration.id, error });
      results.push({ id: narration.id, audioUrl: null });
    }
  }

  logger.info("Batch narration generation completed", {
    total: narrations.length,
    success: results.filter((r) => r.audioUrl !== null).length,
  });

  return results;
}

/**
 * スリープユーティリティ
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
