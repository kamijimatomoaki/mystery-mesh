/**
 * Discussion Summarizer Logic
 * 議論サマライザーのコアロジック
 *
 * 定期的に議論の客観的サマリーを生成し、
 * 全エージェントの共有記憶として機能する
 */

import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import { getVertexAI, executeWithRetry } from "@/core/llm/vertex-client";
import type { GenerateContentRequest } from "@google-cloud/vertexai";
import type { DiscussionSummary } from "../types";
import {
  getSummarizerSystemPrompt,
  buildSummarizerPrompt,
} from "../prompts/summarizer-prompt";

const logger = createModuleLogger("discussion-summarizer");

/** サマライザー更新トリガーの最小メッセージ数 */
const MIN_MESSAGES_FOR_UPDATE = 10;

/** サマライザー用モデル（高速・低コスト） */
const SUMMARIZER_MODEL = "gemini-2.0-flash-lite";

/**
 * ゲームの議論サマリーを更新すべきか判定
 */
export async function shouldUpdateSummary(gameId: string): Promise<boolean> {
  try {
    const summaryRef = adminDb
      .collection("games")
      .doc(gameId)
      .collection("discussionSummary")
      .doc("current");

    const summaryDoc = await summaryRef.get();

    if (!summaryDoc.exists) {
      // サマリーがまだない場合、メッセージが存在すれば更新
      const messagesSnapshot = await adminDb
        .collection("games")
        .doc(gameId)
        .collection("messages")
        .limit(MIN_MESSAGES_FOR_UPDATE)
        .get();

      return messagesSnapshot.size >= MIN_MESSAGES_FOR_UPDATE;
    }

    const summary = summaryDoc.data() as DiscussionSummary;
    return summary.messageCountSinceUpdate >= MIN_MESSAGES_FOR_UPDATE;
  } catch (error) {
    logger.warn("Failed to check summary update condition", { gameId, error: String(error) });
    return false;
  }
}

/**
 * 議論サマリーを更新
 *
 * @param gameId - ゲームID
 * @returns 更新成功かどうか
 */
export async function updateDiscussionSummary(gameId: string): Promise<boolean> {
  const startTime = Date.now();

  try {
    // 排他制御: 二重実行防止
    const lockRef = adminDb
      .collection("games")
      .doc(gameId)
      .collection("discussionSummary")
      .doc("lock");

    const lockResult = await adminDb.runTransaction(async (transaction) => {
      const lockDoc = await transaction.get(lockRef);
      if (lockDoc.exists) {
        const lockData = lockDoc.data();
        if (lockData?.isSummarizing) {
          const lockAge = Date.now() - (lockData.lockedAt?.toMillis() || 0);
          // 5分以上古いロックは無効と見なす
          if (lockAge < 5 * 60 * 1000) {
            return false; // 別のプロセスが実行中
          }
        }
      }
      transaction.set(lockRef, {
        isSummarizing: true,
        lockedAt: Timestamp.now(),
      });
      return true;
    });

    if (!lockResult) {
      logger.debug("Summary update skipped - another process is running", { gameId });
      return false;
    }

    try {
      // 現在のサマリーを取得
      const summaryRef = adminDb
        .collection("games")
        .doc(gameId)
        .collection("discussionSummary")
        .doc("current");

      const summaryDoc = await summaryRef.get();
      const currentSummary = summaryDoc.exists
        ? (summaryDoc.data() as DiscussionSummary)
        : null;

      // 新しいメッセージを取得
      const newMessages = await getNewMessages(gameId, currentSummary);

      if (newMessages.length === 0) {
        logger.debug("No new messages to summarize", { gameId });
        // ロック解除
        await lockRef.set({ isSummarizing: false, lockedAt: null });
        return true;
      }

      // ゲームの現在のフェーズを取得
      const gameDoc = await adminDb.collection("games").doc(gameId).get();
      const gamePhase = gameDoc.data()?.phase || "unknown";

      // Geminiでサマリー生成
      const updatedSummary = await generateSummaryWithGemini(
        currentSummary,
        newMessages,
        gamePhase
      );

      // Firestoreに保存
      await summaryRef.set(updatedSummary);

      // ロック解除
      await lockRef.set({ isSummarizing: false, lockedAt: null });

      const executionTime = Date.now() - startTime;
      logger.info("Discussion summary updated", {
        gameId,
        executionTime,
        factsCount: updatedSummary.establishedFacts.length,
        resolvedQuestionsCount: updatedSummary.resolvedQuestions.length,
        rpActionsCount: updatedSummary.rpActions.length,
        newMessagesProcessed: newMessages.length,
      });

      return true;
    } catch (error) {
      // エラー時もロック解除
      await lockRef.set({ isSummarizing: false, lockedAt: null });
      throw error;
    }
  } catch (error) {
    logger.error("Discussion summary update failed", error as Error, { gameId });
    return false;
  }
}

/**
 * 最後のサマリー以降の新しいメッセージを取得
 */
async function getNewMessages(
  gameId: string,
  currentSummary: DiscussionSummary | null
): Promise<{ speaker: string; speakerName: string; content: string; messageId: string }[]> {
  let query = adminDb
    .collection("games")
    .doc(gameId)
    .collection("messages")
    .orderBy("timestamp", "asc");

  // 最後に処理したメッセージ以降を取得
  if (currentSummary?.lastMessageIdProcessed) {
    try {
      const lastMsgDoc = await adminDb
        .collection("games")
        .doc(gameId)
        .collection("messages")
        .doc(currentSummary.lastMessageIdProcessed)
        .get();

      if (lastMsgDoc.exists) {
        const lastTimestamp = lastMsgDoc.data()?.timestamp;
        if (lastTimestamp) {
          query = query.where("timestamp", ">", lastTimestamp);
        }
      }
    } catch {
      // フォールバック: 全メッセージを取得
    }
  }

  // 最大100メッセージまで取得（パフォーマンス制限）
  const messagesSnapshot = await query.limit(100).get();

  return messagesSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      speaker: data.senderId,
      speakerName: data.senderName,
      content: data.content || "",
      messageId: doc.id,
    };
  });
}

/**
 * Geminiでサマリーを生成
 */
async function generateSummaryWithGemini(
  currentSummary: DiscussionSummary | null,
  newMessages: { speaker: string; speakerName: string; content: string; messageId: string }[],
  currentPhase: string
): Promise<DiscussionSummary> {
  const prompt = buildSummarizerPrompt(currentSummary, newMessages);
  const systemInstruction = getSummarizerSystemPrompt();

  const result = await executeWithRetry(
    async () => {
      const vertexAI = getVertexAI();
      const model = vertexAI.getGenerativeModel({
        model: SUMMARIZER_MODEL,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
        systemInstruction,
      });

      const request: GenerateContentRequest = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      };

      const response = await model.generateContent(request);
      const responseText =
        response.response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        throw new Error("Empty response from summarizer AI");
      }

      return responseText;
    },
    "summarizer",
    2
  );

  // JSONパース
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(result);
  } catch {
    logger.warn("Summarizer JSON parse failed, attempting extraction");
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to extract JSON from summarizer response");
    }
    parsed = JSON.parse(jsonMatch[0]);
  }

  const lastMessageId = newMessages[newMessages.length - 1]?.messageId || "";

  // DiscussionSummaryオブジェクトを構築
  return {
    establishedFacts: Array.isArray(parsed.establishedFacts)
      ? (parsed.establishedFacts as DiscussionSummary["establishedFacts"])
      : currentSummary?.establishedFacts || [],
    resolvedQuestions: Array.isArray(parsed.resolvedQuestions)
      ? (parsed.resolvedQuestions as DiscussionSummary["resolvedQuestions"]).map((q) => ({
          ...q,
          timestamp: Timestamp.now(),
        }))
      : currentSummary?.resolvedQuestions || [],
    openQuestions: Array.isArray(parsed.openQuestions)
      ? (parsed.openQuestions as string[])
      : currentSummary?.openQuestions || [],
    topicsDiscussed: Array.isArray(parsed.topicsDiscussed)
      ? (parsed.topicsDiscussed as DiscussionSummary["topicsDiscussed"]).map((t) => ({
          ...t,
          lastMentionedAt: Timestamp.now(),
        }))
      : currentSummary?.topicsDiscussed || [],
    rpActions: Array.isArray(parsed.rpActions)
      ? (parsed.rpActions as DiscussionSummary["rpActions"]).map((a) => ({
          ...a,
          acknowledgedBy: a.acknowledgedBy || [],
          timestamp: Timestamp.now(),
        }))
      : currentSummary?.rpActions || [],
    contradictionsNoted: Array.isArray(parsed.contradictionsNoted)
      ? (parsed.contradictionsNoted as string[])
      : currentSummary?.contradictionsNoted || [],

    lastMessageIdProcessed: lastMessageId,
    messageCountSinceUpdate: 0, // リセット
    summaryVersion: (currentSummary?.summaryVersion || 0) + 1,
    lastUpdatedAt: Timestamp.now(),
    currentPhase,
  };
}

/**
 * メッセージカウントをインクリメント
 * 新しいメッセージが投稿されるたびに呼ばれる
 */
export async function incrementMessageCount(gameId: string): Promise<void> {
  try {
    const summaryRef = adminDb
      .collection("games")
      .doc(gameId)
      .collection("discussionSummary")
      .doc("current");

    const summaryDoc = await summaryRef.get();

    if (summaryDoc.exists) {
      const currentCount = (summaryDoc.data() as DiscussionSummary).messageCountSinceUpdate || 0;
      await summaryRef.update({
        messageCountSinceUpdate: currentCount + 1,
      });
    } else {
      // 初回: サマリードキュメントを初期化
      const initialSummary: DiscussionSummary = {
        establishedFacts: [],
        resolvedQuestions: [],
        openQuestions: [],
        topicsDiscussed: [],
        rpActions: [],
        contradictionsNoted: [],
        lastMessageIdProcessed: "",
        messageCountSinceUpdate: 1,
        summaryVersion: 0,
        lastUpdatedAt: Timestamp.now(),
        currentPhase: "",
      };
      await summaryRef.set(initialSummary);
    }
  } catch (error) {
    // メッセージカウント失敗はゲーム進行をブロックしない
    logger.warn("Failed to increment message count", { gameId, error: String(error) });
  }
}
