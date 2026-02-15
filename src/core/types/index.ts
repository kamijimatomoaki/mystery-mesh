import { Timestamp } from "firebase/firestore";

/**
 * MysteryMesh Domain Models (v4.0 Final)
 * "The Infinite Mystery Library" Edition
 */

// --- 1. Common Types ---

export type GamePhase =
  | "setup"           // 部屋作成・キャラ選択
  | "generation"      // シナリオ生成中（執筆中）
  | "lobby"           // 待機ロビー
  | "prologue"        // ハンドアウト確認（記憶の同調）
  | "exploration_1"   // 前半探索
  | "discussion_1"    // 前半議論
  | "exploration_2"   // 後半探索
  | "discussion_2"    // 後半議論（密談あり）
  | "voting"          // 投票（判決）
  | "ending"          // エンディング
  | "ended";          // ゲーム終了

export type Role = "culprit" | "innocent" | "detective";

export type ArtStyle = "anime" | "oil_painting" | "realistic" | "sketch";

export type EmotionalState = "calm" | "angry" | "nervous" | "sad" | "confident";

// --- 2. Scenario & Library (Static Data) ---

/**
 * 公開・アーカイブされたシナリオデータ
 * Firestore Path: `scenarios/{scenarioId}`
 */
export type ScenarioStatus = "generating" | "ready" | "published" | "error";

export interface Scenario {
  id: string;
  authorId: string;       // 生成者のUID
  authorName: string;     // 生成者の表示名
  isPublished: boolean;   // 図書館に公開するか
  status?: ScenarioStatus; // 生成ステータス（後方互換: undefinedの場合は"ready"扱い）
  jobId?: string;         // scenarioJobsとの紐付け
  createdAt: Timestamp;

  // メタデータ（検索・一覧表示用）
  meta: {
    title: string;        // "深紅の館の殺人"
    description: string;  // あらすじ
    genre: string;        // "Mansion", "SF", "School"
    difficulty: "easy" | "normal" | "hard";
    playTimeMin: number;  // 想定プレイ時間（分）
    artStyle: ArtStyle;

    // ソーシャル評価
    playCount: number;
    stars: number;        // いいね数
    tags: string[];       // ["泣ける", "高難易度", "初心者向け"]
  };

  // マスターデータ（ゲーム開始時にコピーされる原本）
  data: {
    introText: string;    // 導入ストーリー

    // 背景画像URL（動的生成またはデフォルト）
    backgroundImageUrl?: string;

    // プロローグナレーション音声URL（事前生成、生成失敗時はnull）
    prologueNarrationUrl?: string | null;

    // 真相（クライアントには絶対に直接送らない）
    truth: {
      culpritId: string;
      /** 被害者のキャラクターID（プレイアブルキャラクターから除外される） */
      victimId?: string;
      trickExplanation: string; // トリックの解説
      masterTimeline: MasterTimelineEvent[];
    };

    // ロケーション定義（マップ生成用）
    locations: LocationDefinition[];

    // キャラクター定義
    characters: CharacterDefinition[];

    // カード定義（スロット割り当て済み）
    cards: CardDefinition[];
  };
}

/**
 * ロケーション定義（マップ上の場所）
 * シナリオのジャンル・舞台に応じて動的に生成される
 */
export interface LocationDefinition {
  /** ロケーションID（英語、一意） */
  id: string;
  /** 表示名（日本語） */
  name: string;
  /** ロケーションタイプ */
  type: "room" | "outdoor" | "special";
  /** 説明文 */
  description?: string;
  /** 事件現場かどうか */
  isCrimeScene?: boolean;
  /** 重要度（1-5、カード配置の優先度に影響） */
  importance?: number;
  /** マップ上の座標（オプション、自動計算も可能） */
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface MasterTimelineEvent {
  time: string; // "10:00"
  event: string;
  isTrue: boolean; // 犯人の偽装工作ならfalse
  relatedCharacterId?: string | null; // nullまたはundefinedを許可

  /**
   * イベントの可視性
   * - "public": 全員が見れる（目撃情報、公共の場での出来事）
   * - "private": relatedCharacterId のキャラのみ見れる（犯人含め全員同じルール）
   */
  visibility?: "public" | "private";
}

/**
 * キャラクターの外見情報（画像生成用）
 * Geminiが生成した詳細な外見情報を保持
 */
export interface CharacterVisualDescription {
  /** 民族的特徴（Japanese, Western, etc.） */
  ethnicity: string;
  /** 髪型の詳細 */
  hairStyle: string;
  /** 髪の色 */
  hairColor: string;
  /** 体型（slim, average, athletic, etc.） */
  bodyType: string;
  /** 顔の特徴 */
  facialFeatures: string;
  /** 服装の詳細 */
  clothing: string;
  /** 目立つ特徴（メガネ、傷、ほくろなど） */
  distinguishingFeatures: string;
  /** 全体的な雰囲気・印象 */
  overallImpression: string;
}

/**
 * 目撃情報
 * 各キャラクターが他のキャラクターについて知っている情報
 */
export interface WitnessInfo {
  /** 目撃した時刻 */
  time: string;
  /** 目撃されたキャラクターのID */
  targetCharacterId: string;
  /** 目撃内容 */
  description: string;
}

export interface CharacterDefinition {
  id: string; // "char_butler"
  name: string;
  job: string;
  gender: "male" | "female";
  age: number;
  personality: string;
  /** LLM生成の話し方・口調（語尾、癖、言い回しなど） */
  speakingStyle?: string;
  description?: string; // キャラクターの詳細説明（ハンドアウト用）
  secretInfo?: string; // 秘密の情報（ハンドアウト用）
  /** 疑惑情報（キャラ選択時には非表示、ハンドアウトで公開） */
  suspiciousInfo?: string;

  // 画像生成用の外見情報（Geminiが生成）
  visualDescription?: CharacterVisualDescription;

  // 生成された画像アセット
  images: {
    base: string;      // 通常
    angry: string;     // 怒り
    sad: string;       // 悲しみ
    nervous: string;   // 焦り
  };

  // ハンドアウト（プレイヤー用）
  handout: {
    publicInfo: string;  // 公開プロフィール
    secretGoal: string;  // "実は借金がある"、"復讐したい"
    timeline: string[];  // 個別の行動記憶
    /** 他キャラクターの目撃情報（最低2つ） */
    witnessInfo?: WitnessInfo[];
  };
}

export interface CardDefinition {
  id: string; // "card_knife"
  name: string;
  type: "evidence" | "information" | "item";

  // どのスロットに属するか
  slotType: "motive" | "item" | "action" | "secret";
  relatedCharacterId?: string | null; // 誰に紐づくか（nullまたはundefinedを許可）

  // 公開情報
  location: string; // "Kitchen"
  backImageUrl: string; // 裏面の画像

  // 秘匿情報（Secrets）
  secret: {
    title: string;
    description: string;
    trueImageUrl: string;
    importanceLevel: number; // 1-5
    misleadNote?: string;    // AIへの嘘のヒント
  };
}

// --- 3. Game State (Dynamic Data) ---

/**
 * 進行中のゲーム状態（公開情報のみ）
 * Firestore Path: `games/{gameId}`
 */
export interface GameState {
  id: string;
  scenarioId: string;
  hostId: string;

  // 進行管理
  phase: GamePhase;
  turnCount: number;

  // タイマー管理 (Server Time基準)
  phaseDeadline: Timestamp | null; // フェーズ終了時刻
  isPaused: boolean;

  // 探索フェーズのアクション順管理
  explorationState?: {
    currentActiveActor: string | null; // "user_123" or "agent_bot"
    actionQueue: string[];             // 行動順 ["user_123", "agent_bot", ...]
    remainingAP: Record<string, number>; // 各プレイヤーの残りAP
    turnStartedAt?: Timestamp;         // 現在のターン開始時刻（停滞検知用）
  };

  // スピーチロック（TTS重複再生防止）
  speechLock?: {
    lockedUntil: number;        // ロック解除時刻（timestamp）
    speakingPlayerId: string;   // 現在発言中のプレイヤーID
  };

  // AI発言制御フラグ
  /** プレイヤーのチャット入力を許可するか */
  allowHumanInput: boolean;
  /** AI発言トリガーを許可するか */
  allowAITrigger: boolean;
  /** AI発言処理中フラグ */
  isAISpeaking: boolean;
  /** AI発言ロック取得時刻（ミリ秒）— タイムアウト判定用 */
  isAISpeakingLockedAt?: number | null;

  // 参加プレイヤー情報
  players: {
    [uid: string]: {
      characterId: string;
      isHuman: boolean;
      displayName: string;
      isReady: boolean;
      /** プロローグ確認完了フラグ */
      isPrologueReady?: boolean;
      isOnline: boolean;
    };
  };

  // カードの現状（メタデータのみ）
  cards: {
    [cardId: string]: {
      location: string;        // "Hand(UserA)" or "LivingRoom"
      ownerId: string | null;  // 誰が持っているか
      isRevealed: boolean;     // 公開されたか
      isTransferable?: boolean; // 譲渡可能かどうか（デフォルト: false、itemのみtrue）
    };
  };

  // 投票（投票フェーズ中の投票状況）
  votes?: {
    [voterId: string]: string; // { playerId: targetCharacterId }
  };

  // エンディング結果（フェーズがendedになるまでnull）
  endingData?: {
    resultText: string;      // 生成された結末テキスト
    movieUrl: string | null; // Veoで生成した動画URL
    mvpAgentId: string;      // 最も活躍したAI

    // 投票結果
    votes: Record<string, string>; // { voterId: targetId }
  };

  // 人間の推定思考ログ（Shadow State - エンディングで公開）
  humanShadowState: {
    [userId: string]: {
      // 誰をどう思っているかの推測値
      relationships: {
        [targetId: string]: {
          estimatedSuspicion: number; // 0-100
          reason: string;             // "執事への尋問が厳しいため"
        };
      };
    };
  };
}

// --- 4. Agent Brain (Private Data) ---

/**
 * AIエージェントの脳内（プレイヤーには不可視）
 * Firestore Path: `games/{gameId}/agents/{agentId}`
 */
export interface AgentBrain {
  characterId: string;
  characterName?: string;

  // 現在の感情
  emotionalState: EmotionalState;

  // 関係性マトリクス
  relationships: {
    [targetId: string]: {
      trust: number;     // 0-100
      suspicion: number; // 0-100
      note: string;      // "矛盾した発言あり"
    };
  };

  // 知識ベース (Mental Notebook)
  knowledgeBase: {
    cards: {
      [cardId: string]: {
        status: "unknown" | "seen_holder" | "known";
        holder: string | null;
        contentGuess: string | null; // 中身の推測
      };
    };
    // タイムラインの矛盾検知用メモリ
    knownFacts: string[];
  };

  // 直前の思考ログ（デバッグ・感想戦用）
  lastThought: {
    content: string;
    timestamp: Timestamp;
  };

  /** 前回発言したがっていたが機会がなかったフラグ */
  wantedToSpeak?: boolean;

  /** 前回の疑惑ランキング（疑惑値アンカリング用） */
  lastSuspicionRanking?: {
    characterId: string;
    characterName: string;
    suspicionLevel: number;
  }[];
}

// --- 5. Logs & History ---

/**
 * 行動ログ
 * Firestore Path: `games/{gameId}/logs/{logId}`
 */
export interface ActionLog {
  id: string;
  actorId: string; // プレイヤーID または エージェントID
  characterId: string;
  characterName?: string; // キャラクター名（表示用）
  type: "join" | "talk" | "move" | "investigate" | "reveal" | "vote" | "secret_talk" | "wait";

  // 詳細
  targetId?: string; // 対象カードIDや相手ID
  location?: string;
  content?: string;  // 発言内容

  // メタデータ
  phase: GamePhase;
  timestamp: Timestamp;
}

/**
 * チャットメッセージ
 * Firestore Path: `games/{gameId}/messages/{messageId}`
 */
export interface ChatMessage {
  id: string;
  senderId: string;        // プレイヤーID または エージェントID
  senderName: string;      // 表示名
  characterId: string;     // キャラクターID
  content: string;         // メッセージ内容
  timestamp: Timestamp;    // 送信時刻
}

/**
 * 思考ログ（AIのみ・感想戦用）
 * Firestore Path: `games/{gameId}/agents/{agentId}/thoughts/{thoughtId}`
 */
export interface ThinkingLog {
  id: string;
  timestamp: Timestamp;
  phase: GamePhase;
  trigger: string; // "user_Aの発言" など

  // 思考プロセス (CoT)
  thoughtProcess: string;
  decision: string; // "嘘をつくことにした"

  // 感情変化
  emotionBefore: EmotionalState;
  emotionAfter: EmotionalState;
}
