/**
 * Navbar
 * グローバルナビゲーション
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, BookOpen, PenTool, Home, LogIn, LogOut, User, Users } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";

interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "ホーム", icon: <Home className="w-4 h-4" /> },
  { href: "/library", label: "図書館", icon: <BookOpen className="w-4 h-4" /> },
  { href: "/scenario/create", label: "新しき謎を綴る", icon: <PenTool className="w-4 h-4" /> },
];

export function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, displayName, signOut, loading } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ink-black/80 backdrop-blur-md border-b border-gold-accent/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ロゴ */}
          <Link href="/" className="flex items-center gap-2 group">
            <motion.span
              className="text-2xl"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              📚
            </motion.span>
            <span className="font-title text-xl text-parchment-light group-hover:text-gold-accent transition-colors">
              MysteryMesh
            </span>
          </Link>

          {/* デスクトップナビ */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg font-body text-sm transition-all
                    ${isActive
                      ? "bg-gold-accent/20 text-gold-accent"
                      : "text-parchment-light/70 hover:text-parchment-light hover:bg-parchment-light/5"
                    }
                  `}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}

            {/* ルーム参加 */}
            <Link
              href="/game/join"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-parchment-light/50 hover:text-gold-accent hover:bg-gold-accent/10 transition-all font-body text-sm"
              title="ルームIDで参加"
            >
              <Users className="w-4 h-4" />
              <span className="hidden lg:inline">参加</span>
            </Link>

            {/* 認証ボタン */}
            {!loading && (
              isAuthenticated ? (
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gold-accent/20">
                  <div className="flex items-center gap-2 text-parchment-light/70">
                    <User className="w-4 h-4" />
                    <span className="text-sm font-body">{displayName || "ユーザー"}</span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg text-parchment-light/60 hover:text-parchment-light hover:bg-parchment-light/5 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/signin"
                  className="flex items-center gap-2 px-4 py-2 ml-4 rounded-lg bg-gold-accent/20 text-gold-accent hover:bg-gold-accent/30 transition-all font-body text-sm"
                >
                  <LogIn className="w-4 h-4" />
                  サインイン
                </Link>
              )
            )}
          </div>

          {/* モバイルメニューボタン */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-parchment-light/70 hover:text-parchment-light"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* モバイルメニュー */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-ink-black/95 border-b border-gold-accent/20"
          >
            <div className="px-4 py-4 space-y-2">
              {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg font-body transition-all
                      ${isActive
                        ? "bg-gold-accent/20 text-gold-accent"
                        : "text-parchment-light/70 hover:text-parchment-light hover:bg-parchment-light/5"
                      }
                    `}
                  >
                    {link.icon}
                    {link.label}
                  </Link>
                );
              })}
              {/* ルーム参加（モバイル） */}
              <Link
                href="/game/join"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg font-body transition-all
                  ${pathname === "/game/join"
                    ? "bg-gold-accent/20 text-gold-accent"
                    : "text-parchment-light/50 hover:text-parchment-light hover:bg-parchment-light/5"
                  }
                `}
              >
                <Users className="w-4 h-4" />
                ルームIDで参加
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
