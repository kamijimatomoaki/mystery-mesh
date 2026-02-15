"use client";

/**
 * GM Announcement Banner
 * ゲームマスター（Librarian）からの重要アナウンス表示
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, X, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GMAnnouncementBannerProps {
  message: string;
  type?: "info" | "warning" | "success" | "phase_change";
  duration?: number; // 自動非表示までのミリ秒（0で永続表示）
  onClose?: () => void;
  showSpeech?: boolean; // TTS再生ボタンを表示
}

/**
 * GMアナウンスバナー
 * Dark Academia / Mystical Library スタイル
 */
export function GMAnnouncementBanner({
  message,
  type = "info",
  duration = 5000,
  onClose,
  showSpeech = false,
}: GMAnnouncementBannerProps) {
  const [isVisible, setIsVisible] = useState(true);

  // 自動非表示
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  // タイプ別のスタイリング
  const typeStyles = {
    info: {
      bg: "bg-gradient-to-r from-ink-black/95 via-ink-brown/90 to-ink-black/95",
      border: "border-gold-accent/50",
      icon: <BookOpen className="h-5 w-5 text-gold-accent" />,
      iconBg: "bg-gold-accent/20",
    },
    warning: {
      bg: "bg-gradient-to-r from-blood-red/20 via-blood-red/30 to-blood-red/20",
      border: "border-blood-red/50",
      icon: <AlertTriangle className="h-5 w-5 text-blood-red" />,
      iconBg: "bg-blood-red/20",
    },
    success: {
      bg: "bg-gradient-to-r from-emerald-accent/20 via-emerald-accent/30 to-emerald-accent/20",
      border: "border-emerald-accent/50",
      icon: <CheckCircle className="h-5 w-5 text-emerald-accent" />,
      iconBg: "bg-emerald-accent/20",
    },
    phase_change: {
      bg: "bg-gradient-to-r from-purple-900/30 via-purple-800/40 to-purple-900/30",
      border: "border-purple-400/50",
      icon: <BookOpen className="h-5 w-5 text-purple-300" />,
      iconBg: "bg-purple-400/20",
    },
  };

  const style = typeStyles[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl mx-auto px-4"
          )}
        >
          <div
            className={cn(
              "relative rounded-lg border-2 shadow-2xl backdrop-blur-sm",
              style.bg,
              style.border
            )}
          >
            {/* 装飾的な角 */}
            <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-gold-accent/70 rounded-tl" />
            <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-gold-accent/70 rounded-tr" />
            <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-gold-accent/70 rounded-bl" />
            <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-gold-accent/70 rounded-br" />

            <div className="flex items-start gap-4 p-4">
              {/* アイコン */}
              <div
                className={cn(
                  "flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full",
                  style.iconBg
                )}
              >
                <motion.div
                  animate={type === "phase_change" ? {
                    rotate: [0, 10, -10, 0],
                    scale: [1, 1.1, 1],
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {style.icon}
                </motion.div>
              </div>

              {/* メッセージ */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-title font-bold text-gold-accent/80 uppercase tracking-wider mb-1">
                  {type === "phase_change" ? "Phase Transition" : "Librarian's Notice"}
                </p>
                <p className="text-sm font-body text-parchment-light leading-relaxed">
                  {message}
                </p>
              </div>

              {/* 閉じるボタン */}
              <button
                onClick={handleClose}
                className="flex-shrink-0 p-1 rounded-full text-parchment-light/60 hover:text-parchment-light hover:bg-parchment-light/10 transition-colors"
                aria-label="閉じる"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 進捗バー（自動非表示の場合） */}
            {duration > 0 && (
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: duration / 1000, ease: "linear" }}
                className="h-0.5 bg-gold-accent/50 origin-left"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * GMアナウンスフック - 複数のアナウンスを管理
 */
export function useGMAnnouncements() {
  const [announcements, setAnnouncements] = useState<Array<{
    id: string;
    message: string;
    type: "info" | "warning" | "success" | "phase_change";
    duration?: number;
  }>>([]);

  const announce = (
    message: string,
    type: "info" | "warning" | "success" | "phase_change" = "info",
    duration: number = 5000
  ) => {
    const id = `gm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    setAnnouncements((prev) => [...prev, { id, message, type, duration }]);
  };

  const dismiss = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  const clear = () => {
    setAnnouncements([]);
  };

  return {
    announcements,
    announce,
    dismiss,
    clear,
  };
}

export default GMAnnouncementBanner;
