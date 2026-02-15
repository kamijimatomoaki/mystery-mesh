/**
 * Badge Component
 * "The Infinite Mystery Library" Edition
 *
 * 図書館のラベル・タグ風デザイン
 */

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * バッジのバリアント
   * - default: デフォルト（金色）
   * - primary: プライマリ（封蝋風）
   * - secondary: セカンダリ（羊皮紙風）
   * - success: 成功（緑）
   * - warning: 警告（オレンジ）
   * - danger: 危険（赤）
   * - outline: アウトライン
   */
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "success"
    | "warning"
    | "danger"
    | "outline";

  /**
   * サイズ
   */
  size?: "sm" | "md" | "lg";

  /**
   * 削除可能（×ボタン表示）
   */
  removable?: boolean;

  /**
   * 削除時のコールバック
   */
  onRemove?: () => void;
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  removable = false,
  onRemove,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center gap-1.5 font-sans font-medium rounded-full transition-all duration-200";

  const variantStyles = {
    default:
      "bg-accent-gold/20 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/30",
    primary:
      "bg-accent-red/20 text-accent-red border border-accent-red/30 hover:bg-accent-red/30",
    secondary:
      "bg-paper/20 text-paper border border-paper/30 hover:bg-paper/30",
    success:
      "bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30",
    warning:
      "bg-orange-500/20 text-orange-400 border border-orange-500/30 hover:bg-orange-500/30",
    danger:
      "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30",
    outline:
      "border-2 border-accent-gold text-accent-gold hover:bg-accent-gold/10",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  };

  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      <span>{children}</span>
      {removable && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="rounded-full hover:bg-black/20 p-0.5 transition-colors"
          aria-label="削除"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/**
 * BadgeGroup - バッジのグループコンテナ
 */
export interface BadgeGroupProps {
  children: React.ReactNode;
  className?: string;
}

export function BadgeGroup({ children, className }: BadgeGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
  );
}
