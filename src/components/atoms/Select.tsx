/**
 * Select Component
 * "The Infinite Mystery Library" Edition
 *
 * 図書館のドロップダウン選択風デザイン
 */

"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export interface SelectOption {
  /**
   * オプションの値
   */
  value: string;

  /**
   * オプションのラベル
   */
  label: string;

  /**
   * 無効化
   */
  disabled?: boolean;
}

export interface SelectProps {
  /**
   * オプション配列
   */
  options: SelectOption[];

  /**
   * 選択された値
   */
  value?: string;

  /**
   * デフォルト値
   */
  defaultValue?: string;

  /**
   * プレースホルダー
   */
  placeholder?: string;

  /**
   * ラベル
   */
  label?: string;

  /**
   * ヘルプテキスト
   */
  helperText?: string;

  /**
   * エラー状態
   */
  error?: boolean;

  /**
   * 無効化
   */
  disabled?: boolean;

  /**
   * 値変更時のコールバック
   */
  onChange?: (value: string) => void;

  /**
   * カスタムクラス名
   */
  className?: string;
}

export function Select({
  options,
  value,
  defaultValue,
  placeholder = "選択してください",
  label,
  helperText,
  error,
  disabled,
  onChange,
  className,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(value || defaultValue || "");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === selectedValue);

  // 外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ESCキーで閉じる
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  const handleSelect = (optionValue: string, optionDisabled?: boolean) => {
    if (optionDisabled) return;

    setSelectedValue(optionValue);
    setIsOpen(false);
    onChange?.(optionValue);
  };

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      {label && (
        <label className="mb-2 block font-serif text-sm font-medium text-primary-foreground">
          {label}
        </label>
      )}

      <div className="relative">
        {/* トリガーボタン */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex h-12 w-full items-center justify-between rounded-lg border-2 bg-primary px-4 py-2 font-sans text-base text-primary-foreground transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-accent-gold",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-accent-red focus:ring-accent-red"
              : "border-ink-light",
            isOpen && "ring-2 ring-accent-gold border-accent-gold"
          )}
        >
          <span className={cn(!selectedOption && "text-primary-foreground/50")}>
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {/* ドロップダウンメニュー */}
        {isOpen && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border-2 border-paper-dark bg-paper shadow-2xl">
            <div className="max-h-60 overflow-y-auto">
              {options.map((option) => {
                const isSelected = option.value === selectedValue;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value, option.disabled)}
                    disabled={option.disabled}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-3 text-left font-sans text-sm transition-colors",
                      "hover:bg-accent-gold/10 focus:bg-accent-gold/10 focus:outline-none",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      isSelected
                        ? "bg-accent-gold/20 text-accent-gold font-medium"
                        : "text-ink"
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {helperText && (
        <p
          className={cn(
            "mt-1 text-xs",
            error ? "text-accent-red" : "text-primary-foreground/60"
          )}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
