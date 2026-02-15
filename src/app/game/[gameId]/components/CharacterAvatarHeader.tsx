"use client";

/**
 * Character Avatar Header
 * キャラクターアバターヘッダー（画面上部）
 */

import { useState, useCallback, memo } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Users,
  Volume2,
  VolumeX,
  PanelLeft,
  PanelRight,
  Crown,
  Lock,
  MessageCircle,
} from "lucide-react";
import type { GameState, Scenario, CharacterDefinition } from "@/core/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components";
import { CharacterInfoPopover } from "./CharacterInfoPopover";

interface CharacterAvatarHeaderProps {
  game: GameState;
  scenario: Scenario;
  currentUserId: string;
  onLeftSidebarToggle: () => void;
  onRightSidebarToggle: () => void;
  isBgmPlaying: boolean;
  onBgmToggle: () => void;
  /** 現在発話中のプレイヤーID（TTSやAI思考中） */
  speakingPlayerId?: string | null;
  /** AI思考中のプレイヤーID */
  thinkingPlayerId?: string | null;
}

export const CharacterAvatarHeader = memo(function CharacterAvatarHeader({
  game,
  scenario,
  currentUserId,
  onLeftSidebarToggle,
  onRightSidebarToggle,
  isBgmPlaying,
  onBgmToggle,
  speakingPlayerId,
  thinkingPlayerId,
}: CharacterAvatarHeaderProps) {
  const players = Object.entries(game.players);

  // ポップオーバー状態管理
  const [selectedPlayer, setSelectedPlayer] = useState<{
    playerId: string;
    character: CharacterDefinition;
    isHuman: boolean;
    isOnline: boolean;
  } | null>(null);

  const handleAvatarClick = useCallback((
    playerId: string,
    character: CharacterDefinition | undefined,
    isHuman: boolean,
    isOnline: boolean
  ) => {
    if (!character) return;
    setSelectedPlayer({ playerId, character, isHuman, isOnline });
  }, []);

  const handleClosePopover = useCallback(() => {
    setSelectedPlayer(null);
  }, []);

  // フェーズ表示名
  const phaseLabels = {
    setup: "準備中",
    generation: "シナリオ生成中",
    lobby: "ロビー",
    prologue: "プロローグ",
    exploration_1: "探索フェーズ 1",
    discussion_1: "議論フェーズ 1",
    exploration_2: "探索フェーズ 2",
    discussion_2: "議論フェーズ 2",
    voting: "投票フェーズ",
    ending: "エンディング",
    ended: "終了",
  } as const;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-gradient-to-r from-ink-black via-ink-brown to-ink-black">
      {/* 左: サイドバー開閉 + フェーズ */}
      <div className="flex items-center gap-3">
        {/* 左サイドバー開閉（情報） */}
        <button
          onClick={onLeftSidebarToggle}
          className="flex items-center gap-2 rounded-lg border-2 border-gold-accent/30 bg-ink-brown/50 px-3 py-2 text-parchment-light/70 transition-all duration-300 hover:border-gold-accent hover:bg-gold-accent/20 hover:text-parchment-light hover:shadow-lg hover:shadow-gold-accent/20"
          aria-label="情報"
        >
          <BookOpen className="h-4 w-4" />
          <span className="text-xs font-title font-semibold">情報</span>
        </button>

        {/* フェーズ表示 */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blood-red/20 border-2 border-blood-red/40">
          <BookOpen className="h-5 w-5 text-gold-accent candle-glow" />
          <span className="text-sm font-title font-bold text-parchment-light">
            {phaseLabels[game.phase]}
          </span>
        </div>
      </div>

      {/* 中央: キャラクターアバター */}
      <div className="flex flex-1 items-center justify-center gap-2 overflow-x-auto">
        {players.map(([playerId, player]) => {
          const character = scenario.data.characters.find(
            (c) => c.id === player.characterId
          );
          const isCurrentUser = playerId === currentUserId;
          const isSpeaking = speakingPlayerId === playerId;
          const isThinking = thinkingPlayerId === playerId;

          return (
            <motion.div
              key={playerId}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-lg p-2 transition-all duration-300 cursor-pointer",
                isSpeaking && "ring-4 ring-gold-accent animate-pulse shadow-lg shadow-gold-accent/50",
                isThinking && "ring-4 ring-purple-400 animate-pulse shadow-lg shadow-purple-400/50",
                isCurrentUser && "bg-parchment-texture border border-gold-accent/50"
              )}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAvatarClick(playerId, character, player.isHuman, player.isOnline)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleAvatarClick(playerId, character, player.isHuman, player.isOnline);
                }
              }}
              aria-label={`${character?.name || "未選択"}の情報を表示`}
            >
              {/* アバター画像 */}
              <div
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 text-xl shadow-md transition-all duration-300 overflow-hidden",
                  isSpeaking
                    ? "border-gold-accent bg-gold-accent/30 shadow-lg shadow-gold-accent/50"
                    : isThinking
                    ? "border-purple-400 bg-purple-400/30 shadow-lg shadow-purple-400/50"
                    : "border-parchment-dark bg-ink-brown",
                  isCurrentUser && "ring-2 ring-gold-accent/50"
                )}
              >
                {isThinking ? (
                  <motion.span
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    💭
                  </motion.span>
                ) : character?.images?.base ? (
                  <img
                    src={character.images.base}
                    alt={character.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      // 画像読み込み失敗時はフォールバックアイコンに切り替え
                      const target = e.currentTarget;
                      target.style.display = "none";
                      const fallback = target.nextElementSibling;
                      if (fallback) fallback.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span className={cn(
                  "text-xl",
                  character?.images?.base ? "hidden" : ""
                )}>
                  {player.isHuman ? "👤" : "🤖"}
                </span>
              </div>

              {/* キャラクター名 */}
              <div className="flex flex-col items-center gap-0.5">
                <p className={cn(
                  "text-xs font-body font-semibold line-clamp-1",
                  isCurrentUser ? "text-ink-black" : "text-parchment-light"
                )}>
                  {character?.name || "未選択"}
                </p>
                {isCurrentUser && (
                  <Crown className="h-3 w-3 text-gold-accent candle-glow" />
                )}
              </div>

              {/* オンライン状態 */}
              <div
                className={cn(
                  "absolute top-1 right-1 h-2 w-2 rounded-full border border-ink-black shadow-sm",
                  player.isOnline ? "bg-emerald-accent" : "bg-gray-500"
                )}
              />
            </motion.div>
          );
        })}
      </div>

      {/* 右: BGM + 右サイドバー開閉 */}
      <div className="flex items-center gap-3">
        {/* BGM切り替え */}
        <button
          onClick={onBgmToggle}
          className={cn(
            "flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-all duration-300",
            isBgmPlaying
              ? "border-gold-accent bg-gold-accent/20 text-parchment-light shadow-lg shadow-gold-accent/20"
              : "border-gold-accent/30 bg-ink-brown/50 text-parchment-light/70 hover:border-gold-accent hover:bg-gold-accent/20 hover:text-parchment-light hover:shadow-lg hover:shadow-gold-accent/20"
          )}
          aria-label="BGM"
        >
          {isBgmPlaying ? (
            <Volume2 className="h-4 w-4 candle-glow" />
          ) : (
            <VolumeX className="h-4 w-4" />
          )}
          <span className="text-xs font-title font-semibold">BGM</span>
        </button>

        {/* 右サイドバー開閉（会話） */}
        <button
          onClick={onRightSidebarToggle}
          className="flex items-center gap-2 rounded-lg border-2 border-gold-accent/30 bg-ink-brown/50 px-3 py-2 text-parchment-light/70 transition-all duration-300 hover:border-gold-accent hover:bg-gold-accent/20 hover:text-parchment-light hover:shadow-lg hover:shadow-gold-accent/20"
          aria-label="会話"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs font-title font-semibold">会話</span>
        </button>
      </div>

      {/* キャラクター情報ポップオーバー */}
      {selectedPlayer && (
        <CharacterInfoPopover
          character={selectedPlayer.character}
          isOnline={selectedPlayer.isOnline}
          isHuman={selectedPlayer.isHuman}
          isCurrentUser={selectedPlayer.playerId === currentUserId}
          isOpen={true}
          onClose={handleClosePopover}
        />
      )}
    </div>
  );
});
