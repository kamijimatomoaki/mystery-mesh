/**
 * Landing Page (Library Entrance)
 * "図書館の入り口"
 */

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Hero } from "@/components/organisms/Hero";
import { BookOpen, Users } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen ink-bg">
      {/* ヒーローセクション */}
      <Hero className="pt-16" />

      {/* 機能紹介セクション */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-title text-3xl md:text-4xl text-parchment-light mb-4">
              MisteryMeshの特徴
            </h2>
            <p className="font-body text-parchment-light/70 max-w-2xl mx-auto">
              最先端のAI技術と伝統的なマーダーミステリーの融合
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* AI協力 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="parchment-card p-8 text-center"
            >
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="text-5xl mb-6"
              >
                🤖
              </motion.div>
              <h3 className="font-title text-xl font-bold text-ink-black mb-3">
                AIと協力
              </h3>
              <p className="font-body text-ink-brown leading-relaxed">
                最先端のAIエージェントと共に推理。自然な会話で物語が動き出す。
                AIは単なるNPCではなく、あなたと同じように推理し、時に騙されます。
              </p>
            </motion.div>

            {/* シナリオ生成 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="parchment-card p-8 text-center"
            >
              <motion.div
                animate={{
                  rotate: [0, -360],
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear",
                }}
                className="text-5xl mb-6"
              >
                ✨
              </motion.div>
              <h3 className="font-title text-xl font-bold text-ink-black mb-3">
                無限のシナリオ
              </h3>
              <p className="font-body text-ink-brown leading-relaxed">
                Geminiが生成する無数の謎。毎回新しい物語があなたを待っています。
                ジャンル、難易度、プレイ人数をカスタマイズ可能。
              </p>
            </motion.div>

            {/* 動画エンディング */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="parchment-card p-8 text-center"
            >
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="text-5xl mb-6"
              >
                🎬
              </motion.div>
              <h3 className="font-title text-xl font-bold text-ink-black mb-3">
                動画エンディング
              </h3>
              <p className="font-body text-ink-brown leading-relaxed">
                Veoが紡ぐドラマチックな結末。あなたの推理が映像になります。
                真相解明の瞬間を、映画のような体験で。
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 導線リンク */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Link
              href="/library"
              className="inline-flex items-center gap-2 text-gold-accent hover:text-gold-accent/80 transition-colors font-body text-lg"
            >
              <BookOpen className="w-5 h-5" />
              図書館でシナリオを探す
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <Link
              href="/game/join"
              className="inline-flex items-center gap-2 text-parchment-light/60 hover:text-gold-accent transition-colors font-body"
            >
              <Users className="w-4 h-4" />
              ルームIDで参加する
            </Link>
          </motion.div>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-8 px-4 border-t border-gold-accent/20">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📚</span>
              <span className="font-title text-lg text-parchment-light">
                MisteryMesh
              </span>
            </div>

            <div className="flex items-center gap-6 text-parchment-light/50 font-body text-sm">
              <Link href="/debug" className="hover:text-gold-accent transition-colors">
                開発者向け
              </Link>
              <span className="text-parchment-light/30">|</span>
              <span>Powered by Vertex AI</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
