"use client";

/**
 * Character Info Popover
 * キャラクター情報ポップオーバー（アバタークリックで表示）
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, User, Briefcase, Eye, EyeOff } from "lucide-react";
import type { CharacterDefinition } from "@/core/types";
import { Badge } from "@/components";
import { cn } from "@/lib/utils";

interface CharacterInfoPopoverProps {
  character: CharacterDefinition;
  isOnline: boolean;
  isHuman: boolean;
  isCurrentUser: boolean;
  isOpen: boolean;
  onClose: () => void;
  /** ポップオーバーの位置調整用 */
  position?: { x: number; y: number };
}

export function CharacterInfoPopover({
  character,
  isOnline,
  isHuman,
  isCurrentUser,
  isOpen,
  onClose,
  position,
}: CharacterInfoPopoverProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ（クリックで閉じる） */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* ポップオーバー本体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: "spring", duration: 0.3 }}
            style={position ? { left: position.x, top: position.y } : undefined}
            className={cn(
              "fixed z-50 w-80 max-w-[90vw]",
              "rounded-xl border-2 border-gold-accent/50 bg-ink-brown/95 backdrop-blur-md shadow-2xl shadow-ink-black/50",
              !position && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div className="relative flex items-start gap-4 p-4 border-b border-gold-accent/30">
              {/* 閉じるボタン */}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 p-1 rounded-lg text-parchment-light/60 hover:text-parchment-light hover:bg-gold-accent/20 transition-colors"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>

              {/* キャラクター画像（拡大版） */}
              <div className="relative flex-shrink-0">
                <div className="h-24 w-24 rounded-xl border-2 border-gold-accent/50 bg-ink-black overflow-hidden shadow-lg">
                  {character.images?.base ? (
                    <img
                      src={character.images.base}
                      alt={character.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <div className={cn(
                    "h-full w-full flex items-center justify-center text-4xl",
                    character.images?.base ? "hidden" : ""
                  )}>
                    {isHuman ? "👤" : "🤖"}
                  </div>
                </div>

                {/* オンライン状態インジケーター */}
                <div
                  className={cn(
                    "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-ink-brown",
                    isOnline ? "bg-emerald-accent" : "bg-gray-500"
                  )}
                  title={isOnline ? "オンライン" : "オフライン"}
                />
              </div>

              {/* 名前・職業 */}
              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-lg font-title font-bold text-parchment-light truncate">
                  {character.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" size="sm" className="text-xs">
                    <Briefcase className="h-3 w-3 mr-1" />
                    {character.job}
                  </Badge>
                  {isHuman ? (
                    <Badge variant="outline" size="sm" className="text-xs text-emerald-accent border-emerald-accent/50">
                      <User className="h-3 w-3 mr-1" />
                      人間
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm" className="text-xs text-purple-400 border-purple-400/50">
                      AI
                    </Badge>
                  )}
                </div>
                {isCurrentUser && (
                  <p className="text-xs text-gold-accent mt-1 font-body">あなたのキャラクター</p>
                )}
              </div>
            </div>

            {/* 公開情報 */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-gold-accent" />
                <h4 className="text-sm font-title font-semibold text-parchment-light">
                  公開情報
                </h4>
              </div>
              <p className="text-sm font-body text-parchment-light/80 leading-relaxed whitespace-pre-wrap">
                {character.handout?.publicInfo || "情報なし"}
              </p>
            </div>

            {/* 秘密情報（自分のキャラクターのみ表示） */}
            {isCurrentUser && character.handout?.secretGoal && (
              <div className="p-4 border-t border-gold-accent/30 bg-blood-red/10">
                <div className="flex items-center gap-2 mb-2">
                  <EyeOff className="h-4 w-4 text-blood-red" />
                  <h4 className="text-sm font-title font-semibold text-blood-red">
                    秘密の目標
                  </h4>
                </div>
                <p className="text-sm font-body text-parchment-light/80 leading-relaxed whitespace-pre-wrap">
                  {character.handout.secretGoal}
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
