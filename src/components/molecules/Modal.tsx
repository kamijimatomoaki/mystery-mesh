/**
 * Modal Component
 * "The Infinite Mystery Library" Edition
 *
 * 図書館風のモーダルダイアログ
 */

"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ReactNode, useEffect } from "react";

export interface ModalProps {
  /**
   * モーダルの開閉状態
   */
  isOpen: boolean;

  /**
   * モーダルを閉じる関数
   */
  onClose: () => void;

  /**
   * タイトル
   */
  title?: string;

  /**
   * 子要素
   */
  children: ReactNode;

  /**
   * サイズ
   */
  size?: "sm" | "md" | "lg" | "xl";

  /**
   * オーバーレイクリックで閉じるか
   */
  closeOnOverlayClick?: boolean;

  /**
   * カラーバリアント
   */
  variant?: "parchment" | "dark";

  /**
   * カスタムクラス名
   */
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  closeOnOverlayClick = true,
  variant = "parchment",
  className,
}: ModalProps) {
  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // モーダルが開いている間はボディのスクロールを無効化
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const sizeStyles = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* オーバーレイ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={closeOnOverlayClick ? onClose : undefined}
          />

          {/* モーダル本体 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={cn(
                "relative w-full rounded-lg shadow-2xl border-4",
                variant === "dark"
                  ? "bg-ink text-paper border-ink-light bg-gradient-to-br from-ink to-ink-light"
                  : "bg-paper text-ink border-paper-dark bg-gradient-to-br from-paper to-paper-dark",
                sizeStyles[size],
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* ヘッダー */}
              {title && (
                <div className={cn(
                  "flex items-center justify-between border-b-2 p-6",
                  variant === "dark" ? "border-ink-light" : "border-paper-dark"
                )}>
                  <h2 className="font-serif text-2xl font-bold">{title}</h2>
                  <button
                    onClick={onClose}
                    className={cn(
                      "rounded-full p-2 transition-colors",
                      variant === "dark"
                        ? "text-paper/60 hover:bg-paper/10 hover:text-paper"
                        : "text-ink/60 hover:bg-ink/10 hover:text-ink"
                    )}
                    aria-label="閉じる"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}

              {/* コンテンツ */}
              <div className="p-6">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * ModalFooter - モーダルのフッター
 */
export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t-2 border-paper-dark pt-4 mt-6",
        className
      )}
    >
      {children}
    </div>
  );
}
