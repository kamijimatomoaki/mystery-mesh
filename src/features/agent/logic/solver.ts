/**
 * Solver Agent Logic
 * AIがミステリーを解いて犯人を特定する
 */
import { generateJSON } from "@/core/llm/vertex-text";
import { z } from "zod";
import { adminDb } from "@/core/db/firestore-admin";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario, CharacterDefinition } from "@/core/types";

/**
 * 推理結果のZodスキーマ
 */
const SolveResultSchema = z.object({
  culpritId: z.string(),
  culpritName: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
  suspicionLevels: z.array(z.object({
    characterId: z.string(),
    characterName: z.string(),
    suspicionLevel: z.number(),
    evidence: z.array(z.string()),
  })),
  timeline: z.array(z.object({
    time: z.string(),
    event: z.string(),
    involvedCharacters: z.array(z.string()),
  })),
  keyEvidence: z.array(z.string()),
});

/**
 * ヒント出力のZodスキーマ
 */
const HintSchema = z.object({
  hint: z.string(),
});

const logger = createModuleLogger("SolverAgent");

/**
 * 推理結果
 */
export interface SolveResult {
  culpritId: string; // 犯人のキャラクターID
  culpritName: string; // 犯人の名前
  confidence: number; // 確信度（0-100）
  reasoning: string; // 推理の根拠
  suspicionLevels: Array<{
    characterId: string;
    characterName: string;
    suspicionLevel: number; // 疑惑度（0-100）
    evidence: string[]; // 証拠リスト
  }>;
  timeline: Array<{
    time: string;
    event: string;
    involvedCharacters: string[];
  }>;
  keyEvidence: string[]; // 決定的な証拠
}

/**
 * AIによるミステリー解決
 * @param gameId - ゲームID
 * @returns 推理結果
 */
export async function solveMystery(gameId: string): Promise<SolveResult> {
  logger.info("Solving mystery", { gameId });

  // ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    throw new Error(`Game not found: ${gameId}`);
  }
  const game = gameDoc.data() as GameState;

  // シナリオを取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  if (!scenarioDoc.exists) {
    throw new Error(`Scenario not found: ${game.scenarioId}`);
  }
  const scenario = scenarioDoc.data() as Scenario;

  // すべてのメッセージを取得（logsコレクションから取得する必要があるが、簡略化のため空配列）
  const messages: any[] = [];

  // すべてのカード情報を取得（公開されたカードのみ）
  const cardsSnapshot = await adminDb
    .collection("games")
    .doc(gameId)
    .collection("cards")
    .where("isRevealed", "==", true)
    .get();

  const revealedCards = cardsSnapshot.docs.map((doc) => doc.data());

  // Geminiに推理を依頼
  const prompt = buildSolverPrompt(scenario, messages, revealedCards);

  const solveResult = await generateJSON<SolveResult>(prompt, {
    temperature: 0.3,
    maxTokens: 16384,
    schema: SolveResultSchema,
  });

  logger.info("Mystery solved", {
    gameId,
    culpritId: solveResult.culpritId,
    confidence: solveResult.confidence,
  });

  // Firestoreに推理結果を保存
  await adminDb.collection("games").doc(gameId).collection("solverResults").add({
    ...solveResult,
    solvedAt: new Date(),
  });

  return solveResult;
}

/**
 * Solver用プロンプトを構築
 */
function buildSolverPrompt(
  scenario: Scenario,
  messages: any[],
  revealedCards: any[]
): string {
  const characters = scenario.data.characters.map((c) => `- ${c.name}（${c.id}）: ${c.description}`).join("\n");

  // 真相のマスタータイムラインを使用
  const timeline = scenario.data.truth.masterTimeline
    .map((e) => `- ${e.time}: ${e.event}`)
    .join("\n");

  const messagesSummary = messages
    .map((msg) => `[${msg.senderName}]: ${msg.content}`)
    .slice(-50) // 最新50件のみ
    .join("\n");

  const cardsSummary = revealedCards
    .map((card) => `- ${card.title}: ${card.description} [所有者: ${card.ownerId || "不明"}]`)
    .join("\n");

  return `# ミステリー推理タスク

あなたは名探偵です。以下の情報を基に、誰が犯人かを推理してください。

## シナリオ情報
**タイトル**: ${scenario.meta.title}
**説明**: ${scenario.meta.description}

## 登場人物
${characters}

## 事件のタイムライン
${timeline}

## ゲーム中の会話（最新50件）
${messagesSummary || "（会話なし）"}

## 公開されたカード情報
${cardsSummary || "（公開カードなし）"}

---

**指示**:
1. すべての証拠を整理してください
2. 各キャラクターの疑惑度を0-100で評価してください
3. 最も疑わしいキャラクターを犯人として特定してください
4. 推理の根拠を明確に説明してください
5. 事件の真相タイムラインを構築してください
6. 決定的な証拠をリストアップしてください

**出力形式**:
- culpritId: 犯人のキャラクターID
- culpritName: 犯人の名前
- confidence: 確信度（0-100）
- reasoning: 推理の根拠（詳細に）
- suspicionLevels: 各キャラクターの疑惑度と証拠
- timeline: 事件の真相タイムライン
- keyEvidence: 決定的な証拠のリスト
`;
}

/**
 * 真相との答え合わせ
 * @param gameId - ゲームID
 * @param solveResult - 推理結果
 * @returns 正解かどうか
 */
export async function verifySolution(gameId: string, solveResult: SolveResult): Promise<{
  isCorrect: boolean;
  actualCulpritId: string;
  actualCulpritName: string;
  feedback: string;
}> {
  logger.info("Verifying solution", { gameId, culpritId: solveResult.culpritId });

  // ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    throw new Error(`Game not found: ${gameId}`);
  }
  const game = gameDoc.data() as GameState;

  // シナリオを取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  if (!scenarioDoc.exists) {
    throw new Error(`Scenario not found: ${game.scenarioId}`);
  }
  const scenario = scenarioDoc.data() as Scenario;

  // 真相と比較
  const actualCulpritId = scenario.data.truth.culpritId;
  const actualCulprit = scenario.data.characters.find((c) => c.id === actualCulpritId);
  const actualCulpritName = actualCulprit?.name || "不明";

  const isCorrect = solveResult.culpritId === actualCulpritId;

  const feedback = isCorrect
    ? `正解です！犯人は ${actualCulpritName} でした。推理の精度: ${solveResult.confidence}%`
    : `不正解です。あなたは ${solveResult.culpritName} を犯人と推理しましたが、実際の犯人は ${actualCulpritName} でした。`;

  logger.info("Solution verified", {
    gameId,
    isCorrect,
    actualCulpritId,
    guessedCulpritId: solveResult.culpritId,
  });

  return {
    isCorrect,
    actualCulpritId,
    actualCulpritName,
    feedback,
  };
}

/**
 * ヒントを生成
 * @param gameId - ゲームID
 * @returns ヒント
 */
export async function generateHint(gameId: string): Promise<string> {
  logger.info("Generating hint", { gameId });

  // ゲーム状態を取得
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    throw new Error(`Game not found: ${gameId}`);
  }
  const game = gameDoc.data() as GameState;

  // シナリオを取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  if (!scenarioDoc.exists) {
    throw new Error(`Scenario not found: ${game.scenarioId}`);
  }
  const scenario = scenarioDoc.data() as Scenario;

  // すべてのメッセージを取得（logsコレクションから取得する必要があるが、簡略化のため空配列）
  const messages: any[] = [];

  // Geminiにヒント生成を依頼
  const prompt = `# ミステリーゲームのヒント生成

あなたはゲームマスターです。プレイヤーが行き詰まっているようなので、ヒントを提供してください。

## シナリオ情報
**タイトル**: ${scenario.meta.title}
**説明**: ${scenario.meta.description}

## ゲーム中の会話（最新30件）
${messages.map((msg) => `[${msg.senderName}]: ${msg.content}`).slice(-30).join("\n")}

**指示**:
- プレイヤーが気づいていない重要な手がかりを1つ示唆してください
- 直接的に犯人を教えないでください
- 考え方のヒントを与えてください
- 1-2文で簡潔に

**出力**: ヒント文章のみ
`;

  const hint = await generateJSON<{ hint: string }>(prompt, {
    temperature: 0.5,
    maxTokens: 1024,
    schema: HintSchema,
  });

  logger.info("Hint generated", { gameId, hint: hint.hint.slice(0, 50) });

  return hint.hint;
}
