/**
 * キャラクター人格定義
 * Character Persona Definitions
 */

import { adminDb } from "@/core/db/firestore-admin";
import { getScenarioById } from "@/core/mock/scenarios";
import type { CharacterDefinition, Scenario } from "@/core/types";
import type { CharacterPersona } from "../types";
import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("CharacterPersona");

/**
 * キャラクター人格を取得
 * Firestoreから動的生成されたシナリオを優先し、モックシナリオをフォールバックとして使用
 *
 * @param characterId - キャラクターID
 * @param scenarioId - シナリオID
 * @returns キャラクター人格定義
 */
export async function getCharacterPersona(
  characterId: string,
  scenarioId: string
): Promise<CharacterPersona> {
  logger.debug("Getting character persona", { characterId, scenarioId });

  // 1. Firestoreからシナリオを取得（動的生成されたシナリオ）
  try {
    const scenarioDoc = await adminDb.collection("scenarios").doc(scenarioId).get();

    if (scenarioDoc.exists) {
      const scenario = scenarioDoc.data() as Scenario;
      const character = scenario.data.characters.find((c) => c.id === characterId);

      if (character) {
        logger.info("Found character in Firestore scenario", {
          characterId,
          characterName: character.name,
          scenarioId,
        });
        return buildPersonaFromCharacter(character, scenario.data.truth.culpritId);
      } else {
        logger.warn("Character not found in Firestore scenario", {
          characterId,
          scenarioId,
          availableCharacters: scenario.data.characters.map((c) => c.id),
        });
      }
    } else {
      logger.debug("Scenario not found in Firestore, trying mock", { scenarioId });
    }
  } catch (error) {
    logger.error("Failed to fetch scenario from Firestore", error as Error, { scenarioId });
  }

  // 2. フォールバック: モックシナリオ
  const mockScenario = getScenarioById(scenarioId);
  if (mockScenario) {
    const character = mockScenario.data.characters.find((c) => c.id === characterId);
    if (character) {
      logger.info("Found character in mock scenario", {
        characterId,
        characterName: character.name,
        scenarioId,
      });
      return buildPersonaFromCharacter(character, mockScenario.data.truth.culpritId);
    }
  }

  // 3. 最終フォールバック: デフォルトペルソナ
  logger.warn("Using default persona for unknown character", { characterId, scenarioId });
  return getDefaultPersona(characterId);
}

/**
 * キャラクターデータからペルソナを構築
 *
 * @param character - キャラクターデータ
 * @param culpritId - 真犯人のID
 * @returns ペルソナ定義
 */
function buildPersonaFromCharacter(character: CharacterDefinition, culpritId: string): CharacterPersona {
  const isCulprit = character.id === culpritId;

  // 話し方の特徴: LLM生成のspeakingStyleを優先、なければルールベースでフォールバック
  const speakingStyle = character.speakingStyle || inferSpeakingStyle(character);

  // 背景ストーリー
  const backstory = character.description || character.handout.publicInfo;

  // 勝利条件
  const winCondition = isCulprit
    ? "自分が犯人であることを隠し通し、他の人に罪を着せる"
    : "真犯人を見つけ、証拠を揃えて告発する";

  return {
    id: character.id,
    name: character.name,
    personality: character.personality,
    secretGoal: character.handout.secretGoal,
    winCondition,
    speakingStyle,
    backstory,
    // キャラクター固有の行動記憶（AIの個別化に重要）
    timeline: character.handout.timeline,
    // H3: isCulpritはペルソナに含めない（winConditionで十分な情報を提供）
  };
}

/**
 * 話し方のフォールバック
 * LLM生成の speakingStyle がない既存シナリオ用のデフォルト値
 */
function inferSpeakingStyle(_character: CharacterDefinition): string {
  return "キャラクターの性格・年齢・職業に合った自然な口調で話してください。";
}

/**
 * デフォルトペルソナを取得（フォールバック）
 *
 * @param characterId - キャラクターID
 * @returns デフォルトペルソナ
 */
function getDefaultPersona(characterId: string): CharacterPersona {
  // 基本的なモックペルソナ
  const defaultPersonas: Record<string, CharacterPersona> = {
    char_butler: {
      id: "char_butler",
      name: "執事",
      personality: "冷静沈着で礼儀正しい。完璧主義。",
      secretGoal: "主人の名誉を守ること",
      winCondition: "真犯人を見つけるか、主人への疑いを晴らす",
      speakingStyle: "丁寧で礼儀正しく、敬語を使う。「〜でございます」",
      backstory: "30年間この館に仕えてきた忠実な執事。",
    },
    char_maid: {
      id: "char_maid",
      name: "メイド",
      personality: "明るく活発だが、実は計算高い。",
      secretGoal: "借金を返済するための金を手に入れる",
      winCondition: "真犯人を見つけるか、自分への疑いを逸らす",
      speakingStyle: "柔らかく親しみやすい口調。「〜ですわ」",
      backstory: "この館で働き始めて5年。明るい性格で人気がある。",
    },
    char_cook: {
      id: "char_cook",
      name: "料理長",
      personality: "気性が荒いが、情に厚い。",
      secretGoal: "息子の学費を稼ぎ続けること",
      winCondition: "真犯人を見つける",
      speakingStyle: "率直で気さくな口調。「〜だよ」",
      backstory: "15年勤める熟練の料理長。料理の腕は確か。",
    },
  };

  return (
    defaultPersonas[characterId] || {
      id: characterId,
      name: "不明",
      personality: "普通の人",
      secretGoal: "生き延びる",
      winCondition: "真犯人を見つける",
      speakingStyle: "標準的な丁寧語。「〜です」「〜ます」",
      backstory: "この事件に巻き込まれた人物。",
    }
  );
}

/**
 * 全キャラクターのペルソナを一括取得
 * Firestoreから動的生成されたシナリオを優先
 *
 * @param scenarioId - シナリオID
 * @returns 全キャラクターのペルソナマップ
 */
export async function getAllPersonas(
  scenarioId: string
): Promise<Record<string, CharacterPersona>> {
  logger.debug("Getting all personas", { scenarioId });

  // 1. Firestoreからシナリオを取得
  try {
    const scenarioDoc = await adminDb.collection("scenarios").doc(scenarioId).get();

    if (scenarioDoc.exists) {
      const scenario = scenarioDoc.data() as Scenario;
      const personas: Record<string, CharacterPersona> = {};

      for (const character of scenario.data.characters) {
        personas[character.id] = buildPersonaFromCharacter(
          character,
          scenario.data.truth.culpritId
        );
      }

      logger.info("Loaded all personas from Firestore", {
        scenarioId,
        characterCount: Object.keys(personas).length,
      });
      return personas;
    }
  } catch (error) {
    logger.error("Failed to fetch scenario from Firestore", error as Error, { scenarioId });
  }

  // 2. フォールバック: モックシナリオ
  const mockScenario = getScenarioById(scenarioId);

  if (!mockScenario) {
    logger.warn("No scenario found", { scenarioId });
    return {};
  }

  const personas: Record<string, CharacterPersona> = {};

  for (const character of mockScenario.data.characters) {
    personas[character.id] = buildPersonaFromCharacter(
      character,
      mockScenario.data.truth.culpritId
    );
  }

  logger.info("Loaded all personas from mock scenario", {
    scenarioId,
    characterCount: Object.keys(personas).length,
  });
  return personas;
}
