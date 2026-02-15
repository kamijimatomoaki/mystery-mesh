/**
 * Mock Game State Data for Development
 * 開発用モックゲームデータ
 */

import { Timestamp } from "firebase/firestore";
import type { GameState, GamePhase } from "../types";

/**
 * 動的に作成されたゲームを保存する配列
 */
const dynamicGames: GameState[] = [];

/**
 * Firestoreの Timestamp をモック用に生成
 */
const mockTimestamp = (minutesFromNow: number = 0): Timestamp => {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutesFromNow);
  return Timestamp.fromDate(date);
};

/**
 * モックゲーム一覧
 */
export const mockGames: GameState[] = [
  // 1. 探索フェーズ中のゲーム
  {
    id: "game_001",
    scenarioId: "scenario_crimson_mansion",
    hostId: "user_001",

    phase: "exploration_1",
    turnCount: 3,
    phaseDeadline: mockTimestamp(15), // 15分後に終了
    isPaused: false,

    // AI発言制御フラグ
    allowHumanInput: true,
    allowAITrigger: true,
    isAISpeaking: false,

    explorationState: {
      currentActiveActor: "user_001",
      actionQueue: ["user_001", "agent_bot_1", "user_002"],
      remainingAP: {
        user_001: 2,
        agent_bot_1: 3,
        user_002: 3,
      },
    },

    players: {
      user_001: {
        characterId: "char_butler",
        isHuman: true,
        displayName: "あなた",
        isReady: true,
        isOnline: true,
      },
      agent_bot_1: {
        characterId: "char_maid",
        isHuman: false,
        displayName: "AIエージェント: エミリー",
        isReady: true,
        isOnline: true,
      },
      user_002: {
        characterId: "char_cook",
        isHuman: true,
        displayName: "プレイヤー2",
        isReady: true,
        isOnline: true,
      },
    },

    cards: {
      card_wine: {
        location: "書斎",
        ownerId: null,
        isRevealed: false,
      },
      card_knife: {
        location: "Hand(user_001)",
        ownerId: "user_001",
        isRevealed: false,
      },
      card_letter: {
        location: "Hand(agent_bot_1)",
        ownerId: "agent_bot_1",
        isRevealed: false,
      },
    },

    humanShadowState: {
      user_001: {
        relationships: {
          agent_bot_1: {
            estimatedSuspicion: 35,
            reason: "メイドへの質問が少ない",
          },
          user_002: {
            estimatedSuspicion: 60,
            reason: "厨房に長時間いた",
          },
        },
      },
    },
  },

  // 2. 議論フェーズ中のゲーム
  {
    id: "game_002",
    scenarioId: "scenario_academy_secret",
    hostId: "user_003",

    phase: "discussion_1",
    turnCount: 8,
    phaseDeadline: mockTimestamp(10),
    isPaused: false,

    // AI発言制御フラグ
    allowHumanInput: true,
    allowAITrigger: true,
    isAISpeaking: false,

    players: {
      user_003: {
        characterId: "char_vice_president",
        isHuman: true,
        displayName: "探偵A",
        isReady: true,
        isOnline: true,
      },
      agent_bot_2: {
        characterId: "char_librarian",
        isHuman: false,
        displayName: "AIエージェント: 詩織",
        isReady: true,
        isOnline: true,
      },
    },

    cards: {
      card_railing: {
        location: "図書館3階",
        ownerId: null,
        isRevealed: true,
      },
      card_document: {
        location: "Hand(user_003)",
        ownerId: "user_003",
        isRevealed: false,
      },
    },

    humanShadowState: {
      user_003: {
        relationships: {
          agent_bot_2: {
            estimatedSuspicion: 20,
            reason: "積極的に情報を共有している",
          },
        },
      },
    },
  },

  // 3. 投票フェーズのゲーム
  {
    id: "game_003",
    scenarioId: "scenario_colony_murder",
    hostId: "user_004",

    phase: "voting",
    turnCount: 15,
    phaseDeadline: mockTimestamp(5),
    isPaused: false,

    // AI発言制御フラグ（votingでは両方無効）
    allowHumanInput: false,
    allowAITrigger: false,
    isAISpeaking: false,

    players: {
      user_004: {
        characterId: "char_engineer",
        isHuman: true,
        displayName: "サラ役",
        isReady: true,
        isOnline: true,
      },
      agent_bot_3: {
        characterId: "char_doctor",
        isHuman: false,
        displayName: "AIエージェント: リアム",
        isReady: true,
        isOnline: true,
      },
    },

    cards: {
      card_oxygen_log: {
        location: "メンテナンスルーム",
        ownerId: null,
        isRevealed: true,
      },
      card_research_data: {
        location: "Hand(user_004)",
        ownerId: "user_004",
        isRevealed: true,
      },
    },

    humanShadowState: {
      user_004: {
        relationships: {
          agent_bot_3: {
            estimatedSuspicion: 80,
            reason: "証拠から犯人と推測",
          },
        },
      },
    },
  },

  // 4. エンディング済みのゲーム
  {
    id: "game_004",
    scenarioId: "scenario_crimson_mansion",
    hostId: "user_005",

    phase: "ended",
    turnCount: 20,
    phaseDeadline: null,
    isPaused: false,

    // AI発言制御フラグ（endedでは両方無効）
    allowHumanInput: false,
    allowAITrigger: false,
    isAISpeaking: false,

    players: {
      user_005: {
        characterId: "char_butler",
        isHuman: true,
        displayName: "名探偵X",
        isReady: true,
        isOnline: false,
      },
      agent_bot_4: {
        characterId: "char_maid",
        isHuman: false,
        displayName: "AIエージェント: エミリー",
        isReady: true,
        isOnline: true,
      },
    },

    cards: {
      card_wine: {
        location: "Hand(user_005)",
        ownerId: "user_005",
        isRevealed: true,
      },
    },

    endingData: {
      resultText: `真相は明らかになった。

執事セバスチャンが犯人であった。
動機は20年前、主人によって陥れられた父の復讐。

遅効性の毒を仕込むという巧妙なトリックで、自らが発見者となることでアリバイを偽装していた。

全ての真実が白日の下に晒された今、この館に平穏が戻ることを願う。`,
      movieUrl: null,
      mvpAgentId: "agent_bot_4",
      votes: {
        user_005: "char_butler", // 正解
        agent_bot_4: "char_cook", // 不正解
      },
    },

    humanShadowState: {
      user_005: {
        relationships: {
          agent_bot_4: {
            estimatedSuspicion: 15,
            reason: "最後まで積極的に協力",
          },
        },
      },
    },
  },

  // 5. テスト用: 参加可能なロビー状態のゲーム（キャラクター選択可能）
  {
    id: "game_005",
    scenarioId: "scenario_crimson_mansion",
    hostId: "user_test_host",

    phase: "lobby",
    turnCount: 0,
    phaseDeadline: null,
    isPaused: false,

    // AI発言制御フラグ（lobbyでは両方無効）
    allowHumanInput: false,
    allowAITrigger: false,
    isAISpeaking: false,

    players: {
      user_test_host: {
        characterId: "char_butler", // ホストは既に選択済み
        isHuman: true,
        displayName: "ホストプレイヤー",
        isReady: true,
        isOnline: true,
      },
      user_001: {
        characterId: "", // 未選択
        isHuman: true,
        displayName: "あなた",
        isReady: false,
        isOnline: true,
      },
      agent_bot_test_1: {
        characterId: "", // AIはまだ未選択（ゲーム開始時に割り当て）
        isHuman: false,
        displayName: "AIプレイヤー 1",
        isReady: true,
        isOnline: true,
      },
      // char_maid と char_cook が選択可能
    },

    cards: {
      card_wine_glass: {
        location: "study",
        ownerId: null,
        isRevealed: true,
      },
      card_bloody_knife: {
        location: "study",
        ownerId: null,
        isRevealed: false,
      },
      card_letter: {
        location: "hallway",
        ownerId: null,
        isRevealed: true,
      },
      card_key: {
        location: "dining",
        ownerId: null,
        isRevealed: false,
      },
      card_poison_bottle: {
        location: "library",
        ownerId: null,
        isRevealed: true,
      },
      card_diary: {
        location: "bedroom",
        ownerId: null,
        isRevealed: false,
      },
      card_receipt: {
        location: "bedroom",
        ownerId: null,
        isRevealed: true,
      },
      card_gloves: {
        location: "kitchen",
        ownerId: null,
        isRevealed: false,
      },
      card_footprint: {
        location: "garden",
        ownerId: null,
        isRevealed: true,
      },
      card_tire_mark: {
        location: "garage",
        ownerId: null,
        isRevealed: false,
      },
    },

    humanShadowState: {},
  },

  // 6. E2Eテスト用: game_test_123
  {
    id: "game_test_123",
    scenarioId: "scenario_academy_secret",
    hostId: "user_001",

    phase: "prologue",
    turnCount: 1,
    phaseDeadline: mockTimestamp(20), // 20分後
    isPaused: false,

    // AI発言制御フラグ（prologueではハンドアウト確認中のため両方無効）
    allowHumanInput: false,
    allowAITrigger: false,
    isAISpeaking: false,

    players: {
      user_001: {
        characterId: "char_vice_president",
        isHuman: true,
        displayName: "あなた",
        isReady: true,
        isOnline: true,
      },
      agent_bot_test_1: {
        characterId: "char_librarian",
        isHuman: false,
        displayName: "AIエージェント: 詩織",
        isReady: true,
        isOnline: true,
      },
      agent_bot_test_2: {
        characterId: "char_student_a",
        isHuman: false,
        displayName: "AIエージェント: 拓海",
        isReady: true,
        isOnline: true,
      },
      agent_bot_test_3: {
        characterId: "char_student_b",
        isHuman: false,
        displayName: "AIエージェント: 美咲",
        isReady: true,
        isOnline: true,
      },
    },

    cards: {
      card_railing: {
        location: "図書館3階",
        ownerId: null,
        isRevealed: false,
      },
      card_document: {
        location: "生徒会室",
        ownerId: null,
        isRevealed: false,
      },
    },

    humanShadowState: {
      user_001: {
        relationships: {},
      },
    },
  },
];

/**
 * IDでゲームを取得
 */
export function getGameById(id: string): GameState | undefined {
  // 静的モックから検索
  const staticGame = mockGames.find((g) => g.id === id);
  if (staticGame) return staticGame;

  // 動的に作成されたゲームから検索
  return dynamicGames.find((g) => g.id === id);
}

/**
 * 新しいゲームを作成
 */
export function createMockGame(params: {
  gameId: string;
  scenarioId: string;
  hostId: string;
  aiPlayerCount: number;
  availableCharacters: Array<{ id: string; name: string }>;
}): GameState {
  const { gameId, scenarioId, hostId, aiPlayerCount, availableCharacters } = params;

  const players: GameState["players"] = {
    // ホストプレイヤーを追加（キャラクターはsetup画面で選択）
    [hostId]: {
      characterId: "", // まだ選択されていない
      isHuman: true,
      displayName: "あなた",
      isReady: false,
      isOnline: true,
    },
  };

  // AIプレイヤーを自動生成（キャラクターはまだ割り当てない）
  for (let i = 0; i < aiPlayerCount; i++) {
    const aiId = `agent_bot_${Date.now()}_${i}`;

    players[aiId] = {
      characterId: "", // ゲーム開始時に割り当て
      isHuman: false,
      displayName: `AIプレイヤー ${i + 1}`,
      isReady: true, // AIは常に準備完了
      isOnline: true,
    };
  }

  const newGame: GameState = {
    id: gameId,
    scenarioId,
    hostId,
    phase: "setup",
    turnCount: 0,
    phaseDeadline: null,
    isPaused: false,
    // AI発言制御フラグ（setupでは両方無効）
    allowHumanInput: false,
    allowAITrigger: false,
    isAISpeaking: false,
    players,
    cards: {},
    humanShadowState: {},
  };

  // 動的ゲーム配列に追加
  dynamicGames.push(newGame);

  return newGame;
}

/**
 * ゲームにプレイヤーのキャラクター選択を反映
 * @returns エラーメッセージ（成功時はnull）
 */
export function setPlayerCharacter(
  gameId: string,
  playerId: string,
  characterId: string
): string | null {
  const game = getGameById(gameId);
  if (!game) {
    return "ゲームが見つかりません";
  }

  if (!game.players[playerId]) {
    return "プレイヤーが見つかりません";
  }

  // 他のプレイヤーが既に選択していないかチェック
  const isCharacterTaken = Object.entries(game.players).some(
    ([pid, player]) =>
      pid !== playerId && player.characterId === characterId
  );

  if (isCharacterTaken) {
    return "このキャラクターは既に他のプレイヤーが選択しています";
  }

  // キャラクター選択を反映
  game.players[playerId].characterId = characterId;
  game.players[playerId].isReady = true;

  return null; // 成功
}

/**
 * プレイヤーの準備完了状態を切り替え
 */
export function togglePlayerReady(
  gameId: string,
  playerId: string
): boolean | null {
  const game = getGameById(gameId);
  if (!game) return null;

  if (!game.players[playerId]) return null;

  // 準備完了状態を反転
  game.players[playerId].isReady = !game.players[playerId].isReady;

  return game.players[playerId].isReady;
}

/**
 * ゲーム開始時にAIプレイヤーに空いているキャラクターを自動割り当て
 */
export function assignCharactersToAI(
  gameId: string,
  availableCharacters: Array<{ id: string; name: string }>
): void {
  const game = getGameById(gameId);
  if (!game) return;

  // 既に選ばれているキャラクターIDを取得
  const takenCharacterIds = Object.values(game.players)
    .map((p) => p.characterId)
    .filter((id) => id !== "");

  // 空いているキャラクターを抽出
  const availableChars = availableCharacters.filter(
    (char) => !takenCharacterIds.includes(char.id)
  );

  // AIプレイヤーにランダムで割り当て
  const aiPlayers = Object.entries(game.players).filter(
    ([_, p]) => !p.isHuman && p.characterId === ""
  );

  aiPlayers.forEach(([aiId, aiPlayer], index) => {
    if (index < availableChars.length) {
      const character = availableChars[index];
      aiPlayer.characterId = character.id;
      aiPlayer.displayName = `AIエージェント: ${character.name}`;
    }
  });
}

/**
 * プレイヤーが参加中のゲームを取得
 */
export function getGamesByPlayerId(playerId: string): GameState[] {
  return mockGames.filter((g) => playerId in g.players);
}

/**
 * フェーズでフィルタリング
 */
export function getGamesByPhase(phase: GamePhase): GameState[] {
  return mockGames.filter((g) => g.phase === phase);
}

/**
 * 進行中のゲームのみ取得
 */
export function getActiveGames(): GameState[] {
  return mockGames.filter((g) => g.phase !== "ended");
}

/**
 * 終了済みのゲームのみ取得
 */
export function getEndedGames(): GameState[] {
  return mockGames.filter((g) => g.phase === "ended");
}
