/**
 * Tabs Component
 * "The Infinite Mystery Library" Edition
 *
 * 図書館の索引タブ風デザイン
 */

"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ReactNode, useState } from "react";

export interface Tab {
  /**
   * タブのID
   */
  id: string;

  /**
   * タブのラベル
   */
  label: string;

  /**
   * タブのコンテンツ
   */
  content: ReactNode;

  /**
   * 無効化
   */
  disabled?: boolean;

  /**
   * アイコン（オプション）
   */
  icon?: ReactNode;
}

export interface TabsProps {
  /**
   * タブ配列
   */
  tabs: Tab[];

  /**
   * デフォルトで選択されるタブID
   */
  defaultTab?: string;

  /**
   * タブ変更時のコールバック
   */
  onTabChange?: (tabId: string) => void;

  /**
   * バリアント
   */
  variant?: "line" | "enclosed";

  /**
   * カスタムクラス名
   */
  className?: string;
}

export function Tabs({
  tabs,
  defaultTab,
  onTabChange,
  variant = "line",
  className,
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(
    defaultTab || tabs[0]?.id || ""
  );

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled) return;
    setActiveTab(tabId);
    onTabChange?.(tabId);
  };

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={cn("w-full", className)}>
      {/* タブヘッダー */}
      <div
        className={cn(
          "flex items-center gap-1",
          variant === "line"
            ? "border-b-2 border-primary-foreground/20"
            : "bg-primary-foreground/5 rounded-lg p-1"
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id, tab.disabled)}
              disabled={tab.disabled}
              className={cn(
                "relative px-4 py-2.5 font-serif font-medium text-sm transition-all duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2",
                "disabled:cursor-not-allowed disabled:opacity-40",
                variant === "line"
                  ? cn(
                      isActive
                        ? "text-accent-gold"
                        : "text-primary-foreground/60 hover:text-primary-foreground"
                    )
                  : cn(
                      "rounded-md",
                      isActive
                        ? "bg-paper text-ink shadow-md"
                        : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
                    )
              )}
            >
              <span className="flex items-center gap-2">
                {tab.icon}
                {tab.label}
              </span>

              {/* アンダーライン（line variant） */}
              {variant === "line" && isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-gold"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* タブコンテンツ */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="mt-6"
      >
        {activeTabContent}
      </motion.div>
    </div>
  );
}
