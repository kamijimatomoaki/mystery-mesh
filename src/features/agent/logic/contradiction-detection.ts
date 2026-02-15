/**
 * Advanced Contradiction Detection using Gemini
 * Geminiを使用した高度な矛盾検出
 */

import { generateJSON } from "@/core/llm/vertex-text";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { createModuleLogger } from "@/core/utils/logger";
import type {
  AgentPerception,
  KnowledgeBase,
  Contradiction,
} from "../types";

/**
 * 矛盾検出結果のZodスキーマ
 */
const ContradictionDetectionResultSchema = z.object({
  contradictions: z.array(z.object({
    type: z.enum(["statement", "timeline", "knowledge", "alibi"]),
    description: z.string(),
    involved: z.array(z.object({
      characterId: z.string(),
      characterName: z.string(),
      statement: z.string(),
      timestamp: z.number().optional(),
    })),
    severity: z.number(),
    reasoning: z.string(),
  })),
  analysis: z.string(),
});

const logger = createModuleLogger("contradiction-detection");

/**
 * Geminiを使用した高度な矛盾検出
 */
export async function detectContradictionsWithGemini(
  perception: AgentPerception,
  knowledgeBase: KnowledgeBase
): Promise<Contradiction[]> {
  logger.info("Starting Gemini-based contradiction detection");

  // メッセージが少ない場合はスキップ
  if (perception.recentMessages.length < 3) {
    return [];
  }

  try {
    // プロンプトを構築
    const prompt = buildContradictionDetectionPrompt(
      perception,
      knowledgeBase
    );

    // Geminiで矛盾を検出
    const result = await generateJSON<ContradictionDetectionResult>(
      prompt,
      {
        systemInstruction: getContradictionDetectionSystemPrompt(),
        temperature: 0.3, // 論理的な分析なので低めの温度
        maxTokens: 32768, // 複雑な矛盾分析に十分なトークン量を確保
        schema: ContradictionDetectionResultSchema,
      }
    );

    // 結果を Contradiction[] に変換
    const contradictions: Contradiction[] = result.contradictions.map(
      (c, index) => ({
        id: `contradiction_gemini_${Date.now()}_${index}`,
        type: mapTypeToContradictionType(c.type),
        description: c.description,
        involved: c.involved.map((inv) => ({
          characterId: inv.characterId,
          characterName: inv.characterName,
          statement: inv.statement,
          timestamp: inv.timestamp
            ? Timestamp.fromMillis(inv.timestamp)
            : undefined,
        })),
        severity: c.severity,
        discoveredAt: Timestamp.now(),
        status: "unresolved",
        reasoning: c.reasoning,
      })
    );

    logger.info("Contradiction detection completed", {
      found: contradictions.length,
    });

    return contradictions;
  } catch (error) {
    logger.error("Contradiction detection failed", error as Error);
    return [];
  }
}

/**
 * システムプロンプト
 */
function getContradictionDetectionSystemPrompt(): string {
  return `あなたは優秀な探偵です。マーダーミステリーゲームの会話ログを分析し、矛盾や不審な点を見つけ出してください。

【矛盾検出の種類】
1. **statement**: 発言内容の矛盾（前後で言っていることが違う）
2. **timeline**: タイムライン上の矛盾（時系列が成立しない）
3. **knowledge**: 知識の矛盾（知らないはずのことを知っている）
4. **alibi**: アリバイの矛盾（複数人の証言が食い違う）

【重要度の基準】
- 80-100: 決定的な証拠となる重大な矛盾
- 60-79: 犯人特定に繋がる可能性が高い矛盾
- 40-59: 注視すべき中程度の矛盾
- 20-39: 軽微な食い違い
- 0-19: ほぼ無視できる違和感

【矛盾の乱造防止 - 最重要】
- **1回の分析で報告する矛盾は最大2件まで**。本当に確実なものだけを報告すること
- **カード情報を持っている人がその内容を知っているのは矛盾ではない**（カード所有者は探索で入手したため事前に内容を知っている）
- **感情的な発言や個人の意見は矛盾の根拠にならない**（「怪しい」「信じられない」等の主観的発言は矛盾ではない）
- **記憶の曖昧さ・表現の揺れは矛盾ではない**（「10時頃」と「10時15分」は許容範囲）
- 矛盾は「客観的な事実同士の食い違い」のみ。推測や印象の違いは矛盾に含めない

【分析のポイント】
- 発言者の立場や動機を考慮する
- 時系列の整合性を確認する
- 複数人の証言を比較する
- 証拠との整合性を確認する

【出力ルール】
- 明確な矛盾のみを報告する（推測だけのものは含めない）
- 各矛盾について論理的な理由を説明する
- 関与する人物と具体的な発言を明示する
- **最大2件まで**（確信度の高い順に厳選）`;
}

/**
 * 矛盾検出プロンプトを構築
 */
function buildContradictionDetectionPrompt(
  perception: AgentPerception,
  knowledgeBase: KnowledgeBase
): string {
  // 会話ログをフォーマット（直近20件に制限し、出力肥大化を防止）
  const conversationLog = perception.recentMessages
    .slice(-20)
    .map((msg, i) => {
      const time = msg.timestamp.toDate().toLocaleTimeString("ja-JP");
      return `[${i + 1}] ${time} **${msg.speakerName}**: ${msg.content}`;
    })
    .join("\n");

  // 既知の事実をフォーマット
  const knownFacts = knowledgeBase.knownFacts.length > 0
    ? knowledgeBase.knownFacts
        .slice(-10) // 最新10件
        .map((fact, i) => {
          return `[事実 ${i + 1}] ${fact.content} (確信度: ${fact.confidence}%)`;
        })
        .join("\n")
    : "（まだ事実が記録されていません）";

  // 既存の矛盾をフォーマット（重複検出を避けるため）
  const existingContradictions = knowledgeBase.contradictions.length > 0
    ? knowledgeBase.contradictions
        .filter((c) => c.status === "unresolved")
        .map((c, i) => {
          return `[既出 ${i + 1}] ${c.description}`;
        })
        .join("\n")
    : "（まだ矛盾は検出されていません）";

  return `# 会話ログ分析タスク

以下の会話ログを分析し、矛盾や不審な点を検出してください。

## 最近の会話（直近${perception.recentMessages.length}件）

${conversationLog}

---

## 既知の事実

${knownFacts}

---

## 既に検出済みの矛盾（重複を避けるため）

${existingContradictions}

---

# 分析指示

上記の会話ログと既知の事実を分析し、以下の形式でJSON出力してください：

\`\`\`json
{
  "contradictions": [
    {
      "type": "statement" | "timeline" | "knowledge" | "alibi",
      "description": "矛盾の簡潔な説明（日本語、50文字以内）",
      "involved": [
        {
          "characterId": "char_xxx",
          "characterName": "キャラクター名",
          "statement": "具体的な発言内容",
          "timestamp": 1234567890000
        }
      ],
      "severity": 85,
      "reasoning": "この矛盾が重要である理由を論理的に説明"
    }
  ],
  "analysis": "全体的な分析結果のサマリー（日本語）"
}
\`\`\`

**重要**:
- 明確な矛盾のみを報告してください（推測だけのものは含めない）
- 既に検出済みの矛盾は含めないでください
- 矛盾が見つからない場合は空配列 [] を返してください
- 出力は必ずJSON形式のみで、説明文やマークダウンは含めないでください`;
}

/**
 * Geminiのレスポンス型
 */
interface ContradictionDetectionResult {
  contradictions: Array<{
    type: "statement" | "timeline" | "knowledge" | "alibi";
    description: string;
    involved: Array<{
      characterId: string;
      characterName: string;
      statement: string;
      timestamp?: number;
    }>;
    severity: number;
    reasoning: string;
  }>;
  analysis: string;
}

/**
 * タイプをマッピング
 * Contradiction["type"]は "statement" | "action" | "timeline" のみ
 */
function mapTypeToContradictionType(
  type: string
): Contradiction["type"] {
  switch (type) {
    case "statement":
      return "statement";
    case "timeline":
      return "timeline";
    case "action":
      return "action";
    case "knowledge":
    case "alibi":
      // knowledge/alibiはstatementにマッピング
      return "statement";
    default:
      return "statement";
  }
}

/**
 * 矛盾の重複チェック
 */
export function isDuplicateContradiction(
  newContradiction: Contradiction,
  existingContradictions: Contradiction[]
): boolean {
  return existingContradictions.some((existing) => {
    // 同じ説明の矛盾は重複
    if (existing.description === newContradiction.description) {
      return true;
    }

    // 同じキャラクターの同じ発言に関する矛盾は重複
    const existingCharacters = existing.involved.map((i) => i.characterId).sort();
    const newCharacters = newContradiction.involved.map((i) => i.characterId).sort();

    return (
      existingCharacters.join(",") === newCharacters.join(",") &&
      existing.type === newContradiction.type
    );
  });
}

/**
 * 矛盾をマージ（重複を除外）
 */
export function mergeContradictions(
  existing: Contradiction[],
  newContradictions: Contradiction[]
): Contradiction[] {
  const merged = [...existing];

  for (const newC of newContradictions) {
    if (!isDuplicateContradiction(newC, merged)) {
      merged.push(newC);
    }
  }

  return merged;
}

/**
 * Phase B-2C: 矛盾解決メカニズム
 * 古い矛盾やゲーム進行上不要になった矛盾を自動解決する
 *
 * @param contradictions - 現在の矛盾リスト
 * @param currentMessageCount - 現在のメッセージ数（ターンカウントの代わり）
 * @returns 解決処理後の矛盾リスト
 */
export function resolveStaleContradictions(
  contradictions: Contradiction[],
  currentMessageCount: number
): Contradiction[] {
  const MAX_UNRESOLVED = 10;

  const resolved = contradictions.map((c) => {
    // 既に解決済みならスキップ
    if (c.status !== "unresolved") return c;

    // 古い矛盾を自動解除（discoveredAtから十分経過した場合）
    const ageMs = Date.now() - (c.discoveredAt?.toMillis?.() || 0);
    const ageMinutes = ageMs / (1000 * 60);

    // 10分以上前で重要度が低い矛盾は自動dismissal
    if (ageMinutes > 10 && c.severity < 60) {
      return { ...c, status: "dismissed" as const };
    }

    // 20分以上前の矛盾は全て自動dismissal
    if (ageMinutes > 20) {
      return { ...c, status: "dismissed" as const };
    }

    return c;
  });

  // 未解決矛盾が最大10件を超えたら、最古の矛盾から解除
  const unresolvedList = resolved.filter((c) => c.status === "unresolved");
  if (unresolvedList.length > MAX_UNRESOLVED) {
    // 古い順にソート
    const sorted = unresolvedList.sort(
      (a, b) => (a.discoveredAt?.toMillis?.() || 0) - (b.discoveredAt?.toMillis?.() || 0)
    );
    const toDiscard = sorted.slice(0, unresolvedList.length - MAX_UNRESOLVED);
    const discardIds = new Set(toDiscard.map((c) => c.id));

    return resolved.map((c) => {
      if (discardIds.has(c.id)) {
        return { ...c, status: "dismissed" as const };
      }
      return c;
    });
  }

  return resolved;
}
