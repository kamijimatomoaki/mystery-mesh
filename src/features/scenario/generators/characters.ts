/**
 * Character Generation
 * Vertex AI (Gemini) を使った動的キャラクター生成
 */

import { generateJSON } from "@/core/llm/vertex-text";
import { z } from "zod";
import type { CharacterDefinition, MasterTimelineEvent } from "@/core/types";
import type { MasterTimeline } from "../schemas";

/**
 * 外見情報のZodスキーマ
 */
const VisualDescriptionSchema = z.object({
  ethnicity: z.string(),
  hairStyle: z.string(),
  hairColor: z.string(),
  bodyType: z.string(),
  facialFeatures: z.string(),
  clothing: z.string(),
  distinguishingFeatures: z.string(),
  overallImpression: z.string()
});

/**
 * 目撃情報のZodスキーマ
 * AI生成時にtargetCharacterIdが欠ける場合があるため、nullish対応とデフォルト値を設定
 */
const WitnessInfoSchema = z.object({
  time: z.string().default("不明"),
  targetCharacterId: z.string().nullish().transform(val => val || "unknown"),
  description: z.string().default("詳細不明")
});

/**
 * キャラクター生成用のZodスキーマ
 */
const GeneratedCharacterSchema = z.object({
  id: z.string(),
  name: z.string(),
  job: z.string(),
  gender: z.enum(["male", "female"]),
  age: z.number(),
  personality: z.string(),
  speakingStyle: z.string(),
  description: z.string(),
  secretInfo: z.string(),
  publicInfo: z.string(),
  secretGoal: z.string(),
  // 疑惑情報（キャラ選択時には非表示、ハンドアウトで公開）
  suspiciousInfo: z.string(),
  // 他キャラクターの目撃情報（最低2つ）
  witnessInfo: z.array(WitnessInfoSchema).min(2),
  // 画像生成用の外見情報
  visualDescription: VisualDescriptionSchema
});

const CharacterListSchema = z.object({
  characters: z.array(GeneratedCharacterSchema)
});

type GeneratedCharacter = z.infer<typeof GeneratedCharacterSchema>;

export interface CharacterGenParams {
  genre: string;
  difficulty: "easy" | "normal" | "hard";
  timeline: MasterTimeline;
  playerCount: number;
}

/**
 * タイムラインからユニークなキャラクターIDを抽出
 * 被害者（victimId または "char_victim"）は除外される
 */
function extractCharacterIds(timeline: MasterTimeline): string[] {
  const ids = new Set<string>();

  // 被害者のIDを特定（victimIdフィールド優先、なければ "char_victim"）
  const victimId = timeline.victimId || "char_victim";

  // 犯人IDを追加（被害者でない場合のみ）
  if (timeline.culpritId !== victimId) {
    ids.add(timeline.culpritId);
  }

  // タイムラインからキャラクターIDを抽出（被害者を除外）
  for (const event of timeline.masterTimeline) {
    if (event.relatedCharacterId && event.relatedCharacterId !== victimId) {
      ids.add(event.relatedCharacterId);
    }
  }

  console.log("[Character Generation] Excluded victim:", victimId);
  console.log("[Character Generation] Extracted playable character IDs:", Array.from(ids));

  return Array.from(ids);
}

/**
 * キャラクター生成プロンプトを構築
 */
function buildCharacterPrompt(params: CharacterGenParams, characterIds: string[]): string {
  const { genre, difficulty, timeline } = params;

  // タイムラインから各キャラクターの行動を抽出
  const characterActions: Record<string, string[]> = {};
  for (const id of characterIds) {
    characterActions[id] = timeline.masterTimeline
      .filter(e => e.relatedCharacterId === id)
      .map(e => `${e.time}: ${e.event}`);
  }

  const characterHints = characterIds.map(id => {
    const actions = characterActions[id] || [];
    const isCulprit = id === timeline.culpritId;
    return `- ${id}: ${isCulprit ? "【犯人】" : ""}
  タイムライン上の行動:
  ${actions.length > 0 ? actions.join('\n  ') : '（行動記録なし）'}`;
  }).join('\n\n');

  // ジャンルから舞台設定を推測
  const settingHint = genre.includes("学園") || genre.includes("学校") ? "日本の学校" :
                      genre.includes("洋館") || genre.includes("館") ? "西洋風の館" :
                      genre.includes("日本") || genre.includes("和風") ? "日本" :
                      "シナリオの舞台に合った設定";

  return `
【タスク】
マーダーミステリー「${genre}」のキャラクター詳細を生成してください。
各キャラクターには、画像生成に使用する詳細な外見情報も含めてください。

【事件の概要】
${timeline.intro}

【トリックの説明】
${timeline.trickExplanation}

【生成するキャラクター】
${characterHints}

【難易度】
${difficulty === "easy" ? "初心者向け - 動機は明確に" : difficulty === "normal" ? "中級 - 適度な複雑さ" : "上級 - 複雑な人間関係"}

【舞台設定】
${settingHint}

【出力形式】
以下のJSON形式で全キャラクターの情報を出力してください：

{
  "characters": [
    {
      "id": "char_xxx",
      "name": "フルネーム（日本語または西洋風）",
      "job": "職業",
      "gender": "male または female",
      "age": 数値,
      "personality": "性格（30-50文字）",
      "speakingStyle": "話し方・口調の特徴（後述の注意事項を必ず参照）",
      "description": "キャラクターの背景と立場の説明（100-200文字）",
      "secretInfo": "プレイヤーのみが知る秘密情報。犯人の場合は犯行の詳細（150-300文字）",
      "publicInfo": "他のプレイヤーに公開される基本情報（50-100文字）【注意】キャラ選択時に表示されるため、犯人推測に繋がる情報は含めない",
      "secretGoal": "このゲーム中に達成したい秘密の目標（30-50文字）。【重要】ゲーム終了後の目標ではなく、このマーダーミステリー中に達成可能な目標にすること",
      "suspiciousInfo": "このキャラクターの疑わしい点・動機（50-100文字）。全員に何らかの疑惑を持たせること。キャラ選択後のハンドアウトで公開される",
      "witnessInfo": [
        {
          "time": "10:30",
          "targetCharacterId": "char_other",
          "description": "○○が廊下を慌てて走っていくのを見かけた"
        },
        {
          "time": "11:00",
          "targetCharacterId": "char_another",
          "description": "○○が何かを隠すような仕草をしているのを目撃した"
        }
      ],
      "visualDescription": {
        "ethnicity": "民族的特徴（例: Japanese, East Asian, Western European, etc.）",
        "hairStyle": "髪型の詳細（例: short messy hair, long straight hair with bangs, ponytail, etc.）",
        "hairColor": "髪の色（例: black, dark brown, light brown, blonde, etc.）",
        "bodyType": "体型（例: slim, average, athletic, slightly overweight, etc.）",
        "facialFeatures": "顔の特徴（例: sharp jawline, round face, gentle eyes, etc.）",
        "clothing": "服装の詳細（例: navy blazer school uniform, white lab coat, black butler suit, etc.）",
        "distinguishingFeatures": "目立つ特徴（例: wears glasses, small mole under left eye, scar on forehead, none, etc.）",
        "overallImpression": "全体的な雰囲気（例: mysterious and aloof, warm and approachable, stern and professional, etc.）"
      }
    }
  ]
}

【サブプロット（裏ストーリー）- 最重要の追加要件】
マダミスの醍醐味は、殺人事件の本筋だけでなく、各キャラクターが裏で抱える個人的なストーリーが絡み合うことです。

1. **各キャラクターに「殺人事件とは別の個人的な目的・秘密」を必ず設定すること**
   例:
   - 「実はこの中に自分の親を裏切った人物がいる。その証拠を掴みたい」
   - 「ある人物に借金がある。この場で密かに返済交渉したい」
   - 「被害者が持っていたはずの遺言書を見つけ出したい」
   - 「自分の過去の罪（事件とは無関係）が暴かれないようにしたい」
   - 「密かに想いを寄せている人物の秘密を守りたい」
   - 「ある人物の裏切りの証拠を突きつけたい」

2. **キャラクター間のサブプロット関係を最低3組設定すること**
   - A→Bへの一方的な関係（AがBの秘密を握っている等）
   - C↔Dの双方向の関係（共犯関係、恋愛、過去の因縁等）
   - E→全体への関係（全員の秘密を知っている等）

3. **secretGoalは本筋＋サブプロットを合わせた複合目標にすること**
   - 犯人: 「犯行を隠しつつ、○○の秘密も守る必要がある」
   - 無実: 「犯人を見つけたいが、自分の○○が暴かれるとまずい」

4. **secretInfoにサブプロットの詳細を含めること**
   - 単なる犯行情報だけでなく、キャラクターの個人的な事情・動機・目的を記述

5. **サブプロットがゲーム中の行動選択に影響すること**
   - 「本当は○○を疑っているが、サブプロットの都合上守らなければならない」
   - 「犯人を追及したいが、自分の秘密が暴かれるリスクがある」

【重要な注意事項】
1. idは提供されたものをそのまま使用すること
2. 犯人（${timeline.culpritId}）のsecretInfoには犯行の動機と詳細な手口を含めること
3. 各キャラクターに明確な動機（または動機がないことの説明）を設定すること
4. キャラクター間の人間関係を考慮すること
5. 名前は舞台設定（${genre}）に合った雰囲気にすること
6. 全${characterIds.length}名分のキャラクターを必ず出力すること
7. secretGoalはゲーム中に達成可能な複合目標にすること（本筋＋サブプロットの両方を含む）
   - 犯人: 「自分が犯人だとバレないようにしつつ、○○の秘密を守る」など
   - 無実のキャラ: 「犯人を見つけつつ、自分の○○が暴かれないようにする」など
8. 生成する全テキストフィールド（description, secretInfo, publicInfo, secretGoal, suspiciousInfo, witnessInfoのdescription）ではキャラクターID（char_xxx形式）を絶対に使わず、生成したキャラクター名を使用すること。被害者への言及は「被害者」と表記すること。

【怪しさのバランス - 最重要】
1. **全てのキャラクターが犯人候補に見えるようにすること**
2. 全員に何らかの疑惑・動機をsuspiciousInfoに設定すること（真犯人だけが怪しく見えるのはNG）
3. suspiciousInfoの例:
   - 「被害者との金銭トラブルを抱えていた」
   - 「被害者の秘密を知っていた可能性がある」
   - 「最近、不審な行動が目立つ」
   - 「被害者に強い恨みを持っていると噂される」
   - 「事件前に被害者と激しく口論していた」
4. publicInfoには犯人推測に繋がる情報を含めないこと（キャラ選択時に公平性を保つため）

【目撃情報 - 最重要】
1. 各キャラクターは他のキャラクターの行動を**最低2つ**目撃していること
2. 目撃情報は断片的で、「〇〇が△△にいるのを見かけた」「〇〇が何かを隠すのを見た」など
3. この目撃情報が議論の糸口となり、「あの時何をしていたの？」という展開を促す
4. 目撃情報の例:
   - 「10:30頃、○○が廊下を慌てて走っていくのを見た」
   - 「○○が△△と言い争っているのを耳にした」
   - 「○○が何かを書斎に隠すような仕草をしていた」
   - 「○○の手に赤い染みがついているように見えた」
   - 「○○が被害者の部屋から出てくるのを見かけた」
5. witnessInfoのtargetCharacterIdには目撃された人物のIDを正確に指定すること

【目撃情報の整合性 - 必須】
1. **目撃時刻と被目撃者のタイムライン上の行動が矛盾しないこと**
   - 例: Aが10:30に図書室にいたのを見た → Bのタイムラインで10:30に図書室にいることと整合
2. **目撃者自身のタイムラインとも矛盾しないこと**
   - 例: Aが10:30に図書室で目撃 → Aは10:30に図書室近くにいる設定が必要
3. 犯人の行動を目撃した情報は、**断片的で曖昧な表現**にすること
   - 「何かを隠しているように見えた」「慌てている様子だった」など
4. 同一時刻に複数の場所で目撃されることがないよう注意すること

【話し方（speakingStyle）の注意事項 - 最重要】
1. **全キャラクターの話し方が異なるようにすること**。全員が「です・ます」調は絶対禁止
2. 以下の要素を組み合わせて、キャラクターごとにユニークな話し方を設計すること:
   - **語尾**: 「〜だ」「〜だよ」「〜ですわ」「〜じゃ」「〜でございます」「〜さ」「〜かしら」「〜だぜ」「〜のよ」「〜っす」など
   - **一人称**: 「私」「僕」「俺」「わたくし」「あたし」「ワシ」「我」「自分」など
   - **口調の癖**: 皮肉っぽい、回りくどい、断定的、疑問形が多い、独り言が多い、詩的、ぶっきらぼう等
   - **特徴的な言い回し**: 専門用語を混ぜる、古風な言い方、方言っぽい、外来語が多い等
3. speakingStyleの例:
   - 「一人称は『ワシ』。年長者らしい威厳ある口調で、『〜じゃ』『〜であろう』を多用。説教くさいが温かみもある」
   - 「一人称は『あたし』。ぶっきらぼうで率直。『〜だろ？』『〜じゃん』。皮肉混じりの鋭いツッコミが多い」
   - 「一人称は『私（わたくし）』。上品で回りくどい言い回し。『〜ではなくて？』『〜かと存じます』」
   - 「一人称は『僕』。穏やかだが知的。『〜と考えられますね』『興味深い話です』。分析的な話し方」
   - 「一人称は『俺』。荒々しく感情的。『〜だッ！』『ふざけるなよ！』。怒ると声が大きくなる」
4. 年齢・性別・職業・性格と矛盾しない話し方にすること
5. 80-150文字程度で具体的に記述すること

【外見情報の注意事項】
1. visualDescriptionは英語で記述すること（画像生成AIが使用するため）
2. 各キャラクターの外見は他のキャラクターと明確に区別できるようにすること
3. 年齢・性別・職業に合った外見を設定すること
4. 舞台設定に合った服装を設定すること（学園モノなら制服、洋館なら執事服など）
5. 髪型・髪色・体型・特徴などで多様性を持たせること（全員同じにしない）
6. ethnicityは名前や舞台設定と整合性を持たせること（日本人名ならJapanese/East Asian）

**IMPORTANT: Return ONLY valid JSON, no markdown code blocks, no explanations.**
`;
}

/**
 * 生成テキスト内の char_xxx 形式のIDをキャラクター名に置換する安全策
 */
function replaceCharacterIdsWithNames(
  characters: GeneratedCharacter[],
  victimId: string
): GeneratedCharacter[] {
  const idToName: Record<string, string> = {};
  for (const char of characters) {
    idToName[char.id] = char.name;
  }
  idToName[victimId] = "被害者";

  function replaceIds(text: string): string {
    if (!text) return text;
    return text.replace(/char_[a-zA-Z0-9_]+/g, (match) => idToName[match] || match);
  }

  return characters.map(char => ({
    ...char,
    description: replaceIds(char.description),
    secretInfo: replaceIds(char.secretInfo),
    publicInfo: replaceIds(char.publicInfo),
    secretGoal: replaceIds(char.secretGoal),
    suspiciousInfo: replaceIds(char.suspiciousInfo),
    witnessInfo: char.witnessInfo.map(w => ({
      ...w,
      description: replaceIds(w.description),
    })),
  }));
}

/**
 * キャラクターを動的に生成
 */
export async function generateCharacters(
  params: CharacterGenParams
): Promise<CharacterDefinition[]> {
  console.log("[Character Generation] Starting...");

  // タイムラインからキャラクターIDを抽出
  const characterIds = extractCharacterIds(params.timeline);

  // プレイヤー数が足りない場合、追加のキャラクターを生成
  while (characterIds.length < params.playerCount) {
    characterIds.push(`char_extra_${characterIds.length + 1}`);
  }

  console.log("[Character Generation] Character IDs:", characterIds);

  const prompt = buildCharacterPrompt(params, characterIds);

  try {
    const result = await generateJSON<{ characters: GeneratedCharacter[] }>(prompt, {
      temperature: 0.7,
      maxTokens: 48000,  // 日本語キャラクター生成＋目撃情報のため増量（4倍増）
      schema: CharacterListSchema,
    });

    console.log("[Character Generation] Raw result:", result);

    // バリデーション
    const validated = CharacterListSchema.parse(result);

    // 後処理: char_xxx 形式のIDをキャラクター名に置換
    const victimId = params.timeline.victimId || "char_victim";
    const processedCharacters = replaceCharacterIdsWithNames(validated.characters, victimId);

    // タイムラインイベントテキスト内の char_xxx → キャラ名 置換用マッピング
    const idToName: Record<string, string> = {};
    for (const c of processedCharacters) {
      idToName[c.id] = c.name;
    }
    idToName[victimId] = "被害者";

    /** タイムラインイベントテキスト内の char_xxx をキャラ名に置換 */
    function replaceIdsInEvent(text: string): string {
      if (!text) return text;
      return text.replace(/char_[a-zA-Z0-9_]+/g, (match) => idToName[match] || match);
    }

    // CharacterDefinition形式に変換
    const characters: CharacterDefinition[] = processedCharacters.map(char => ({
      id: char.id,
      name: char.name,
      job: char.job,
      gender: char.gender,
      age: char.age,
      personality: char.personality,
      speakingStyle: char.speakingStyle,
      description: char.description,
      secretInfo: char.secretInfo,
      suspiciousInfo: char.suspiciousInfo,
      // 画像生成用の外見情報
      visualDescription: char.visualDescription,
      images: {
        base: "/images/placeholder.png",
        angry: "/images/placeholder.png",
        sad: "/images/placeholder.png",
        nervous: "/images/placeholder.png"
      },
      handout: {
        publicInfo: char.publicInfo,
        secretGoal: char.secretGoal,
        timeline: params.timeline.masterTimeline
          .filter(e => e.relatedCharacterId === char.id || e.visibility === "public")
          .map(e => {
            // イベントテキスト内の char_xxx をキャラ名に置換
            const eventText = replaceIdsInEvent(e.event);

            if (e.visibility === "public" && e.relatedCharacterId !== char.id) {
              // 【共通】イベント: 行動者の名前を主語として付与
              const actorName = e.relatedCharacterId
                ? (idToName[e.relatedCharacterId] || e.relatedCharacterId)
                : "";
              const subjectPrefix = actorName ? `${actorName}が` : "";
              return `${e.time} - 【共通】${subjectPrefix}${eventText}`;
            }
            return `${e.time} - ${eventText}`;
          }),
        // 目撃情報を追加（最低2つ）
        witnessInfo: char.witnessInfo.map(w => ({
          time: w.time,
          targetCharacterId: w.targetCharacterId,
          description: w.description
        }))
      }
    }));

    console.log("[Character Generation] Completed:", {
      count: characters.length,
      culprit: params.timeline.culpritId
    });

    // 犯人が含まれているか確認
    const hasCulprit = characters.some(c => c.id === params.timeline.culpritId);
    if (!hasCulprit) {
      console.error("[Character Generation] WARNING: Culprit not found in generated characters!");
    }

    return characters;

  } catch (error) {
    console.error("[Character Generation] Error:", error);
    throw new Error(`Character generation failed: ${error}`);
  }
}
