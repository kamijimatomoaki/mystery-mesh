/**
 * Avatar
 * ユーザーアバターコンポーネント
 */

"use client";

import { motion } from "framer-motion";
import { User } from "lucide-react";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  isOnline?: boolean;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-24 h-24",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

export function Avatar({
  src,
  alt = "User avatar",
  size = "md",
  className = "",
  isOnline,
}: AvatarProps) {
  return (
    <div className={`relative inline-block ${className}`}>
      <div
        className={`
          ${sizeClasses[size]}
          rounded-full overflow-hidden
          bg-gradient-to-br from-gold-accent/30 to-ink-brown/30
          border-2 border-gold-accent/50
          flex items-center justify-center
        `}
      >
        {src ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className={`${iconSizes[size]} text-gold-accent/70`} />
        )}
      </div>

      {/* オンラインインジケーター */}
      {isOnline !== undefined && (
        <motion.div
          animate={isOnline ? {
            scale: [1, 1.2, 1],
            opacity: [1, 0.7, 1],
          } : {}}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className={`
            absolute bottom-0 right-0
            ${size === "sm" ? "w-2.5 h-2.5" : "w-3.5 h-3.5"}
            rounded-full border-2 border-ink-black
            ${isOnline ? "bg-emerald-accent" : "bg-ink-brown/50"}
          `}
        />
      )}
    </div>
  );
}
