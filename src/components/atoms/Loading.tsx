/**
 * Loading Component
 * "The Infinite Mystery Library" Edition
 *
 * 砂時計、インク滲みなどのローディングアニメーション
 */

"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface LoadingProps {
  /**
   * ローディングのバリアント
   * - hourglass: 砂時計
   * - ink: インク滲み
   * - spinner: スピナー
   */
  variant?: "hourglass" | "ink" | "spinner";

  /**
   * サイズ
   */
  size?: "sm" | "md" | "lg";

  /**
   * テキスト
   */
  text?: string;

  /**
   * カスタムクラス名
   */
  className?: string;
}

export function Loading({
  variant = "spinner",
  size = "md",
  text,
  className,
}: LoadingProps) {
  const sizeStyles = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
      {variant === "spinner" && (
        <motion.div
          className={cn(
            "border-4 border-accent-gold/30 border-t-accent-gold rounded-full",
            sizeStyles[size]
          )}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      )}

      {variant === "hourglass" && (
        <motion.div
          className={cn("relative", sizeStyles[size])}
          animate={{ rotateZ: 180 }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            repeatDelay: 0.5,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full text-accent-gold"
          >
            <path
              d="M6.5 2h11M6.5 22h11M7 2v4.5c0 2 1.5 3 3 3.5 1.5.5 3 1.5 3 3.5v.5c0 2-1.5 3-3 3.5-1.5.5-3 1.5-3 3.5V22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      )}

      {variant === "ink" && (
        <div className={cn("relative", sizeStyles[size])}>
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full bg-accent-gold/30"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.4,
                ease: "easeOut",
              }}
            />
          ))}
          <div className="absolute inset-0 rounded-full bg-accent-gold" />
        </div>
      )}

      {text && (
        <motion.p
          className="font-serif text-sm text-primary-foreground/80"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}

/**
 * LoadingOverlay - 全画面ローディングオーバーレイ
 */
export function LoadingOverlay({
  text = "読み込み中...",
  variant = "hourglass",
}: {
  text?: string;
  variant?: LoadingProps["variant"];
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <Loading variant={variant} size="lg" text={text} />
    </div>
  );
}
