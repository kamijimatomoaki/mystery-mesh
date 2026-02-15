/**
 * PhaseTimeline Component
 * ゲームフェーズのタイムライン表示（Dark Academia: 本の章風）
 */

"use client";

import React from "react";
import { motion } from "framer-motion";
import type { GamePhase } from "@/core/types";

interface PhaseTimelineProps {
  currentPhase: GamePhase;
  className?: string;
}

interface PhaseInfo {
  id: GamePhase;
  chapter: string; // 章番号（図書館メタファー）
  title: string;
  icon: string;
  description: string;
}

const PHASES: PhaseInfo[] = [
  {
    id: "setup",
    chapter: "序章",
    title: "集いの間",
    icon: "🚪",
    description: "部屋作成・キャラ選択",
  },
  {
    id: "generation",
    chapter: "準備",
    title: "運命の編纂",
    icon: "📜",
    description: "シナリオ生成中",
  },
  {
    id: "lobby",
    chapter: "待機",
    title: "仮面の選択",
    icon: "🎭",
    description: "プレイヤー集結",
  },
  {
    id: "prologue",
    chapter: "導入",
    title: "記憶の同調",
    icon: "📖",
    description: "ハンドアウト確認",
  },
  {
    id: "exploration_1",
    chapter: "探索一",
    title: "前半探索",
    icon: "🔍",
    description: "真実を探せ",
  },
  {
    id: "discussion_1",
    chapter: "第一章",
    title: "前半議論",
    icon: "💬",
    description: "情報を共有せよ",
  },
  {
    id: "exploration_2",
    chapter: "探索二",
    title: "後半探索",
    icon: "🔎",
    description: "決定的証拠を",
  },
  {
    id: "discussion_2",
    chapter: "第二章",
    title: "後半議論",
    icon: "💭",
    description: "推理を深めよ",
  },
  {
    id: "voting",
    chapter: "審判",
    title: "投票",
    icon: "⚖️",
    description: "真犯人を指摘せよ",
  },
  {
    id: "ending",
    chapter: "終章",
    title: "真相開示",
    icon: "🎬",
    description: "すべてが明らかに",
  },
  {
    id: "ended",
    chapter: "完",
    title: "物語の終幕",
    icon: "📖",
    description: "ゲーム終了",
  },
];

export function PhaseTimeline({ currentPhase, className = "" }: PhaseTimelineProps) {
  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);

  return (
    <div className={`relative ${className}`}>
      {/* 背景装飾: 羊皮紙風 */}
      <div className="absolute inset-0 bg-gradient-to-br from-paper via-paper-dark to-paper opacity-20 rounded-lg blur-sm" />

      {/* タイムライン本体 */}
      <div className="relative bg-ink/80 backdrop-blur-sm rounded-lg border-2 border-accent-gold/30 p-6">
        {/* タイトル */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-br from-accent-red to-accent-red-dark rounded-full flex items-center justify-center">
            <span className="text-paper text-sm font-bold">📜</span>
          </div>
          <h3 className="text-2xl font-serif text-accent-gold">物語の進行</h3>
        </div>

        {/* フェーズリスト */}
        <div className="space-y-3">
          {PHASES.map((phase, index) => {
            const isActive = phase.id === currentPhase;
            const isPast = index < currentIndex;
            const isFuture = index > currentIndex;

            return (
              <motion.div
                key={phase.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  relative flex items-center gap-4 p-4 rounded-lg border-2 transition-all duration-300
                  ${
                    isActive
                      ? "bg-accent-gold/20 border-accent-gold shadow-lg shadow-accent-gold/20"
                      : isPast
                      ? "bg-paper/5 border-paper/20 opacity-60"
                      : "bg-paper/10 border-paper/30 opacity-70"
                  }
                `}
              >
                {/* 左: 章番号 + アイコン */}
                <div className="flex flex-col items-center gap-1 min-w-[80px]">
                  <div
                    className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-2xl
                    ${
                      isActive
                        ? "bg-accent-gold text-ink shadow-lg shadow-accent-gold/50"
                        : isPast
                        ? "bg-paper/20 text-paper"
                        : "bg-paper/15 text-paper/60"
                    }
                  `}
                  >
                    {phase.icon}
                  </div>
                  <span
                    className={`
                    text-xs font-serif
                    ${isActive ? "text-accent-gold font-bold" : isPast ? "text-paper" : "text-paper/60"}
                  `}
                  >
                    {phase.chapter}
                  </span>
                </div>

                {/* 中央: タイトルと説明 */}
                <div className="flex-1">
                  <h4
                    className={`
                    text-lg font-serif mb-1
                    ${isActive ? "text-accent-gold font-bold" : isPast ? "text-paper" : "text-paper/60"}
                  `}
                  >
                    {phase.title}
                  </h4>
                  <p
                    className={`
                    text-sm
                    ${isActive ? "text-paper" : isPast ? "text-paper/50" : "text-paper/50"}
                  `}
                  >
                    {phase.description}
                  </p>
                </div>

                {/* 右: ステータスインジケーター */}
                <div className="flex items-center gap-2">
                  {isActive && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-3 h-3 bg-accent-gold rounded-full shadow-lg shadow-accent-gold/50"
                    />
                  )}
                  {isPast && <div className="w-3 h-3 bg-paper/40 rounded-full" />}
                </div>

                {/* アクティブ時のグロー効果 */}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-lg bg-gradient-to-r from-accent-gold/0 via-accent-gold/10 to-accent-gold/0"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* 進捗バー */}
        <div className="mt-6 pt-6 border-t border-ink-light/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-paper/70 font-serif">物語の進行度</span>
            <span className="text-sm text-accent-gold font-bold">
              {Math.round(((currentIndex + 1) / PHASES.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-ink-light/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-accent-gold via-accent-red to-accent-gold"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / PHASES.length) * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
