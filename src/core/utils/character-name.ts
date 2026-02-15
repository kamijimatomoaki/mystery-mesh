/**
 * キャラクター名解決ユーティリティ
 * プレイヤーIDからキャラクター名を取得する
 */

import { adminDb } from "@/core/db/firestore-admin";
import type { GameState } from "@/core/types";

/**
 * プレイヤーIDからキャラクター名を解決する
 *
 * @param gameId - ゲームID
 * @param playerId - プレイヤーID
 * @param gameState - 既に取得済みのGameState（省略時はFirestoreから取得）
 * @returns キャラクター名（解決できない場合はcharacterIdまたはplayerId）
 */
export async function resolveCharacterName(
  gameId: string,
  playerId: string,
  gameState?: GameState
): Promise<string> {
  // GameStateを取得
  const game = gameState || await fetchGameState(gameId);
  if (!game) return playerId;

  const player = game.players[playerId];
  if (!player?.characterId) return player?.displayName || playerId;

  // シナリオからキャラクター名を検索（シナリオがゲーム内に埋め込まれている場合）
  // まずagentBrainsから取得を試みる（AIプレイヤー）
  if (!player.isHuman) {
    const agentId = `agent_${playerId}`;
    try {
      const brainDoc = await adminDb
        .collection("games")
        .doc(gameId)
        .collection("agentBrains")
        .doc(agentId)
        .get();

      if (brainDoc.exists) {
        const brain = brainDoc.data();
        if (brain?.characterName) return brain.characterName;
      }
    } catch {
      // フォールバック
    }
  }

  // characterIdをそのまま返す（呼び出し元でシナリオから解決可能）
  return player.characterId;
}

/**
 * シナリオデータからcharacterIdでキャラクター名を解決する（同期版）
 * クライアント・サーバー両方で使える軽量版
 */
export function resolveCharacterNameFromScenario(
  characterId: string,
  characters: Array<{ id: string; name: string }>
): string {
  const character = characters.find((c) => c.id === characterId);
  return character?.name || characterId;
}

async function fetchGameState(gameId: string): Promise<GameState | null> {
  const gameDoc = await adminDb.collection("games").doc(gameId).get();
  return gameDoc.exists ? (gameDoc.data() as GameState) : null;
}
