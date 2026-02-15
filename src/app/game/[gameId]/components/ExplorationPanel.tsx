"use client";

/**
 * Exploration Panel
 * 探索パネル（カード調査・ターン制）
 */

import { useState, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Zap, Lock, CheckCircle, AlertCircle, Clock, User, FileQuestion, MapPin, Hourglass, SkipForward } from "lucide-react";
import type { GameState, Scenario, CardDefinition, LocationDefinition } from "@/core/types";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/useToast";
import { CardDetailModal } from "./CardDetailModal";

/**
 * 部屋アイコンマッピング
 */
const LOCATION_ICONS: Record<string, string> = {
  library: "📚",
  study: "📖",
  kitchen: "🍳",
  living_room: "🛋️",
  bedroom: "🛏️",
  hallway: "🚪",
  garden: "🌳",
  entrance: "🚪",
  crime_scene: "🔍",
  main_room: "🏛️",
  dining_room: "🍽️",
  bathroom: "🚿",
  storage: "📦",
  default: "📍",
};

interface ExplorationPanelProps {
  game: GameState;
  scenario: Scenario;
  currentUserId: string;
}

export const ExplorationPanel = memo(function ExplorationPanel({
  game,
  scenario,
  currentUserId,
}: ExplorationPanelProps) {
  const toast = useToast();
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const [revealedCard, setRevealedCard] = useState<CardDefinition | null>(null); // 調査成功後に表示するカード
  const [showExplorationCompleteModal, setShowExplorationCompleteModal] = useState(false); // 探索完了モーダル
  const [imgError, setImgError] = useState<Record<string, boolean>>({}); // 画像読み込みエラー状態
  const [skipping, setSkipping] = useState(false); // パス中

  /**
   * 画像読み込みエラー時のハンドラー（無限ループ防止）
   */
  const handleImageError = useCallback((cardId: string) => {
    setImgError(prev => ({ ...prev, [cardId]: true }));
  }, []);

  // 現在のプレイヤー情報
  const currentPlayer = game.players[currentUserId];

  // 探索状態
  const explorationState = game.explorationState;
  const currentAP = explorationState?.remainingAP?.[currentUserId] || 0;
  const currentActiveActor = explorationState?.currentActiveActor;
  const isMyTurn = currentActiveActor === currentUserId;

  // プレイヤーIDからキャラクター名を解決するヘルパー
  const getPlayerCharacterName = useMemo(() => {
    return (playerId: string): string => {
      const player = game.players[playerId];
      if (!player?.characterId) return player?.displayName || playerId;
      const character = scenario.data.characters.find(c => c.id === player.characterId);
      return character?.name || player.characterId;
    };
  }, [game.players, scenario.data.characters]);

  // 現在のターンのプレイヤー名を取得（キャラクター名で表示）
  const currentActorName = useMemo(() => {
    if (!currentActiveActor) return null;
    return getPlayerCharacterName(currentActiveActor);
  }, [currentActiveActor, getPlayerCharacterName]);

  // 現在のターンがAIかどうか
  const isAITurn = useMemo(() => {
    if (!currentActiveActor) return false;
    const player = game.players[currentActiveActor];
    return player && !player.isHuman;
  }, [currentActiveActor, game.players]);

  // プレイヤーの手札（既に調査済みのカード）
  const handCards = Object.entries(game.cards || {})
    .filter(([_, cardState]) => cardState.ownerId === currentUserId)
    .map(([cardId]) => cardId);

  // 誰かに取られているカードを除外した利用可能なカード
  const availableCards = useMemo(() => {
    return scenario.data.cards.filter((card) => {
      // 既に誰かの手札にあるカードは除外
      const cardState = game.cards?.[card.id];
      if (cardState?.ownerId) return false;

      // 初期locationがHandのカードは除外（キャラクター固有カード）
      if (card.location.startsWith("Hand")) return false;

      return true;
    });
  }, [scenario.data.cards, game.cards]);

  // 部屋ごとにカードをグループ化
  const cardsByLocation = useMemo(() => {
    const grouped: Record<string, CardDefinition[]> = {};
    const takenCards: CardDefinition[] = [];

    for (const card of scenario.data.cards) {
      // Handで始まる場所は除外
      if (card.location.startsWith("Hand")) continue;

      const cardState = game.cards?.[card.id];
      if (cardState?.ownerId) {
        // 取得済みカード
        takenCards.push(card);
      } else {
        // 利用可能なカード
        if (!grouped[card.location]) {
          grouped[card.location] = [];
        }
        grouped[card.location].push(card);
      }
    }

    return { grouped, takenCards };
  }, [scenario.data.cards, game.cards]);

  // 場所情報を取得
  const getLocationInfo = (locationId: string): { name: string; icon: string } => {
    const location = scenario.data.locations?.find(l => l.id === locationId);
    const icon = LOCATION_ICONS[locationId] || LOCATION_ICONS.default;
    return {
      name: location?.name || locationId,
      icon,
    };
  };

  // 残りターン数を計算
  const remainingTurns = explorationState?.actionQueue?.length || 0;

  // 表示モード（部屋別 / リスト） - デフォルトは部屋別
  const [viewMode, setViewMode] = useState<"room" | "list">("room");

  // カードを調査する（API経由）
  const handleInvestigate = async (card: CardDefinition) => {
    if (!isMyTurn) {
      toast.error("あなたのターンではありません", 1500);
      return;
    }

    if (currentAP < 1) {
      toast.error("APが足りません", 1500);
      return;
    }

    setInvestigating(true);

    try {
      const response = await fetch("/api/game/exploration/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          playerId: currentUserId,
          cardId: card.id,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.message || "調査に失敗しました", 2000);
        return;
      }

      toast.success(`「${card.name}」を調査しました`, 2000);
      setSelectedCard(null);

      // 調査成功時にカード詳細モーダルを表示
      setRevealedCard(card);

      if (result.isExplorationComplete) {
        // 探索完了モーダルを表示
        setShowExplorationCompleteModal(true);
      }
    } catch (error) {
      console.error("Failed to investigate card:", error);
      toast.error("カードの調査に失敗しました", 2000);
    } finally {
      setInvestigating(false);
    }
  };

  // ターンをパスする
  const handleSkipTurn = async () => {
    if (!isMyTurn) return;
    setSkipping(true);

    try {
      const response = await fetch("/api/game/exploration/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          playerId: currentUserId,
          action: "skip",
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.message || "スキップに失敗しました", 2000);
        return;
      }

      toast.info("ターンをパスしました", 1500);
    } catch (error) {
      console.error("Failed to skip turn:", error);
      toast.error("スキップに失敗しました", 2000);
    } finally {
      setSkipping(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ヘッダー */}
        <Card variant="parchment">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Search className="h-6 w-6 text-accent-gold" />
                <CardTitle className="text-2xl">証拠探索</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-gold/20 border-2 border-accent-gold/50">
                  <Zap className="h-5 w-5 text-accent-gold" />
                  <span className="text-xl font-bold text-accent-gold">
                    {currentAP}
                  </span>
                  <span className="text-sm text-ink/70">AP</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {/* ターン表示 */}
              <AnimatePresence mode="wait">
                {isMyTurn ? (
                  <motion.div
                    key="my-turn"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent-gold/30 border-2 border-accent-gold"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-accent-gold" />
                      <span className="font-bold text-accent-gold">
                        あなたのターンです！
                      </span>
                      <span className="text-sm text-ink/70">
                        カードを1枚選んで調査してください
                      </span>
                    </div>
                    <button
                      onClick={handleSkipTurn}
                      disabled={skipping}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-ink/10 text-ink/70 hover:bg-ink/20 hover:text-ink transition-colors"
                    >
                      <SkipForward className="h-4 w-4" />
                      {skipping ? "パス中..." : "パスする"}
                    </button>
                  </motion.div>
                ) : currentActiveActor ? (
                  <motion.div
                    key="other-turn"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-ink/10 border border-ink/20"
                  >
                    <Clock className="h-5 w-5 text-ink/60 animate-pulse" />
                    <span className="text-ink/80">
                      <strong>{currentActorName}</strong>
                      {isAITurn ? "（AI）" : ""} が調査中...
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-green-500/20 border border-green-500/50"
                  >
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-700">
                      探索フェーズが完了しました
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-xs text-ink/60">
                  <span>調査済み: {handCards.length}枚</span>
                  <span>調査可能: {availableCards.length}枚</span>
                  <span>残りターン: {remainingTurns}</span>
                </div>
                {/* 表示切り替えボタン */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewMode("room")}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-colors",
                      viewMode === "room"
                        ? "bg-accent-gold text-ink"
                        : "bg-ink/10 text-ink/60 hover:bg-ink/20"
                    )}
                  >
                    <MapPin className="h-3 w-3 inline mr-1" />
                    部屋別
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "px-2 py-1 rounded text-xs transition-colors",
                      viewMode === "list"
                        ? "bg-accent-gold text-ink"
                        : "bg-ink/10 text-ink/60 hover:bg-ink/20"
                    )}
                  >
                    一覧
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 部屋別表示 */}
        {viewMode === "room" && (
          <div className="space-y-6">
            {Object.entries(cardsByLocation.grouped).map(([locationId, cards]) => {
              const locationInfo = getLocationInfo(locationId);
              return (
                <Card key={locationId} variant="dark" className="overflow-hidden">
                  <CardHeader className="bg-ink-brown/30 border-b border-paper/10">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{locationInfo.icon}</span>
                      <CardTitle className="text-lg text-paper">{locationInfo.name}</CardTitle>
                      <Badge variant="outline" size="sm" className="ml-auto">
                        {cards.length}枚
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {cards.map((card) => {
                        const canInvestigate = isMyTurn && currentAP >= 1;
                        return (
                          <RoomCardItem
                            key={card.id}
                            card={card}
                            canInvestigate={canInvestigate}
                            investigating={investigating && selectedCard?.id === card.id}
                            imgError={imgError[card.id]}
                            onImageError={() => handleImageError(card.id)}
                            onInvestigate={() => handleInvestigate(card)}
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* リスト表示（従来のグリッド） */}
        {viewMode === "list" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableCards.map((card) => {
            const canInvestigate = isMyTurn && currentAP >= 1;
            const isSelected = selectedCard?.id === card.id;

            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Card
                  variant="parchment"
                  className={cn(
                    "transition-all",
                    canInvestigate ? "cursor-pointer hover:shadow-lg" : "cursor-not-allowed",
                    isSelected && "ring-2 ring-accent-gold shadow-xl",
                    !canInvestigate && "opacity-60"
                  )}
                >
                  <div
                    onClick={() => canInvestigate && setSelectedCard(card)}
                    className="relative"
                  >
                    {/* カード画像 */}
                    <div className="aspect-video w-full overflow-hidden rounded-t-lg bg-ink/10 relative">
                      {!imgError[card.id] ? (
                        <img
                          src={card.backImageUrl}
                          alt={card.name}
                          className="h-full w-full object-cover"
                          onError={() => handleImageError(card.id)}
                        />
                      ) : (
                        // CSSグラデーションでフォールバック表示（Dark Academia風）
                        <div className="h-full w-full bg-gradient-to-br from-ink-brown via-ink to-ink-black flex items-center justify-center">
                          <div className="text-center">
                            <FileQuestion className="h-12 w-12 text-paper/60 mx-auto mb-2" />
                            <span className="text-xs text-paper/40 font-serif">証拠カード</span>
                          </div>
                        </div>
                      )}
                      {!canInvestigate && (
                        <div className="absolute inset-0 bg-ink/40 backdrop-blur-[1px] flex items-center justify-center">
                          <Lock className="h-12 w-12 text-paper/60" />
                        </div>
                      )}
                    </div>

                    {/* カード情報 */}
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-serif font-bold text-ink">{card.name}</h3>
                        <Badge
                          variant={
                            card.type === "evidence"
                              ? "danger"
                              : card.type === "information"
                              ? "warning"
                              : "default"
                          }
                          size="sm"
                        >
                          {card.type === "evidence"
                            ? "証拠"
                            : card.type === "information"
                            ? "情報"
                            : "物品"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-ink/60">
                        <span>場所: {card.location}</span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInvestigate(card);
                        }}
                        disabled={!canInvestigate || investigating}
                        className={cn(
                          "w-full mt-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold text-sm transition-all",
                          canInvestigate
                            ? "bg-accent-gold text-ink hover:bg-accent-gold/80 shadow-md hover:shadow-lg"
                            : "bg-ink/10 text-ink/40 cursor-not-allowed"
                        )}
                      >
                        <Search className="h-4 w-4" />
                        {investigating && isSelected
                          ? "調査中..."
                          : isMyTurn
                          ? "調査する (1 AP)"
                          : "順番を待っています"}
                      </button>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
        )}

        {availableCards.length === 0 && (
          <Card variant="dark">
            <CardContent className="p-8 text-center text-paper/60">
              <Search className="h-12 w-12 mx-auto mb-3 text-paper/40" />
              <p>調査可能なカードがありません</p>
            </CardContent>
          </Card>
        )}

        {/* AP不足の警告 */}
        {currentAP === 0 && isMyTurn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card variant="dark">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-accent-red" />
                <p className="text-sm text-paper">
                  APがなくなりました。次のフェーズに進むまでお待ちください。
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* 次のターンのプレイヤー一覧（デバッグ用、将来的に削除可能） */}
        {explorationState?.actionQueue && explorationState.actionQueue.length > 0 && (
          <Card variant="parchment" className="opacity-60">
            <CardContent className="p-3">
              <p className="text-xs text-ink/50 mb-2">次の行動順:</p>
              <div className="flex flex-wrap gap-1">
                {explorationState.actionQueue.slice(0, 8).map((playerId, index) => {
                  const player = game.players[playerId];
                  return (
                    <Badge key={`${playerId}-${index}`} variant="outline" size="sm">
                      {index + 1}. {getPlayerCharacterName(playerId)}
                      {!player?.isHuman && " (AI)"}
                    </Badge>
                  );
                })}
                {explorationState.actionQueue.length > 8 && (
                  <Badge variant="outline" size="sm">
                    +{explorationState.actionQueue.length - 8}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 調査成功時のカード詳細モーダル */}
      <AnimatePresence>
        {revealedCard && (
          <CardDetailModal
            card={revealedCard}
            gameId={game.id}
            currentUserId={currentUserId}
            isRevealed={false}
            isOwned={true}
            onClose={() => setRevealedCard(null)}
          />
        )}
      </AnimatePresence>

      {/* 探索完了モーダル */}
      <AnimatePresence>
        {showExplorationCompleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4"
            onClick={() => setShowExplorationCompleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full"
            >
              <Card variant="parchment" className="overflow-hidden border-2 border-accent-gold">
                <CardContent className="p-8 text-center space-y-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="text-6xl"
                  >
                    🎉
                  </motion.div>
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-ink mb-2">
                      探索完了！
                    </h2>
                    <p className="text-sm text-ink/70">
                      全ての探索行動が終了しました。<br />
                      まもなく議論フェーズに移行します。
                    </p>
                  </div>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 3, ease: "linear" }}
                    className="h-1 bg-accent-gold rounded-full"
                  />
                  <button
                    onClick={() => setShowExplorationCompleteModal(false)}
                    className="px-6 py-2 bg-accent-gold text-ink font-serif font-bold rounded-lg hover:bg-accent-gold/90 transition-colors"
                  >
                    閉じる
                  </button>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/**
 * 部屋別表示用のコンパクトなカードアイテム
 */
function RoomCardItem({
  card,
  canInvestigate,
  investigating,
  imgError,
  onImageError,
  onInvestigate,
}: {
  card: CardDefinition;
  canInvestigate: boolean;
  investigating: boolean;
  imgError: boolean;
  onImageError: () => void;
  onInvestigate: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative rounded-lg overflow-hidden border-2 transition-all",
        canInvestigate
          ? "border-accent-gold/30 hover:border-accent-gold cursor-pointer hover:shadow-lg"
          : "border-paper/10 opacity-60 cursor-not-allowed"
      )}
      onClick={() => canInvestigate && onInvestigate()}
    >
      {/* カード画像 */}
      <div className="aspect-[4/3] w-full bg-ink/20 relative">
        {!imgError ? (
          <img
            src={card.backImageUrl}
            alt={card.name}
            className="h-full w-full object-cover"
            onError={onImageError}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-ink-brown via-ink to-ink-black flex items-center justify-center">
            <FileQuestion className="h-8 w-8 text-paper/40" />
          </div>
        )}

        {/* ロック表示 */}
        {!canInvestigate && (
          <div className="absolute inset-0 bg-ink/50 flex items-center justify-center">
            <Lock className="h-6 w-6 text-paper/60" />
          </div>
        )}

        {/* 調査中アニメーション */}
        <AnimatePresence>
          {investigating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-accent-gold/30 flex items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Hourglass className="h-8 w-8 text-accent-gold" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* カード情報 */}
      <div className="p-2 bg-paper/5">
        <p className="text-xs font-serif text-paper truncate">{card.name}</p>
        <div className="flex items-center gap-1 mt-1">
          <Badge
            variant={
              card.type === "evidence"
                ? "danger"
                : card.type === "information"
                ? "warning"
                : "default"
            }
            size="sm"
            className="text-[9px] px-1 py-0"
          >
            {card.type === "evidence" ? "証拠" : card.type === "information" ? "情報" : "物品"}
          </Badge>
        </div>
      </div>

      {/* 調査中の吹き出し */}
      <AnimatePresence>
        {investigating && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap"
          >
            <div className="bg-accent-gold text-ink text-xs font-bold px-3 py-1 rounded-full shadow-lg">
              調査中...
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-accent-gold rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
