"use client";

/**
 * Context Menu
 * 右クリックメニュー（カード操作用）
 */

import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Share2, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  return (
    <>
      {/* 背景オーバーレイ（クリックで閉じる） */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* メニュー本体 */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed z-50 min-w-[200px] rounded-lg border-2 border-paper/30 bg-ink/95 p-2 shadow-2xl backdrop-blur-md"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => {
              if (!item.disabled) {
                item.onClick();
                onClose();
              }
            }}
            disabled={item.disabled}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
              item.disabled
                ? "cursor-not-allowed opacity-40"
                : item.variant === "danger"
                ? "text-accent-red hover:bg-accent-red/20"
                : "text-paper hover:bg-paper/10",
              index > 0 && "mt-1"
            )}
          >
            <span className="flex h-5 w-5 items-center justify-center">
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
          </button>
        ))}
      </motion.div>
    </>
  );
}
