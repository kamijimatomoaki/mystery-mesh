/**
 * AIThinkingIndicator Component
 * AI思考中・入力中の表示（Dark Academia: 羽根ペン + インク滲み）
 */

"use client";

import React from "react";
import { motion } from "framer-motion";

interface AIThinkingIndicatorProps {
  /** エージェント名 */
  agentName: string;
  /** 状態 */
  state: "thinking" | "writing" | "idle";
  /** クラス名 */
  className?: string;
}

export function AIThinkingIndicator({
  agentName,
  state,
  className = "",
}: AIThinkingIndicatorProps) {
  if (state === "idle") {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg
        bg-ink/60 backdrop-blur-sm border border-accent-gold/30
        ${className}
      `}
    >
      {/* 左: アニメーション */}
      <div className="relative w-12 h-12">
        {state === "thinking" ? (
          // 思考中: インク滲みアニメーション
          <div className="relative w-full h-full">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full bg-accent-gold/30"
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.6, 0, 0.6],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.4,
                }}
              />
            ))}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl">🧠</span>
            </div>
          </div>
        ) : (
          // 入力中: 羽根ペンアニメーション
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div
              animate={{
                rotate: [-5, 5, -5],
                y: [0, -2, 0],
              }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="text-3xl origin-bottom-right"
            >
              🪶
            </motion.div>
            {/* インク滴 */}
            <motion.div
              className="absolute bottom-0 left-1/2 w-1.5 h-1.5 bg-accent-gold rounded-full"
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
        )}
      </div>

      {/* 中央: テキスト */}
      <div className="flex-1">
        <div className="text-sm text-accent-gold font-serif font-bold">{agentName}</div>
        <div className="text-xs text-paper/70">
          {state === "thinking" ? "推理を巡らせている..." : "発言を綴っている..."}
        </div>
      </div>

      {/* 右: ドットアニメーション */}
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-accent-gold rounded-full"
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/**
 * ChatBubble with AI Typing Effect
 * AI発言のチャットバブル（タイピングエフェクト付き）
 */
interface AIChatBubbleProps {
  agentName: string;
  content: string;
  isTyping?: boolean;
  avatarUrl?: string;
  className?: string;
}

export function AIChatBubble({
  agentName,
  content,
  isTyping = false,
  avatarUrl,
  className = "",
}: AIChatBubbleProps) {
  const [displayedContent, setDisplayedContent] = React.useState("");
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isTyping) {
      setDisplayedContent(content);
      return;
    }

    if (currentIndex < content.length) {
      const timeout = setTimeout(() => {
        setDisplayedContent(content.slice(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }, 30); // 30msごとに1文字

      return () => clearTimeout(timeout);
    }
  }, [content, isTyping, currentIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex gap-3 ${className}`}
    >
      {/* アバター */}
      <div className="flex-shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={agentName}
            className="w-10 h-10 rounded-full border-2 border-accent-gold/50"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-accent-gold/20 border-2 border-accent-gold/50 flex items-center justify-center">
            <span className="text-accent-gold text-lg">🤖</span>
          </div>
        )}
      </div>

      {/* バブル */}
      <div className="flex-1 max-w-xl">
        <div className="text-xs text-accent-gold font-serif mb-1">{agentName}</div>
        <div
          className="
          px-4 py-3 rounded-lg rounded-tl-none
          bg-gradient-to-br from-paper/10 to-paper-dark/10
          border border-accent-gold/30
          backdrop-blur-sm
        "
        >
          <p className="text-paper leading-relaxed">
            {displayedContent}
            {isTyping && currentIndex < content.length && (
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="inline-block w-0.5 h-4 bg-accent-gold ml-1"
              />
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
