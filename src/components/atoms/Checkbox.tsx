/**
 * Checkbox Component
 * "The Infinite Mystery Library" Edition
 *
 * 図書館のチェックリスト風デザイン
 */

"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { InputHTMLAttributes, forwardRef } from "react";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  /**
   * ラベル
   */
  label?: string;

  /**
   * 説明文
   */
  description?: string;

  /**
   * エラー状態
   */
  error?: boolean;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, error, disabled, id, ...props }, ref) => {
    const checkboxId = id || `checkbox-${Math.random().toString(36).substring(2, 11)}`;

    return (
      <div className="flex items-start space-x-3">
        <div className="relative flex items-center justify-center">
          <input
            type="checkbox"
            id={checkboxId}
            className="peer sr-only"
            ref={ref}
            disabled={disabled}
            {...props}
          />
          <label
            htmlFor={checkboxId}
            className={cn(
              "h-5 w-5 rounded border-2 transition-all duration-200",
              "flex items-center justify-center",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-accent-gold peer-focus-visible:ring-offset-2",
              "peer-checked:bg-accent-gold peer-checked:border-accent-gold peer-checked:[&_svg]:opacity-100",
              "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
              error
                ? "border-accent-red peer-checked:bg-accent-red peer-checked:border-accent-red"
                : "border-ink-light bg-primary",
              !disabled && "cursor-pointer hover:border-accent-gold",
              className
            )}
          >
            <Check className="h-3.5 w-3.5 text-ink opacity-0 transition-opacity" />
          </label>
        </div>

        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={checkboxId}
                className={cn(
                  "font-sans text-sm font-medium leading-none",
                  disabled
                    ? "text-primary-foreground/50 cursor-not-allowed"
                    : "text-primary-foreground cursor-pointer",
                  error && "text-accent-red"
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p
                className={cn(
                  "text-xs mt-1",
                  error
                    ? "text-accent-red/80"
                    : "text-primary-foreground/60"
                )}
              >
                {description}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
