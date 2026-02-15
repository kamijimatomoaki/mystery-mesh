/**
 * POST /api/game/[gameId]/start
 * ゲームを開始（AIプレイヤーにキャラクターを自動割り当て + AgentBrain初期化）
 */

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/core/db/firestore-admin";
import { Timestamp } from "firebase-admin/firestore";
import { validateRequest } from "@/core/validation/helpers";
import { z } from "zod";
import { withErrorHandler, NotFoundError, ValidationError } from "@/core/utils/errors";
import { createModuleLogger } from "@/core/utils/logger";
import type { GameState, Scenario } from "@/core/types";
import { PHASE_DURATIONS } from "@/features/gm/types";
import { incrementPlayCount } from "@/features/scenario/logic/publish";

const logger = createModuleLogger("StartGame");

type RouteContext = {
  params: Promise<{ gameId: string }>;
};

const StartGameSchema = z.object({
  hostId: z.string().min(1),
});

/**
 * ゲームを開始
 */
export const POST = withErrorHandler(async (
  request: NextRequest,
  context: RouteContext
) => {
  const { gameId } = await context.params;
  const body = await request.json();
  const validated = validateRequest(body, StartGameSchema);

  logger.info("Starting game", { gameId, hostId: validated.hostId });

  // Firestoreからゲームを取得
  const gameRef = adminDb.collection("games").doc(gameId);
  const gameDoc = await gameRef.get();

  if (!gameDoc.exists) {
    throw new NotFoundError("Game", gameId);
  }

  const game = gameDoc.data() as GameState;

  // ホストのみがゲームを開始できる
  if (game.hostId !== validated.hostId) {
    throw new ValidationError("ホストのみがゲームを開始できます");
  }

  // シナリオを取得
  const scenarioDoc = await adminDb.collection("scenarios").doc(game.scenarioId).get();
  if (!scenarioDoc.exists) {
    throw new NotFoundError("Scenario", game.scenarioId);
  }
  const scenario = scenarioDoc.data() as Scenario;

  // 既に選ばれているキャラクターIDを取得
  const takenCharacterIds = Object.values(game.players)
    .map((p) => p.characterId)
    .filter((id) => id !== "");

  // 被害者のIDを取得（プレイアブルキャラクターから除外する）
  const victimId = scenario.data.truth.victimId || "char_victim";
  logger.info("Victim ID (excluded from playable)", { victimId });

  // 空いているキャラクターを抽出（被害者を除外）
  const availableChars = scenario.data.characters.filter(
    (char) => !takenCharacterIds.includes(char.id) && char.id !== victimId
  );

  // AIプレイヤーにキャラクターを自動割り当て
  const updates: Record<string, unknown> = {};
  let charIndex = 0;
  const aiAssignments: { playerId: string; characterId: string }[] = [];

  for (const [playerId, player] of Object.entries(game.players)) {
    if (!player.isHuman && player.characterId === "") {
      if (charIndex < availableChars.length) {
        const character = availableChars[charIndex];
        updates[`players.${playerId}.characterId`] = character.id;
        updates[`players.${playerId}.displayName`] = `AIエージェント: ${character.name}`;
        // AIプレイヤーはプロローグを自動で確認済みにする
        updates[`players.${playerId}.isPrologueReady`] = true;
        aiAssignments.push({ playerId, characterId: character.id });
        charIndex++;
      }
    } else if (!player.isHuman) {
      // 既にキャラクターが割り当てられているAIもisPrologueReadyをtrueに
      updates[`players.${playerId}.isPrologueReady`] = true;
    }
  }

  // フェーズを「prologue」に変更
  updates["phase"] = "prologue";
  updates["turnCount"] = 1;
  updates["phaseDeadline"] = Timestamp.fromDate(new Date(Date.now() + PHASE_DURATIONS.prologue * 1000));

  await gameRef.update(updates);

  // AIエージェントのBrain（脳）を初期化
  const batch = adminDb.batch();
  const allPlayers = { ...game.players };

  // 新規割り当てされたAIのcharacterIdを反映
  for (const assignment of aiAssignments) {
    allPlayers[assignment.playerId] = {
      ...allPlayers[assignment.playerId],
      characterId: assignment.characterId,
    };
  }

  // 全キャラクターのIDリストを取得（関係性マトリクス用）
  const allCharacterIds = scenario.data.characters.map((c) => c.id);

  for (const [playerId, player] of Object.entries(allPlayers)) {
    if (!player.isHuman && player.characterId) {
      // agentIdはphases.ts/thinking.tsと同じ命名規則を使用
      const agentId = `agent_${playerId}`;
      const agentBrainRef = adminDb
        .collection("games")
        .doc(gameId)
        .collection("agentBrains")
        .doc(agentId);

      // キャラクター情報を取得
      const character = scenario.data.characters.find((c) => c.id === player.characterId);
      const isCulprit = player.characterId === scenario.data.truth.culpritId;

      // 初期AgentBrain作成
      const initialRelationships: Record<string, { trust: number; suspicion: number; note: string }> = {};
      for (const charId of allCharacterIds) {
        if (charId !== player.characterId) {
          initialRelationships[charId] = {
            trust: 50,
            suspicion: 30,
            note: "",
          };
        }
      }

      // AgentBrainデータ（キャラクター固有情報を含む）
      const agentBrainData = {
        characterId: player.characterId,
        characterName: character?.name || "不明",
        emotionalState: "calm" as const,
        relationships: initialRelationships,
        knowledgeBase: {
          cards: {},
          knownFacts: [],
        },
        // キャラクター固有の情報（AIの個別化に必要）
        secretGoal: character?.handout.secretGoal || "",
        timeline: character?.handout.timeline || [],
        isCulprit,
        lastThought: {
          content: "ゲームが開始された。状況を把握しなければ...",
          timestamp: Timestamp.now(), // Admin SDK Timestamp
        },
      };

      batch.set(agentBrainRef, agentBrainData);
      logger.info("Created agent brain", {
        gameId,
        agentId,
        characterId: player.characterId,
        characterName: character?.name,
        isCulprit,
      });
    }
  }

  await batch.commit();

  // Phase B-3: ハンドカード（type: "item"）をGameState.cardsに初期登録
  // 議論フェーズでの譲渡を可能にするため
  const cardUpdates: Record<string, unknown> = {};
  for (const card of scenario.data.cards || []) {
    if (card.location === "Hand" && card.relatedCharacterId) {
      // このカードに関連するキャラクターを持つプレイヤーを探す
      const ownerEntry = Object.entries(allPlayers).find(
        ([, p]) => p.characterId === card.relatedCharacterId
      );
      if (ownerEntry) {
        const [ownerId] = ownerEntry;
        const isItem = card.type === "item";
        cardUpdates[`cards.${card.id}`] = {
          location: `Hand(${ownerId})`,
          ownerId: ownerId,
          isRevealed: false,
          isTransferable: isItem, // type: "item" のカードのみ譲渡可能
        };

        // AI エージェントのknowledgeBaseにもカード情報を追加
        if (!ownerEntry[1].isHuman) {
          const agentId = `agent_${ownerId}`;
          const agentBrainRef = adminDb
            .collection("games")
            .doc(gameId)
            .collection("agentBrains")
            .doc(agentId);
          // バッチコミット後なのでupdateを使用
          try {
            await agentBrainRef.update({
              [`knowledgeBase.cards.${card.id}`]: {
                cardId: card.id,
                status: "known",
                holder: ownerId,
                location: `Hand(${ownerId})`,
                contentGuess: card.secret.description,
                cardName: card.secret.title || card.name,
                confidence: 100,
                lastUpdated: Timestamp.now(),
                source: "hand",
              },
            });
          } catch {
            // 個別更新失敗はログのみ
          }
        }
      }
    }
  }
  if (Object.keys(cardUpdates).length > 0) {
    await gameRef.update(cardUpdates);
    logger.info("Hand cards initialized in GameState", {
      gameId,
      cardCount: Object.keys(cardUpdates).length,
    });
  }

  logger.info("Game started", { gameId, assignedCharacters: charIndex, agentBrainsCreated: aiAssignments.length });

  // 公開シナリオの場合、プレイ数をインクリメント（fire-and-forget）
  if (scenario.isPublished) {
    incrementPlayCount(game.scenarioId).catch((err) => {
      logger.warn("Failed to increment play count (non-critical)", { scenarioId: game.scenarioId, error: String(err) });
    });
  }

  return NextResponse.json({
    success: true,
    gameId,
    phase: "prologue",
  });
}, "StartGame");
