/**
 * Human Profiling Logic
 * AIが人間プレイヤーの行動を分析・推測する
 */

import { generateJSON } from "@/core/llm/vertex-text";
import { z } from "zod";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import type { AgentPerception, RelationshipMatrix } from "../types";
import type { GameState, Scenario } from "@/core/types";
import { resolveCharacterNameFromScenario } from "@/core/utils/character-name";

/**
 * プロファイリング結果のZodスキーマ
 */
const ProfilingResultSchema = z.object({
  suspectedCharacters: z.array(z.object({
    characterId: z.string(),
    estimatedSuspicion: z.number(),
    reason: z.string(),
    confidence: z.number(),
  })),
  behaviorAnalysis: z.object({
    speakingFrequency: z.number(),
    aggressiveness: z.number(),
    defensiveness: z.number(),
    logicalReasoning: z.number(),
  }),
  predictedRole: z.object({
    isCulprit: z.boolean(),
    confidence: z.number(),
    reasoning: z.string(),
  }),
});

const logger = createModuleLogger("agent-profiling");

/**
 * 人間プレイヤーのプロファイリング結果
 */
export interface HumanProfile {
  playerId: string;
  playerName: string;
  suspectedCharacters: Array<{
    characterId: string;
    estimatedSuspicion: number; // 0-100
    reason: string;
    confidence: number; // 推測の確信度 0-100
  }>;
  behaviorAnalysis: {
    speakingFrequency: number; // 発言頻度（回/分）
    aggressiveness: number; // 攻撃性 0-100
    defensiveness: number; // 防衛性 0-100
    logicalReasoning: number; // 論理的思考度 0-100
  };
  predictedRole: {
    isCulprit: boolean; // 犯人である可能性
    confidence: number; // 確信度 0-100
    reasoning: string; // 推論理由
  };
  lastUpdated: Timestamp;
}

/**
 * 人間プレイヤーをプロファイリング
 */
export async function profileHumanPlayer(
  agentId: string,
  gameId: string,
  humanPlayerId: string,
  perception: AgentPerception
): Promise<HumanProfile> {
  logger.info("Starting human profiling", { agentId, humanPlayerId });

  try {
    // 人間プレイヤーの発言を抽出
    const humanMessages = perception.recentMessages.filter(
      (m) => m.speaker === humanPlayerId
    );

    if (humanMessages.length === 0) {
      logger.debug("No messages from human player yet", { humanPlayerId });
      return createEmptyProfile(humanPlayerId, gameId);
    }

    // Geminiで行動分析
    const analysis = await analyzeHumanBehaviorWithGemini(
      humanMessages,
      perception,
      gameId
    );

    // プロファイル作成
    const profile: HumanProfile = {
      playerId: humanPlayerId,
      playerName: humanMessages[0].speakerName,
      suspectedCharacters: analysis.suspectedCharacters,
      behaviorAnalysis: analysis.behaviorAnalysis,
      predictedRole: analysis.predictedRole,
      lastUpdated: Timestamp.now(),
    };

    logger.info("Human profiling completed", {
      agentId,
      humanPlayerId,
      suspectedCount: profile.suspectedCharacters.length,
    });

    return profile;
  } catch (error) {
    logger.error("Human profiling failed", error as Error, {
      agentId,
      humanPlayerId,
    });

    // フォールバック: 簡易プロファイル
    return createSimpleProfile(humanPlayerId, gameId, perception);
  }
}

/**
 * Geminiを使った人間行動分析
 */
async function analyzeHumanBehaviorWithGemini(
  humanMessages: AgentPerception["recentMessages"],
  perception: AgentPerception,
  gameId: string
): Promise<{
  suspectedCharacters: HumanProfile["suspectedCharacters"];
  behaviorAnalysis: HumanProfile["behaviorAnalysis"];
  predictedRole: HumanProfile["predictedRole"];
}> {
  const prompt = buildProfilingPrompt(humanMessages, perception, gameId);

  const result = await generateJSON<ProfilingResult>(prompt, {
    systemInstruction: getProfilingSystemPrompt(),
    temperature: 0.4, // 分析的なタスクなので低め
    maxTokens: 16384,
    schema: ProfilingResultSchema,
  });

  return {
    predictedRole: result.predictedRole || {
      isCulprit: false, confidence: 0, reasoning: "分析データが不足しています"
    },
    behaviorAnalysis: result.behaviorAnalysis || {
      speakingFrequency: 0, aggressiveness: 50, defensiveness: 50, logicalReasoning: 50
    },
    suspectedCharacters: (result.suspectedCharacters || []).map((s) => ({
      characterId: s.characterId || "unknown",
      estimatedSuspicion: s.estimatedSuspicion ?? 0,
      reason: s.reason || "不明",
      confidence: s.confidence ?? 0,
    })),
  };
}

/**
 * プロファイリング用システムプロンプト
 */
function getProfilingSystemPrompt(): string {
  return `あなたは優秀な心理分析官です。マーダーミステリーゲームで人間プレイヤーの行動を観察し、その思考や疑念を推測してください。

【分析の観点】
1. **疑惑推定**: 誰を疑っているか（発言内容、質問の方向性から推測）
2. **行動パターン**: 発言頻度、攻撃性、防衛性、論理性
3. **役割推測**: 犯人である可能性（隠蔽行動、ミスリード誘導から判断）

【重要な注意事項】
- 発言内容だけでなく、発言のタイミングや質問の仕方も考慮する
- 「誰々が怪しい」という直接的な発言だけでなく、間接的な疑念も読み取る
- 防衛的な発言や話題転換は、何かを隠している可能性がある
- 論理的な推理をしているか、感情的な発言が多いかを分析する

【分析の確信度】
- 80-100: 明確な根拠がある
- 60-79: ある程度の根拠がある
- 40-59: 推測の域
- 20-39: 弱い推測
- 0-19: ほとんど根拠なし`;
}

/**
 * プロファイリング用プロンプト構築
 */
function buildProfilingPrompt(
  humanMessages: AgentPerception["recentMessages"],
  perception: AgentPerception,
  gameId: string
): string {
  // 人間プレイヤーの発言をフォーマット
  const messagesFormatted = humanMessages
    .map((m, i) => {
      const time = m.timestamp.toDate().toLocaleTimeString("ja-JP");
      return `[${i + 1}] ${time} ${m.speakerName}: ${m.content}`;
    })
    .join("\n");

  return `# 人間プレイヤー行動分析タスク

あなたは人間プレイヤーの発言と行動を分析し、その思考パターンと疑念を推測してください。

## 分析対象プレイヤーの発言（直近${humanMessages.length}件）

${messagesFormatted}

---

# 分析指示

上記の発言を分析し、以下の形式でJSON出力してください：

\`\`\`json
{
  "suspectedCharacters": [
    {
      "characterId": "char_xxx",
      "estimatedSuspicion": 85,
      "reason": "この人物を疑っている理由（発言から推測）",
      "confidence": 75
    }
  ],
  "behaviorAnalysis": {
    "speakingFrequency": 0.5,
    "aggressiveness": 60,
    "defensiveness": 40,
    "logicalReasoning": 70
  },
  "predictedRole": {
    "isCulprit": false,
    "confidence": 30,
    "reasoning": "犯人である/ないと推測する理由"
  }
}
\`\`\`

**重要**:
- suspectedCharacters: 疑っていると推測される人物を疑惑度順に並べる
- estimatedSuspicion: その人物への疑惑度（0-100）
- confidence: 推測の確信度（0-100）
- speakingFrequency: 発言頻度（回/分の推定値）
- aggressiveness: 攻撃的な発言の割合（0-100）
- defensiveness: 防衛的な発言の割合（0-100）
- logicalReasoning: 論理的な推理をしているか（0-100）
- 出力は必ずJSON形式のみで、説明文やマークダウンは含めないでください`;
}

/**
 * Geminiのレスポンス型
 */
interface ProfilingResult {
  suspectedCharacters: Array<{
    characterId: string;
    estimatedSuspicion: number;
    reason: string;
    confidence: number;
  }>;
  behaviorAnalysis: {
    speakingFrequency: number;
    aggressiveness: number;
    defensiveness: number;
    logicalReasoning: number;
  };
  predictedRole: {
    isCulprit: boolean;
    confidence: number;
    reasoning: string;
  };
}

/**
 * 空のプロファイル作成
 */
async function createEmptyProfile(
  humanPlayerId: string,
  gameId: string
): Promise<HumanProfile> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  const game = gameDoc.data() as GameState;
  const player = game.players[humanPlayerId];

  // キャラクター名をシナリオから解決（優先: scenario > characterId > displayName）
  let playerName = "不明";
  if (player?.characterId) {
    playerName = player.characterId;
    try {
      const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
      if (scenarioDoc.exists) {
        const scenario = scenarioDoc.data() as Scenario;
        playerName = resolveCharacterNameFromScenario(player.characterId, scenario.data.characters);
      }
    } catch {
      // フォールバック: characterIdをそのまま使用
    }
  }

  return {
    playerId: humanPlayerId,
    playerName,
    suspectedCharacters: [],
    behaviorAnalysis: {
      speakingFrequency: 0,
      aggressiveness: 50,
      defensiveness: 50,
      logicalReasoning: 50,
    },
    predictedRole: {
      isCulprit: false,
      confidence: 0,
      reasoning: "まだ発言がありません",
    },
    lastUpdated: Timestamp.now(),
  };
}

/**
 * 簡易プロファイル作成（フォールバック）
 */
function createSimpleProfile(
  humanPlayerId: string,
  gameId: string,
  perception: AgentPerception
): HumanProfile {
  const humanMessages = perception.recentMessages.filter(
    (m) => m.speaker === humanPlayerId
  );

  // Phase B-1.5: キーワードベースの疑惑推定は削除（議事録AIで代替）
  const suspectedCharacters: HumanProfile["suspectedCharacters"] = [];

  return {
    playerId: humanPlayerId,
    playerName: humanMessages[0]?.speakerName || "不明",
    suspectedCharacters,
    behaviorAnalysis: {
      speakingFrequency: humanMessages.length / 10, // 簡易計算
      aggressiveness: 50,
      defensiveness: 50,
      logicalReasoning: 50,
    },
    predictedRole: {
      isCulprit: false,
      confidence: 20,
      reasoning: "簡易分析のため確信度は低い",
    },
    lastUpdated: Timestamp.now(),
  };
}

/**
 * 全ての人間プレイヤーをプロファイリング
 */
export async function profileAllHumanPlayers(
  agentId: string,
  gameId: string,
  perception: AgentPerception
): Promise<Record<string, HumanProfile>> {
  logger.info("Profiling all human players", { agentId, gameId });

  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  if (!gameDoc.exists) {
    throw new Error(`Game not found: ${gameId}`);
  }

  const game = gameDoc.data() as GameState;

  // 人間プレイヤーのみを抽出
  const humanPlayers = Object.entries(game.players).filter(
    ([_, player]) => player.isHuman
  );

  const profiles: Record<string, HumanProfile> = {};

  // 並列でプロファイリング
  const profilingPromises = humanPlayers.map(async ([playerId, _]) => {
    const profile = await profileHumanPlayer(
      agentId,
      gameId,
      playerId,
      perception
    );
    profiles[playerId] = profile;
  });

  await Promise.all(profilingPromises);

  logger.info("All human players profiled", {
    agentId,
    humanPlayerCount: humanPlayers.length,
  });

  return profiles;
}

/**
 * プロファイルをFirestoreに保存
 */
export async function saveHumanProfiles(
  agentId: string,
  gameId: string,
  profiles: Record<string, HumanProfile>
): Promise<void> {
  logger.debug("Saving human profiles to Firestore", {
    agentId,
    profileCount: Object.keys(profiles).length,
  });

  const agentRef = adminDb
    .collection("games")
    .doc(gameId)
    .collection("agentBrains")
    .doc(agentId);

  await agentRef.update({
    humanProfiles: profiles,
    profilesUpdatedAt: Timestamp.now(),
  });

  logger.info("Human profiles saved", { agentId });
}
