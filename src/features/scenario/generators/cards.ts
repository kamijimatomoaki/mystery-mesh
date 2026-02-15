/**
 * Card Slot Allocation
 * プレイヤー数に応じた動的なカード生成
 */

import { generateJSON } from "@/core/llm/vertex-text";
import { z } from "zod";
import { GAME_CONSTANTS } from "@/core/config/constants";
import type { MasterTimeline } from "../schemas";
import type { CardDefinition, CharacterDefinition, LocationDefinition } from "@/core/types";
import { getCrimeSceneLocation, getFieldLocations, HAND_LOCATION_ID } from "./locations";

/**
 * カード生成の共通スキーマ（title + description）
 */
const TitleDescriptionSchema = z.object({
  title: z.string(),
  description: z.string(),
});

/**
 * AIが返したカード内容のundefined/空文字をフォールバック値で補完するヘルパー
 */
function safeCardContent(
  result: { title?: string; description?: string },
  fallbackTitle: string,
  fallbackDescription: string
): { title: string; description: string } {
  return {
    title: result.title && result.title.trim() !== "" ? result.title : fallbackTitle,
    description: result.description && result.description.trim() !== "" ? result.description : fallbackDescription,
  };
}

/**
 * カード配分を計算
 *
 * 新計算式（v2）: フィールドカード数をプレイヤー数から独立計算
 * - characterCards = CARDS_PER_CHARACTER × playerCount = 16（4人時）
 * - fixedFieldCards = BASE_FIELD_CARDS = 4（遺体/死因/現場/凶器）
 * - dynamicFieldCards = FIELD_CARDS_PER_PLAYER × playerCount = 12（4人時）
 * - bufferCards = UNREACHABLE_CARD_BUFFER = 3
 * - fieldCards = fixedFieldCards + dynamicFieldCards + bufferCards = 19
 * - totalCards = characterCards + fieldCards = 35
 *
 * 結果: 4人プレイで35枚（手札16 + フィールド19）
 * - フィールドに19枚あるので総AP20でほぼ探索しきれる量
 * - 3枚はバッファで到達不能 → 全情報は揃わない設計を維持
 */
export function calculateCardDistribution(playerCount: number) {
  const totalAP = GAME_CONSTANTS.EXPLORATION_1_AP + GAME_CONSTANTS.EXPLORATION_2_AP;

  // キャラクター固有カード: 4枚×N人（固定）
  const characterCards = GAME_CONSTANTS.CARDS_PER_CHARACTER * playerCount;

  // フィールドカード: 固定枠 + 動的枠 + バッファ
  const fixedFieldCards = GAME_CONSTANTS.BASE_FIELD_CARDS;
  const dynamicFieldCards = GAME_CONSTANTS.FIELD_CARDS_PER_PLAYER * playerCount;
  const bufferCards = GAME_CONSTANTS.UNREACHABLE_CARD_BUFFER;
  const fieldCards = fixedFieldCards + dynamicFieldCards + bufferCards;

  return {
    totalCards: characterCards + fieldCards,
    characterCards,
    fieldCards,
    fixedFieldCards,
    dynamicFieldCards,
    bufferCards,
    totalAP: totalAP * playerCount,
    apPerPlayer: totalAP,
  };
}

/**
 * カードスロットを生成
 *
 * @param timeline - マスタータイムライン
 * @param characters - キャラクター定義
 * @param locations - ロケーション定義（オプション、なければデフォルト使用）
 */
export async function generateCardSlots(
  timeline: MasterTimeline,
  characters: CharacterDefinition[],
  locations?: LocationDefinition[]
): Promise<CardDefinition[]> {

  console.log("[Card Generation] Starting...", { locationCount: locations?.length });

  const cards: CardDefinition[] = [];

  // 各キャラクターに4スロット割り当て
  for (const char of characters) {
    const isCulprit = char.id === timeline.culpritId;

    console.log(`[Card Generation] Generating for ${char.id} (culprit: ${isCulprit})`);

    // Slot 1: Motive（動機）
    cards.push(await generateMotiveCard(char, timeline, isCulprit));

    // Slot 2: Item（所持品）
    cards.push(await generateItemCard(char, timeline, isCulprit));

    // Slot 3: Action (Alibi)（行動記録）
    cards.push(await generateActionCard(char, timeline, isCulprit));

    // Slot 4: Secret/Critical（秘密/決定的証拠）
    if (isCulprit) {
      // 犯人: 決定的証拠
      cards.push(await generateCriticalEvidenceCard(char, timeline));
    } else {
      // シロ: ミスリード
      cards.push(await generateMisleadCard(char, timeline));
    }
  }

  // フィールドカード生成
  const dist = calculateCardDistribution(characters.length);
  const fieldCards = await generateFieldCards(timeline, dist.fieldCards, characters, locations);

  console.log("[Card Generation] Completed:", {
    characterCards: cards.length,
    fieldCards: fieldCards.length,
    total: cards.length + fieldCards.length
  });

  return [...cards, ...fieldCards];
}

/**
 * Motive Card 生成（動機カード）
 * 被害者との関係性から浮かぶ疑惑として生成
 */
async function generateMotiveCard(
  char: CharacterDefinition,
  timeline: MasterTimeline,
  isCulprit: boolean
): Promise<CardDefinition> {

  const prompt = `
あなたはマーダーミステリーのシナリオライターです。
キャラクター「${char.name}」（${char.job}、${char.age}歳）の「被害者との関係性から浮かぶ疑惑」カードを生成してください。

【キャラクター情報】
- 性格: ${char.personality}

【要件】
- このカードは被害者とこのキャラクターの間にある過去のトラブルや感情的な軋轢を描写してください
- ${isCulprit ? "本当の殺意に繋がりうる深い怨恨や利害関係を示唆してください（ただし犯人だと断定しないこと）" : "一見怪しく見えるが、よく考えると犯行動機としては弱い関係性を描写してください"}
- 80-120文字で具体的なエピソードやシーンを含めて描写すること
- **禁止**: 犯人名の直接記述、「犯人である」「殺した」等の断定表現

JSON形式（必ず完結させること）：
{
  "title": "タイトル（5-10文字）",
  "description": "説明（80-120文字）"
}
`;

  const rawResult = await generateJSON<{ title: string; description: string }>(prompt, {
    temperature: 0.7,
    maxTokens: 16000,
    schema: TitleDescriptionSchema,
  });
  const result = safeCardContent(rawResult, `${char.name}の動機`, `${char.name}と被害者の間には何らかのトラブルがあったようだ。詳細は不明だが、周囲の証言から二人の関係は円満ではなかったことが窺える。`);

  return {
    id: `card_${char.id}_motive`,
    name: result.title,
    type: "information",
    slotType: "motive",
    relatedCharacterId: char.id,
    location: "Hand",
    backImageUrl: "/images/card-back.png",
    secret: {
      title: result.title,
      description: result.description,
      trueImageUrl: "/images/placeholder.png",
      importanceLevel: isCulprit ? 4 : 3
    }
  };
}

/**
 * Item Card 生成（所持品カード）
 * キャラクターの職業・性格から推測される所持品として生成（trickExplanationを渡さない）
 */
async function generateItemCard(
  char: CharacterDefinition,
  timeline: MasterTimeline,
  isCulprit: boolean
): Promise<CardDefinition> {

  const prompt = `
あなたはマーダーミステリーのシナリオライターです。
キャラクター「${char.name}」（${char.job}、${char.age}歳）の所持品カードを生成してください。

【キャラクター情報】
- 性格: ${char.personality}
- 職業: ${char.job}

【要件】
- このキャラクターの職業や性格から推測される、所持していそうな物品を描写してください
- ${isCulprit ? "事件と間接的に結びつく可能性のある物品（ただし直接的な凶器ではないこと）" : "日常的な所持品だが、見方によっては事件と関連があるように見える物品"}
- 物品の外見、状態、特徴を80-120文字で具体的に描写すること
- **禁止**: 犯人名の記述、「凶器」「殺害」等の直接表現

JSON形式（必ず完結）：
{
  "title": "物品名（5-10文字）",
  "description": "説明（80-120文字）"
}
`;

  const rawResult = await generateJSON<{ title: string; description: string }>(prompt, {
    temperature: 0.7,
    maxTokens: 16000,
    schema: TitleDescriptionSchema,
  });
  const result = safeCardContent(rawResult, `${char.name}の所持品`, `${char.name}の鞄の中から見つかった物品。${char.job}という職業に関連するものと思われるが、事件との関係は不明。`);

  return {
    id: `card_${char.id}_item`,
    name: result.title,
    type: "item",
    slotType: "item",
    relatedCharacterId: char.id,
    location: "Hand",
    backImageUrl: "/images/card-back.png",
    secret: {
      title: result.title,
      description: result.description,
      trueImageUrl: "/images/placeholder.png",
      importanceLevel: isCulprit ? 3 : 2
    }
  };
}

/**
 * Action Card 生成（行動記録カード）
 * タイムラインイベントのみ提供し、犯人フラグは直接渡さない
 */
async function generateActionCard(
  char: CharacterDefinition,
  timeline: MasterTimeline,
  isCulprit: boolean
): Promise<CardDefinition> {

  // タイムラインから該当キャラの行動を取得（客観的事実のみ）
  const charEvents = timeline.masterTimeline.filter(
    e => e.relatedCharacterId === char.id
  );

  const eventDesc = charEvents.length > 0
    ? charEvents.slice(0, 3).map(e => `${e.time}: ${e.event}`).join("\n")
    : `${char.name}の行動は不明な点が多い`;

  const prompt = `
あなたはマーダーミステリーのシナリオライターです。
キャラクター「${char.name}」（${char.job}）の事件当日の行動記録カードを生成してください。

【タイムラインの客観的事実】
${eventDesc}

【要件】
- 上記のタイムラインに基づき、目撃者の証言や防犯カメラの記録のような客観的な描写で行動を記述してください
- 80-120文字で、場所・時刻・目撃情報を具体的に描写すること
- ${isCulprit ? "一部の時間帯に空白（不明な行動）があることを示唆してください" : "アリバイとして使えそうな情報を含めてください（ただし完全ではない）"}
- **禁止**: 犯人名の記述、犯行の直接描写

JSON形式（必ず完結）：
{
  "title": "行動記録のタイトル（5-10文字）",
  "description": "説明（80-120文字）"
}
`;

  const rawResult = await generateJSON<{ title: string; description: string }>(prompt, {
    temperature: 0.6,
    maxTokens: 16000,
    schema: TitleDescriptionSchema,
  });
  const result = safeCardContent(rawResult, `${char.name}の行動記録`, `${char.name}の事件当日の行動記録。目撃証言によると、いくつかの場所で姿が確認されているが、一部の時間帯については情報が欠落している。`);

  return {
    id: `card_${char.id}_action`,
    name: result.title,
    type: "information",
    slotType: "action",
    relatedCharacterId: char.id,
    location: "Hand",
    backImageUrl: "/images/card-back.png",
    secret: {
      title: result.title,
      description: result.description,
      trueImageUrl: "/images/placeholder.png",
      importanceLevel: 3
    }
  };
}

/**
 * Critical Evidence Card 生成（犯人用 - 状況証拠）
 * 「犯人であることを証明する決定的な証拠」ではなく「状況証拠」として生成
 */
async function generateCriticalEvidenceCard(
  char: CharacterDefinition,
  timeline: MasterTimeline
): Promise<CardDefinition> {

  // タイムラインから犯人の行動イベントのみを抽出（trickExplanationは直接渡さない）
  const culpritEvents = timeline.masterTimeline
    .filter(e => e.relatedCharacterId === char.id)
    .map(e => `${e.time}: ${e.event}`)
    .join("\n");

  const prompt = `
あなたはマーダーミステリーのシナリオライターです。
キャラクター「${char.name}」に関する重要な状況証拠カードを生成してください。

【このキャラクターの行動記録】
${culpritEvents || "詳細な行動記録はない"}

【要件】
- このカードは「他のカードと組み合わせることで真相に近づける状況証拠」です
- 単独では犯人を断定できないが、他の手がかりと合わせると疑惑が深まる物的証拠や状況を描写してください
- 例：不自然な痕跡、場違いな物品、時間的な矛盾を示す証拠など
- 80-120文字で、証拠の外見・発見状況を具体的に描写すること
- **絶対禁止**: 犯人名の記述、「犯人」「殺害」「犯行」等の断定表現、トリックの直接説明

JSON形式で出力（必ず閉じカッコを含めること）：
{
  "title": "証拠品名（5-10文字）",
  "description": "証拠の状況描写（80-120文字）"
}
`;

  const rawResult = await generateJSON<{ title: string; description: string }>(prompt, {
    temperature: 0.6,
    maxTokens: 16000,
    schema: TitleDescriptionSchema,
  });
  const result = safeCardContent(rawResult, "重要な状況証拠", `${char.name}の近くで見つかった不審な痕跡。単独では意味をなさないが、他の証拠と合わせて考えると重要な手がかりになりそうだ。`);

  return {
    id: `card_${char.id}_secret`,
    name: result.title,
    type: "evidence",
    slotType: "secret",
    relatedCharacterId: char.id,
    location: "Hand",
    backImageUrl: "/images/card-back.png",
    secret: {
      title: result.title,
      description: result.description,
      trueImageUrl: "/images/placeholder.png",
      importanceLevel: 5 // 最重要
    }
  };
}

/**
 * Mislead Card 生成（無実者用 - ミスリード）
 * 疑わしいが無実を示す具体的な状況証拠
 */
async function generateMisleadCard(
  char: CharacterDefinition,
  timeline: MasterTimeline
): Promise<CardDefinition> {

  // タイムラインから該当キャラの行動を抽出（trickExplanationは渡さない）
  const charEvents = timeline.masterTimeline
    .filter(e => e.relatedCharacterId === char.id)
    .map(e => `${e.time}: ${e.event}`)
    .join("\n");

  const prompt = `
あなたはマーダーミステリーのシナリオライターです。
無実のキャラクター「${char.name}」（${char.job}）に関するミスリードカードを生成してください。

【このキャラクターの行動記録】
${charEvents || "詳細な行動記録はない"}

【要件】
- 一見すると非常に怪しく見えるが、よく考えると無実を裏付ける証拠を描写してください
- 例：現場近くでの目撃情報だが実は別の理由があった、怪しい物品だが正当な用途があった等
- 80-120文字で、証拠の外見・発見状況を具体的に描写すること
- プレイヤーが議論で検証できるような具体的な情報を含めてください
- **禁止**: 犯人名の記述、真犯人への言及

JSON形式（必ず完結）：
{
  "title": "証拠品名（5-10文字）",
  "description": "説明（80-120文字）"
}
`;

  const rawResult = await generateJSON<{ title: string; description: string }>(prompt, {
    temperature: 0.7,
    maxTokens: 16000,
    schema: TitleDescriptionSchema,
  });
  const result = safeCardContent(rawResult, "疑わしい証拠", `${char.name}に関する疑わしい状況証拠。一見すると犯行に関与しているように見えるが、よく調べると別の説明がつく可能性がある。`);

  return {
    id: `card_${char.id}_secret`,
    name: result.title,
    type: "evidence",
    slotType: "secret",
    relatedCharacterId: char.id,
    location: "Hand",
    backImageUrl: "/images/card-back.png",
    secret: {
      title: result.title,
      description: result.description,
      trueImageUrl: "/images/placeholder.png",
      importanceLevel: 4,
      misleadNote: "これは無実の証拠です"
    }
  };
}

/**
 * 重み付き分散アルゴリズムでカードをロケーションに配置
 *
 * Phase 1: 非犯行現場に各1枚保証
 * Phase 2: 犯行現場に1-2枚（既に固定4枚あるため控えめ）
 * Phase 3: importance値ベース + 既存枚数ペナルティで残りを分配
 */
function distributeCardsToLocations(
  count: number,
  fieldLocations: LocationDefinition[],
  crimeSceneId: string
): LocationDefinition[] {
  const assignments: LocationDefinition[] = [];
  const locationCardCount = new Map<string, number>();

  // 犯行現場には既に固定4枚あることを考慮
  locationCardCount.set(crimeSceneId, 4);
  for (const loc of fieldLocations) {
    if (!locationCardCount.has(loc.id)) {
      locationCardCount.set(loc.id, 0);
    }
  }

  // Phase 1: 非犯行現場に各1枚保証
  const nonCrimeLocations = fieldLocations.filter(l => l.id !== crimeSceneId);
  for (const loc of nonCrimeLocations) {
    if (assignments.length >= count) break;
    assignments.push(loc);
    locationCardCount.set(loc.id, (locationCardCount.get(loc.id) || 0) + 1);
  }

  // Phase 2: 犯行現場に1-2枚（控えめ）
  const crimeLocation = fieldLocations.find(l => l.id === crimeSceneId);
  if (crimeLocation && assignments.length < count) {
    const crimeCards = Math.min(2, count - assignments.length);
    for (let i = 0; i < crimeCards; i++) {
      assignments.push(crimeLocation);
      locationCardCount.set(crimeSceneId, (locationCardCount.get(crimeSceneId) || 0) + 1);
    }
  }

  // Phase 3: 残りをimportance値ベース + 既存枚数ペナルティで分配
  while (assignments.length < count) {
    let bestLocation = fieldLocations[0];
    let bestScore = -Infinity;

    for (const loc of fieldLocations) {
      const existingCount = locationCardCount.get(loc.id) || 0;
      const importance = loc.importance || 3;
      // スコア = importance - (既存カード数 * 2) + ランダムジッター
      const score = importance - (existingCount * 2) + (Math.random() * 1.5);
      if (score > bestScore) {
        bestScore = score;
        bestLocation = loc;
      }
    }

    assignments.push(bestLocation);
    locationCardCount.set(bestLocation.id, (locationCardCount.get(bestLocation.id) || 0) + 1);
  }

  return assignments;
}

/**
 * デフォルトロケーション（locationsが渡されなかった場合のフォールバック）
 */
const DEFAULT_FIELD_LOCATIONS: LocationDefinition[] = [
  { id: "living_room", name: "リビングルーム", type: "room", importance: 4 },
  { id: "library", name: "図書室", type: "room", importance: 4 },
  { id: "kitchen", name: "キッチン", type: "room", importance: 3 },
  { id: "hallway", name: "廊下", type: "room", importance: 2 },
  { id: "bedroom", name: "寝室", type: "room", importance: 3 },
];

/**
 * Field Cards 生成（フィールド共通カード）
 *
 * @param timeline - マスタータイムライン
 * @param count - 生成するカード数
 * @param characters - キャラクター定義
 * @param locations - ロケーション定義（オプション）
 */
async function generateFieldCards(
  timeline: MasterTimeline,
  count: number,
  characters: CharacterDefinition[],
  locations?: LocationDefinition[]
): Promise<CardDefinition[]> {

  console.log(`[Field Cards] Generating ${count} cards...`);

  const cards: CardDefinition[] = [];

  // ロケーション設定
  const fieldLocations = locations ? getFieldLocations(locations) : DEFAULT_FIELD_LOCATIONS;
  const crimeScene = locations ? getCrimeSceneLocation(locations) : null;
  const crimeSceneId = crimeScene?.id || "crime_scene";

  // 固定枠: 死体情報 + 現場状況 (4枚) — AI生成
  // タイムラインから客観的事実のみ抽出（trickExplanationは直接使わない）
  const publicEvents = timeline.masterTimeline
    .filter(e => e.visibility === "public")
    .map(e => `${e.time}: ${e.event}`)
    .join("\n");

  const victimName = characters.find(c => c.id === timeline.victimId)?.name || "被害者";
  const crimeSceneName = crimeScene?.name || "事件現場";

  // 4枚を並列生成
  const [bodyCard, causeCard, sceneCard, weaponCard] = await Promise.all([
    // カード1: 死体の状態
    generateJSON<{ title: string; description: string }>(`
あなたはマーダーミステリーのシナリオライターです。
事件現場で発見された被害者「${victimName}」の遺体の状態を描写するカードを生成してください。

【公開されているタイムライン情報】
${publicEvents || "詳細は不明"}

【要件】
- 遺体の発見場所、姿勢、外見的な特徴（表情、服装の乱れ、周囲の状況）を描写
- 80-120文字で医学的・客観的な視点で記述
- **禁止**: 犯人名、殺害方法の断定

JSON形式：
{ "title": "タイトル（5-10文字）", "description": "説明（80-120文字）" }
`, { temperature: 0.6, maxTokens: 16000, schema: TitleDescriptionSchema }),

    // カード2: 死因（trickExplanationを直接使わず、客観的な所見として生成）
    generateJSON<{ title: string; description: string }>(`
あなたはマーダーミステリーのシナリオライターです。
被害者「${victimName}」の死因に関する検視所見カードを生成してください。

【公開されているタイムライン情報】
${publicEvents || "詳細は不明"}

【要件】
- 死亡推定時刻、外傷の種類、死因の可能性（複数あってもよい）を記述
- 検視官の報告書のような客観的で専門的な記述
- 80-120文字で、推理の手がかりになる具体的な医学的所見を含めること
- **禁止**: 犯人名、殺害手口の断定的記述（「〜の可能性がある」「〜と思われる」等の推定表現を使う）

JSON形式：
{ "title": "タイトル（5-10文字）", "description": "説明（80-120文字）" }
`, { temperature: 0.6, maxTokens: 16000, schema: TitleDescriptionSchema }),

    // カード3: 現場の状況
    generateJSON<{ title: string; description: string }>(`
あなたはマーダーミステリーのシナリオライターです。
「${crimeSceneName}」の犯行現場の状況を描写するカードを生成してください。

【公開されているタイムライン情報】
${publicEvents || "詳細は不明"}

【要件】
- 現場の部屋の状態、家具の配置、窓やドアの施錠状況、照明、温度などの環境情報を記述
- 不自然な痕跡（争った形跡、移動した家具、開いた窓など）があれば描写
- 80-120文字で犯行の手がかりとなる具体的な情報を含めること
- **禁止**: 犯人名、犯行方法の断定

JSON形式：
{ "title": "タイトル（5-10文字）", "description": "説明（80-120文字）" }
`, { temperature: 0.6, maxTokens: 16000, schema: TitleDescriptionSchema }),

    // カード4: 凶器候補
    generateJSON<{ title: string; description: string }>(`
あなたはマーダーミステリーのシナリオライターです。
事件現場付近で発見された凶器候補の物品カードを生成してください。

【公開されているタイムライン情報】
${publicEvents || "詳細は不明"}

【要件】
- 凶器の可能性がある物品の外見、材質、状態（指紋の有無、血痕の有無等）を描写
- 本当の凶器かどうかは断定せず、「凶器と思われる」「可能性がある」等の推定表現を使う
- 80-120文字で具体的に描写すること
- **禁止**: 犯人名、犯行方法の断定

JSON形式：
{ "title": "タイトル（5-10文字）", "description": "説明（80-120文字）" }
`, { temperature: 0.6, maxTokens: 16000, schema: TitleDescriptionSchema }),
  ]);

  const safeBody = safeCardContent(bodyCard, "遺体の状態", `${victimName}の遺体は${crimeSceneName}で発見された。外見上の特徴から、死亡してからそれほど時間が経っていないことが推測される。`);
  const safeCause = safeCardContent(causeCard, "検視所見", `検視の結果、死亡推定時刻は事件当日の夜間と思われる。死因については複数の可能性が示唆されているが、断定には至っていない。`);
  const safeScene = safeCardContent(sceneCard, "現場の状況", `${crimeSceneName}の現場には複数の不自然な痕跡が残されていた。争った形跡の有無や、物品の配置から犯行の手がかりを得られる可能性がある。`);
  const safeWeapon = safeCardContent(weaponCard, "凶器候補", `現場付近で発見された物品。凶器として使用された可能性があるが、確証はない。詳細な鑑定が待たれる。`);

  cards.push({
    id: "card_field_body_1",
    name: safeBody.title,
    type: "evidence",
    slotType: "action",
    location: crimeSceneId,
    backImageUrl: "/images/card-back.png",
    secret: { title: safeBody.title, description: safeBody.description, trueImageUrl: "/images/placeholder.png", importanceLevel: 4 }
  });

  cards.push({
    id: "card_field_body_2",
    name: safeCause.title,
    type: "evidence",
    slotType: "action",
    location: crimeSceneId,
    backImageUrl: "/images/card-back.png",
    secret: { title: safeCause.title, description: safeCause.description, trueImageUrl: "/images/placeholder.png", importanceLevel: 5 }
  });

  cards.push({
    id: "card_field_scene_1",
    name: safeScene.title,
    type: "information",
    slotType: "action",
    location: crimeSceneId,
    backImageUrl: "/images/card-back.png",
    secret: { title: safeScene.title, description: safeScene.description, trueImageUrl: "/images/placeholder.png", importanceLevel: 3 }
  });

  cards.push({
    id: "card_field_scene_2",
    name: safeWeapon.title,
    type: "evidence",
    slotType: "item",
    location: crimeSceneId,
    backImageUrl: "/images/card-back.png",
    secret: { title: safeWeapon.title, description: safeWeapon.description, trueImageUrl: "/images/placeholder.png", importanceLevel: 4 }
  });

  // 動的枠: 残りのカードを生成（重み付き分散アルゴリズム）
  const remaining = count - 4;

  // 各ロケーションへのカード配置を重み付き分散で決定
  const locationAssignments = distributeCardsToLocations(remaining, fieldLocations, crimeSceneId);

  // 動的カードも並列バッチで生成（パフォーマンス向上）
  const dynamicCardPromises = [];
  for (let i = 0; i < remaining; i++) {
    const targetLocation = locationAssignments[i];
    const locationId = targetLocation.id;
    const locationName = targetLocation.name;

    // キャラクター名リスト（ヒント用）
    const charNames = characters.map(c => c.name).join("、");

    const prompt = `
あなたはマーダーミステリーのシナリオライターです。
「${locationName}」で発見された手がかりカードを生成してください。

【場所の情報】
場所名: ${locationName}
登場人物: ${charNames}

【タイムライン（公開情報）】
${publicEvents || "詳細は不明"}

【要件】
- この場所で発見された物品、痕跡、記録（メモ、写真、足跡など）を具体的に描写
- 事件と何らかの関連がありそうな手がかりとして機能すること
- 80-120文字で、場所の特徴を活かした具体的な描写をすること
- **禁止**: 犯人名の記述、犯行方法の断定

JSON形式：
{ "title": "物品名（5-10文字）", "description": "説明（80-120文字）" }
`;

    dynamicCardPromises.push(
      generateJSON<{ title: string; description: string }>(prompt, {
        temperature: 0.7,
        maxTokens: 16000,
        schema: TitleDescriptionSchema,
      }).then(rawResult => {
        const result = safeCardContent(rawResult, `${locationName}の手がかり`, `${locationName}で発見された痕跡。事件との関連は不明だが、調査の手がかりになる可能性がある。`);
        return {
          id: `card_field_dynamic_${i + 1}`,
          name: result.title,
          type: "information" as const,
          slotType: "action" as const,
          location: locationId,
          backImageUrl: "/images/card-back.png",
          secret: {
            title: result.title,
            description: result.description,
            trueImageUrl: "/images/placeholder.png",
            importanceLevel: 2
          }
        };
      })
    );
  }

  // 並列実行して結果を収集（Promise.allSettledで個別失敗を許容）
  const dynamicResults = await Promise.allSettled(dynamicCardPromises);

  let successCount = 0;
  let failCount = 0;
  for (const result of dynamicResults) {
    if (result.status === "fulfilled") {
      cards.push(result.value);
      successCount++;
    } else {
      failCount++;
      console.warn(`[Field Cards] Dynamic card generation failed:`, result.reason);
    }
  }

  // 失敗したカードをリトライ（最大3回）
  if (failCount > 0) {
    console.log(`[Field Cards] ${failCount} cards failed, retrying...`);
    for (let retry = 0; retry < 3 && failCount > 0; retry++) {
      const retryPromises = [];
      for (let i = 0; i < failCount; i++) {
        const fallbackLocation = fieldLocations[i % fieldLocations.length];
        retryPromises.push(
          generateJSON<{ title: string; description: string }>(`
あなたはマーダーミステリーのシナリオライターです。
「${fallbackLocation.name}」で発見された手がかりカードを生成してください。
80-120文字で具体的に描写すること。
JSON形式：{ "title": "物品名（5-10文字）", "description": "説明（80-120文字）" }
`, { temperature: 0.7, maxTokens: 16000, schema: TitleDescriptionSchema }).then(rawResult => {
            const result = safeCardContent(rawResult, `${fallbackLocation.name}の手がかり`, `${fallbackLocation.name}で発見された痕跡。事件との関連は不明だが、調査の手がかりになる可能性がある。`);
            return {
              id: `card_field_retry_${retry}_${i}`,
              name: result.title,
              type: "information" as const,
              slotType: "action" as const,
              location: fallbackLocation.id,
              backImageUrl: "/images/card-back.png",
              secret: {
                title: result.title,
                description: result.description,
                trueImageUrl: "/images/placeholder.png",
                importanceLevel: 2
              }
            };
          })
        );
      }
      const retryResults = await Promise.allSettled(retryPromises);
      let newFailCount = 0;
      for (const result of retryResults) {
        if (result.status === "fulfilled") {
          cards.push(result.value);
          failCount--;
        } else {
          newFailCount++;
        }
      }
      failCount = newFailCount;
      if (failCount === 0) break;
    }
  }

  console.log(`[Field Cards] Final result: ${cards.length} cards (${successCount} dynamic succeeded, ${failCount} still failed)`);

  return cards;
}

/**
 * カード内容のバリデーション
 * 犯人名・トリック直接記述のチェック、文字数下限チェック
 *
 * @param cards - 生成されたカード一覧
 * @param timeline - タイムライン（犯人名の検出に使用）
 * @param characters - キャラクター定義
 * @returns バリデーション結果（問題のあるカードID一覧）
 */
export function validateCardContents(
  cards: CardDefinition[],
  timeline: MasterTimeline,
  characters: CharacterDefinition[]
): { valid: boolean; issues: { cardId: string; reason: string }[] } {
  const issues: { cardId: string; reason: string }[] = [];

  // 犯人のキャラクター名を取得
  const culprit = characters.find(c => c.id === timeline.culpritId);
  const culpritName = culprit?.name || "";

  // 禁止ワードリスト
  const bannedPhrases = [
    "犯人は",
    "犯人である",
    "犯行を行った",
    "殺害した",
    "殺した人物",
  ];

  for (const card of cards) {
    const desc = card.secret?.description || "";

    // 文字数下限チェック（50文字未満はリジェクト）
    if (desc.length < 50) {
      issues.push({ cardId: card.id, reason: `description が短すぎます（${desc.length}文字 < 50文字）` });
    }

    // 犯人名の直接記述チェック
    if (culpritName && desc.includes(`${culpritName}が犯人`)) {
      issues.push({ cardId: card.id, reason: `犯人名「${culpritName}」の直接記述` });
    }

    // 禁止フレーズチェック
    for (const phrase of bannedPhrases) {
      if (desc.includes(phrase)) {
        issues.push({ cardId: card.id, reason: `禁止フレーズ「${phrase}」の記述` });
        break;
      }
    }

    // trickExplanationの直接コピーチェック（30文字以上の一致）
    if (timeline.trickExplanation && desc.length > 0) {
      const trickSub = timeline.trickExplanation.substring(0, 30);
      if (desc.includes(trickSub)) {
        issues.push({ cardId: card.id, reason: "trickExplanation の直接コピー" });
      }
    }
  }

  console.log(`[Card Validation] ${issues.length} issues found in ${cards.length} cards`);
  if (issues.length > 0) {
    console.warn("[Card Validation] Issues:", issues);
  }

  return { valid: issues.length === 0, issues };
}

/**
 * カード枚数バリデーション
 * 期待枚数 vs 実際枚数チェック、ロケーション集中度チェック
 */
export function validateCardCount(
  cards: CardDefinition[],
  characters: CharacterDefinition[],
  locations?: LocationDefinition[]
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const expectedTotal = calculateCardDistribution(characters.length).totalCards;

  // 総数チェック
  if (cards.length < expectedTotal) {
    warnings.push(`カード総数が期待値を下回っています（期待: ${expectedTotal}, 実際: ${cards.length}）`);
  }

  // 各キャラクターが4枚持っているかチェック
  for (const char of characters) {
    const charCards = cards.filter(c => c.relatedCharacterId === char.id && c.location === "Hand");
    if (charCards.length < GAME_CONSTANTS.CARDS_PER_CHARACTER) {
      warnings.push(`${char.name}のハンドカードが不足（期待: ${GAME_CONSTANTS.CARDS_PER_CHARACTER}, 実際: ${charCards.length}）`);
    }
  }

  // ロケーション集中度チェック
  const fieldCards = cards.filter(c => c.location !== "Hand");
  if (fieldCards.length > 0) {
    const locationCounts = new Map<string, number>();
    for (const card of fieldCards) {
      locationCounts.set(card.location, (locationCounts.get(card.location) || 0) + 1);
    }

    for (const [locId, count] of locationCounts) {
      const ratio = count / fieldCards.length;
      if (ratio > 0.4) {
        warnings.push(`ロケーション「${locId}」にカードが集中しすぎ（${count}/${fieldCards.length}枚、${Math.round(ratio * 100)}%）`);
      }
    }

    // カード0枚のロケーションチェック
    if (locations) {
      for (const loc of locations) {
        if (!locationCounts.has(loc.id) && loc.id !== "Hand") {
          warnings.push(`ロケーション「${loc.name}」にカードが0枚`);
        }
      }
    }
  }

  if (warnings.length > 0) {
    console.warn("[Card Count Validation] Warnings:", warnings);
  }

  return { valid: warnings.length === 0, warnings };
}
