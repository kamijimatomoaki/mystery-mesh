"use client";

/**
 * Card Detail Modal
 * カード詳細表示・公開モーダル
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { X, Eye, Lock } from "lucide-react";
import type { CardDefinition, LocationDefinition } from "@/core/types";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/useToast";

/**
 * スロットタイプのローカライズマップ
 */
const SLOT_TYPE_LABELS: Record<string, string> = {
  motive: "動機",
  item: "所持品",
  action: "行動記録",
  secret: "秘密",
};

/**
 * 場所IDからローカライズされた場所名を取得
 * locationsが渡されない場合はフォールバックを使用
 */
function getLocationName(locationId: string, locations?: LocationDefinition[]): string {
  // シナリオのlocationsから検索
  if (locations && locations.length > 0) {
    const location = locations.find(l => l.id === locationId);
    if (location) {
      return location.name;
    }
  }

  // フォールバック: 一般的な場所名のマッピング
  const fallbackLocationNames: Record<string, string> = {
    "Hand": "手元",
    "main_room": "メインルーム",
    "living_room": "リビングルーム",
    "library": "図書室",
    "kitchen": "キッチン",
    "hallway": "廊下",
    "bedroom": "寝室",
    "crime_scene": "事件現場",
    "garden": "庭園",
    "study": "書斎",
    "entrance": "エントランス",
  };

  return fallbackLocationNames[locationId] || locationId;
}

interface CardDetailModalProps {
  card: CardDefinition;
  gameId: string;
  currentUserId: string;
  isRevealed: boolean;
  isOwned: boolean; // カードを所持しているか
  locations?: LocationDefinition[]; // シナリオの場所情報
  onClose: () => void;
}

export function CardDetailModal({
  card,
  gameId,
  currentUserId,
  isRevealed,
  isOwned,
  locations,
  onClose,
}: CardDetailModalProps) {
  const toast = useToast();
  const [revealing, setRevealing] = useState(false);
  const [frontImgError, setFrontImgError] = useState(false);
  const [backImgError, setBackImgError] = useState(false);

  // 場所名をローカライズ
  const locationName = useMemo(
    () => getLocationName(card.location, locations),
    [card.location, locations]
  );

  // スロットタイプをローカライズ
  const slotTypeLabel = SLOT_TYPE_LABELS[card.slotType] || card.slotType;

  // カードを公開する（API経由でAIエージェントへの通知も含む）
  const handleReveal = async () => {
    if (!isOwned) {
      toast.error("所持していないカードは公開できません", 2000);
      return;
    }

    if (isRevealed) {
      toast.info("このカードは既に公開済みです", 1500);
      return;
    }

    setRevealing(true);

    try {
      const response = await fetch("/api/game/reveal-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          cardId: card.id,
          playerId: currentUserId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "カードの公開に失敗しました");
      }

      toast.success(`「${card.name}」を公開しました`, 2000);
      onClose();
    } catch (error) {
      console.error("Failed to reveal card:", error);
      toast.error(error instanceof Error ? error.message : "カードの公開に失敗しました", 2000);
    } finally {
      setRevealing(false);
    }
  };

  // カードの内容を表示できるか（所持 or 公開済み）
  const canViewSecret = isOwned || isRevealed;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className="w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
          <Card variant="parchment" className="overflow-hidden">
            {/* ヘッダー */}
            <CardHeader className="border-b-2 border-ink/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-2xl">{card.name}</CardTitle>
                  <Badge
                    variant={
                      card.type === "evidence"
                        ? "danger"
                        : card.type === "information"
                        ? "warning"
                        : "default"
                    }
                  >
                    {card.type === "evidence"
                      ? "証拠品"
                      : card.type === "information"
                      ? "情報"
                      : "物品"}
                  </Badge>
                  {isRevealed && (
                    <Badge variant="success" size="sm">
                      <Eye className="h-3 w-3 mr-1" />
                      公開済み
                    </Badge>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="rounded p-2 text-ink/70 transition-colors hover:bg-ink/10 hover:text-ink"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* カード画像 */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg border-2 border-ink/20 bg-ink/5">
                {canViewSecret ? (
                  <>
                    {/* 表面（共通テンプレート + テキストオーバーレイ） */}
                    <div className="relative h-full w-full">
                      {!frontImgError ? (
                        <img
                          src="/images/card-front.png"
                          alt="Card front"
                          className="h-full w-full object-cover"
                          onError={() => setFrontImgError(true)}
                        />
                      ) : (
                        // フォールバック: Dark Academia風のグラデーション背景
                        <div className="h-full w-full bg-gradient-to-br from-paper via-paper-dark to-ink-brown" />
                      )}
                      {/* カード内容オーバーレイ */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-b from-transparent via-ink/30 to-ink/60">
                        {/* カードタイプアイコン */}
                        <div className="mb-2">
                          {card.type === "evidence" && (
                            <span className="text-4xl">🔍</span>
                          )}
                          {card.type === "information" && (
                            <span className="text-4xl">📄</span>
                          )}
                          {card.type === "item" && (
                            <span className="text-4xl">🗝️</span>
                          )}
                        </div>
                        {/* カードタイトル */}
                        <h4 className="text-xl font-serif font-bold text-paper text-center drop-shadow-lg">
                          {card.secret.title}
                        </h4>
                        {/* スロットタイプ */}
                        <Badge
                          variant={
                            card.slotType === "motive" ? "danger" :
                            card.slotType === "secret" ? "warning" :
                            "default"
                          }
                          size="sm"
                          className="mt-2"
                        >
                          {slotTypeLabel}
                        </Badge>
                      </div>
                    </div>
                    {card.secret.importanceLevel >= 4 && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="danger" size="sm">
                          重要度 {card.secret.importanceLevel}/5
                        </Badge>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* 裏面（共通デザイン）- CSSグラデーションフォールバック */}
                    {!backImgError ? (
                      <img
                        src="/images/card-back.png"
                        alt="Card back"
                        className="h-full w-full object-cover"
                        onError={() => setBackImgError(true)}
                      />
                    ) : null}
                    <div className={cn(
                      "absolute inset-0 flex flex-col items-center justify-center",
                      "bg-gradient-to-br from-ink-brown via-ink to-ink-black"
                    )}>
                      <Lock className="h-12 w-12 text-paper/80 mb-2" />
                      <p className="text-paper/80 font-serif">非公開</p>
                    </div>
                  </>
                )}
              </div>

              {/* カード詳細 */}
              {canViewSecret ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-serif font-bold text-ink mb-2">
                      {card.secret.title}
                    </h3>
                    <p className="text-sm text-ink/80 leading-relaxed whitespace-pre-wrap">
                      {card.secret.description}
                    </p>
                  </div>

                  {card.secret.misleadNote && (
                    <div className="rounded-lg border-2 border-accent-gold/30 bg-accent-gold/10 p-3">
                      <p className="text-xs text-ink/70">
                        💡 {card.secret.misleadNote}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-ink/60">
                    <span>場所: {locationName}</span>
                    {card.relatedCharacterId && (
                      <span>関連: {card.relatedCharacterId}</span>
                    )}
                    <span>種類: {slotTypeLabel}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-ink/20 bg-ink/5 p-6 text-center">
                  <Lock className="h-8 w-8 text-ink/40 mx-auto mb-3" />
                  <p className="text-sm text-ink/60">
                    このカードは非公開です。所有者のみが内容を確認できます。
                  </p>
                </div>
              )}

              {/* アクションボタン */}
              {isOwned && !isRevealed && (
                <div className="pt-4 border-t-2 border-ink/10">
                  <button
                    onClick={handleReveal}
                    disabled={revealing}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all",
                      "bg-accent-gold text-ink hover:bg-accent-gold/80",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <Eye className="h-4 w-4" />
                    {revealing ? "公開中..." : "全員に公開する"}
                  </button>
                  <p className="text-xs text-ink/50 text-center mt-2">
                    💡 公開すると全プレイヤーが内容を確認できます
                  </p>
                </div>
              )}

              {isOwned && isRevealed && (
                <div className="pt-4 border-t-2 border-ink/10 text-center">
                  <p className="text-sm text-ink/60 flex items-center justify-center gap-2">
                    <Eye className="h-4 w-4" />
                    このカードは既に公開されています
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
  );
}
