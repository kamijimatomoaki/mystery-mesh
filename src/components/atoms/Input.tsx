/**
 * Input Component
 * "The Infinite Mystery Library" Edition
 *
 * インク風の入力フィールド
 */

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * エラー状態
   */
  error?: boolean;

  /**
   * ラベル
   */
  label?: string;

  /**
   * ヘルプテキスト
   */
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, label, helperText, type = "text", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block font-serif text-sm font-medium text-primary-foreground">
            {label}
          </label>
        )}
        <input
          type={type}
          className={cn(
            "flex h-12 w-full rounded-lg border-2 bg-primary px-4 py-2 font-sans text-base text-primary-foreground placeholder:text-primary-foreground/50 transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-accent-gold",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-accent-red focus:ring-accent-red"
              : "border-ink-light",
            className
          )}
          ref={ref}
          {...props}
        />
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
);

Input.displayName = "Input";

/**
 * Textarea - 複数行のテキスト入力
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  label?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block font-serif text-sm font-medium text-primary-foreground">
            {label}
          </label>
        )}
        <textarea
          className={cn(
            "flex min-h-[120px] w-full rounded-lg border-2 bg-primary px-4 py-3 font-sans text-base text-primary-foreground placeholder:text-primary-foreground/50 transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-accent-gold focus:border-accent-gold",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "resize-y",
            error
              ? "border-accent-red focus:ring-accent-red"
              : "border-ink-light",
            className
          )}
          ref={ref}
          {...props}
        />
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
);

Textarea.displayName = "Textarea";

export { Input };
