/**
 * Location Generator
 * シナリオの物語に応じてロケーションをAI生成（フォールバック: テンプレート）
 */

import { z } from "zod";
import type { LocationDefinition } from "@/core/types";
import { generateJSON } from "@/core/llm/vertex-text";
import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("LocationGenerator");

/**
 * AI生成用のロケーションスキーマ
 */
const AILocationSchema = z.object({
  id: z.string().regex(/^[a-z_]+$/, "IDは英小文字とアンダースコアのみ"),
  name: z.string().min(1).max(20),
  type: z.enum(["room", "outdoor", "special"]),
  importance: z.number().min(1).max(5),
  isCrimeScene: z.boolean().optional(),
  description: z.string().max(50).optional(),
});

const AILocationsResponseSchema = z.object({
  locations: z.array(AILocationSchema).min(6).max(12),
});

type AILocationsResponse = z.infer<typeof AILocationsResponseSchema>;

/**
 * フォールバック用テンプレート（AI生成失敗時に使用）
 */
const FALLBACK_TEMPLATES: Record<string, LocationDefinition[]> = {
  mansion: [
    { id: "entrance_hall", name: "玄関ホール", type: "room", importance: 3 },
    { id: "living_room", name: "リビングルーム", type: "room", importance: 4 },
    { id: "dining_room", name: "ダイニングルーム", type: "room", importance: 4 },
    { id: "kitchen", name: "キッチン", type: "room", importance: 3 },
    { id: "study", name: "書斎", type: "room", importance: 5, isCrimeScene: true },
    { id: "library", name: "図書室", type: "room", importance: 4 },
    { id: "master_bedroom", name: "主寝室", type: "room", importance: 4 },
    { id: "garden", name: "庭園", type: "outdoor", importance: 3 },
  ],
  default: [
    { id: "main_room", name: "メインルーム", type: "room", importance: 5, isCrimeScene: true },
    { id: "room_a", name: "部屋A", type: "room", importance: 4 },
    { id: "room_b", name: "部屋B", type: "room", importance: 4 },
    { id: "room_c", name: "部屋C", type: "room", importance: 3 },
    { id: "hallway", name: "廊下", type: "room", importance: 2 },
    { id: "storage", name: "倉庫", type: "room", importance: 3 },
    { id: "outside_a", name: "外部エリアA", type: "outdoor", importance: 3 },
    { id: "outside_b", name: "外部エリアB", type: "outdoor", importance: 2 },
  ],
};

/**
 * マップ上の座標を自動計算
 */
function calculatePositions(locations: LocationDefinition[]): LocationDefinition[] {
  const GRID_COLS = 4;
  const CELL_WIDTH = 240;
  const CELL_HEIGHT = 180;
  const PADDING = 30;
  const START_X = 50;
  const START_Y = 50;

  return locations.map((loc, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);

    return {
      ...loc,
      position: {
        x: START_X + col * (CELL_WIDTH + PADDING),
        y: START_Y + row * (CELL_HEIGHT + PADDING),
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
      },
    };
  });
}

/**
 * 事件現場が設定されていない場合、最重要ロケーションを事件現場に
 */
function ensureCrimeScene(locations: LocationDefinition[]): LocationDefinition[] {
  const hasCrimeScene = locations.some((l) => l.isCrimeScene);
  if (hasCrimeScene) return locations;

  // 重要度でソートして最も重要な場所を事件現場に
  const sorted = [...locations].sort((a, b) => (b.importance || 0) - (a.importance || 0));
  const crimeSceneId = sorted[0]?.id;

  return locations.map((loc) => ({
    ...loc,
    isCrimeScene: loc.id === crimeSceneId,
  }));
}

/**
 * AIを使用してロケーションを生成
 *
 * @param intro - シナリオの導入文（舞台設定の参考）
 * @param genre - シナリオのジャンル
 * @param playerCount - プレイヤー数
 */
async function generateLocationsWithAI(
  intro: string,
  genre: string,
  playerCount: number
): Promise<LocationDefinition[]> {
  // プレイヤー数に応じたロケーション数を計算
  const minLocations = Math.max(6, playerCount + 2);
  const maxLocations = Math.min(12, minLocations + 2);

  const prompt = `あなたはマーダーミステリーゲームの舞台設計者です。
以下のシナリオ設定に基づいて、ゲームの舞台となるロケーション（場所）を生成してください。

【シナリオ設定】
ジャンル: ${genre}
導入:
${intro}

【生成ルール】
1. ${minLocations}〜${maxLocations}箇所のロケーションを生成
2. 必ず1箇所を事件現場（isCrimeScene: true）に設定
3. シナリオの雰囲気・舞台に合った具体的な場所名を使用
   - 例: 「キッチン」ではなく「血痕の残る厨房」
   - 例: 「部屋A」ではなく「被害者の私室」
4. 各ロケーションに重要度（1-5）を設定
   - 5: 事件現場・核心的な場所
   - 4: 重要な証拠がある場所
   - 3: 一般的な探索場所
   - 2: 補助的な場所
   - 1: 背景的な場所

【出力形式】
JSON形式で出力してください:
{
  "locations": [
    {
      "id": "crime_scene",
      "name": "血塗られた書斎",
      "type": "room",
      "importance": 5,
      "isCrimeScene": true,
      "description": "被害者が最後に目撃された場所"
    },
    {
      "id": "kitchen",
      "name": "古びた厨房",
      "type": "room",
      "importance": 3,
      "description": "調理器具が散乱している"
    }
  ]
}

【注意】
- idは英小文字とアンダースコアのみ使用可能（例: main_hall, secret_room）
- nameは日本語で20文字以内
- typeは "room"（室内）, "outdoor"（屋外）, "special"（特殊）のいずれか
- descriptionは省略可能（50文字以内）`;

  logger.info("Generating locations with AI", { genre, playerCount, minLocations, maxLocations });

  const result = await generateJSON<AILocationsResponse>(prompt, {
    temperature: 0.8, // 創造性を高める
    maxTokens: 12000,  // ロケーション詳細・雰囲気設定のため増量（4倍増）
    schema: AILocationsResponseSchema,
  });

  // スキーマでバリデーション
  const validated = AILocationsResponseSchema.parse(result);

  logger.info("AI locations generated", {
    count: validated.locations.length,
    crimeScene: validated.locations.find((l) => l.isCrimeScene)?.name,
  });

  return validated.locations;
}

/**
 * ジャンルからフォールバックテンプレートキーを推測
 */
function getTemplateKeyFromGenre(genre: string): string {
  const genreLower = genre.toLowerCase();

  if (
    genreLower.includes("館") ||
    genreLower.includes("mansion") ||
    genreLower.includes("洋館")
  ) {
    return "mansion";
  }

  return "default";
}

/**
 * フォールバック用のテンプレートベース生成
 */
function generateLocationsFromTemplate(
  genre: string,
  playerCount: number
): LocationDefinition[] {
  const templateKey = getTemplateKeyFromGenre(genre);
  const template = FALLBACK_TEMPLATES[templateKey] || FALLBACK_TEMPLATES.default;

  // プレイヤー数に応じてロケーション数を調整
  const minLocations = Math.max(6, playerCount + 2);
  const targetCount = Math.min(minLocations, template.length);

  // 重要度順にソートして選択
  const sortedByImportance = [...template].sort(
    (a, b) => (b.importance || 0) - (a.importance || 0)
  );

  return sortedByImportance.slice(0, targetCount);
}

/**
 * ロケーションを生成（メインエントリーポイント）
 *
 * AI生成を試み、失敗時はテンプレートにフォールバック
 *
 * @param intro - シナリオの導入文
 * @param genre - シナリオのジャンル
 * @param playerCount - プレイヤー数
 * @returns 生成されたロケーション定義の配列
 */
export async function generateLocations(
  intro: string,
  genre: string,
  playerCount: number = 4
): Promise<LocationDefinition[]> {
  logger.info("Starting location generation", { genre, playerCount });

  let locations: LocationDefinition[];

  try {
    // AI生成を試行
    locations = await generateLocationsWithAI(intro, genre, playerCount);
    logger.info("Using AI-generated locations");
  } catch (error) {
    // AI生成失敗時はテンプレートにフォールバック
    logger.warn("AI location generation failed, using template fallback", { error });
    locations = generateLocationsFromTemplate(genre, playerCount);
    logger.info("Using template-based locations", {
      templateKey: getTemplateKeyFromGenre(genre),
    });
  }

  // 事件現場が設定されていない場合は自動設定
  locations = ensureCrimeScene(locations);

  // 座標を計算
  locations = calculatePositions(locations);

  logger.info("Location generation completed", {
    count: locations.length,
    crimeScene: locations.find((l) => l.isCrimeScene)?.name,
    locationNames: locations.map((l) => l.name),
  });

  return locations;
}

/**
 * 同期版ロケーション生成（テンプレートのみ使用）
 * モックデータ生成など、同期処理が必要な場合に使用
 */
export function generateLocationsSync(
  genre: string,
  playerCount: number = 4
): LocationDefinition[] {
  logger.info("Generating locations (sync/template)", { genre, playerCount });

  let locations = generateLocationsFromTemplate(genre, playerCount);
  locations = ensureCrimeScene(locations);
  locations = calculatePositions(locations);

  return locations;
}

/**
 * 特殊ロケーション: 手持ち（プレイヤーの手札）
 */
export const HAND_LOCATION_ID = "hand";

/**
 * ロケーションIDからロケーション定義を取得
 */
export function getLocationById(
  locations: LocationDefinition[],
  locationId: string
): LocationDefinition | undefined {
  return locations.find((l) => l.id === locationId);
}

/**
 * 事件現場のロケーションを取得
 */
export function getCrimeSceneLocation(
  locations: LocationDefinition[]
): LocationDefinition | undefined {
  return locations.find((l) => l.isCrimeScene);
}

/**
 * フィールドロケーション（手持ち以外）を取得
 */
export function getFieldLocations(
  locations: LocationDefinition[]
): LocationDefinition[] {
  return locations.filter((l) => l.id !== HAND_LOCATION_ID);
}
