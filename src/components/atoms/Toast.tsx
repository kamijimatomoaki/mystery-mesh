/**
 * Toast Component
 * "The Infinite Mystery Library" Edition
 *
 * 図書館の通知システム（羊皮紙風）
 */

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Info, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastVariant = "info" | "success" | "warning" | "error";

export interface ToastProps {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose: (id: string) => void;
}

const variantStyles = {
  info: "bg-primary border-accent-gold text-paper",
  success: "bg-gradient-to-br from-paper to-paper-dark border-accent-green text-ink",
  warning: "bg-gradient-to-br from-amber-100 to-amber-200 border-amber-600 text-amber-900",
  error: "bg-gradient-to-br from-red-100 to-red-200 border-accent-red text-red-900",
} as const;

const variantIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

export function Toast({
  id,
  message,
  variant = "info",
  duration = 4000,
  onClose,
}: ToastProps) {
  const Icon = variantIcons[variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, x: 50 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 50, transition: { duration: 0.2 } }}
      className={cn(
        "relative flex items-start gap-3 rounded-lg border-2 p-4 shadow-lg backdrop-blur-sm",
        "min-w-[320px] max-w-md",
        variantStyles[variant]
      )}
    >
      {/* アイコン */}
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />

      {/* メッセージ */}
      <p className="flex-1 font-sans text-sm leading-relaxed">{message}</p>

      {/* 閉じるボタン */}
      <button
        onClick={() => onClose(id)}
        className={cn(
          "flex-shrink-0 rounded p-1 transition-colors",
          "hover:bg-black/10 active:bg-black/20"
        )}
        aria-label="閉じる"
      >
        <X className="h-4 w-4" />
      </button>

      {/* 進行バー（オプション） */}
      {duration > 0 && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-current opacity-30"
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

/**
 * ToastContainer - トースト表示コンテナ
 */
export interface ToastContainerProps {
  toasts: Array<{
    id: string;
    message: string;
    variant?: ToastVariant;
    duration?: number;
  }>;
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
