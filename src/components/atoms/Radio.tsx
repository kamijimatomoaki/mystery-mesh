/**
 * Radio Component
 * "The Infinite Mystery Library" Edition
 *
 * 図書館のラジオボタン風デザイン
 */

"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export interface RadioProps
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

const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, description, error, disabled, id, ...props }, ref) => {
    const radioId = id || `radio-${Math.random().toString(36).substring(2, 11)}`;

    return (
      <div className="flex items-start space-x-3">
        <div className="relative flex items-center justify-center">
          <input
            type="radio"
            id={radioId}
            className="peer sr-only"
            ref={ref}
            disabled={disabled}
            {...props}
          />
          <label
            htmlFor={radioId}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition-all duration-200",
              "flex items-center justify-center",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-accent-gold peer-focus-visible:ring-offset-2",
              "peer-checked:[&>div]:opacity-100",
              "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
              error ? "border-accent-red" : "border-ink-light bg-primary",
              !disabled && "cursor-pointer hover:border-accent-gold",
              className
            )}
          >
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full transition-all duration-200",
                "opacity-0",
                error ? "bg-accent-red" : "bg-accent-gold"
              )}
            />
          </label>
        </div>

        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <label
                htmlFor={radioId}
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

Radio.displayName = "Radio";

/**
 * RadioGroup - ラジオボタンのグループコンテナ
 */
export interface RadioGroupProps {
  label?: string;
  error?: boolean;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}

export function RadioGroup({
  label,
  error,
  helperText,
  children,
  className,
}: RadioGroupProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <label className="block font-serif text-sm font-medium text-primary-foreground">
          {label}
        </label>
      )}
      <div className="space-y-2">{children}</div>
      {helperText && (
        <p
          className={cn(
            "text-xs",
            error ? "text-accent-red" : "text-primary-foreground/60"
          )}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

export { Radio };
