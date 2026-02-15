/**
 * POST /api/scenario/generate
 * シナリオ生成を開始（Polling Pattern）
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { Timestamp as ClientTimestamp } from "firebase/firestore";
import { z } from "zod";
import {
  generateMasterTimeline,
  type ScenarioParams
} from "@/features/scenario/generators/timeline";
import { generateCharacters } from "@/features/scenario/generators/characters";
import { generateCardSlots } from "@/features/scenario/generators/cards";
import { generateLocations } from "@/features/scenario/generators/locations";
import { generateBaseCharacterImage, generateBackgroundImage } from "@/core/llm/vertex-image";
import { uploadBase64ToStorage, ensureBucketExists } from "@/core/storage/cloud-storage";
import type { Scenario, CharacterDefinition, ArtStyle } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";
import { createModuleLogger } from "@/core/utils/logger";
import { performFinalReview } from "@/features/scenario/generators/final-review";
import { generatePrologueNarration } from "@/features/scenario/generators/tts-batch";
import { removeUndefined } from "@/core/utils/firestore";

const logger = createModuleLogger("ScenarioGenerate");

// リクエストスキーマ
const GenerateRequestSchema = z.object({
  genre: z.string(),
  playerCount: z.number().min(3).max(8),
  difficulty: z.enum(["easy", "normal", "hard"]),
  artStyle: z.enum(["anime", "oil_painting", "realistic", "sketch"]),
  userId: z.string(),
  userName: z.string()
});

// Jobステータス型
interface ScenarioGenerationJob {
  id: string;
  status: "processing" | "completed" | "failed";
  userId: string;
  params: ScenarioParams & { artStyle: string };
  progress: {
    stage: "timeline" | "characters" | "locations" | "cards" | "images" | "validation" | "completed";
    percentage: number;
    message: string;
  };
  result?: Scenario;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function POST(request: NextRequest) {
  // Rate Limit Check（シナリオ生成は重い処理なので厳しい制限）
  const rateLimitResponse = await checkUserRateLimit(request, "scenarioGeneration");
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const validated = GenerateRequestSchema.parse(body);

    // Job IDを生成
    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    console.log("[API] Scenario generation started:", jobId);

    // Firestoreにジョブを保存
    await adminDb.collection("scenarioJobs").doc(jobId).set({
      id: jobId,
      status: "processing",
      userId: validated.userId,
      params: validated,
      progress: {
        stage: "timeline",
        percentage: 0,
        message: "物語の骨組みを構築中..."
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    // シナリオドキュメントを「生成中」として事前作成（マイライブラリに表示するため）
    const scenarioId = `scenario_${jobId}`;
    await adminDb.collection("scenarios").doc(scenarioId).set({
      id: scenarioId,
      authorId: validated.userId,
      authorName: validated.userName,
      isPublished: false,
      status: "generating",
      jobId,
      createdAt: Timestamp.now(),
      meta: {
        title: `${validated.genre}の事件`,
        description: "シナリオを生成中...",
        genre: validated.genre,
        difficulty: validated.difficulty,
        playTimeMin: 90,
        artStyle: validated.artStyle,
        playCount: 0,
        stars: 0,
        tags: [],
      },
      data: {
        introText: "",
        truth: { culpritId: "", victimId: "", trickExplanation: "", masterTimeline: [] },
        locations: [],
        characters: [],
        cards: [],
      },
    });

    // バックグラウンドで生成開始（非同期）
    executeScenarioGeneration(jobId, validated).catch(async (error) => {
      console.error("[API] Scenario generation failed:", error);

      // エラー時はジョブステータスとシナリオステータスを更新
      await Promise.all([
        adminDb.collection("scenarioJobs").doc(jobId).update({
          status: "failed",
          error: String(error),
          updatedAt: Timestamp.now(),
        }),
        adminDb.collection("scenarios").doc(scenarioId).update({
          status: "error",
        }),
      ]);
    });

    // Job IDを即座に返却
    return NextResponse.json({ jobId });

  } catch (error) {
    console.error("[API] Scenario generate error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * バックグラウンドでシナリオ生成を実行
 */
async function executeScenarioGeneration(
  jobId: string,
  params: z.infer<typeof GenerateRequestSchema>
) {

  const updateProgress = async (
    stage: ScenarioGenerationJob["progress"]["stage"],
    percentage: number,
    message: string
  ) => {
    await adminDb.collection("scenarioJobs").doc(jobId).update({
      progress: { stage, percentage, message },
      updatedAt: Timestamp.now()
    });
  };

  try {
    // Stage 1: Timeline
    await updateProgress("timeline", 10, "真相を確定中...");

    const timeline = await generateMasterTimeline({
      genre: params.genre,
      playerCount: params.playerCount,
      difficulty: params.difficulty,
      userId: params.userId,
      userName: params.userName
    });

    // Stage 2: Characters（Gemini動的生成）
    await updateProgress("characters", 30, "登場人物を設定中...");

    const characters = await generateCharacters({
      genre: params.genre,
      difficulty: params.difficulty,
      timeline,
      playerCount: params.playerCount
    });

    // Stage 3: Locations（AI生成 + フォールバック）
    await updateProgress("locations", 40, "舞台を構築中...");

    const locations = await generateLocations(timeline.intro, params.genre, params.playerCount);
    logger.info("Locations generated", {
      genre: params.genre,
      count: locations.length,
      crimeScene: locations.find(l => l.isCrimeScene)?.name,
      locationNames: locations.map(l => l.name)
    });

    // Stage 4: Cards（リトライ付き、最大3回）
    await updateProgress("cards", 50, "証拠品を配置中...");

    let cards: import("@/core/types").CardDefinition[] = [];
    for (let cardAttempt = 1; cardAttempt <= 3; cardAttempt++) {
      try {
        cards = await generateCardSlots(timeline, characters, locations);
        if (cards.length > 0) break;
        logger.warn(`Card generation attempt ${cardAttempt} returned 0 cards, retrying...`);
      } catch (cardError) {
        logger.warn(`Card generation attempt ${cardAttempt} failed`, { error: cardError });
        if (cardAttempt === 3) {
          throw new Error(`Card generation failed after 3 attempts: ${cardError}`);
        }
      }
    }

    // Stage 5: Images（並列で画像生成を実行）
    await updateProgress("images", 60, "キャラクター画像を生成中...");

    // 画像アップロード用のバケットを事前に確認・作成
    const imageBucketName = `${process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-images`;
    try {
      await ensureBucketExists(imageBucketName);
      logger.info("Image bucket ensured", { bucket: imageBucketName });
    } catch (bucketError) {
      logger.warn("Failed to ensure image bucket exists, will try to create on upload", {
        bucket: imageBucketName,
        error: bucketError,
      });
    }

    // 画像生成を並列実行（失敗してもシナリオ生成は続行）
    // ※ 並列実行数を制限してリージョンマネージャーの競合を防ぐ
    const CONCURRENT_LIMIT = 2;
    let completedCount = 0;

    /**
     * 単一キャラクターの画像生成処理
     */
    const generateImageForCharacter = async (char: CharacterDefinition, globalIndex: number) => {
      try {
        logger.info(`Generating image for character: ${char.name}`);

        // Gemini Imageで画像生成
        const dataUrl = await generateBaseCharacterImage(char, params.artStyle as ArtStyle);

        // Data URLからBase64データを抽出
        const base64Match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!base64Match) {
          throw new Error("Invalid image data URL format");
        }

        const mimeType = base64Match[1];
        const base64Data = base64Match[2];

        // Cloud Storageにアップロード
        const fileName = `characters/${jobId}/${char.id}_base.png`;
        const publicUrl = await uploadBase64ToStorage(
          base64Data,
          fileName,
          mimeType,
          `${process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-images`
        );

        // キャラクターにURLを設定
        char.images = {
          base: publicUrl,
          angry: publicUrl, // 表情差分は後で生成
          sad: publicUrl,
          nervous: publicUrl,
        };

        logger.info(`Image generated for ${char.name}: ${publicUrl}`);

        // 進捗更新
        completedCount++;
        const progressPercent = 60 + Math.floor(completedCount / characters.length * 20);
        await updateProgress("images", progressPercent, `${char.name}の画像を生成完了 (${completedCount}/${characters.length})`);

      } catch (error) {
        logger.warn(`Failed to generate image for ${char.name}, using placeholder`, { error });
        // 失敗時はプレースホルダーを使用
        const placeholderUrl = `/placeholder/character_${(globalIndex % 6) + 1}.png`;
        char.images = {
          base: placeholderUrl,
          angry: placeholderUrl,
          sad: placeholderUrl,
          nervous: placeholderUrl,
        };
        completedCount++;
      }
    };

    // 2件ずつ順次実行（リージョン競合を回避）
    for (let i = 0; i < characters.length; i += CONCURRENT_LIMIT) {
      const chunk = characters.slice(i, i + CONCURRENT_LIMIT);
      const promises = chunk.map(async (char, chunkIndex) => {
        // 各リクエスト間に少し待機を入れてレート制限を回避
        if (chunkIndex > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        return generateImageForCharacter(char, i + chunkIndex);
      });
      // チャンク内の処理を待機してから次のチャンクへ
      await Promise.allSettled(promises);
    }

    // Stage 5.5: Background Image生成
    await updateProgress("images", 82, "背景画像を生成中...");

    let backgroundImageUrl: string | undefined;
    try {
      // 背景画像を生成（タイムラインで生成されたカスタムプロンプトを使用）
      const scenarioMeta = {
        title: `${params.genre}の事件`,
        genre: params.genre,
        description: timeline.intro,
      };

      // タイムラインで生成されたカスタムプロンプトがあれば使用
      const customBgPrompt = timeline.backgroundImagePrompt;
      if (customBgPrompt) {
        logger.info("Using custom background prompt from timeline", {
          promptLength: customBgPrompt.length,
        });
      }

      const bgDataUrl = await generateBackgroundImage(
        scenarioMeta,
        params.artStyle as ArtStyle,
        customBgPrompt
      );

      // Data URLからBase64データを抽出
      const base64Match = bgDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        const mimeType = base64Match[1];
        const base64Data = base64Match[2];

        // Cloud Storageにアップロード
        const fileName = `backgrounds/${jobId}/main.png`;
        backgroundImageUrl = await uploadBase64ToStorage(
          base64Data,
          fileName,
          mimeType,
          `${process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-images`
        );

        logger.info("Background image generated", { backgroundImageUrl });
      }
    } catch (bgError) {
      logger.warn("Failed to generate background image, using default", { error: bgError });
      // 失敗時はデフォルト画像を使用（MapViewがフォールバック対応済み）
      backgroundImageUrl = "/images/background_test01.png";
    }

    // undefinedの場合もデフォルト画像を設定
    if (!backgroundImageUrl) {
      backgroundImageUrl = "/images/background_test01.png";
    }

    // Stage 6: Final Review & Validation
    await updateProgress("validation", 85, "整合性を検証中...");

    // Final Review & Adjustment Layer
    const reviewResult = await performFinalReview({
      timeline,
      characters,
      locations,
      cards,
    });

    logger.info("Final review completed", {
      isValid: reviewResult.isValid,
      wasAdjusted: reviewResult.wasAdjusted,
      issueCount: reviewResult.issues.length,
      errors: reviewResult.issues.filter(i => i.severity === "error").length,
      warnings: reviewResult.issues.filter(i => i.severity === "warning").length,
    });

    // 修正があれば反映
    const finalCharacters = reviewResult.adjustedCharacters || characters;
    const finalCards = reviewResult.adjustedCards || cards;

    // レビュー結果をログに残す（デバッグ用）
    if (reviewResult.issues.length > 0) {
      logger.warn("Scenario review issues", {
        issues: reviewResult.issues.map(i => ({
          category: i.category,
          severity: i.severity,
          description: i.description,
        })),
      });
    }

    // Stage 6.5: プロローグナレーション事前生成（並列実行可能）
    await updateProgress("validation", 90, "ナレーションを生成中...");

    let prologueNarrationUrl: string | undefined;
    try {
      const narrationResult = await generatePrologueNarration(timeline.intro, jobId);
      if (narrationResult) {
        prologueNarrationUrl = narrationResult;
        logger.info("Prologue narration generated", { prologueNarrationUrl });
      }
    } catch (narrationError) {
      logger.warn("Failed to generate prologue narration, continuing without it", { error: narrationError });
      // ナレーション生成失敗でもシナリオ生成は続行
    }

    await updateProgress("validation", 95, "シナリオを完成中...");

    // 完成したシナリオを作成
    const scenario: Scenario = {
      id: `scenario_${jobId}`,
      authorId: params.userId,
      authorName: params.userName,
      isPublished: false,
      status: "ready",
      jobId,
      createdAt: Timestamp.now() as unknown as ClientTimestamp,
      meta: {
        title: `${params.genre}の事件`,
        description: timeline.intro,
        genre: params.genre,
        difficulty: params.difficulty,
        playTimeMin: 90,
        artStyle: params.artStyle as any,
        playCount: 0,
        stars: 0,
        tags: []
      },
      data: {
        introText: timeline.intro,
        backgroundImageUrl, // 動的生成された背景画像URL
        prologueNarrationUrl: prologueNarrationUrl ?? null, // 事前生成されたナレーション音声URL（失敗時はnull）
        truth: {
          culpritId: timeline.culpritId,
          victimId: timeline.victimId || "char_victim", // 被害者ID（プレイアブルキャラクターから除外される）
          trickExplanation: timeline.trickExplanation,
          masterTimeline: timeline.masterTimeline
        },
        locations,
        characters: finalCharacters,
        cards: finalCards
      }
    };

    // Firestoreに保存（undefinedをサニタイズ）
    await adminDb.collection("scenarios").doc(scenario.id).set(removeUndefined(scenario));

    // Job完了
    await adminDb.collection("scenarioJobs").doc(jobId).update({
      status: "completed",
      result: removeUndefined(scenario),
      progress: { stage: "completed", percentage: 100, message: "完了" },
      updatedAt: Timestamp.now()
    });

    console.log("[API] Scenario generation completed:", scenario.id);

  } catch (error) {
    console.error("[API] Scenario generation error:", error);
    throw error;
  }
}

// モックキャラクター生成は削除されました
// キャラクターは generateCharacters() で動的に生成されます
