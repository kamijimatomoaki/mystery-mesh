/**
 * アプリケーション定数定義
 * "The Infinite Mystery Library" Edition
 */

// ゲーム設定
export const GAME_CONSTANTS = {
  // プレイヤー数
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 5,

  // AP（アクションポイント）
  EXPLORATION_1_AP: 3,
  EXPLORATION_2_AP: 2,

  // フェーズ時間制限（秒）
  PHASE_DURATION: {
    exploration_1: 5 * 60,     // 5分
    discussion_1: 30 * 60,     // 30分
    exploration_2: 5 * 60,     // 5分
    discussion_2: 45 * 60,     // 45分
    voting: 3 * 60,            // 3分
  },

  // カード設定
  CARDS_PER_CHARACTER: 4,
  BASE_FIELD_CARDS: 4, // 固定フィールドカード（遺体/死因/現場/凶器）
  FIELD_CARDS_PER_PLAYER: 3, // プレイヤーあたりの動的フィールドカード数
  UNREACHABLE_CARD_BUFFER: 3, // 取得不可能なカードの余剰枚数
} as const;

// UI設定
export const UI_CONSTANTS = {
  // アニメーション時間（ミリ秒）
  ANIMATION: {
    PAGE_FLIP: 600,
    FADE_IN: 500,
    CARD_REVEAL: 800,
  },

  // タイマー警告閾値（秒）
  TIMER_WARNING_THRESHOLD: 5 * 60, // 残り5分

  // デバッグモード
  DEBUG_MODE: process.env.NODE_ENV === "development",
} as const;

// Firestore コレクション名
export const COLLECTIONS = {
  SCENARIOS: "scenarios",
  GAMES: "games",
  USERS: "users",

  // サブコレクション
  SECRETS: "secrets",
  AGENTS: "agents",
  LOGS: "logs",
  THOUGHTS: "thoughts",
} as const;

// メッセージ定数（世界観に沿った表現）
export const MESSAGES = {
  LOADING: {
    SCENARIO_GENERATION: "物語を執筆中...",
    IMAGE_GENERATION: "挿絵を描画中...",
    VIDEO_GENERATION: "真相を再構成中...",
    CONNECTING: "図書館に接続中...",
  },
  ERROR: {
    NETWORK: "インクが薄れてしまいました。再度お試しください。",
    AUTH: "図書カードが見つかりません。",
    NOT_FOUND: "その本は図書館に存在しません。",
    PERMISSION_DENIED: "この書架へのアクセスは許可されていません。",
  },
  SUCCESS: {
    SCENARIO_CREATED: "新しい物語が製本されました。",
    GAME_STARTED: "物語が始まります...",
    VOTE_SUBMITTED: "判決を記録しました。",
  },
} as const;

// Vertex AI モデル設定（環境変数から取得）
export const AI_MODELS = {
  TEXT: process.env.VERTEX_MODEL_TEXT || "gemini-1.5-pro-002",
  IMAGE: process.env.VERTEX_MODEL_IMAGE || "imagen-3.0-generate-001",
  VIDEO: process.env.VERTEX_MODEL_VIDEO || "veo-001",
} as const;
