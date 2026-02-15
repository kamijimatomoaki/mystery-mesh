/**
 * Button Component
 * "The Infinite Mystery Library" Edition
 *
 * 封蝋風ボタン、羽根ペン風ボタンなど、世界観に沿ったデザイン
 */

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * ボタンのバリアント
   * - seal: 封蝋風（プライマリアクション）
   * - quill: 羽根ペン風（セカンダリアクション）
   * - ghost: ゴースト（控えめなアクション）
   * - outline: アウトライン（境界線のみ）
   */
  variant?: "seal" | "quill" | "ghost" | "outline";

  /**
   * サイズ
   */
  size?: "sm" | "md" | "lg";

  /**
   * 全幅表示
   */
  fullWidth?: boolean;

  /**
   * ローディング状態
   */
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "seal",
      size = "md",
      fullWidth = false,
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-full font-serif font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

    const variantStyles = {
      seal: "bg-accent-red text-paper hover:scale-105 hover:shadow-lg hover:shadow-accent-red/50 active:scale-95",
      quill:
        "bg-accent-gold text-ink hover:bg-accent-gold/90 hover:scale-105 active:scale-95",
      ghost:
        "text-primary-foreground hover:bg-primary-foreground/10 active:bg-primary-foreground/20",
      outline:
        "border-2 border-accent-gold text-accent-gold hover:bg-accent-gold hover:text-ink transition-all duration-300",
    };

    const sizeStyles = {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          isLoading && "cursor-wait opacity-70",
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            処理中...
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
