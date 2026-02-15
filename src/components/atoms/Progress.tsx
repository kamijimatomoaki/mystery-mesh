/**
 * Progress Component
 * "The Infinite Mystery Library" Edition
 *
 * 図書館の進捗バー（インク染み風）
 */

"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { HTMLAttributes } from "react";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * 進捗値（0-100）
   */
  value: number;

  /**
   * バリアント
   * - default: デフォルト（金色）
   * - primary: プライマリ（封蝋風）
   * - success: 成功（緑）
   */
  variant?: "default" | "primary" | "success";

  /**
   * サイズ
   */
  size?: "sm" | "md" | "lg";

  /**
   * ラベル表示
   */
  showLabel?: boolean;

  /**
   * カスタムラベル
   */
  label?: string;

  /**
   * アニメーション
   */
  animated?: boolean;
}

export function Progress({
  value,
  variant = "default",
  size = "md",
  showLabel = false,
  label,
  animated = true,
  className,
  ...props
}: ProgressProps) {
  // 0-100の範囲に制限
  const clampedValue = Math.min(Math.max(value, 0), 100);

  const variantStyles = {
    default: "bg-accent-gold",
    primary: "bg-accent-red",
    success: "bg-green-500",
  };

  const sizeStyles = {
    sm: "h-1.5",
    md: "h-2.5",
    lg: "h-4",
  };

  return (
    <div className={cn("w-full", className)} {...props}>
      {/* ラベル */}
      {(showLabel || label) && (
        <div className="flex items-center justify-between mb-2">
          <span className="font-sans text-sm text-primary-foreground">
            {label || "進捗"}
          </span>
          {showLabel && (
            <span className="font-mono text-sm text-primary-foreground/80">
              {clampedValue}%
            </span>
          )}
        </div>
      )}

      {/* プログレスバー */}
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-primary-foreground/10",
          sizeStyles[size]
        )}
      >
        {animated ? (
          <motion.div
            className={cn(
              "h-full rounded-full transition-colors duration-300",
              variantStyles[variant]
            )}
            initial={{ width: 0 }}
            animate={{ width: `${clampedValue}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        ) : (
          <div
            className={cn("h-full rounded-full", variantStyles[variant])}
            style={{ width: `${clampedValue}%` }}
          />
        )}

        {/* グロー効果 */}
        {clampedValue > 0 && (
          <div
            className={cn(
              "absolute top-0 right-0 h-full w-8 blur-md opacity-50",
              variantStyles[variant]
            )}
            style={{ right: `${100 - clampedValue}%` }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * ProgressSteps - ステップ式プログレス
 */
export interface ProgressStepsProps {
  /**
   * 現在のステップ（0から始まる）
   */
  currentStep: number;

  /**
   * ステップ情報
   */
  steps: {
    label: string;
    description?: string;
  }[];

  /**
   * カスタムクラス名
   */
  className?: string;
}

export function ProgressSteps({
  currentStep,
  steps,
  className,
}: ProgressStepsProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={index} className="flex flex-col items-center flex-1">
              {/* ステップ円 */}
              <div className="relative flex items-center w-full">
                {/* 前の線 */}
                {index > 0 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 transition-colors duration-300",
                      isCompleted ? "bg-accent-gold" : "bg-primary-foreground/20"
                    )}
                  />
                )}

                {/* 円 */}
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center font-serif font-bold text-sm transition-all duration-300",
                    "border-2",
                    isCompleted || isCurrent
                      ? "bg-accent-gold border-accent-gold text-ink"
                      : "bg-primary border-primary-foreground/20 text-primary-foreground/50"
                  )}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>

                {/* 後の線 */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 transition-colors duration-300",
                      isCompleted ? "bg-accent-gold" : "bg-primary-foreground/20"
                    )}
                  />
                )}
              </div>

              {/* ラベル */}
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    "font-sans text-sm font-medium",
                    isCurrent
                      ? "text-accent-gold"
                      : isCompleted
                      ? "text-primary-foreground"
                      : "text-primary-foreground/50"
                  )}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-primary-foreground/60 mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
