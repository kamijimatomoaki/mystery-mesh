"use client";

/**
 * Map View
 * マップビュー（中央メインエリア）
 * 各部屋に証拠カードの状態を視覚的に表示
 */

import { useState, useMemo, memo } from "react";
import { AnimatePresence } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, Share2, Info } from "lucide-react";
import type { GameState, Scenario, CardDefinition, LocationDefinition } from "@/core/types";
import { Button, Badge } from "@/components";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/useToast";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { CardDetailModal } from "./CardDetailModal";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/core/db/firestore-client";

interface MapViewProps {
  game: GameState;
  scenario: Scenario;
  currentUserId?: string;
}

/**
 * デフォルトロケーション（シナリオにロケーションがない場合のフォールバック）
 */
const DEFAULT_LOCATIONS: LocationDefinition[] = [
  { id: "main_room", name: "メインルーム", type: "room", importance: 5, isCrimeScene: true, position: { x: 50, y: 50, width: 220, height: 160 } },
  { id: "room_a", name: "部屋A", type: "room", importance: 4, position: { x: 300, y: 50, width: 180, height: 160 } },
  { id: "room_b", name: "部屋B", type: "room", importance: 4, position: { x: 510, y: 50, width: 220, height: 160 } },
  { id: "room_c", name: "部屋C", type: "room", importance: 3, position: { x: 760, y: 50, width: 240, height: 160 } },
  { id: "hallway", name: "廊下", type: "room", importance: 2, position: { x: 50, y: 240, width: 220, height: 160 } },
  { id: "storage", name: "倉庫", type: "room", importance: 3, position: { x: 300, y: 240, width: 180, height: 160 } },
  { id: "outside_a", name: "外部エリアA", type: "outdoor", importance: 3, position: { x: 510, y: 240, width: 220, height: 160 } },
  { id: "outside_b", name: "外部エリアB", type: "outdoor", importance: 2, position: { x: 760, y: 240, width: 240, height: 160 } },
];

/**
 * ロケーションに座標がない場合、自動計算
 */
function calculateLocationPositions(locations: LocationDefinition[]): LocationDefinition[] {
  const GRID_COLS = 4;
  const CELL_WIDTH = 220;
  const CELL_HEIGHT = 160;
  const PADDING = 30;
  const START_X = 50;
  const START_Y = 50;

  return locations.map((loc, index) => {
    if (loc.position) return loc;

    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);

    return {
      ...loc,
      position: {
        x: START_X + col * (CELL_WIDTH + PADDING),
        y: START_Y + row * (CELL_HEIGHT + PADDING),
        width: CELL_WIDTH,
        height: CELL_HEIGHT,
      },
    };
  });
}

/** カードの表示用ステータス */
type CardStatus = "undiscovered" | "owned_by_me" | "owned_by_other" | "revealed";

interface CardDisplayInfo {
  cardId: string;
  name: string;
  status: CardStatus;
  ownerName?: string;
}

// デフォルト背景画像（フォールバック用）
const DEFAULT_BACKGROUND_IMAGE = "/images/background_test01.png";

export const MapView = memo(function MapView({ game, scenario, currentUserId }: MapViewProps) {
  const toast = useToast();
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 背景画像のフォールバック制御
  const [backgroundSrc, setBackgroundSrc] = useState(
    scenario.data.backgroundImageUrl || DEFAULT_BACKGROUND_IMAGE
  );

  // コンテキストメニュー
  const [contextMenu, setContextMenu] = useState<{
    cardId: string;
    position: { x: number; y: number };
  } | null>(null);

  // カード詳細モーダル
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // ロケーション定義を取得（シナリオから、なければデフォルト使用）
  const locations = useMemo(() => {
    const scenarioLocations = scenario.data.locations;
    if (scenarioLocations && scenarioLocations.length > 0) {
      return calculateLocationPositions(scenarioLocations);
    }
    return DEFAULT_LOCATIONS;
  }, [scenario.data.locations]);

  // カード定義のマップを作成
  const cardDefinitionsMap = useMemo(() => {
    const map = new Map<string, CardDefinition>();
    if (scenario.data.cards) {
      scenario.data.cards.forEach((card) => {
        map.set(card.id, card);
      });
    }
    return map;
  }, [scenario.data.cards]);

  // プレイヤー名解決マップ（characterId → キャラ名）
  const playerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const characters = scenario.data.characters || [];
    for (const [uid, player] of Object.entries(game.players || {})) {
      const charDef = characters.find(c => c.id === player.characterId);
      const name = charDef?.name || player.displayName?.replace(/^AIエージェント: /, "") || uid;
      map.set(uid, name);
    }
    return map;
  }, [game.players, scenario.data.characters]);

  // 選択されたカードの定義を取得
  const selectedCard = selectedCardId ? cardDefinitionsMap.get(selectedCardId) : null;

  // カードが公開済みかどうか
  const isCardRevealed = (cardId: string) => {
    return game.cards?.[cardId]?.isRevealed ?? false;
  };

  // カードを所持しているかどうか（調査済み）
  const isCardOwned = (cardId: string) => {
    if (!currentUserId) return false;
    const cardState = game.cards?.[cardId];
    return cardState?.ownerId === currentUserId;
  };

  /**
   * ロケーション内のカード一覧を構築
   * シナリオのカード定義をベースに、game.cardsのランタイム状態をマージ
   */
  const getCardsDisplayInLocation = (locationId: string): CardDisplayInfo[] => {
    const result: CardDisplayInfo[] = [];

    // 1. シナリオのカード定義から、このロケーションに配置されたカードを取得
    if (scenario.data.cards) {
      for (const cardDef of scenario.data.cards) {
        if (cardDef.location !== locationId) continue;
        // Hand系はマップに表示しない
        if (cardDef.location.startsWith("Hand")) continue;

        const runtimeState = game.cards?.[cardDef.id];
        let status: CardStatus = "undiscovered";
        let ownerName: string | undefined;

        if (runtimeState) {
          if (runtimeState.isRevealed) {
            status = "revealed";
            if (runtimeState.ownerId) {
              ownerName = playerNameMap.get(runtimeState.ownerId) || runtimeState.ownerId;
            }
          } else if (runtimeState.ownerId) {
            status = runtimeState.ownerId === currentUserId ? "owned_by_me" : "owned_by_other";
            ownerName = playerNameMap.get(runtimeState.ownerId) || runtimeState.ownerId;
          }
        }

        result.push({
          cardId: cardDef.id,
          name: cardDef.name || cardDef.id,
          status,
          ownerName,
        });
      }
    }

    // 2. game.cardsから、このロケーションに直接割り当てられたカード（シナリオ定義にない場合の補完）
    for (const [cardId, cardState] of Object.entries(game.cards || {})) {
      if (cardState.location !== locationId) continue;
      // 既にシナリオ定義から追加済みならスキップ
      if (result.some(r => r.cardId === cardId)) continue;

      const cardDef = cardDefinitionsMap.get(cardId);
      let status: CardStatus = "undiscovered";
      let ownerName: string | undefined;

      if (cardState.isRevealed) {
        status = "revealed";
      } else if (cardState.ownerId) {
        status = cardState.ownerId === currentUserId ? "owned_by_me" : "owned_by_other";
        ownerName = playerNameMap.get(cardState.ownerId) || cardState.ownerId;
      }

      result.push({
        cardId,
        name: cardDef?.name || cardId,
        status,
        ownerName,
      });
    }

    return result;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 0.2, 0.5));
  };

  const handleResetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // カード右クリック
  const handleCardRightClick = (
    e: React.MouseEvent,
    cardId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      cardId,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  // カード公開状態を切り替え
  const handleToggleCardReveal = async (cardId: string) => {
    const card = game.cards?.[cardId];
    if (!card) return;

    if (!isCardOwned(cardId)) {
      toast.error("所持していないカードは操作できません", 2000);
      return;
    }

    try {
      const gameRef = doc(db, "games", game.id);
      await updateDoc(gameRef, {
        [`cards.${cardId}.isRevealed`]: !card.isRevealed,
      });

      if (card.isRevealed) {
        toast.info(`カードを非公開にしました`, 2000);
      } else {
        toast.success(`カードを公開しました`, 2000);
      }
    } catch (error) {
      console.error("Failed to toggle card reveal:", error);
      toast.error("カードの状態変更に失敗しました", 2000);
    }
  };

  // コンテキストメニューのアイテム
  const getContextMenuItems = (cardId: string): ContextMenuItem[] => {
    const card = game.cards?.[cardId];
    const cardDef = cardDefinitionsMap.get(cardId);
    const canInteract = card != null;

    const items: ContextMenuItem[] = [];

    // カードを見るは常に表示
    items.push({
      id: "view-secret",
      label: "カードを見る",
      icon: <Eye className="h-4 w-4" />,
      onClick: () => {
        if (cardDef) {
          setSelectedCardId(cardId);
        } else {
          toast.info(`カード「${cardId}」の詳細情報がありません`, 2000);
        }
      },
    });

    // 所持カードの公開切替
    if (canInteract && isCardOwned(cardId)) {
      items.push({
        id: "reveal",
        label: card!.isRevealed ? "非公開にする" : "全員に公開する",
        icon: card!.isRevealed ? <EyeOff className="h-4 w-4" /> : <Share2 className="h-4 w-4" />,
        onClick: () => handleToggleCardReveal(cardId),
      });
    }

    items.push({
      id: "info",
      label: "カード情報",
      icon: <Info className="h-4 w-4" />,
      onClick: () => {
        const info = [
          `カード: ${cardDef?.name || cardId}`,
          card ? `状態: ${card.isRevealed ? "公開済み" : card.ownerId ? "調査済み" : "未調査"}` : "状態: 未調査",
        ];
        toast.info(info.join("\n"), 3000);
      },
    });

    return items;
  };

  /** ステータスに応じた色を取得 */
  const getStatusColor = (status: CardStatus) => {
    switch (status) {
      case "revealed": return { bg: "rgba(217, 119, 6, 0.25)", border: "rgba(217, 119, 6, 0.8)", text: "rgba(251, 191, 36, 1)", icon: "rgba(251, 191, 36, 0.9)" };
      case "owned_by_me": return { bg: "rgba(34, 197, 94, 0.2)", border: "rgba(34, 197, 94, 0.7)", text: "rgba(134, 239, 172, 1)", icon: "rgba(34, 197, 94, 0.9)" };
      case "owned_by_other": return { bg: "rgba(99, 102, 241, 0.2)", border: "rgba(99, 102, 241, 0.7)", text: "rgba(165, 180, 252, 1)", icon: "rgba(99, 102, 241, 0.9)" };
      case "undiscovered":
      default: return { bg: "rgba(245, 230, 200, 0.08)", border: "rgba(245, 230, 200, 0.25)", text: "rgba(245, 230, 200, 0.6)", icon: "rgba(245, 230, 200, 0.4)" };
    }
  };

  /** ステータスアイコン（SVGテキスト） */
  const getStatusIcon = (status: CardStatus): string => {
    switch (status) {
      case "revealed": return "\u{1F4D6}"; // 📖
      case "owned_by_me": return "\u2705"; // ✅
      case "owned_by_other": return "\u{1F464}"; // 👤
      case "undiscovered":
      default: return "\u2753"; // ❓
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-ink-light to-primary">
      {/* コントロールパネル */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <Button variant="ghost" size="sm" onClick={handleZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleResetView}>
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Badge variant="outline" size="sm" className="text-xs">
          {Math.round(zoom * 100)}%
        </Badge>
      </div>

      {/* シナリオタイトル */}
      <div className="absolute top-4 right-4 z-10">
        <div className="rounded-lg border-2 border-paper/20 bg-ink/90 px-4 py-2 backdrop-blur-sm">
          <p className="font-serif text-sm font-semibold text-paper">
            {scenario.meta.title}
          </p>
        </div>
      </div>

      {/* 凡例 */}
      <div className="absolute top-16 right-4 z-10">
        <div className="rounded-lg border border-paper/15 bg-ink/85 px-3 py-2 backdrop-blur-sm space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">{getStatusIcon("undiscovered")}</span>
            <span className="text-[10px] text-paper/50">未調査</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">{getStatusIcon("owned_by_me")}</span>
            <span className="text-[10px] text-green-300">自分が調査済</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">{getStatusIcon("owned_by_other")}</span>
            <span className="text-[10px] text-indigo-300">他者が調査済</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">{getStatusIcon("revealed")}</span>
            <span className="text-[10px] text-amber-300">公開済み</span>
          </div>
        </div>
      </div>

      {/* マップ（SVG） */}
      <div
        className={cn(
          "h-full w-full",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1050 450"
          className="transition-transform"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          {/* レイヤー1: 背景画像 */}
          <image
            href={backgroundSrc}
            x="0"
            y="0"
            width="1050"
            height="450"
            preserveAspectRatio="xMidYMid slice"
            onError={() => {
              if (backgroundSrc !== DEFAULT_BACKGROUND_IMAGE) {
                setBackgroundSrc(DEFAULT_BACKGROUND_IMAGE);
              }
            }}
          />

          {/* レイヤー2: グリッド */}
          <defs>
            <pattern
              id="grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="rgba(245, 230, 200, 0.15)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="1050" height="450" fill="url(#grid)" />

          {/* ロケーション */}
          {locations.map((location) => {
            const cardsDisplay = getCardsDisplayInLocation(location.id);
            const pos = location.position!;

            return (
              <g key={location.id}>
                {/* 部屋の枠 */}
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.width}
                  height={pos.height}
                  fill={location.isCrimeScene ? "rgba(220, 38, 38, 0.1)" : "rgba(245, 230, 200, 0.05)"}
                  stroke={location.isCrimeScene ? "rgba(220, 38, 38, 0.5)" : "rgba(245, 230, 200, 0.3)"}
                  strokeWidth="2"
                  rx="8"
                  className="transition-all hover:fill-[rgba(245,230,200,0.1)] hover:stroke-[rgba(217,119,6,0.6)] cursor-pointer"
                />

                {/* 事件現場マーカー */}
                {location.isCrimeScene && (
                  <text
                    x={pos.x + pos.width - 10}
                    y={pos.y + 20}
                    fill="rgba(220, 38, 38, 0.9)"
                    fontSize="14"
                    textAnchor="end"
                  >
                    ⚠
                  </text>
                )}

                {/* 部屋名 */}
                <text
                  x={pos.x + pos.width / 2}
                  y={pos.y + 24}
                  fill="rgba(245, 230, 200, 0.9)"
                  fontSize="14"
                  fontFamily="serif"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {location.name}
                </text>

                {/* カード数カウンター */}
                {cardsDisplay.length > 0 && (
                  <text
                    x={pos.x + 12}
                    y={pos.y + 24}
                    fill="rgba(245, 230, 200, 0.5)"
                    fontSize="10"
                    textAnchor="start"
                  >
                    {cardsDisplay.length}件
                  </text>
                )}

                {/* 証拠カード一覧 */}
                {cardsDisplay.map((cardInfo, index) => {
                  const colors = getStatusColor(cardInfo.status);
                  const ROW_HEIGHT = 22;
                  const MAX_ROWS = Math.floor((pos.height - 40) / ROW_HEIGHT);
                  const cardY = pos.y + 38 + index * ROW_HEIGHT;

                  // 表示範囲を超える場合は「+N件」表示
                  if (index >= MAX_ROWS) {
                    if (index === MAX_ROWS) {
                      return (
                        <text
                          key="overflow"
                          x={pos.x + pos.width / 2}
                          y={cardY}
                          fill="rgba(245, 230, 200, 0.5)"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          +{cardsDisplay.length - MAX_ROWS}件...
                        </text>
                      );
                    }
                    return null;
                  }

                  // カード名を短縮（幅に収まるよう）
                  const maxNameLen = Math.floor((pos.width - 50) / 8);
                  const displayName = cardInfo.name.length > maxNameLen
                    ? cardInfo.name.slice(0, maxNameLen) + "…"
                    : cardInfo.name;

                  return (
                    <g
                      key={cardInfo.cardId}
                      onContextMenu={(e) => handleCardRightClick(e as any, cardInfo.cardId)}
                      onClick={() => {
                        const cardDef = cardDefinitionsMap.get(cardInfo.cardId);
                        if (cardDef) setSelectedCardId(cardInfo.cardId);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      {/* カード背景 */}
                      <rect
                        x={pos.x + 8}
                        y={cardY - 12}
                        width={pos.width - 16}
                        height={ROW_HEIGHT - 3}
                        rx="3"
                        fill={colors.bg}
                        stroke={colors.border}
                        strokeWidth="0.8"
                        className="transition-all"
                      />
                      {/* ステータスアイコン */}
                      <text
                        x={pos.x + 16}
                        y={cardY}
                        fontSize="10"
                        textAnchor="start"
                      >
                        {getStatusIcon(cardInfo.status)}
                      </text>
                      {/* カード名 */}
                      <text
                        x={pos.x + 30}
                        y={cardY}
                        fill={colors.text}
                        fontSize="10"
                        fontFamily="sans-serif"
                        textAnchor="start"
                      >
                        {displayName}
                      </text>
                      {/* オーナー名（調査済みの場合） */}
                      {cardInfo.ownerName && (
                        <text
                          x={pos.x + pos.width - 14}
                          y={cardY}
                          fill={colors.text}
                          fontSize="8"
                          fontFamily="sans-serif"
                          textAnchor="end"
                          opacity="0.7"
                        >
                          {cardInfo.ownerName.length > 4 ? cardInfo.ownerName.slice(0, 4) + "…" : cardInfo.ownerName}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 操作ガイド */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-lg border-2 border-paper/20 bg-ink/90 px-4 py-2 backdrop-blur-sm">
        <p className="text-xs text-paper/70">
          ドラッグで移動 / カードをクリックで詳細 / 右クリックで操作
        </p>
      </div>

      {/* コンテキストメニュー */}
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            items={getContextMenuItems(contextMenu.cardId)}
            position={contextMenu.position}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>

      {/* カード詳細モーダル */}
      {selectedCard && currentUserId && (
        <CardDetailModal
          card={selectedCard}
          gameId={game.id}
          currentUserId={currentUserId}
          isRevealed={isCardRevealed(selectedCardId!)}
          isOwned={isCardOwned(selectedCardId!)}
          onClose={() => setSelectedCardId(null)}
        />
      )}
    </div>
  );
});
