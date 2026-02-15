/**
 * Common Zod Schemas
 * 型安全なバリデーションスキーマ
 *
 * 設計思想:
 * - API入力のバリデーション
 * - 型推論の活用
 * - 再利用可能なスキーマ
 * - カスタムバリデーションルール
 */

import { z } from "zod";

// ========================================
// 基本型
// ========================================

/**
 * IDスキーマ（共通）
 */
export const IdSchema = z.string().min(1, "ID is required");

/**
 * タイムスタンプスキーマ
 */
export const TimestampSchema = z.union([
  z.date(),
  z.object({
    toDate: z.function().returns(z.date()),
    toMillis: z.function().returns(z.number()),
  }),
]);

/**
 * ページネーションスキーマ
 */
export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().optional(),
});

// ========================================
// ユーザー関連
// ========================================

/**
 * ユーザーID
 */
export const UserIdSchema = IdSchema;

/**
 * ユーザー名
 */
export const UserNameSchema = z
  .string()
  .min(2, "名前は2文字以上である必要があります")
  .max(50, "名前は50文字以下である必要があります");

/**
 * メールアドレス
 */
export const EmailSchema = z
  .string()
  .email("有効なメールアドレスを入力してください");

// ========================================
// ゲーム関連
// ========================================

/**
 * ゲームID
 */
export const GameIdSchema = IdSchema;

/**
 * シナリオID
 */
export const ScenarioIdSchema = IdSchema;

/**
 * フェーズ
 */
export const GamePhaseSchema = z.enum([
  "setup",
  "generation",
  "lobby",
  "prologue",
  "exploration_1",
  "discussion_1",
  "exploration_2",
  "discussion_2",
  "voting",
  "ending",
  "ended",
]);

/**
 * 難易度
 */
export const DifficultySchema = z.enum(["easy", "normal", "hard"]);

/**
 * アートスタイル
 */
export const ArtStyleSchema = z.enum([
  "anime",
  "oil_painting",
  "realistic",
  "sketch",
]);

/**
 * ジャンル
 */
export const GenreSchema = z.enum([
  "Mansion",
  "Island",
  "Train",
  "Hotel",
  "School",
  "Custom",
]);

/**
 * 感情状態
 */
export const EmotionalStateSchema = z.enum([
  "calm",
  "angry",
  "nervous",
  "sad",
  "confident",
]);

// ========================================
// メッセージ関連
// ========================================

/**
 * チャットメッセージ
 */
export const ChatMessageSchema = z.object({
  id: IdSchema,
  senderId: UserIdSchema,
  senderName: UserNameSchema,
  content: z.string().min(1).max(1000),
  timestamp: TimestampSchema,
  isAI: z.boolean().default(false),
});

/**
 * アクションログ
 */
export const ActionLogSchema = z.object({
  id: IdSchema,
  actorId: UserIdSchema,
  characterId: IdSchema,
  type: z.enum(["join", "talk", "investigate", "vote", "move", "wait", "reveal", "secret_talk"]),
  targetId: IdSchema.optional(),
  location: z.string().optional(),
  content: z.string().optional(),
  phase: GamePhaseSchema,
  timestamp: TimestampSchema,
});

// ========================================
// シナリオ生成関連
// ========================================

/**
 * シナリオ生成リクエスト
 */
export const ScenarioGenerationRequestSchema = z.object({
  genre: GenreSchema,
  playerCount: z.number().int().min(3).max(8),
  difficulty: DifficultySchema,
  artStyle: ArtStyleSchema,
  userId: UserIdSchema,
  userName: UserNameSchema,
});

/**
 * タイムラインイベント
 */
export const TimelineEventSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, "時刻は HH:MM 形式である必要があります"),
  event: z.string().min(1),
  isTrue: z.boolean(),
  relatedCharacterId: IdSchema.optional(),
});

/**
 * マスタータイムライン
 */
export const MasterTimelineSchema = z.object({
  culpritId: IdSchema,
  trickExplanation: z.string().min(10),
  masterTimeline: z.array(TimelineEventSchema).min(5),
  intro: z.string().min(10),
});

// ========================================
// AI Agent関連
// ========================================

/**
 * エージェントアクション
 */
export const AgentActionSchema = z.object({
  type: z.enum(["talk", "investigate", "vote", "wait"]),
  content: z.string().optional(),
  targetCardId: IdSchema.optional(),
  targetCharacterId: IdSchema.optional(),
  location: z.string().optional(),
  emotion: EmotionalStateSchema.optional(),
});

/**
 * エージェント思考リクエスト
 */
export const AgentThinkRequestSchema = z.object({
  gameId: GameIdSchema,
  agentId: IdSchema,
  trigger: z.enum(["phase_change", "new_message", "timer_tick"]),
});

// ========================================
// カスタムバリデーション
// ========================================

/**
 * 日本語文字列（ひらがな、カタカナ、漢字を含む）
 */
export const JapaneseStringSchema = z
  .string()
  .regex(/^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBFぁ-んァ-ヶー一-龠\s]+$/, "日本語で入力してください");

/**
 * URL（httpまたはhttps）
 */
export const HttpUrlSchema = z
  .string()
  .url()
  .refine((url) => url.startsWith("http://") || url.startsWith("https://"), {
    message: "URLはhttpまたはhttpsで始まる必要があります",
  });

/**
 * 安全なHTML（XSS対策）
 */
export const SafeHtmlSchema = z
  .string()
  .refine(
    (html) => !/<script|javascript:|onerror=|onclick=/i.test(html),
    { message: "危険なHTMLタグが含まれています" }
  );

// ========================================
// 型推論ヘルパー
// ========================================

export type UserId = z.infer<typeof UserIdSchema>;
export type UserName = z.infer<typeof UserNameSchema>;
export type Email = z.infer<typeof EmailSchema>;
export type GameId = z.infer<typeof GameIdSchema>;
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;
export type GamePhase = z.infer<typeof GamePhaseSchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type ArtStyle = z.infer<typeof ArtStyleSchema>;
export type Genre = z.infer<typeof GenreSchema>;
export type EmotionalState = z.infer<typeof EmotionalStateSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ActionLog = z.infer<typeof ActionLogSchema>;
export type ScenarioGenerationRequest = z.infer<typeof ScenarioGenerationRequestSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type MasterTimeline = z.infer<typeof MasterTimelineSchema>;
export type AgentAction = z.infer<typeof AgentActionSchema>;
export type AgentThinkRequest = z.infer<typeof AgentThinkRequestSchema>;
