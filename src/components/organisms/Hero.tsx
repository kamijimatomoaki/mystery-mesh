/**
 * Hero
 * ヒーローセクション（タイトル、タグライン、CTA）
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, BookOpen } from "lucide-react";

interface HeroProps {
  className?: string;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
}

export function Hero({ className = "" }: HeroProps) {
  // パーティクルエフェクト（光の粒子）- クライアントサイドのみで生成
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    // クライアントサイドでのみパーティクルを生成（Hydrationエラー回避）
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 10 + Math.random() * 10,
      }))
    );
  }, []);

  return (
    <section className={`relative min-h-[90vh] flex items-center justify-center overflow-hidden ${className}`}>
      {/* 背景装飾 */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-black via-ink-brown/50 to-ink-black" />

      {/* パーティクルエフェクト */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-1 h-1 rounded-full bg-gold-accent"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0, 1, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              delay: particle.delay,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* メインコンテンツ */}
      <div className="relative z-10 text-center space-y-8 px-4 max-w-5xl mx-auto">
        {/* タイトル */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="space-y-4"
        >
          <motion.h1
            animate={{
              textShadow: [
                "0 0 20px rgba(201, 169, 97, 0.5)",
                "0 0 40px rgba(201, 169, 97, 0.8)",
                "0 0 20px rgba(201, 169, 97, 0.5)",
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="font-title text-6xl md:text-8xl font-bold text-parchment-light"
          >
            MysteryMesh
          </motion.h1>

          <p className="font-title text-xl md:text-2xl text-gold-accent candle-glow">
            The Infinite Mystery Library
          </p>

          <p className="font-body text-lg text-parchment-light/80 max-w-2xl mx-auto leading-relaxed">
            無限に広がるミステリー図書館へようこそ。
            <br />
            AIと人間が織りなす、かつてない推理体験が始まります。
          </p>
        </motion.div>

        {/* CTA ボタン */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/scenario/create"
              className="
                inline-flex items-center gap-2 px-8 py-4 rounded-full
                bg-gradient-to-r from-gold-accent to-gold-accent/80
                text-ink-black font-body font-bold text-lg
                shadow-lg shadow-gold-accent/30
                hover:shadow-gold-accent/50 transition-all duration-300
              "
            >
              <Sparkles className="w-5 h-5" />
              新しき謎を綴る
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/library"
              className="
                inline-flex items-center gap-2 px-8 py-4 rounded-full
                border-2 border-gold-accent text-gold-accent
                hover:bg-gold-accent hover:text-ink-black
                transition-all duration-300 font-body font-semibold text-lg
              "
            >
              <BookOpen className="w-5 h-5" />
              図書館を探索する
            </Link>
          </motion.div>
        </motion.div>

        {/* スクロールインジケーター */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="pt-12"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center gap-2 text-parchment-light/50"
          >
            <span className="text-xs font-body">Scroll to explore</span>
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
