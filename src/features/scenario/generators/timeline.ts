/**
 * Master Timeline Generation
 * Vertex AI (Gemini) を使ったタイムライン生成
 */

import { generateJSON } from "@/core/llm/vertex-text";
import {
  buildTimelineSystemPrompt,
  buildTimelinePrompt,
  type TimelineGenParams
} from "../prompts/timeline-gen";
import { MasterTimelineSchema, type MasterTimeline } from "../schemas";

export interface ScenarioParams extends TimelineGenParams {
  userId: string;
  userName: string;
}

/**
 * Master Timeline を生成
 *
 * @param params - シナリオ生成パラメータ
 * @returns 生成されたマスタータイムライン
 */
export async function generateMasterTimeline(
  params: ScenarioParams
): Promise<MasterTimeline> {

  console.log("[Timeline Generation] Starting...", params);

  const systemInstruction = buildTimelineSystemPrompt(params);
  const prompt = buildTimelinePrompt(params);

  // Geminiで生成
  try {
    const result = await generateJSON<MasterTimeline>(prompt, {
      systemInstruction,
      temperature: 0.8, // 創造的な生成のため高め
      maxTokens: 65536, // Vertex AI上限値（65537未満）
      schema: MasterTimelineSchema,
    });

    console.log("[Timeline Generation] Raw result:", result);

    // Zodでバリデーション
    const validated = MasterTimelineSchema.parse(result);

    console.log("[Timeline Generation] Validated:", {
      culprit: validated.culpritId,
      eventsCount: validated.masterTimeline.length
    });

    // 整合性チェック
    if (!isTimelineConsistent(validated)) {
      console.warn("[Timeline Generation] Inconsistency detected, retrying...");
      return await selfCorrectTimeline(validated, params);
    }

    return validated;

  } catch (error) {
    console.error("[Timeline Generation] Error:", error);
    throw new Error(`Timeline generation failed: ${error}`);
  }
}

/**
 * タイムラインの整合性チェック
 */
function isTimelineConsistent(timeline: MasterTimeline): boolean {
  const issues: string[] = [];

  // 1. 時系列順になっているか
  for (let i = 1; i < timeline.masterTimeline.length; i++) {
    const prev = timeline.masterTimeline[i - 1].time;
    const curr = timeline.masterTimeline[i].time;

    if (prev > curr) {
      issues.push(`時系列が逆転: ${prev} > ${curr}`);
    }
  }

  // 2. 犯人が存在するか
  const hasCulprit = timeline.masterTimeline.some(
    e => e.relatedCharacterId === timeline.culpritId
  );

  if (!hasCulprit) {
    issues.push("犯人がタイムラインに登場していない");
  }

  // 3. 殺人イベントが存在するか
  const hasMurder = timeline.masterTimeline.some(
    e => e.event.includes("殺人") || e.event.includes("殺害") || e.event.includes("死亡")
  );

  if (!hasMurder) {
    issues.push("殺人イベントが存在しない");
  }

  // 4. イベント数が妥当か（最低30個以上）
  if (timeline.masterTimeline.length < 30) {
    issues.push(`イベント数が少なすぎる: ${timeline.masterTimeline.length}個（最低30個必要）`);
  }

  // 5. 各キャラクターの登場回数チェック
  const charAppearances = new Map<string, number>();
  for (const e of timeline.masterTimeline) {
    if (e.relatedCharacterId) {
      charAppearances.set(e.relatedCharacterId,
        (charAppearances.get(e.relatedCharacterId) || 0) + 1);
    }
  }
  for (const [charId, count] of charAppearances) {
    if (charId !== timeline.victimId && count < 8) {
      issues.push(`${charId} の登場回数が少なすぎる: ${count}回（最低8回必要）`);
    }
  }

  if (issues.length > 0) {
    console.error("[Timeline] Consistency issues:", issues);
    return false;
  }

  return true;
}

/**
 * Self-Correction（タイムライン修正）
 * 整合性チェックで問題が見つかった場合に修正を試みる
 */
async function selfCorrectTimeline(
  timeline: MasterTimeline,
  params: ScenarioParams
): Promise<MasterTimeline> {

  const issues = detectTimelineIssues(timeline);

  if (issues.length === 0) {
    return timeline;
  }

  console.log("[Timeline] Self-correcting issues:", issues);

  const correctionPrompt = `
以下のマーダーミステリーのタイムラインに問題があります。修正してください。

【ジャンル】${params.genre}
【プレイヤー数】${params.playerCount}名
【難易度】${params.difficulty}

【問題点】
${issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}

【元のタイムライン】
${JSON.stringify(timeline, null, 2)}

【修正方針】
- 時系列順に並び替える
- 犯人のイベントを追加（最低8回登場）
- 殺人イベントを明確にする
- イベント数を増やす（最低50個、30分刻みで1日を網羅）
- 各キャラクターを最低15回登場させる（public + private合算）
- publicイベント15個以上、各キャラprivateイベント8個以上
- 伏線イベントを3つ以上含める
- 事件後の発見・反応イベントを含める

**IMPORTANT: Return ONLY valid JSON in the same format, no markdown, no explanations.**
`;

  try {
    const corrected = await generateJSON<MasterTimeline>(correctionPrompt, {
      temperature: 0.3, // 修正は保守的に
      schema: MasterTimelineSchema,
    });

    const validated = MasterTimelineSchema.parse(corrected);

    console.log("[Timeline] Self-correction completed");

    return validated;

  } catch (error) {
    console.error("[Timeline] Self-correction failed:", error);
    // 修正に失敗した場合は元のタイムラインを返す
    return timeline;
  }
}

/**
 * タイムラインの問題点を検出
 */
function detectTimelineIssues(timeline: MasterTimeline): string[] {
  const issues: string[] = [];

  // 時系列順チェック
  for (let i = 1; i < timeline.masterTimeline.length; i++) {
    if (timeline.masterTimeline[i - 1].time > timeline.masterTimeline[i].time) {
      issues.push(`時系列が逆転: ${timeline.masterTimeline[i - 1].time} → ${timeline.masterTimeline[i].time}`);
    }
  }

  // 犯人チェック
  const culpritEvents = timeline.masterTimeline.filter(
    e => e.relatedCharacterId === timeline.culpritId
  );

  if (culpritEvents.length === 0) {
    issues.push(`犯人 ${timeline.culpritId} がタイムラインに登場していない`);
  }

  // 殺人イベントチェック
  const murderEvents = timeline.masterTimeline.filter(
    e => e.event.includes("殺人") || e.event.includes("殺害") || e.event.includes("死亡")
  );

  if (murderEvents.length === 0) {
    issues.push("殺人イベントが存在しない");
  }

  // イベント数チェック
  if (timeline.masterTimeline.length < 30) {
    issues.push(`イベント数が少なすぎる: ${timeline.masterTimeline.length}個（最低30個必要）`);
  }

  // 各キャラクターの登場回数チェック
  const charAppearances = new Map<string, number>();
  for (const e of timeline.masterTimeline) {
    if (e.relatedCharacterId) {
      charAppearances.set(e.relatedCharacterId,
        (charAppearances.get(e.relatedCharacterId) || 0) + 1);
    }
  }
  for (const [charId, count] of charAppearances) {
    if (charId !== timeline.victimId && count < 8) {
      issues.push(`${charId} の登場回数が少なすぎる: ${count}回（最低8回必要）`);
    }
  }

  return issues;
}
