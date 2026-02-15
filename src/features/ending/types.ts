/**
 * Ending API Types
 * エンディング関連APIの共通型定義
 */

export interface RelationshipEdge {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  trust: number;
  suspicion: number;
  note: string;
}

export interface RelationshipNode {
  characterId: string;
  characterName: string;
  isHuman: boolean;
  emotionalState: string;
}

export interface EndingCard {
  id: string;
  name: string;
  type: "evidence" | "information" | "item";
  slotType: "motive" | "item" | "action" | "secret";
  location: string;
  relatedCharacterName: string | null;
  secret: {
    title: string;
    description: string;
    importanceLevel: number;
    misleadNote?: string;
  };
  wasObtained: boolean;
  obtainedBy: string | null;
  wasRevealed: boolean;
}
