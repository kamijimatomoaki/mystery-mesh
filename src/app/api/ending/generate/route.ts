/**
 * POST /api/ending/generate
 * エピローグテキスト生成API（Polling Pattern）
 * 投票結果・ゲーム状態を基にGeminiでエピローグナレーションを生成
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { generateText, generateJSON } from "@/core/llm/vertex-text";
import { withErrorHandler, NotFoundError, ValidationError } from "@/core/utils/errors";
import { validateRequest } from "@/core/validation/helpers";
import { createModuleLogger } from "@/core/utils/logger";
import { withRetry } from "@/core/utils/async";
import type { GameState, Scenario } from "@/core/types";
import { checkUserRateLimit } from "@/core/security/middleware";

const logger = createModuleLogger("EndingGenerate");

const GenerateEndingRequestSchema = z.object({
  gameId: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const rateLimitResponse = await checkUserRateLimit(request, "endingGeneration");
  if (rateLimitResponse) return rateLimitResponse;

  const body = await request.json();
  const validated = validateRequest(body, GenerateEndingRequestSchema);

  logger.info("Epilogue generation requested", { gameId: validated.gameId });

  // H4: フェーズチェック — ending/votingフェーズ以外では生成を拒否
  const gameCheckDoc = await adminDb.collection("games").doc(validated.gameId).get();
  if (!gameCheckDoc.exists) {
    throw new NotFoundError("Game", validated.gameId);
  }
  const gameCheckData = gameCheckDoc.data() as GameState;
  if (gameCheckData.phase !== "ending" && gameCheckData.phase !== "voting") {
    throw new ValidationError(
      `エンディング生成は投票フェーズまたはエンディングフェーズでのみ実行できます（現在: ${gameCheckData.phase}）`
    );
  }

  // Job IDを生成
  const jobId = `ending_job_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  // Firestoreにジョブを保存
  await adminDb.collection("endingJobs").doc(jobId).set({
    id: jobId,
    status: "processing",
    gameId: validated.gameId,
    progress: { percentage: 0, message: "エピローグを準備中..." },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  // バックグラウンドでエピローグ生成開始
  executeEpilogueGeneration(jobId, validated.gameId).catch(async (error) => {
    logger.error("Epilogue generation failed", error as Error, { jobId });
    await adminDb.collection("endingJobs").doc(jobId).update({
      status: "failed",
      error: String(error),
      updatedAt: Timestamp.now(),
    });
  });

  return NextResponse.json({ jobId });
}, "EndingGenerate");

/**
 * バックグラウンドでエピローグ生成を実行
 */
async function executeEpilogueGeneration(jobId: string, gameId: string) {
  const updateProgress = async (percentage: number, message: string) => {
    await adminDb.collection("endingJobs").doc(jobId).update({
      progress: { percentage, message },
      updatedAt: Timestamp.now(),
    });
  };

  try {
    // Step 1: ゲーム情報を取得
    await updateProgress(10, "ゲーム情報を取得中...");
    const gameDoc = await adminDb.collection("games").doc(gameId).get();
    if (!gameDoc.exists) throw new Error("Game not found");
    const game = gameDoc.data() as GameState;

    // Step 2: シナリオを取得
    await updateProgress(20, "シナリオを取得中...");
    const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
    if (!scenarioDoc.exists) throw new Error("Scenario not found");
    const scenario = scenarioDoc.data() as Scenario;

    // Step 3: 投票結果を集計
    await updateProgress(30, "投票結果を集計中...");
    const votes = game.votes || {};
    const truth = scenario.data.truth;
    const culprit = scenario.data.characters.find((c) => c.id === truth.culpritId);
    const culpritName = culprit?.name || "犯人";

    // 正解者カウント
    const correctVoters = Object.entries(votes)
      .filter(([_, targetId]) => targetId === truth.culpritId)
      .map(([voterId]) => voterId);

    const totalVoters = Object.keys(votes).length;
    const isCorrectMajority = correctVoters.length > totalVoters / 2;

    // Step 4: MVP算出（Gemini判定、フォールバック: ルールベース）
    await updateProgress(40, "MVPをGeminiで判定中...");
    let mvpResult: MVPResult;
    try {
      mvpResult = await calculateMVPWithGemini(gameId, game, scenario, votes);
    } catch (error) {
      logger.warn("Gemini MVP calculation failed, falling back to rule-based", {
        gameId, error: error instanceof Error ? error.message : "unknown",
      });
      mvpResult = await calculateMVP(gameId, game, scenario, votes);
    }

    // Step 5: エピローグテキスト生成
    await updateProgress(60, "エピローグを執筆中...");
    const epilogueText = await withRetry(
      () => generateEpilogueText(scenario, game, votes, isCorrectMajority, culpritName, mvpResult.mvpName),
      2, // 最大2回リトライ
      2000, // 2秒間隔
      2
    );

    // Step 6: ゲームのendingDataを更新
    await updateProgress(90, "結果を保存中...");
    await adminDb.collection("games").doc(gameId).update({
      endingData: {
        resultText: epilogueText,
        movieUrl: game.endingData?.movieUrl || null,
        mvpAgentId: mvpResult.mvpId,
        mvpReasoning: mvpResult.mvpReasoning || null,
        characterHighlights: mvpResult.characterHighlights || null,
        votes,
      },
      updatedAt: Timestamp.now(),
    });

    // Step 7: 完了
    await adminDb.collection("endingJobs").doc(jobId).update({
      status: "completed",
      result: {
        epilogueText,
        mvpAgentId: mvpResult.mvpId,
        mvpAgentName: mvpResult.mvpName,
        mvpScore: mvpResult.mvpScore,
        mvpReasoning: mvpResult.mvpReasoning || null,
        characterHighlights: mvpResult.characterHighlights || null,
        scoreBreakdown: mvpResult.scores,
      },
      progress: { percentage: 100, message: "完了" },
      updatedAt: Timestamp.now(),
    });

    logger.info("Epilogue generation completed", { jobId, gameId });
  } catch (error) {
    logger.error("Epilogue generation error", error as Error, { jobId });
    throw error;
  }
}

/**
 * Geminiでエピローグテキストを生成
 */
async function generateEpilogueText(
  scenario: Scenario,
  game: GameState,
  votes: Record<string, string>,
  isCorrectMajority: boolean,
  culpritName: string,
  mvpName: string
): Promise<string> {
  const truth = scenario.data.truth;

  const prompt = `あなたはマーダーミステリーゲームの司書（GM）です。ゲーム終了後のエピローグナレーションを生成してください。

## シナリオ情報
- タイトル: ${scenario.meta.title}
- ジャンル: ${scenario.meta.genre}
- 犯人: ${culpritName}
- トリック: ${truth.trickExplanation}
- 導入: ${scenario.data.introText.slice(0, 200)}

## ゲーム結果
- 投票で正解した人が多数派: ${isCorrectMajority ? "はい（探偵たちの勝利）" : "いいえ（犯人の勝利）"}
- 総投票数: ${Object.keys(votes).length}
- MVP: ${mvpName}

## タイムライン（真相）
${truth.masterTimeline.slice(0, 6).map((e) => `${e.time} - ${e.event} (${e.isTrue ? "事実" : "偽装"})`).join("\n")}

## 出力要件
- Dark Academiaの世界観に合った格調高い文体で
- 300〜500文字程度
- 結末の種類に応じた雰囲気（正解→カタルシス、不正解→悲壮感）
- 犯人の動機とトリックの概要を含める
- 最後にMVPへの賛辞を一文添える
- 改行で段落を分ける`;

  const text = await generateText(prompt, {
    temperature: 0.8,
    maxTokens: 2048,
    systemInstruction: "あなたは「無限の謎の図書館」の司書です。Dark Academiaの世界観でエピローグを語ってください。",
  });

  return text.trim();
}

/**
 * MVP結果の型
 */
interface CharacterHighlight {
  characterId: string;
  characterName: string;
  highlight: string;
  votedFor: string;
  performance: "excellent" | "good" | "notable";
}

interface MVPResult {
  mvpId: string;
  mvpName: string;
  mvpScore: number;
  mvpReasoning?: string;
  characterHighlights?: CharacterHighlight[];
  scores: Record<string, { total: number; correctVote: number; contradictions: number; investigation: number; reasoning: number }>;
}

/**
 * Gemini MVP判定スキーマ
 */
const GeminiMVPResponseSchema = z.object({
  mvpPlayerId: z.string(),
  mvpReasoning: z.string(),
  characterHighlights: z.array(z.object({
    characterId: z.string(),
    characterName: z.string(),
    highlight: z.string(),
    votedFor: z.string(),
    performance: z.enum(["excellent", "good", "notable"]),
  })),
});

/**
 * GeminiでMVPを判定
 */
async function calculateMVPWithGemini(
  gameId: string,
  game: GameState,
  scenario: Scenario,
  votes: Record<string, string>
): Promise<MVPResult> {
  const truth = scenario.data.truth;
  const characters = scenario.data.characters;

  // 入力データを構築
  const playerInfoList: string[] = [];
  const logSummaries: string[] = [];

  for (const [playerId, player] of Object.entries(game.players)) {
    if (!player.characterId) continue;

    const char = characters.find(c => c.id === player.characterId);
    const charName = char?.name || player.characterId;
    const votedFor = votes[playerId];
    const votedForChar = votedFor ? characters.find(c => c.id === votedFor) : null;
    const votedForName = votedForChar?.name || votedFor || "未投票";
    const isCorrect = votedFor === truth.culpritId;

    playerInfoList.push(
      `- ${charName}（${player.isHuman ? "人間" : "AI"}）: 職業=${char?.job || "不明"}, 秘密の目標="${char?.handout?.secretGoal || "不明"}", 投票先=${votedForName}${isCorrect ? "（正解）" : "（不正解）"}`
    );

    // ログ取得
    try {
      const logsSnapshot = await adminDb
        .collection("games").doc(gameId).collection("logs")
        .where("actorId", "==", playerId)
        .get();
      const investigateCount = logsSnapshot.docs.filter(d => d.data().type === "investigate").length;
      const talkCount = logsSnapshot.docs.filter(d => d.data().type === "talk").length;
      logSummaries.push(`${charName}: 調査${investigateCount}回, 発言${talkCount}回`);
    } catch {
      logSummaries.push(`${charName}: ログ取得失敗`);
    }

    // 議論メッセージ取得（最大10件、100文字ずつ要約）
    try {
      const messagesSnapshot = await adminDb
        .collection("games").doc(gameId).collection("messages")
        .where("senderId", "==", playerId)
        .get();
      const msgs = messagesSnapshot.docs
        .map(d => d.data().content as string)
        .filter(Boolean)
        .slice(0, 10)
        .map(m => m.slice(0, 100));
      if (msgs.length > 0) {
        logSummaries.push(`${charName}の発言例: ${msgs.join(" / ")}`);
      }
    } catch { /* skip */ }
  }

  const culprit = characters.find(c => c.id === truth.culpritId);
  const culpritName = culprit?.name || "犯人";

  const prompt = `あなたはマーダーミステリーの審判員です。以下のゲーム結果を分析し、MVPを選出してください。

## シナリオ
- タイトル: ${scenario.meta.title}
- 正解の犯人: ${culpritName}（${truth.culpritId}）

## プレイヤー情報
${playerInfoList.join("\n")}

## ゲームログ
${logSummaries.join("\n")}

## 評価基準
1. 正しい犯人に投票したか（最重要）
2. 議論での推理貢献度（鋭い指摘、論理的な推論）
3. 証拠カードの効率的な調査
4. ゲーム全体を盛り上げた度合い

## 出力要件
- mvpPlayerId: MVPのキャラクターID（char_xxx形式）
- mvpReasoning: MVP選出理由（100-200文字、日本語）
- characterHighlights: 全プレイヤーの印象的な行動ハイライト
  - highlight: 50-100文字、そのキャラクターの印象的な行動や貢献
  - votedFor: 投票先のキャラクター名
  - performance: "excellent"（特に優れた）, "good"（良い）, "notable"（注目すべき）

**IMPORTANT: Return ONLY valid JSON.**`;

  const result = await generateJSON<z.infer<typeof GeminiMVPResponseSchema>>(prompt, {
    temperature: 0.5,
    maxTokens: 4096,
    schema: GeminiMVPResponseSchema,
    systemInstruction: "マーダーミステリーゲームのMVP審判員として、公正に評価してJSON形式で出力してください。",
  });

  // MVPプレイヤーIDからplayerIdを解決
  const mvpCharacterId = result.mvpPlayerId;
  let mvpPlayerId = "";
  let mvpName = "";

  for (const [pid, player] of Object.entries(game.players)) {
    if (player.characterId === mvpCharacterId) {
      mvpPlayerId = pid;
      const char = characters.find(c => c.id === mvpCharacterId);
      mvpName = char?.name || player.displayName || pid;
      break;
    }
  }

  // フォールバック: マッチしなかった場合は最初のプレイヤー
  if (!mvpPlayerId) {
    const firstEntry = Object.entries(game.players)[0];
    if (firstEntry) {
      mvpPlayerId = firstEntry[0];
      const char = characters.find(c => c.id === firstEntry[1].characterId);
      mvpName = char?.name || firstEntry[1].displayName || mvpPlayerId;
    }
  }

  return {
    mvpId: mvpPlayerId,
    mvpName,
    mvpScore: 100,
    mvpReasoning: result.mvpReasoning,
    characterHighlights: result.characterHighlights,
    scores: {}, // Gemini判定ではルールベーススコアは使用しない
  };
}

/**
 * MVPを算出（ルールベース、フォールバック用）
 */
async function calculateMVP(
  gameId: string,
  game: GameState,
  scenario: Scenario,
  votes: Record<string, string>
): Promise<MVPResult> {
  const truth = scenario.data.truth;
  const scores: Record<string, { total: number; correctVote: number; contradictions: number; investigation: number; reasoning: number }> = {};

  // 全プレイヤーを取得
  for (const [playerId, player] of Object.entries(game.players)) {
    let correctVote = 0;
    let contradictions = 0;
    let investigation = 0;
    let reasoning = 0;

    // 正解投票（+50）
    if (votes[playerId] === truth.culpritId) {
      correctVote = 50;
    }

    // ログから調査効率を計算
    try {
      const logsSnapshot = await adminDb
        .collection("games")
        .doc(gameId)
        .collection("logs")
        .where("actorId", "==", playerId)
        .get();

      const investigateCount = logsSnapshot.docs.filter((d) => d.data().type === "investigate").length;
      investigation = Math.min(investigateCount * 5, 15); // 最大15点

      // 発言の推理貢献度（発言数ベースの簡易計算）
      const talkCount = logsSnapshot.docs.filter((d) => d.data().type === "talk").length;
      reasoning = Math.min(talkCount * 3, 15); // 最大15点
    } catch {
      // ログ取得失敗時は0点
    }

    // H2: 矛盾発見/分析スコア — 人間とAIを公平に評価
    if (!player.isHuman) {
      // AIの場合はagentBrainの矛盾発見データを使用
      try {
        const agentId = `agent_${playerId}`;
        const brainDoc = await adminDb
          .collection("games")
          .doc(gameId)
          .collection("agentBrains")
          .doc(agentId)
          .get();
        if (brainDoc.exists) {
          const brain = brainDoc.data();
          const contradictionCount = (brain?.knowledgeBase?.contradictions || []).length;
          contradictions = Math.min(contradictionCount * 10, 20); // 最大20点
        }
      } catch {
        // 取得失敗時は0点
      }
    } else {
      // 人間の場合は議論への貢献度（発言数 + カード公開数）で評価
      try {
        const messagesSnapshot = await adminDb
          .collection("games")
          .doc(gameId)
          .collection("messages")
          .where("senderId", "==", playerId)
          .get();
        const messageCount = messagesSnapshot.size;
        // カード公開数
        const revealedCards = Object.values(game.cards || {}).filter(
          (c) => c.ownerId === playerId && c.isRevealed
        ).length;
        // 発言数ベース（最大10点）+ カード公開ボーナス（最大10点）
        contradictions = Math.min(messageCount * 2, 10) + Math.min(revealedCards * 5, 10);
      } catch {
        // 取得失敗時は0点
      }
    }

    const total = correctVote + contradictions + investigation + reasoning;
    scores[playerId] = { total, correctVote, contradictions, investigation, reasoning };
  }

  // MVPを決定
  let mvpId = "";
  let mvpScore = -1;
  for (const [playerId, score] of Object.entries(scores)) {
    if (score.total > mvpScore) {
      mvpScore = score.total;
      mvpId = playerId;
    }
  }

  // MVP名を解決
  const mvpPlayer = game.players[mvpId];
  let mvpName = mvpPlayer?.displayName || "不明";
  if (mvpPlayer?.characterId) {
    const char = scenario.data.characters.find((c) => c.id === mvpPlayer.characterId);
    if (char) mvpName = char.name;
  }

  return { mvpId, mvpName, mvpScore, scores };
}
