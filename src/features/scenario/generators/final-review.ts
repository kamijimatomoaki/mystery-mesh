/**
 * Final Review & Adjustment Layer
 * シナリオ生成の最終段階で全アセットの整合性チェック・自動修正を行う
 *
 * レビュー項目:
 * 1. タイムライン整合性（同一時刻に複数場所にいないか等）
 * 2. キャラクター整合性（疑惑要素、目撃情報の有無等）
 * 3. カード整合性（証拠カードとタイムラインの矛盾等）
 */

import { generateJSON } from "@/core/llm/vertex-text";
import { z } from "zod";
import { createModuleLogger } from "@/core/utils/logger";
import type {
  MasterTimelineEvent,
  CharacterDefinition,
  CardDefinition,
  LocationDefinition,
} from "@/core/types";
import type { MasterTimeline } from "../schemas";
import { validateCardCount } from "./cards";

/**
 * AI修正レスポンスのZodスキーマ
 */
const AIFixResponseSchema = z.object({
  fixedCharacters: z.array(z.object({
    id: z.string(),
    witnessInfo: z.array(z.object({
      time: z.string(),
      targetCharacterId: z.string(),
      description: z.string(),
    })).optional(),
  })).optional(),
  fixedCards: z.array(z.object({
    id: z.string(),
    secret: z.object({
      description: z.string().optional(),
      importanceLevel: z.number().optional(),
    }).optional(),
  })).optional(),
});

const logger = createModuleLogger("FinalReview");

/**
 * 整合性チェックの問題
 */
export interface ValidationIssue {
  category: "timeline" | "character" | "card";
  severity: "error" | "warning";
  description: string;
  affectedIds: string[];
}

/**
 * 最終レビュー結果
 */
export interface FinalReviewResult {
  isValid: boolean;
  issues: ValidationIssue[];
  wasAdjusted: boolean;
  adjustedTimeline?: MasterTimeline;
  adjustedCharacters?: CharacterDefinition[];
  adjustedCards?: CardDefinition[];
}

/**
 * 最終レビューパラメータ
 */
export interface FinalReviewParams {
  timeline: MasterTimeline;
  characters: CharacterDefinition[];
  locations: LocationDefinition[];
  cards: CardDefinition[];
}

/**
 * 最終レビュー＆調整を実行
 *
 * @param params - 全アセットを含むパラメータ
 * @returns レビュー結果（問題があれば修正後のデータを含む）
 */
export async function performFinalReview(
  params: FinalReviewParams
): Promise<FinalReviewResult> {
  logger.info("Starting final review", {
    timelineEvents: params.timeline.masterTimeline.length,
    characters: params.characters.length,
    cards: params.cards.length,
    locations: params.locations.length,
  });

  const issues: ValidationIssue[] = [];

  // 1. タイムライン整合性チェック
  const timelineIssues = checkTimelineConsistency(params.timeline, params.characters);
  issues.push(...timelineIssues);

  // 2. キャラクター整合性チェック
  const characterIssues = checkCharacterConsistency(
    params.characters,
    params.timeline
  );
  issues.push(...characterIssues);

  // 3. カード整合性チェック
  const cardIssues = checkCardConsistency(
    params.cards,
    params.timeline,
    params.characters
  );
  issues.push(...cardIssues);

  // 4. カード枚数・配置バリデーション
  const cardCountResult = validateCardCount(params.cards, params.characters, params.locations);
  for (const warning of cardCountResult.warnings) {
    issues.push({
      category: "card",
      severity: "warning",
      description: warning,
      affectedIds: [],
    });
  }

  // エラーレベルの問題があるかチェック
  const hasErrors = issues.some((i) => i.severity === "error");

  if (!hasErrors) {
    logger.info("Final review passed", {
      warnings: issues.filter((i) => i.severity === "warning").length,
    });

    return {
      isValid: true,
      issues,
      wasAdjusted: false,
    };
  }

  logger.warn("Issues found, attempting auto-fix", {
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
  });

  // 自動修正を試行
  const adjusted = await attemptAutoFix(issues, params);

  if (adjusted) {
    // 修正後に再チェック
    const recheckIssues: ValidationIssue[] = [];

    const newTimelineIssues = checkTimelineConsistency(
      adjusted.timeline,
      adjusted.characters
    );
    recheckIssues.push(...newTimelineIssues);

    const newCharacterIssues = checkCharacterConsistency(
      adjusted.characters,
      adjusted.timeline
    );
    recheckIssues.push(...newCharacterIssues);

    const newCardIssues = checkCardConsistency(
      adjusted.cards,
      adjusted.timeline,
      adjusted.characters
    );
    recheckIssues.push(...newCardIssues);

    const stillHasErrors = recheckIssues.some((i) => i.severity === "error");

    if (!stillHasErrors) {
      logger.info("Auto-fix succeeded");
      return {
        isValid: true,
        issues: recheckIssues,
        wasAdjusted: true,
        adjustedTimeline: adjusted.timeline,
        adjustedCharacters: adjusted.characters,
        adjustedCards: adjusted.cards,
      };
    }

    logger.warn("Auto-fix incomplete, some errors remain");
    return {
      isValid: false,
      issues: recheckIssues,
      wasAdjusted: true,
      adjustedTimeline: adjusted.timeline,
      adjustedCharacters: adjusted.characters,
      adjustedCards: adjusted.cards,
    };
  }

  // 修正失敗 → 警告ログを残して元データで続行
  logger.warn("Auto-fix failed, proceeding with original data", { issues });

  return {
    isValid: false,
    issues,
    wasAdjusted: false,
  };
}

/**
 * タイムライン整合性チェック
 */
function checkTimelineConsistency(
  timeline: MasterTimeline,
  characters: CharacterDefinition[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. 時系列順になっているか
  for (let i = 1; i < timeline.masterTimeline.length; i++) {
    const prev = timeline.masterTimeline[i - 1].time;
    const curr = timeline.masterTimeline[i].time;

    if (timeToMinutes(prev) > timeToMinutes(curr)) {
      issues.push({
        category: "timeline",
        severity: "error",
        description: `時系列が逆転: ${prev} > ${curr}`,
        affectedIds: [],
      });
    }
  }

  // 2. 同一時刻に同一キャラクターが複数の場所にいないか
  const characterLocations = new Map<string, Map<string, string[]>>();

  for (const event of timeline.masterTimeline) {
    if (!event.relatedCharacterId) continue;

    const charId = event.relatedCharacterId;
    const time = event.time;

    if (!characterLocations.has(charId)) {
      characterLocations.set(charId, new Map());
    }

    const charMap = characterLocations.get(charId)!;
    if (!charMap.has(time)) {
      charMap.set(time, []);
    }

    // イベントからロケーションを抽出（簡易的に）
    const locationMatch = event.event.match(/(?:で|にて|から|へ|を出る|に入る)/);
    if (locationMatch) {
      charMap.get(time)!.push(event.event);
    }
  }

  // 同じ時刻に複数の矛盾する行動があるかチェック
  for (const [charId, timeMap] of characterLocations) {
    for (const [time, events] of timeMap) {
      if (events.length > 2) {
        issues.push({
          category: "timeline",
          severity: "warning",
          description: `${charId}が${time}に複数の行動（${events.length}件）`,
          affectedIds: [charId],
        });
      }
    }
  }

  // 3. 犯人がタイムラインに登場しているか
  const culpritAppearances = timeline.masterTimeline.filter(
    (e) => e.relatedCharacterId === timeline.culpritId
  );

  if (culpritAppearances.length < 3) {
    issues.push({
      category: "timeline",
      severity: "warning",
      description: `犯人のタイムライン登場回数が少ない（${culpritAppearances.length}回）`,
      affectedIds: [timeline.culpritId],
    });
  }

  // 4. 殺人イベントが存在するか
  const murderEvent = timeline.masterTimeline.find(
    (e) =>
      e.event.includes("殺人") ||
      e.event.includes("殺害") ||
      e.event.includes("刺した") ||
      e.event.includes("毒を")
  );

  if (!murderEvent) {
    issues.push({
      category: "timeline",
      severity: "error",
      description: "殺人イベントがタイムラインに存在しない",
      affectedIds: [],
    });
  }

  return issues;
}

/**
 * キャラクター整合性チェック
 */
function checkCharacterConsistency(
  characters: CharacterDefinition[],
  timeline: MasterTimeline
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const char of characters) {
    const isCulprit = char.id === timeline.culpritId;

    // 1. 疑惑要素があるか
    if (!char.suspiciousInfo || char.suspiciousInfo.length < 10) {
      issues.push({
        category: "character",
        severity: "warning",
        description: `${char.name}の疑惑情報が不足`,
        affectedIds: [char.id],
      });
    }

    // 2. 目撃情報が最低2つあるか
    const witnessCount = char.handout?.witnessInfo?.length || 0;
    if (witnessCount < 2) {
      issues.push({
        category: "character",
        severity: "error",
        description: `${char.name}の目撃情報が${witnessCount}件（最低2件必要）`,
        affectedIds: [char.id],
      });
    }

    // 3. 秘密の情報があるか
    if (
      !char.secretInfo &&
      !char.handout?.secretGoal
    ) {
      issues.push({
        category: "character",
        severity: "warning",
        description: `${char.name}に秘密の情報がない`,
        affectedIds: [char.id],
      });
    }

    // 4. 犯人だけが怪しすぎないか（逆に他のキャラも疑わしくあるべき）
    if (!isCulprit && !char.suspiciousInfo) {
      issues.push({
        category: "character",
        severity: "warning",
        description: `${char.name}（無実）に疑惑要素がない`,
        affectedIds: [char.id],
      });
    }
  }

  // 5. タイムラインに登場するキャラクターが全員定義されているか
  const definedCharIds = new Set(characters.map((c) => c.id));
  const timelineCharIds = new Set(
    timeline.masterTimeline
      .filter((e) => e.relatedCharacterId)
      .map((e) => e.relatedCharacterId!)
  );

  for (const charId of timelineCharIds) {
    if (!definedCharIds.has(charId) && charId !== timeline.victimId) {
      issues.push({
        category: "character",
        severity: "error",
        description: `タイムラインに登場する${charId}が定義されていない`,
        affectedIds: [charId],
      });
    }
  }

  return issues;
}

/**
 * カード整合性チェック
 */
function checkCardConsistency(
  cards: CardDefinition[],
  timeline: MasterTimeline,
  characters: CharacterDefinition[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // 1. 決定的証拠が存在するか
  const criticalEvidence = cards.filter(
    (c) => c.secret.importanceLevel === 5 || c.slotType === "secret"
  );

  if (criticalEvidence.length === 0) {
    issues.push({
      category: "card",
      severity: "error",
      description: "決定的証拠カードが存在しない",
      affectedIds: [],
    });
  }

  // 2. 犯人に紐づく決定的証拠があるか
  const culpritEvidence = criticalEvidence.filter(
    (c) => c.relatedCharacterId === timeline.culpritId
  );

  if (culpritEvidence.length === 0) {
    issues.push({
      category: "card",
      severity: "error",
      description: "犯人を指し示す決定的証拠がない",
      affectedIds: [timeline.culpritId],
    });
  }

  // 3. 各キャラクターにカードが配分されているか
  const characterCardCount = new Map<string, number>();

  for (const card of cards) {
    if (card.relatedCharacterId) {
      const count = characterCardCount.get(card.relatedCharacterId) || 0;
      characterCardCount.set(card.relatedCharacterId, count + 1);
    }
  }

  for (const char of characters) {
    const count = characterCardCount.get(char.id) || 0;
    if (count < 2) {
      issues.push({
        category: "card",
        severity: "warning",
        description: `${char.name}に紐づくカードが${count}枚（少なすぎる可能性）`,
        affectedIds: [char.id],
      });
    }
  }

  // 4. カードの説明がタイムラインと矛盾していないか（基本チェック）
  for (const card of cards) {
    // card.secret または card.secret.description が undefined の場合はスキップ
    if (!card.secret?.description) continue;

    if (card.secret.description.includes("アリバイ")) {
      // アリバイカードがあるキャラクターが犯人でないか
      if (
        card.relatedCharacterId === timeline.culpritId &&
        card.secret.importanceLevel >= 4
      ) {
        issues.push({
          category: "card",
          severity: "warning",
          description: `犯人に強力なアリバイカードがある: ${card.name}`,
          affectedIds: [card.id, timeline.culpritId],
        });
      }
    }
  }

  return issues;
}

/**
 * 時刻文字列を分に変換
 */
function timeToMinutes(time: string): number {
  const match = time.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

/**
 * 自動修正を試行
 */
async function attemptAutoFix(
  issues: ValidationIssue[],
  params: FinalReviewParams
): Promise<{
  timeline: MasterTimeline;
  characters: CharacterDefinition[];
  cards: CardDefinition[];
} | null> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Auto-fix attempt ${attempt}/${maxRetries}`);

      // AIに修正を依頼
      const fixedData = await requestAIFix(issues, params);

      if (fixedData) {
        return fixedData;
      }
    } catch (error) {
      logger.warn(`Auto-fix attempt ${attempt} failed`, { error });
    }
  }

  return null;
}

/**
 * AIに修正を依頼
 */
async function requestAIFix(
  issues: ValidationIssue[],
  params: FinalReviewParams
): Promise<{
  timeline: MasterTimeline;
  characters: CharacterDefinition[];
  cards: CardDefinition[];
} | null> {
  // エラーレベルの問題のみ抽出
  const errors = issues.filter((i) => i.severity === "error");

  if (errors.length === 0) {
    return {
      timeline: params.timeline,
      characters: params.characters,
      cards: params.cards,
    };
  }

  const prompt = `
以下のマーダーミステリーシナリオに整合性の問題があります。修正してください。

## 検出された問題
${errors.map((e, i) => `${i + 1}. [${e.category}] ${e.description}`).join("\n")}

## 現在のタイムライン概要
- 犯人: ${params.timeline.culpritId}
- 被害者: ${params.timeline.victimId || "未設定"}
- イベント数: ${params.timeline.masterTimeline.length}
- トリック: ${params.timeline.trickExplanation}

## キャラクター一覧
${params.characters.map((c) => `- ${c.id}: ${c.name}（${c.job}）`).join("\n")}

## 修正指示
1. 目撃情報が不足しているキャラクターには、他のキャラクターを目撃した情報を2つ以上追加
2. 決定的証拠がない場合は、犯人を特定できる証拠カードを追加
3. タイムラインの時系列が逆転している場合は正しい順序に修正

以下のJSON形式で修正後のキャラクター情報のみを返してください（変更があったものだけ）:

{
  "fixedCharacters": [
    {
      "id": "char_xxx",
      "witnessInfo": [
        { "time": "10:00", "targetCharacterId": "char_yyy", "description": "目撃内容" },
        { "time": "11:00", "targetCharacterId": "char_zzz", "description": "目撃内容" }
      ]
    }
  ],
  "fixedCards": [
    {
      "id": "card_xxx",
      "secret": {
        "description": "修正後の説明"
      }
    }
  ]
}

修正が不要な場合は空の配列を返してください。
`;

  try {
    const result = await generateJSON<{
      fixedCharacters?: Array<{
        id: string;
        witnessInfo?: Array<{
          time: string;
          targetCharacterId: string;
          description: string;
        }>;
      }>;
      fixedCards?: Array<{
        id: string;
        secret?: {
          description?: string;
          importanceLevel?: number;
        };
      }>;
    }>(prompt, {
      temperature: 0.3,
      maxTokens: 32000,
      schema: AIFixResponseSchema,
    });

    // 修正を適用
    const fixedCharacters = [...params.characters];
    const fixedCards = [...params.cards];

    // キャラクターの修正を適用（undefinedフィールドをフィルタリング）
    if (result.fixedCharacters) {
      for (const fix of result.fixedCharacters) {
        const charIndex = fixedCharacters.findIndex((c) => c.id === fix.id);
        if (charIndex !== -1 && fix.witnessInfo) {
          const validWitnessInfo = fix.witnessInfo.filter(
            (w) => w.time && w.targetCharacterId && w.description
          );
          if (validWitnessInfo.length > 0) {
            fixedCharacters[charIndex] = {
              ...fixedCharacters[charIndex],
              handout: {
                ...fixedCharacters[charIndex].handout,
                witnessInfo: validWitnessInfo,
              },
            };
          }
        }
      }
    }

    // カードの修正を適用（undefinedフィールドをフィルタリング）
    if (result.fixedCards) {
      for (const fix of result.fixedCards) {
        const cardIndex = fixedCards.findIndex((c) => c.id === fix.id);
        if (cardIndex !== -1 && fix.secret) {
          const cleanSecret = Object.fromEntries(
            Object.entries(fix.secret).filter(([, v]) => v !== undefined)
          );
          if (Object.keys(cleanSecret).length > 0) {
            fixedCards[cardIndex] = {
              ...fixedCards[cardIndex],
              secret: {
                ...fixedCards[cardIndex].secret,
                ...cleanSecret,
              },
            };
          }
        }
      }
    }

    return {
      timeline: params.timeline,
      characters: fixedCharacters,
      cards: fixedCards,
    };
  } catch (error) {
    logger.error("AI fix request failed", error as Error);
    return null;
  }
}
