"use client";

/**
 * PhaseTransitionOverlay
 * フェーズ遷移時に全画面で表示されるイマーシブなオーバーレイ
 * Dark Academia風の大時計と鐘の音の演出
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GamePhase } from "@/core/types";

interface PhaseTransitionOverlayProps {
  currentPhase: GamePhase;
  isVisible: boolean;
  onComplete: () => void;
}

/** ゲームプレイ中のフェーズ情報（セットアップ系フェーズを除く） */
const GAMEPLAY_PHASES: {
  id: GamePhase;
  chapter: string;
  title: string;
  icon: string;
}[] = [
  { id: "prologue", chapter: "導入", title: "記憶の同調", icon: "📖" },
  { id: "exploration_1", chapter: "探索一", title: "前半探索", icon: "🔍" },
  { id: "discussion_1", chapter: "第一章", title: "前半議論", icon: "💬" },
  { id: "exploration_2", chapter: "探索二", title: "後半探索", icon: "🔎" },
  { id: "discussion_2", chapter: "第二章", title: "後半議論", icon: "💭" },
  { id: "voting", chapter: "審判", title: "投票", icon: "⚖️" },
  { id: "ending", chapter: "終章", title: "真相開示", icon: "🎬" },
];

/**
 * 鐘の音をWeb Audio APIで合成（外部ファイル不要）
 */
function playBellSound() {
  try {
    const ctx = new AudioContext();

    // 低音の鐘
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 2.5);

    // 倍音（金属感）
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(554, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(277, ctx.currentTime + 1.5);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 1.8);

    // 3番目の倍音（深み）
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(165, ctx.currentTime + 0.05);
    osc3.frequency.exponentialRampToValueAtTime(82, ctx.currentTime + 3);
    gain3.gain.setValueAtTime(0.2, ctx.currentTime + 0.05);
    gain3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.05);
    osc3.stop(ctx.currentTime + 3);

    // メモリクリーンアップ
    setTimeout(() => ctx.close(), 4000);
  } catch {
    // AudioContext非対応 or ユーザーインタラクション前の場合は無視
  }
}

export function PhaseTransitionOverlay({
  currentPhase,
  isVisible,
  onComplete,
}: PhaseTransitionOverlayProps) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const onCompleteRef = useRef(onComplete);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showPhaseTitle, setShowPhaseTitle] = useState(false);

  // onCompleteの最新参照を常に保持（useEffect依存配列から除外するため）
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const currentPhaseInfo = GAMEPLAY_PHASES.find((p) => p.id === currentPhase);
  const currentIndex = GAMEPLAY_PHASES.findIndex((p) => p.id === currentPhase);

  useEffect(() => {
    if (!isVisible) {
      setShowTimeline(false);
      setShowPhaseTitle(false);
      return;
    }

    // 鐘の音
    playBellSound();

    // タイムライン表示
    const t1 = setTimeout(() => setShowTimeline(true), 500);
    // フェーズタイトル表示
    const t2 = setTimeout(() => setShowPhaseTitle(true), 1200);
    // 自動消去（onCompleteRef経由で最新のコールバックを呼ぶ）
    timerRef.current = setTimeout(() => onCompleteRef.current(), 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible]); // onComplete を依存配列から除外

  // 時計の針が指すフェーズの角度
  const hourAngle = currentIndex >= 0
    ? (currentIndex / GAMEPLAY_PHASES.length) * 360 - 90
    : 0;

  return (
    <AnimatePresence>
      {isVisible && currentPhaseInfo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
          onClick={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            onCompleteRef.current();
          }}
        >
          {/* 背景 */}
          <motion.div
            className="absolute inset-0 bg-ink/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* 時計 */}
          <motion.div
            className="relative z-10"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <svg
              viewBox="0 0 200 200"
              className="w-48 h-48 md:w-64 md:h-64"
              style={{ filter: "drop-shadow(0 0 20px rgba(212, 175, 55, 0.3))" }}
            >
              {/* 外枠 */}
              <circle
                cx="100"
                cy="100"
                r="95"
                fill="none"
                stroke="url(#goldGradient)"
                strokeWidth="3"
              />
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="rgba(212, 175, 55, 0.2)"
                strokeWidth="1"
              />

              {/* グラデーション定義 */}
              <defs>
                <radialGradient id="clockFace" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(30, 25, 20, 0.9)" />
                  <stop offset="100%" stopColor="rgba(15, 12, 10, 0.95)" />
                </radialGradient>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#d4af37" />
                  <stop offset="50%" stopColor="#f4d03f" />
                  <stop offset="100%" stopColor="#d4af37" />
                </linearGradient>
              </defs>

              {/* 文字盤 */}
              <circle cx="100" cy="100" r="85" fill="url(#clockFace)" />

              {/* フェーズマーカー */}
              {GAMEPLAY_PHASES.map((phase, i) => {
                const angle = (i / GAMEPLAY_PHASES.length) * 360 - 90;
                const rad = (angle * Math.PI) / 180;
                const x = 100 + 70 * Math.cos(rad);
                const y = 100 + 70 * Math.sin(rad);
                const isActive = phase.id === currentPhase;
                const isPast = i < currentIndex;

                return (
                  <g key={phase.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isActive ? 8 : 5}
                      fill={
                        isActive
                          ? "#d4af37"
                          : isPast
                          ? "rgba(212, 175, 55, 0.4)"
                          : "rgba(255, 255, 255, 0.15)"
                      }
                    />
                    {isActive && (
                      <circle
                        cx={x}
                        cy={y}
                        r="12"
                        fill="none"
                        stroke="#d4af37"
                        strokeWidth="1"
                        opacity="0.5"
                      >
                        <animate
                          attributeName="r"
                          values="10;16;10"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                        <animate
                          attributeName="opacity"
                          values="0.5;0.1;0.5"
                          dur="2s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    )}
                  </g>
                );
              })}

              {/* 時計の針 */}
              <motion.line
                x1="100"
                y1="100"
                x2={100 + 55 * Math.cos((hourAngle * Math.PI) / 180)}
                y2={100 + 55 * Math.sin((hourAngle * Math.PI) / 180)}
                stroke="#d4af37"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              />

              {/* 中央の留め具 */}
              <circle cx="100" cy="100" r="5" fill="#d4af37" />
              <circle cx="100" cy="100" r="3" fill="#1e1914" />
            </svg>

            {/* 振り子 */}
            <motion.div
              className="absolute -bottom-12 left-1/2 -translate-x-1/2"
              animate={{ rotate: [-15, 15, -15] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              style={{ transformOrigin: "top center" }}
            >
              <div className="w-0.5 h-10 bg-accent-gold/40 mx-auto" />
              <div className="w-4 h-4 rounded-full bg-accent-gold/60 mx-auto -mt-0.5" />
            </motion.div>
          </motion.div>

          {/* フェーズタイムライン（小型） */}
          <AnimatePresence>
            {showTimeline && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative z-10 mt-12 flex items-center gap-2"
              >
                {GAMEPLAY_PHASES.map((phase, i) => {
                  const isActive = phase.id === currentPhase;
                  const isPast = i < currentIndex;

                  return (
                    <motion.div
                      key={phase.id}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: i * 0.05, type: "spring", damping: 20 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <div
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-base transition-all ${
                          isActive
                            ? "bg-accent-gold text-ink shadow-lg shadow-accent-gold/50 scale-110"
                            : isPast
                            ? "bg-paper/20 text-paper/60"
                            : "bg-paper/10 text-paper/30"
                        }`}
                      >
                        {phase.icon}
                      </div>
                      <span
                        className={`text-[10px] md:text-xs font-serif whitespace-nowrap ${
                          isActive
                            ? "text-accent-gold font-bold"
                            : isPast
                            ? "text-paper/40"
                            : "text-paper/20"
                        }`}
                      >
                        {phase.chapter}
                      </span>
                      {/* アクティブのコネクトライン */}
                      {i < GAMEPLAY_PHASES.length - 1 && (
                        <div
                          className={`absolute top-4 w-2 h-0.5 ${
                            i < currentIndex
                              ? "bg-accent-gold/40"
                              : "bg-paper/10"
                          }`}
                          style={{
                            left: `calc(${(i + 0.5) / GAMEPLAY_PHASES.length * 100}%)`,
                          }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {/* フェーズ名 */}
          <AnimatePresence>
            {showPhaseTitle && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative z-10 mt-8 text-center"
              >
                <motion.div
                  className="text-accent-gold/60 text-sm font-serif tracking-widest mb-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  {currentPhaseInfo.chapter}
                </motion.div>
                <motion.h2
                  className="text-3xl md:text-4xl font-serif font-bold text-paper"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  {currentPhaseInfo.title}
                </motion.h2>
                <motion.div
                  className="mx-auto mt-4 h-0.5 bg-gradient-to-r from-transparent via-accent-gold to-transparent"
                  initial={{ width: 0 }}
                  animate={{ width: 200 }}
                  transition={{ delay: 0.4, duration: 0.8 }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* タップで閉じるヒント */}
          <motion.p
            className="relative z-10 mt-8 text-paper/30 text-xs font-serif"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            タップして続ける
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
