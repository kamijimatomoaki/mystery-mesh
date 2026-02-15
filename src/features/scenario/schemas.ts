/**
 * Scenario Generation用のZodスキーマ
 * AI生成結果のバリデーションに使用
 */

import { z } from "zod";

/**
 * Master Timeline Event
 */
export const MasterTimelineEventSchema = z.object({
  time: z.string(), // "10:00"
  event: z.string(),
  isTrue: z.boolean(),
  relatedCharacterId: z.string().nullish(), // nullまたはundefinedを許可
  /**
   * イベントの可視性
   * - "public": 全員が見れる（目撃情報、公共の場での出来事）
   * - "private": relatedCharacterId のキャラのみ見れる
   */
  visibility: z.enum(["public", "private"]).default("public"),
  /** イベントが発生した場所（例: "書斎", "キッチン", "庭"） */
  location: z.string().optional()
});

/**
 * Master Timeline（真相）
 */
export const MasterTimelineSchema = z.object({
  culpritId: z.string(),
  /** 被害者のキャラクターID（プレイアブルキャラクターから除外される） */
  victimId: z.string().optional(),
  trickExplanation: z.string(),
  masterTimeline: z.array(MasterTimelineEventSchema),
  intro: z.string(), // 導入ストーリー
  /**
   * 背景画像生成用プロンプト（AIが生成）
   * シナリオの雰囲気に合わせた詳細な場面描写
   */
  backgroundImagePrompt: z.string().optional()
});

export type MasterTimeline = z.infer<typeof MasterTimelineSchema>;
export type MasterTimelineEvent = z.infer<typeof MasterTimelineEventSchema>;

/**
 * Card Definition
 */
export const CardDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["evidence", "information", "item"]),
  slotType: z.enum(["motive", "item", "action", "secret"]),
  relatedCharacterId: z.string().nullish(), // nullまたはundefinedを許可
  location: z.string(),
  backImageUrl: z.string(),
  secret: z.object({
    title: z.string(),
    description: z.string(),
    trueImageUrl: z.string(),
    importanceLevel: z.number().min(1).max(5),
    misleadNote: z.string().optional()
  })
});

export type CardDefinition = z.infer<typeof CardDefinitionSchema>;

/**
 * Character Definition
 */
export const CharacterDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  job: z.string(),
  gender: z.enum(["male", "female"]),
  age: z.number(),
  personality: z.string(),
  description: z.string().optional(),
  secretInfo: z.string().optional(),
  images: z.object({
    base: z.string(),
    angry: z.string().optional(),
    sad: z.string().optional(),
    nervous: z.string().optional()
  }),
  handout: z.object({
    publicInfo: z.string(),
    secretGoal: z.string(),
    timeline: z.array(z.string())
  })
});

export type CharacterDefinition = z.infer<typeof CharacterDefinitionSchema>;

/**
 * Complete Scenario Schema（完全なシナリオ）
 */
export const CompleteScenarioSchema = z.object({
  meta: z.object({
    title: z.string(),
    description: z.string(),
    genre: z.string(),
    difficulty: z.enum(["easy", "normal", "hard"]),
    playTimeMin: z.number(),
    artStyle: z.enum(["anime", "oil_painting", "realistic", "sketch"])
  }),
  data: z.object({
    introText: z.string(),
    truth: z.object({
      culpritId: z.string(),
      trickExplanation: z.string(),
      masterTimeline: z.array(MasterTimelineEventSchema)
    }),
    characters: z.array(CharacterDefinitionSchema),
    cards: z.array(CardDefinitionSchema)
  })
});

export type CompleteScenario = z.infer<typeof CompleteScenarioSchema>;
