/**
 * Image Generation Pipeline
 * キャラクター・カード画像の生成とCloud Storageへのアップロード
 */

import {
  generateBaseCharacterImage,
  generateExpressionVariation,
  generateBackgroundImage,
} from "@/core/llm/vertex-image";
import { uploadBase64ToStorage } from "@/core/storage/cloud-storage";
import { createModuleLogger } from "@/core/utils/logger";
import { getServerEnv } from "@/core/config/env";
import type { CharacterDefinition, CardDefinition, ArtStyle, EmotionalState } from "@/core/types";

const logger = createModuleLogger("ImageGenerator");

/**
 * プレースホルダー画像URL
 */
const PLACEHOLDER_IMAGE = "/images/placeholder.png";
const PLACEHOLDER_CARD_IMAGE = "/images/card_placeholder.png";
const PLACEHOLDER_BACKGROUND_IMAGE = "/images/background_test01.png";

/**
 * 表情バリエーション
 */
const EXPRESSION_EMOTIONS: EmotionalState[] = ["calm", "angry", "nervous", "sad", "confident"];

/**
 * キャラクター画像生成結果
 */
export interface CharacterImageResult {
  characterId: string;
  baseImageUrl: string;
  expressions: Record<EmotionalState, string>;
  success: boolean;
  error?: string;
}

/**
 * カード画像生成結果
 */
export interface CardImageResult {
  cardId: string;
  backImageUrl: string;
  trueImageUrl: string;
  success: boolean;
  error?: string;
}

/**
 * 背景画像生成結果
 */
export interface BackgroundImageResult {
  backgroundImageUrl: string;
  success: boolean;
  error?: string;
}

/**
 * 画像生成が有効かどうかを判定
 * 開発環境ではENABLE_IMAGE_GEN_IN_DEV環境変数で制御
 */
function isImageGenerationEnabled(): boolean {
  const env = getServerEnv();
  const isDev = process.env.NODE_ENV !== "production";

  // 本番環境では常に有効
  if (!isDev) {
    return true;
  }

  // 開発環境ではENABLE_IMAGE_GEN_IN_DEV環境変数で制御
  return process.env.ENABLE_IMAGE_GEN_IN_DEV === "true";
}

/**
 * Data URLからBase64データを抽出
 */
function extractBase64FromDataUrl(dataUrl: string): { data: string; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL format");
  }
  return {
    mimeType: match[1],
    data: match[2],
  };
}

/**
 * 画像をCloud Storageにアップロード
 */
async function uploadImageToStorage(
  dataUrl: string,
  scenarioId: string,
  fileName: string
): Promise<string> {
  const env = getServerEnv();
  const bucketName = `${env.GOOGLE_CLOUD_PROJECT}-images`;
  const { data, mimeType } = extractBase64FromDataUrl(dataUrl);
  const extension = mimeType.split("/")[1] || "png";
  const fullPath = `scenarios/${scenarioId}/${fileName}.${extension}`;

  return uploadBase64ToStorage(data, fullPath, mimeType, bucketName);
}

/**
 * キャラクター画像を生成してCloud Storageにアップロード
 *
 * @param character - キャラクター定義
 * @param scenarioId - シナリオID
 * @param artStyle - 画風
 * @returns 生成結果
 */
export async function generateCharacterImages(
  character: CharacterDefinition,
  scenarioId: string,
  artStyle: ArtStyle
): Promise<CharacterImageResult> {
  logger.info("Generating character images", {
    characterId: character.id,
    scenarioId,
    artStyle,
  });

  // 画像生成が無効の場合はプレースホルダーを返す
  if (!isImageGenerationEnabled()) {
    logger.info("Image generation disabled, using placeholder", {
      characterId: character.id,
    });
    const placeholderExpressions: Record<EmotionalState, string> = {
      calm: PLACEHOLDER_IMAGE,
      angry: PLACEHOLDER_IMAGE,
      nervous: PLACEHOLDER_IMAGE,
      sad: PLACEHOLDER_IMAGE,
      confident: PLACEHOLDER_IMAGE,
    };
    return {
      characterId: character.id,
      baseImageUrl: PLACEHOLDER_IMAGE,
      expressions: placeholderExpressions,
      success: true,
    };
  }

  try {
    // 1. ベース画像を生成
    logger.debug("Generating base image", { characterId: character.id });
    const baseImageDataUrl = await generateBaseCharacterImage(character, artStyle);

    // 2. Cloud Storageにアップロード
    const baseImageUrl = await uploadImageToStorage(
      baseImageDataUrl,
      scenarioId,
      `characters/${character.id}/base`
    );

    logger.debug("Base image uploaded", { characterId: character.id, baseImageUrl });

    // 3. 表情バリエーションを生成（並列実行）
    const expressionPromises = EXPRESSION_EMOTIONS.map(async (emotion) => {
      try {
        logger.debug("Generating expression", { characterId: character.id, emotion });
        const expressionDataUrl = await generateExpressionVariation(
          baseImageDataUrl,
          emotion,
          character
        );

        const expressionUrl = await uploadImageToStorage(
          expressionDataUrl,
          scenarioId,
          `characters/${character.id}/${emotion}`
        );

        return { emotion, url: expressionUrl };
      } catch (error) {
        logger.warn("Expression generation failed, using base image", {
          characterId: character.id,
          emotion,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // エラー時はベース画像を使用
        return { emotion, url: baseImageUrl };
      }
    });

    const expressionResults = await Promise.all(expressionPromises);

    // 表情マップを構築
    const expressions: Record<EmotionalState, string> = {
      calm: baseImageUrl,
      angry: baseImageUrl,
      nervous: baseImageUrl,
      sad: baseImageUrl,
      confident: baseImageUrl,
    };

    for (const result of expressionResults) {
      expressions[result.emotion] = result.url;
    }

    logger.info("Character images generated successfully", {
      characterId: character.id,
      baseImageUrl,
      expressionCount: Object.keys(expressions).length,
    });

    return {
      characterId: character.id,
      baseImageUrl,
      expressions,
      success: true,
    };
  } catch (error) {
    logger.error("Character image generation failed", error as Error, {
      characterId: character.id,
    });

    // エラー時はプレースホルダーを返す
    const placeholderExpressions: Record<EmotionalState, string> = {
      calm: PLACEHOLDER_IMAGE,
      angry: PLACEHOLDER_IMAGE,
      nervous: PLACEHOLDER_IMAGE,
      sad: PLACEHOLDER_IMAGE,
      confident: PLACEHOLDER_IMAGE,
    };

    return {
      characterId: character.id,
      baseImageUrl: PLACEHOLDER_IMAGE,
      expressions: placeholderExpressions,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * カード画像を生成してCloud Storageにアップロード
 *
 * @param card - カード定義
 * @param scenarioId - シナリオID
 * @param artStyle - 画風
 * @returns 生成結果
 */
export async function generateCardImages(
  card: CardDefinition,
  scenarioId: string,
  artStyle: ArtStyle
): Promise<CardImageResult> {
  logger.info("Generating card images", {
    cardId: card.id,
    scenarioId,
    artStyle,
  });

  // 画像生成が無効の場合はプレースホルダーを返す
  if (!isImageGenerationEnabled()) {
    logger.info("Image generation disabled, using placeholder", {
      cardId: card.id,
    });
    return {
      cardId: card.id,
      backImageUrl: PLACEHOLDER_CARD_IMAGE,
      trueImageUrl: PLACEHOLDER_CARD_IMAGE,
      success: true,
    };
  }

  try {
    // カード画像生成（Gemini Imageを使用）
    // TODO: カード専用のプロンプトビルダーを実装
    // 現在はプレースホルダーを返す
    logger.warn("Card image generation not fully implemented, using placeholder", {
      cardId: card.id,
    });

    return {
      cardId: card.id,
      backImageUrl: PLACEHOLDER_CARD_IMAGE,
      trueImageUrl: PLACEHOLDER_CARD_IMAGE,
      success: true,
    };
  } catch (error) {
    logger.error("Card image generation failed", error as Error, {
      cardId: card.id,
    });

    return {
      cardId: card.id,
      backImageUrl: PLACEHOLDER_CARD_IMAGE,
      trueImageUrl: PLACEHOLDER_CARD_IMAGE,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 背景画像を生成してCloud Storageにアップロード
 *
 * @param scenarioMeta - シナリオのメタデータ
 * @param scenarioId - シナリオID
 * @param artStyle - 画風
 * @returns 生成結果
 */
export async function generateScenarioBackgroundImage(
  scenarioMeta: { title: string; genre: string; description: string },
  scenarioId: string,
  artStyle: ArtStyle
): Promise<BackgroundImageResult> {
  logger.info("Generating background image", {
    scenarioId,
    genre: scenarioMeta.genre,
    artStyle,
  });

  // 画像生成が無効の場合はプレースホルダーを返す
  if (!isImageGenerationEnabled()) {
    logger.info("Image generation disabled, using placeholder background", {
      scenarioId,
    });
    return {
      backgroundImageUrl: PLACEHOLDER_BACKGROUND_IMAGE,
      success: true,
    };
  }

  try {
    // 背景画像を生成
    logger.debug("Generating background image with Gemini Image");
    const backgroundDataUrl = await generateBackgroundImage(scenarioMeta, artStyle);

    // Cloud Storageにアップロード
    const backgroundImageUrl = await uploadImageToStorage(
      backgroundDataUrl,
      scenarioId,
      "background/main"
    );

    logger.info("Background image generated successfully", {
      scenarioId,
      backgroundImageUrl,
    });

    return {
      backgroundImageUrl,
      success: true,
    };
  } catch (error) {
    logger.error("Background image generation failed", error as Error, {
      scenarioId,
    });

    return {
      backgroundImageUrl: PLACEHOLDER_BACKGROUND_IMAGE,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * シナリオ全体の画像を一括生成
 *
 * @param characters - キャラクター定義の配列
 * @param cards - カード定義の配列
 * @param scenarioId - シナリオID
 * @param artStyle - 画風
 * @returns 生成結果
 */
export async function generateAllScenarioImages(
  characters: CharacterDefinition[],
  cards: CardDefinition[],
  scenarioId: string,
  artStyle: ArtStyle
): Promise<{
  characterImages: CharacterImageResult[];
  cardImages: CardImageResult[];
  totalSuccess: number;
  totalFailed: number;
}> {
  logger.info("Generating all scenario images", {
    scenarioId,
    characterCount: characters.length,
    cardCount: cards.length,
    artStyle,
  });

  // キャラクター画像を並列生成（同時実行数を制限）
  const characterResults: CharacterImageResult[] = [];
  const BATCH_SIZE = 3; // 同時に生成する最大数

  for (let i = 0; i < characters.length; i += BATCH_SIZE) {
    const batch = characters.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((char) => generateCharacterImages(char, scenarioId, artStyle))
    );
    characterResults.push(...batchResults);
  }

  // カード画像を並列生成
  const cardResults: CardImageResult[] = [];
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((card) => generateCardImages(card, scenarioId, artStyle))
    );
    cardResults.push(...batchResults);
  }

  const successCount =
    characterResults.filter((r) => r.success).length +
    cardResults.filter((r) => r.success).length;
  const failedCount =
    characterResults.filter((r) => !r.success).length +
    cardResults.filter((r) => !r.success).length;

  logger.info("All scenario images generated", {
    scenarioId,
    totalSuccess: successCount,
    totalFailed: failedCount,
  });

  return {
    characterImages: characterResults,
    cardImages: cardResults,
    totalSuccess: successCount,
    totalFailed: failedCount,
  };
}
