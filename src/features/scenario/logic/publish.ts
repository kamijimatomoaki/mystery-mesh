/**
 * Scenario Publishing Logic
 * シナリオの公開・リスト取得・統計管理
 */
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import type { Scenario } from "@/core/types";

const logger = createModuleLogger("ScenarioPublish");

/**
 * 公開シナリオメタデータ
 */
export interface PublishedScenario {
  id: string;
  originalScenarioId: string; // 元のscenariosコレクションのID
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  artStyle: string;
  tags: string[];
  difficulty: "easy" | "normal" | "hard";
  estimatedPlayTime: number; // 推定プレイ時間（分）
  characterCount: number;
  isPublished: boolean;
  publishedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  stats: {
    playCount: number;
    likeCount: number;
    averageRating: number;
  };
}

/**
 * シナリオを公開する
 * @param scenarioId - シナリオID
 * @param authorId - 作成者ID
 * @param authorName - 作成者名
 * @returns 公開シナリオ情報
 */
export async function publishScenario(
  scenarioId: string,
  authorId: string,
  authorName: string
): Promise<PublishedScenario> {
  logger.info("Publishing scenario", { scenarioId, authorId });

  // シナリオを取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(scenarioId).get();
  if (!scenarioDoc.exists) {
    throw new Error(`Scenario not found: ${scenarioId}`);
  }
  const scenario = scenarioDoc.data() as Scenario;

  // シナリオのバリデーション
  validateScenario(scenario);

  // 公開シナリオメタデータを作成
  const publishedScenario: PublishedScenario = {
    id: scenarioId,
    originalScenarioId: scenarioId,
    title: scenario.meta.title,
    description: scenario.meta.description,
    authorId,
    authorName,
    artStyle: scenario.meta.artStyle,
    tags: scenario.meta.tags || [],
    difficulty: scenario.meta.difficulty || "normal",
    estimatedPlayTime: scenario.meta.playTimeMin || 60,
    characterCount: scenario.data.characters.length,
    isPublished: true,
    publishedAt: Timestamp.now(),
    createdAt: scenario.createdAt || Timestamp.now(),
    updatedAt: Timestamp.now(),
    stats: {
      playCount: 0,
      likeCount: 0,
      averageRating: 0,
    },
  };

  // Firestoreに公開シナリオを保存
  await adminDb.collection("publishedScenarios").doc(scenarioId).set(publishedScenario);

  // シナリオ自体も公開状態に更新
  await adminDb.collection("scenarios").doc(scenarioId).update({
    "meta.isPublished": true,
    "meta.publishedAt": Timestamp.now(),
    isPublished: true,
    status: "published",
    updatedAt: Timestamp.now(),
  });

  logger.info("Scenario published successfully", { scenarioId });

  return publishedScenario;
}

/**
 * シナリオのバリデーション
 * 公開に必要な条件をチェック
 */
function validateScenario(scenario: Scenario): void {
  const errors: string[] = [];

  // タイトルチェック
  if (!scenario.meta.title || scenario.meta.title.trim().length < 3) {
    errors.push("タイトルは3文字以上必要です");
  }

  // 説明チェック
  if (!scenario.meta.description || scenario.meta.description.trim().length < 10) {
    errors.push("説明は10文字以上必要です");
  }

  // キャラクター数チェック
  if (scenario.data.characters.length < 3) {
    errors.push("キャラクターは最低3人必要です");
  }

  // 真相チェック
  if (!scenario.data.truth || !scenario.data.truth.culpritId) {
    errors.push("犯人が設定されていません");
  }

  // カードチェック
  if (!scenario.data.cards || scenario.data.cards.length === 0) {
    errors.push("カードが設定されていません");
  }

  if (errors.length > 0) {
    logger.error("Scenario validation failed", new Error(errors.join(", ")));
    throw new Error(`シナリオのバリデーションに失敗しました: ${errors.join(", ")}`);
  }
}

/**
 * シナリオの公開を取り下げる
 * @param scenarioId - シナリオID
 * @param authorId - 作成者ID（権限チェック用）
 */
export async function unpublishScenario(scenarioId: string, authorId: string): Promise<void> {
  logger.info("Unpublishing scenario", { scenarioId, authorId });

  // 公開シナリオを取得
  const publishedDoc = await adminDb.collection("publishedScenarios").doc(scenarioId).get();
  if (!publishedDoc.exists) {
    throw new Error(`Published scenario not found: ${scenarioId}`);
  }

  const published = publishedDoc.data() as PublishedScenario;

  // 権限チェック
  if (published.authorId !== authorId) {
    throw new Error("Only the author can unpublish the scenario");
  }

  // 公開シナリオを削除
  await adminDb.collection("publishedScenarios").doc(scenarioId).delete();

  // シナリオ自体も非公開状態に更新
  await adminDb.collection("scenarios").doc(scenarioId).update({
    "meta.isPublished": false,
    isPublished: false,
    status: "ready",
    updatedAt: Timestamp.now(),
  });

  logger.info("Scenario unpublished successfully", { scenarioId });
}

/**
 * 公開シナリオのリストを取得
 * @param options - リスト取得オプション
 * @returns 公開シナリオのリスト
 */
export async function listPublishedScenarios(options: {
  limit?: number;
  orderBy?: "playCount" | "likeCount" | "publishedAt" | "averageRating";
  tags?: string[];
  difficulty?: "easy" | "medium" | "hard";
}): Promise<PublishedScenario[]> {
  logger.info("Listing published scenarios", options);

  const { limit = 20, orderBy = "publishedAt", tags, difficulty } = options;

  // コンポジットインデックス不要: where のみでクエリし、ソート・フィルタはJS側で行う
  const snapshot = await adminDb
    .collection("publishedScenarios")
    .where("isPublished", "==", true)
    .limit(200)
    .get();

  let scenarios = snapshot.docs.map((doc) => doc.data() as PublishedScenario);

  // タグフィルター（JS側）
  if (tags && tags.length > 0) {
    scenarios = scenarios.filter((s) =>
      s.tags?.some((tag) => tags.includes(tag))
    );
  }

  // 難易度フィルター（JS側）
  if (difficulty) {
    scenarios = scenarios.filter((s) => s.difficulty === difficulty);
  }

  // ソート（JS側）
  if (orderBy === "playCount") {
    scenarios.sort((a, b) => (b.stats?.playCount || 0) - (a.stats?.playCount || 0));
  } else if (orderBy === "likeCount") {
    scenarios.sort((a, b) => (b.stats?.likeCount || 0) - (a.stats?.likeCount || 0));
  } else if (orderBy === "averageRating") {
    scenarios.sort((a, b) => (b.stats?.averageRating || 0) - (a.stats?.averageRating || 0));
  } else {
    // publishedAt でソート（Timestamp or number）
    scenarios.sort((a, b) => {
      const aTime = a.publishedAt?.toMillis?.() || a.publishedAt || 0;
      const bTime = b.publishedAt?.toMillis?.() || b.publishedAt || 0;
      return (bTime as number) - (aTime as number);
    });
  }

  // 件数制限（JS側）
  scenarios = scenarios.slice(0, limit);

  logger.info("Published scenarios listed", { count: scenarios.length });

  return scenarios;
}

/**
 * シナリオにいいねする
 * @param scenarioId - シナリオID
 * @param userId - ユーザーID
 */
export async function likeScenario(scenarioId: string, userId: string): Promise<void> {
  logger.info("Liking scenario", { scenarioId, userId });

  // 既にいいね済みかチェック
  const likeDoc = await adminDb
    .collection("publishedScenarios")
    .doc(scenarioId)
    .collection("likes")
    .doc(userId)
    .get();

  if (likeDoc.exists) {
    logger.warn("Already liked", { scenarioId, userId });
    return; // 既にいいね済み
  }

  // いいねを記録
  await adminDb
    .collection("publishedScenarios")
    .doc(scenarioId)
    .collection("likes")
    .doc(userId)
    .set({
      userId,
      likedAt: Timestamp.now(),
    });

  // いいねカウントを増やす
  await adminDb
    .collection("publishedScenarios")
    .doc(scenarioId)
    .update({
      "stats.likeCount": FieldValue.increment(1),
    });

  logger.info("Scenario liked successfully", { scenarioId, userId });
}

/**
 * シナリオのいいねを取り消す
 * @param scenarioId - シナリオID
 * @param userId - ユーザーID
 */
export async function unlikeScenario(scenarioId: string, userId: string): Promise<void> {
  logger.info("Unliking scenario", { scenarioId, userId });

  // いいねを削除
  await adminDb
    .collection("publishedScenarios")
    .doc(scenarioId)
    .collection("likes")
    .doc(userId)
    .delete();

  // いいねカウントを減らす
  await adminDb
    .collection("publishedScenarios")
    .doc(scenarioId)
    .update({
      "stats.likeCount": FieldValue.increment(-1),
    });

  logger.info("Scenario unliked successfully", { scenarioId, userId });
}

/**
 * シナリオのプレイ回数を増やす
 * @param scenarioId - シナリオID
 */
export async function incrementPlayCount(scenarioId: string): Promise<void> {
  logger.info("Incrementing play count", { scenarioId });

  await adminDb
    .collection("publishedScenarios")
    .doc(scenarioId)
    .update({
      "stats.playCount": FieldValue.increment(1),
      updatedAt: Timestamp.now(),
    });

  logger.info("Play count incremented", { scenarioId });
}

/**
 * シナリオの統計情報を取得
 * @param scenarioId - シナリオID
 * @returns 統計情報
 */
export async function getScenarioStats(scenarioId: string): Promise<PublishedScenario["stats"]> {
  logger.info("Getting scenario stats", { scenarioId });

  const publishedDoc = await adminDb.collection("publishedScenarios").doc(scenarioId).get();
  if (!publishedDoc.exists) {
    throw new Error(`Published scenario not found: ${scenarioId}`);
  }

  const published = publishedDoc.data() as PublishedScenario;

  return published.stats;
}
