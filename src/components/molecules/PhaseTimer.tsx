/**
 * PhaseTimer Component
 * フェーズタイマー表示（Dark Academia: 砂時計 + カウントダウン）
 */

"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface PhaseTimerProps {
  /** 残り秒数 */
  remainingSeconds: number;
  /** タイマーがアクティブか */
  isActive: boolean;
  /** 警告閾値（秒）デフォルト: 60秒 */
  warningThreshold?: number;
  /** クラス名 */
  className?: string;
  /** コンパクトモード（小さい表示） */
  compact?: boolean;
}

export function PhaseTimer({
  remainingSeconds,
  isActive,
  warningThreshold = 60,
  className = "",
  compact = false,
}: PhaseTimerProps) {
  const [displayTime, setDisplayTime] = useState(remainingSeconds);

  useEffect(() => {
    setDisplayTime(remainingSeconds);
  }, [remainingSeconds]);

  // 警告状態
  const isWarning = isActive && displayTime <= warningThreshold;
  const isCritical = isActive && displayTime <= 30;

  // 時間のフォーマット
  const minutes = Math.floor(displayTime / 60);
  const seconds = displayTime % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  // 砂時計の砂の高さ（パーセンテージ）
  const sandHeight = isActive ? (displayTime / 600) * 100 : 0; // 10分=600秒を基準

  if (!isActive) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="text-paper/50 text-xs font-serif">時間制限なし</div>
      </div>
    );
  }

  // コンパクトモード
  if (compact) {
    return (
      <div
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg border backdrop-blur-sm
          ${
            isCritical
              ? "bg-accent-red/20 border-accent-red"
              : isWarning
              ? "bg-accent-gold/20 border-accent-gold"
              : "bg-ink/40 border-accent-gold/30"
          }
          ${className}
        `}
      >
        <span className="text-base">
          {isCritical ? "🔥" : isWarning ? "⏳" : "⌛"}
        </span>
        <span
          className={`
            text-sm font-mono font-bold tabular-nums
            ${isCritical ? "text-accent-red" : isWarning ? "text-accent-gold" : "text-paper"}
          `}
        >
          {timeString}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      className={`relative ${className}`}
      animate={
        isCritical
          ? { scale: [1, 1.05, 1] }
          : isWarning
          ? { scale: [1, 1.02, 1] }
          : {}
      }
      transition={{ duration: 1, repeat: Infinity }}
    >
      {/* 背景グロー（警告時） */}
      <AnimatePresence>
        {isWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
            className={`
              absolute inset-0 blur-xl rounded-full
              ${isCritical ? "bg-accent-red" : "bg-accent-gold"}
            `}
          />
        )}
      </AnimatePresence>

      {/* タイマー本体 */}
      <div
        className={`
        relative flex items-center gap-4 px-6 py-4 rounded-lg border-2 backdrop-blur-sm
        ${
          isCritical
            ? "bg-accent-red/20 border-accent-red shadow-lg shadow-accent-red/30"
            : isWarning
            ? "bg-accent-gold/20 border-accent-gold shadow-lg shadow-accent-gold/20"
            : "bg-ink/60 border-accent-gold/30"
        }
      `}
      >
        {/* 左: 砂時計アニメーション */}
        <div className="relative w-16 h-20">
          {/* 砂時計の枠 */}
          <svg
            viewBox="0 0 64 80"
            className={`
            w-full h-full
            ${isCritical ? "text-accent-red" : isWarning ? "text-accent-gold" : "text-paper"}
          `}
            fill="currentColor"
          >
            {/* 上部 */}
            <path d="M 8 0 L 56 0 L 56 8 L 52 20 L 32 40 L 12 20 L 8 8 Z" opacity="0.3" />
            {/* 下部 */}
            <path d="M 8 80 L 56 80 L 56 72 L 52 60 L 32 40 L 12 60 L 8 72 Z" opacity="0.3" />
            {/* 砂（上部） */}
            <motion.path
              d={`M 12 ${20 - sandHeight * 0.15} L 52 ${20 - sandHeight * 0.15} L 52 20 L 32 40 L 12 20 Z`}
              fill="currentColor"
              initial={{ opacity: 0.8 }}
              animate={{ opacity: [0.8, 1, 0.8] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            {/* 砂（下部） */}
            <motion.path
              d={`M 12 60 L 32 40 L 52 60 L 52 ${72 + (100 - sandHeight) * 0.08} L 12 ${
                72 + (100 - sandHeight) * 0.08
              } Z`}
              fill="currentColor"
              animate={{ opacity: [1, 0.9, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </svg>

          {/* 砂が落ちるパーティクル */}
          <motion.div
            className={`
            absolute top-1/2 left-1/2 w-1 h-2 rounded-full
            ${isCritical ? "bg-accent-red" : "bg-accent-gold"}
          `}
            animate={{ y: [0, 20], opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </div>

        {/* 中央: 残り時間 */}
        <div className="flex-1">
          <div className="text-xs text-paper/70 font-serif mb-1">残り時間</div>
          <div
            className={`
            text-4xl font-mono font-bold tabular-nums
            ${isCritical ? "text-accent-red" : isWarning ? "text-accent-gold" : "text-paper"}
          `}
          >
            {timeString}
          </div>
        </div>

        {/* 右: 警告メッセージ */}
        <AnimatePresence>
          {isWarning && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center gap-1"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="text-3xl"
              >
                {isCritical ? "🔥" : "⚠️"}
              </motion.div>
              <div
                className={`
                text-xs font-bold
                ${isCritical ? "text-accent-red" : "text-accent-gold"}
              `}
              >
                {isCritical ? "急げ！" : "警告"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 下部: プログレスバー */}
      <div className="mt-2 h-1 bg-ink-light/20 rounded-full overflow-hidden">
        <motion.div
          className={`
            h-full
            ${
              isCritical
                ? "bg-accent-red"
                : isWarning
                ? "bg-accent-gold"
                : "bg-gradient-to-r from-accent-gold to-accent-red"
            }
          `}
          style={{ width: `${sandHeight}%` }}
          animate={isWarning ? { opacity: [0.7, 1, 0.7] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        />
      </div>
    </motion.div>
  );
}
