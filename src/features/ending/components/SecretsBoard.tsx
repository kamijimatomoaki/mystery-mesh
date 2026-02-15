/**
 * SecretsBoard
 * 全カードの公開情報 + 秘密情報をグリッド表示
 * ゲーム中に取得したカード vs 未取得カードを色分け
 */

"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, Badge, Loading, Modal } from "@/components";
import { getSecrets } from "@/lib/api/ending";
import { Lock, Unlock, Eye, Search, FileText, Key } from "lucide-react";

import type { EndingCard } from "@/features/ending/types";

interface Props {
  gameId: string;
}

const SLOT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  motive: { label: "動機", color: "bg-red-500/20 text-red-400" },
  item: { label: "アイテム", color: "bg-blue-500/20 text-blue-400" },
  action: { label: "行動", color: "bg-green-500/20 text-green-400" },
  secret: { label: "秘密", color: "bg-purple-500/20 text-purple-400" },
};

const IMPORTANCE_STARS = ["", "★", "★★", "★★★", "★★★★", "★★★★★"];

export default function SecretsBoard({ gameId }: Props) {
  const [cards, setCards] = useState<EndingCard[]>([]);
  const [stats, setStats] = useState({ total: 0, obtained: 0, revealed: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<EndingCard | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getSecrets(gameId);
        setCards(data.cards);
        setStats({
          total: data.totalCards,
          obtained: data.obtainedCount,
          revealed: data.revealedCount,
        });
      } catch (error) {
        console.error("Failed to fetch secrets:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gameId]);

  const filteredCards = cards.filter((card) => {
    if (filter === "all") return true;
    if (filter === "obtained") return card.wasObtained;
    if (filter === "missed") return !card.wasObtained;
    return card.slotType === filter;
  });

  if (loading) {
    return <Loading variant="ink" size="md" text="カード情報を取得中..." />;
  }

  return (
    <>
      <Card variant="dark">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-accent-gold" />
              <span>シークレットアンロック</span>
            </CardTitle>
            <div className="text-sm text-paper/60">
              {stats.obtained}/{stats.total} カード取得
            </div>
          </div>

          {/* フィルターボタン */}
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { key: "all", label: "全て" },
              { key: "obtained", label: "取得済み" },
              { key: "missed", label: "未取得" },
              { key: "motive", label: "動機" },
              { key: "item", label: "アイテム" },
              { key: "action", label: "行動" },
              { key: "secret", label: "秘密" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  filter === f.key
                    ? "bg-accent-gold text-ink font-bold"
                    : "bg-paper/10 text-paper/60 hover:bg-paper/20"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent>
          {filteredCards.length === 0 ? (
            <div className="text-center text-paper/50 py-8">
              該当するカードがありません
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredCards.map((card, index) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedCard(card)}
                  className={`
                    relative p-3 rounded-lg border-2 cursor-pointer transition-all
                    hover:scale-105 hover:shadow-lg
                    ${
                      card.wasObtained
                        ? "border-accent-gold/50 bg-accent-gold/5"
                        : "border-paper/15 bg-paper/5 opacity-70"
                    }
                  `}
                >
                  {/* 状態アイコン */}
                  <div className="absolute top-2 right-2">
                    {card.wasObtained ? (
                      <Unlock className="w-4 h-4 text-accent-gold" />
                    ) : (
                      <Lock className="w-4 h-4 text-paper/30" />
                    )}
                  </div>

                  {/* カード名 */}
                  <h4 className="font-serif text-sm font-medium pr-6 mb-2">
                    {card.name}
                  </h4>

                  {/* スロットタイプ */}
                  <div className="mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        SLOT_TYPE_LABELS[card.slotType]?.color || "bg-paper/10 text-paper/50"
                      }`}
                    >
                      {SLOT_TYPE_LABELS[card.slotType]?.label || card.slotType}
                    </span>
                  </div>

                  {/* 重要度 */}
                  <div className="text-xs text-accent-gold/70">
                    {IMPORTANCE_STARS[card.secret.importanceLevel] || ""}
                  </div>

                  {/* 場所 */}
                  <div className="text-xs text-paper/40 mt-1">{card.location}</div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 詳細モーダル */}
      {selectedCard && (
        <Modal
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          title={selectedCard.name}
          variant="dark"
        >
          <div className="space-y-4">
            {/* ヘッダー情報 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  SLOT_TYPE_LABELS[selectedCard.slotType]?.color || ""
                }`}
              >
                {SLOT_TYPE_LABELS[selectedCard.slotType]?.label}
              </span>
              <span className="text-xs text-paper/50">
                場所: {selectedCard.location}
              </span>
              {selectedCard.relatedCharacterName && (
                <span className="text-xs text-paper/50">
                  関連: {selectedCard.relatedCharacterName}
                </span>
              )}
            </div>

            {/* 取得状態 */}
            <div
              className={`p-3 rounded-lg ${
                selectedCard.wasObtained
                  ? "bg-accent-gold/10 border border-accent-gold/30"
                  : "bg-paper/5 border border-paper/20"
              }`}
            >
              {selectedCard.wasObtained ? (
                <div className="flex items-center gap-2 text-accent-gold">
                  <Eye className="w-4 h-4" />
                  <span className="text-sm">
                    {selectedCard.obtainedBy} が取得
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-paper/50">
                  <Search className="w-4 h-4" />
                  <span className="text-sm">ゲーム中に未取得</span>
                </div>
              )}
            </div>

            {/* 秘密情報 */}
            <div className="border-t border-paper/20 pt-4">
              <h4 className="font-serif text-accent-gold text-sm mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                秘密の内容
              </h4>
              <h5 className="font-medium mb-2">{selectedCard.secret.title}</h5>
              <p className="text-sm text-paper/80 leading-relaxed">
                {selectedCard.secret.description}
              </p>
            </div>

            {/* ミスリードノート */}
            {selectedCard.secret.misleadNote && (
              <div className="bg-accent-red/10 border border-accent-red/30 p-3 rounded-lg">
                <h5 className="text-xs font-serif text-accent-red mb-1">
                  ミスリード情報
                </h5>
                <p className="text-sm text-paper/80">
                  {selectedCard.secret.misleadNote}
                </p>
              </div>
            )}

            {/* 重要度 */}
            <div className="text-right text-accent-gold/70 text-sm">
              重要度: {IMPORTANCE_STARS[selectedCard.secret.importanceLevel]}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
