/**
 * PlayerCard
 * プレイヤー情報表示カード
 */

"use client";

import { motion } from "framer-motion";
import { Crown, Check, Bot, User } from "lucide-react";
import { Badge } from "@/components";

interface Character {
  id: string;
  name: string;
  job: string;
  age: number;
  gender: "male" | "female";
}

interface PlayerCardProps {
  playerId: string;
  displayName: string;
  isHuman: boolean;
  isHost: boolean;
  isReady: boolean;
  isOnline: boolean;
  character?: Character;
  index?: number;
  className?: string;
}

export function PlayerCard({
  playerId,
  displayName,
  isHuman,
  isHost,
  isReady,
  isOnline,
  character,
  index = 0,
  className = "",
}: PlayerCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02, x: 4 }}
      className={`
        relative rounded-xl border-2 p-4 transition-all overflow-hidden
        ${isReady
          ? "border-emerald-accent/50 bg-gradient-to-br from-emerald-accent/10 to-transparent shadow-lg shadow-emerald-accent/10"
          : "border-gold-accent/30 bg-gradient-to-br from-parchment-texture/10 to-transparent"
        }
        ${className}
      `}
    >
      {/* 背景エフェクト */}
      {isReady && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-emerald-accent/5 to-transparent"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      <div className="relative flex items-start gap-4">
        {/* アバター */}
        <div className="relative">
          <div className={`
            w-14 h-14 rounded-full flex items-center justify-center
            ${isHuman
              ? "bg-gradient-to-br from-blue-500/30 to-blue-600/20 border-2 border-blue-400/50"
              : "bg-gradient-to-br from-purple-500/30 to-purple-600/20 border-2 border-purple-400/50"
            }
          `}>
            {isHuman ? (
              <User className="w-6 h-6 text-blue-300" />
            ) : (
              <Bot className="w-6 h-6 text-purple-300" />
            )}
          </div>

          {/* オンラインインジケーター */}
          <motion.div
            animate={{
              scale: isOnline ? [1, 1.2, 1] : 1,
              opacity: isOnline ? [1, 0.7, 1] : 0.3,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={`
              absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-ink-black
              ${isOnline ? "bg-emerald-accent" : "bg-ink-brown/50"}
            `}
          />

          {/* ホストクラウン */}
          {isHost && (
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              className="absolute -top-2 -right-2"
            >
              <Crown className="w-5 h-5 text-gold-accent drop-shadow-lg" />
            </motion.div>
          )}
        </div>

        {/* プレイヤー情報 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-title font-semibold text-parchment-light truncate">
              {displayName}
            </p>
            <Badge
              variant={isHuman ? "primary" : "secondary"}
              size="sm"
              className={isHuman
                ? "bg-blue-500/20 border-blue-400/50 text-blue-300"
                : "bg-purple-500/20 border-purple-400/50 text-purple-300"
              }
            >
              {isHuman ? "人間" : "AI"}
            </Badge>
          </div>

          {/* キャラクター情報 */}
          {character ? (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 p-2 rounded-lg bg-parchment-light/10 border border-parchment-light/20"
            >
              <p className="text-sm font-body text-parchment-light font-semibold">
                {character.name}
              </p>
              <p className="text-xs text-parchment-light/60">
                {character.job} / {character.age}歳 / {character.gender === "male" ? "男性" : "女性"}
              </p>
            </motion.div>
          ) : (
            <p className="mt-2 text-xs font-body text-parchment-light/50 italic">
              {isHuman ? "キャラクター選択待ち..." : "開始時に自動割り当て"}
            </p>
          )}
        </div>

        {/* ステータス */}
        <div className="flex flex-col items-end gap-2">
          {isReady ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Badge
                variant="success"
                size="sm"
                className="bg-emerald-accent/20 border-emerald-accent/50 text-emerald-accent whitespace-nowrap"
              >
                <Check className="w-3 h-3 mr-1" />
                準備OK
              </Badge>
            </motion.div>
          ) : (
            <Badge
              variant="secondary"
              size="sm"
              className="bg-parchment-light/10 border-parchment-light/30 text-parchment-light/60 whitespace-nowrap"
            >
              待機中
            </Badge>
          )}
        </div>
      </div>
    </motion.div>
  );
}
