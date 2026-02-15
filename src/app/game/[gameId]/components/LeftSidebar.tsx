"use client";

/**
 * Left Sidebar (Unified)
 * 左サイドバー（秘密情報・公開情報を統合）
 */

import { useState, useEffect, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, User, Lock, Users as UsersIcon, CreditCard, Eye, BookOpen, Clock, FileText, Brain, AlertTriangle, Target, ArrowRightLeft } from "lucide-react";
import type { GameState, Scenario, CardDefinition } from "@/core/types";
import { Card, CardHeader, CardTitle, CardContent, Badge, Tabs } from "@/components";
import type { Tab } from "@/components";
import { CardDetailModal } from "./CardDetailModal";

/**
 * カード場所表示を解決（"Hand(playerId)" → "○○の手元"、locationId → 場所名）
 */
function resolveLocationDisplay(
  location: string,
  game: GameState,
  scenario: Scenario
): string {
  // "Hand(playerId)" パターンの解析
  const handMatch = location.match(/^Hand\((.+)\)$/);
  if (handMatch) {
    const playerId = handMatch[1];
    const player = game.players[playerId];
    if (player?.characterId) {
      const charDef = scenario.data.characters.find(c => c.id === player.characterId);
      return charDef ? `${charDef.name}の手元` : "手元";
    }
    return "手元";
  }
  // "Hand" のみの場合
  if (location === "Hand") return "手元";
  // ロケーションIDの場合 → シナリオから名前を解決
  const locDef = scenario.data.locations?.find(l => l.id === location);
  return locDef?.name || location;
}

/**
 * カード所有者表示をキャラクター名で解決
 */
function resolveOwnerDisplay(
  ownerId: string,
  game: GameState,
  scenario: Scenario
): string {
  const player = game.players[ownerId];
  if (player?.characterId) {
    const charDef = scenario.data.characters.find(c => c.id === player.characterId);
    return charDef?.name || "不明";
  }
  return "不明";
}

interface MemoryStats {
  totalCards: number;
  knownCards: number;
  unknownCards: number;
  totalFacts: number;
  contradictionsFound: number;
  unresolvedContradictions: number;
  relationshipsTracked: number;
  averageSuspicion: number;
  mostSuspiciousCharacter?: string;
}

interface LeftSidebarProps {
  game: GameState;
  scenario: Scenario;
  currentUserId: string;
  onClose: () => void;
}

export const LeftSidebar = memo(function LeftSidebar({
  game,
  scenario,
  currentUserId,
  onClose,
}: LeftSidebarProps) {
  const currentPlayer = game.players[currentUserId];
  const character = scenario.data.characters.find(
    (c) => c.id === currentPlayer?.characterId
  );

  // 記憶統計（AIエージェントのみ）
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [loadingMemory, setLoadingMemory] = useState(false);

  // カード詳細モーダル
  const [selectedCard, setSelectedCard] = useState<CardDefinition | null>(null);

  // アイテム譲渡
  const [transferCardId, setTransferCardId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);

  const handleTransferItem = useCallback(async (cardId: string, toPlayerId: string) => {
    setTransferring(true);
    try {
      const res = await fetch(`/api/game/${game.id}/transfer-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId,
          fromPlayerId: currentUserId,
          toPlayerId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTransferCardId(null);
      }
    } catch (err) {
      console.error("Transfer failed:", err);
    } finally {
      setTransferring(false);
    }
  }, [game.id, currentUserId]);

  // AIエージェントの場合、記憶統計を取得
  useEffect(() => {
    if (currentPlayer && !currentPlayer.isHuman) {
      const agentId = `agent_${currentUserId}`;
      setLoadingMemory(true);

      fetch(`/api/agent/memory/stats?gameId=${game.id}&agentId=${agentId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setMemoryStats(data.stats);
          }
        })
        .catch((err) => console.error("Failed to fetch memory stats:", err))
        .finally(() => setLoadingMemory(false));
    }
  }, [game.id, currentUserId, currentPlayer?.isHuman]);

  // 所持カード
  const handCards = Object.entries(game.cards || {}).filter(
    ([_, card]) => card.location === `Hand(${currentUserId})`
  );

  // 関係性（疑惑度）
  const relationships = game.humanShadowState?.[currentUserId]?.relationships || {};

  // 公開済みカード
  const revealedCards = Object.entries(game.cards || {}).filter(
    ([_, card]) => card.isRevealed
  );

  const tabs: Tab[] = [
    {
      id: "handout",
      label: "ハンドアウト",
      icon: <FileText className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          {/* キャラクター情報（詳細版） */}
          <Card variant="parchment">
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-ink" />
                <CardTitle className="text-lg">あなたのキャラクター</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {character ? (
                <>
                  <div>
                    <p className="text-sm font-semibold text-ink">{character.name}</p>
                    <p className="text-xs text-ink/60">{character.job}</p>
                  </div>
                  <div className="my-3 h-px bg-ink/20" />
                  <p className="text-sm text-ink/80 leading-relaxed">
                    {character.description}
                  </p>
                </>
              ) : (
                <p className="text-sm text-ink/60">キャラクターが未選択です</p>
              )}
            </CardContent>
          </Card>

          {/* 秘密の情報（ハンドアウト版） */}
          <Card variant="dark">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-accent-red" />
                <CardTitle className="text-lg">秘密</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 🎯 秘密の目標 */}
              {character?.handout?.secretGoal && (
                <div className="rounded-lg border-2 border-accent-gold/50 bg-accent-gold/10 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-accent-gold" />
                    <p className="text-sm font-bold text-accent-gold">あなたの目標</p>
                  </div>
                  <p className="text-sm text-paper font-semibold">
                    {character.handout.secretGoal}
                  </p>
                </div>
              )}
              {/* 秘密情報 */}
              <p className="text-sm text-paper/80 leading-relaxed whitespace-pre-wrap">
                {character?.secretInfo || "秘密の情報がありません"}
              </p>
            </CardContent>
          </Card>

          {/* 他のキャラクター */}
          <Card variant="parchment">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-ink" />
                <CardTitle className="text-lg">他のキャラクター</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {scenario.data.characters
                .filter((c) => c.id !== character?.id)
                .map((char) => (
                  <div
                    key={char.id}
                    className="rounded-lg border-2 border-ink/10 bg-ink/5 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">{char.name}</p>
                      <Badge variant="outline" size="sm">
                        {char.job}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink/60 leading-relaxed">
                      {char.handout.publicInfo}
                    </p>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "private",
      label: "所持品・関係性",
      icon: <CreditCard className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          {/* 所持カード */}
          <Card variant="parchment">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-ink" />
                <CardTitle className="text-lg">所持カード</CardTitle>
                <Badge variant="outline" size="sm">{handCards.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {handCards.length > 0 ? (
                <div className="space-y-2">
                  {handCards.map(([cardId, cardState]) => {
                    // シナリオからカード定義を取得
                    const cardDef = scenario.data.cards.find(c => c.id === cardId);
                    if (!cardDef) return null;

                    return (
                      <div
                        key={cardId}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedCard(cardDef)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedCard(cardDef); }}
                        className="w-full text-left rounded-lg border-2 border-ink/20 bg-ink/5 p-3 transition-all hover:border-accent-gold/50 hover:bg-accent-gold/5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-ink">{cardDef.name}</p>
                          {cardState.isRevealed ? (
                            <Badge variant="success" size="sm">
                              <Eye className="h-3 w-3 mr-1" />
                              公開済み
                            </Badge>
                          ) : (
                            <Badge variant="outline" size="sm">
                              非公開
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-ink/60 mt-1">
                          {cardDef.type === "evidence" ? "証拠品" : cardDef.type === "information" ? "情報" : "物品"}
                        </p>
                        {/* カード説明文（短縮） */}
                        <p className="text-xs text-ink/70 mt-2 line-clamp-2">
                          {cardDef.secret.description}
                        </p>
                        <p className="text-xs text-accent-gold/80 mt-1">
                          クリックで詳細を表示
                        </p>
                        {/* Phase B-3: アイテム譲渡ボタン */}
                        {cardState.isTransferable && game.phase.startsWith("discussion") && !cardState.isRevealed && (
                          <div className="mt-2 border-t border-ink/10 pt-2" onClick={(e) => e.stopPropagation()}>
                            {transferCardId === cardId ? (
                              <div className="space-y-1">
                                <p className="text-xs text-ink/60">渡す相手を選択:</p>
                                {Object.entries(game.players)
                                  .filter(([pid]) => pid !== currentUserId)
                                  .map(([pid, p]) => {
                                    const targetChar = scenario.data.characters.find(c => c.id === p.characterId);
                                    return (
                                      <button
                                        key={pid}
                                        disabled={transferring}
                                        onClick={() => handleTransferItem(cardId, pid)}
                                        className="w-full text-left text-xs px-2 py-1 rounded bg-accent-gold/10 hover:bg-accent-gold/20 transition-colors disabled:opacity-50"
                                      >
                                        {targetChar?.name || p.displayName}
                                      </button>
                                    );
                                  })}
                                <button
                                  onClick={() => setTransferCardId(null)}
                                  className="text-xs text-ink/40 hover:text-ink/60"
                                >
                                  キャンセル
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setTransferCardId(cardId)}
                                className="flex items-center gap-1 text-xs text-accent-gold/70 hover:text-accent-gold transition-colors"
                              >
                                <ArrowRightLeft className="h-3 w-3" />
                                渡す
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink/60">カードを所持していません</p>
              )}
            </CardContent>
          </Card>

          {/* 関係性グラフ */}
          <Card variant="dark">
            <CardHeader>
              <div className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-paper" />
                <CardTitle className="text-lg">関係性・疑惑度</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {Object.keys(relationships).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(relationships).map(([playerId, rel]) => {
                    const targetPlayer = game.players[playerId];
                    const targetChar = scenario.data.characters.find(
                      (c) => c.id === targetPlayer?.characterId
                    );

                    return (
                      <div key={playerId} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-paper">
                            {targetChar?.name || "不明"}
                          </p>
                          <Badge
                            variant={
                              rel.estimatedSuspicion > 70
                                ? "danger"
                                : rel.estimatedSuspicion > 40
                                ? "warning"
                                : "success"
                            }
                            size="sm"
                          >
                            {rel.estimatedSuspicion}%
                          </Badge>
                        </div>
                        <div className="h-2 w-full rounded-full bg-paper/20 overflow-hidden">
                          <div
                            className="h-full bg-accent-red transition-all"
                            style={{ width: `${rel.estimatedSuspicion}%` }}
                          />
                        </div>
                        <p className="text-xs text-paper/60">{rel.reason}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-paper/60">関係性情報がありません</p>
              )}
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: "public",
      label: "公開情報",
      icon: <Eye className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          {/* 証拠 */}
          <Card variant="parchment">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-ink" />
                <CardTitle className="text-lg">公開済み証拠</CardTitle>
                <Badge variant="outline" size="sm">{revealedCards.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {revealedCards.length > 0 ? (
                <div className="space-y-2">
                  {revealedCards.map(([cardId, cardState]) => {
                    // シナリオからカード定義を取得
                    const cardDef = scenario.data.cards.find(c => c.id === cardId);
                    if (!cardDef) return null;

                    return (
                      <button
                        key={cardId}
                        onClick={() => setSelectedCard(cardDef)}
                        className="w-full text-left rounded-lg border-2 border-ink/20 bg-ink/5 p-3 transition-all hover:border-accent-gold/50 hover:bg-accent-gold/5 cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-sm font-semibold text-ink">{cardDef.name}</p>
                          <Badge variant="success" size="sm">
                            公開済み
                          </Badge>
                        </div>
                        <p className="text-xs text-ink/60 mt-1">場所: {resolveLocationDisplay(cardState.location, game, scenario)}</p>
                        {cardState.ownerId && (
                          <p className="text-xs text-ink/60">
                            所有者: {resolveOwnerDisplay(cardState.ownerId, game, scenario)}
                          </p>
                        )}
                        {/* 公開カード説明文（短縮） */}
                        <p className="text-xs text-ink/70 mt-2 line-clamp-2">
                          {cardDef.secret.description}
                        </p>
                        <p className="text-xs text-accent-gold/80 mt-1">
                          クリックで詳細を表示
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink/60">まだ公開された証拠がありません</p>
              )}
            </CardContent>
          </Card>

          {/* シナリオ情報 */}
          <Card variant="parchment">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-ink" />
                <CardTitle className="text-lg">{scenario.meta.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-ink/80 leading-relaxed">
                {scenario.meta.description}
              </p>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-ink/10">
                <div>
                  <p className="text-xs text-ink/60">難易度</p>
                  <Badge
                    variant={
                      scenario.meta.difficulty === "easy"
                        ? "success"
                        : scenario.meta.difficulty === "normal"
                        ? "warning"
                        : "danger"
                    }
                    size="sm"
                    className="mt-1"
                  >
                    {scenario.meta.difficulty === "easy"
                      ? "初級"
                      : scenario.meta.difficulty === "normal"
                      ? "中級"
                      : "上級"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-ink/60">想定時間</p>
                  <p className="text-sm font-semibold text-ink mt-1">
                    {scenario.meta.playTimeMin}分
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-ink/10">
                <p className="text-xs text-ink/60 mb-2">登場人物</p>
                <div className="space-y-1">
                  {scenario.data.characters.map((char) => (
                    <p key={char.id} className="text-sm text-ink">
                      • {char.name} ({char.job})
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* タイムライン */}
          <Card variant="dark">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-paper" />
                <CardTitle className="text-lg">事件のタイムライン</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 自分のタイムライン */}
              {character?.handout.timeline && character.handout.timeline.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-paper/80">あなたの行動</p>
                  <div className="space-y-2">
                    {character.handout.timeline.map((item, index) => (
                      <div
                        key={index}
                        className="flex gap-3 rounded-lg border-2 border-accent-gold/30 bg-accent-gold/10 p-2"
                      >
                        <div className="flex-shrink-0 w-16 text-xs font-semibold text-paper">
                          {item.split(" - ")[0]}
                        </div>
                        <div className="flex-1 text-xs text-paper/80">
                          {item.split(" - ")[1]}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 公開されたタイムライン（TODO: 今後実装） */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-paper/80">判明している事実</p>
                <div className="space-y-2">
                  <div className="flex gap-3 rounded-lg border-2 border-paper/20 bg-paper/5 p-2">
                    <div className="flex-shrink-0 w-16 text-xs font-semibold text-paper">
                      18:00
                    </div>
                    <div className="flex-1 text-xs text-paper/60">
                      晩餐会が開始される
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border-2 border-paper/20 bg-paper/5 p-2">
                    <div className="flex-shrink-0 w-16 text-xs font-semibold text-paper">
                      19:30
                    </div>
                    <div className="flex-1 text-xs text-paper/60">
                      当主が書斎に戻る
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-lg border-2 border-paper/20 bg-paper/5 p-2">
                    <div className="flex-shrink-0 w-16 text-xs font-semibold text-paper">
                      20:15
                    </div>
                    <div className="flex-1 text-xs text-paper/60">
                      遺体が発見される
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ),
    },
    // 記憶タブ（AIエージェントのみ）
    ...(currentPlayer && !currentPlayer.isHuman ? [{
      id: "memory",
      label: "記憶",
      icon: <Brain className="h-4 w-4" />,
      content: (
        <div className="space-y-4">
          {loadingMemory ? (
            <Card variant="dark">
              <CardContent className="p-8 text-center text-paper/60">
                記憶データを読み込み中...
              </CardContent>
            </Card>
          ) : memoryStats ? (
            <>
              {/* 記憶統計 */}
              <Card variant="dark">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-accent" />
                    <CardTitle className="text-lg">記憶統計</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <p className="text-xs text-paper/60">カード知識</p>
                      <p className="text-2xl font-bold text-paper">
                        {memoryStats.knownCards}/{memoryStats.totalCards}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-paper/60">既知の事実</p>
                      <p className="text-2xl font-bold text-paper">
                        {memoryStats.totalFacts}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-paper/60">矛盾検出</p>
                      <p className="text-2xl font-bold text-accent-red">
                        {memoryStats.contradictionsFound}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-paper/60">関係性追跡</p>
                      <p className="text-2xl font-bold text-paper">
                        {memoryStats.relationshipsTracked}
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-paper/20">
                    <p className="text-xs text-paper/60 mb-2">平均疑惑度</p>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-3 rounded-full bg-paper/20 overflow-hidden">
                        <div
                          className="h-full bg-accent-red transition-all"
                          style={{ width: `${memoryStats.averageSuspicion}%` }}
                        />
                      </div>
                      <p className="text-sm font-bold text-paper">
                        {Math.round(memoryStats.averageSuspicion)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 未解決の矛盾 */}
              {memoryStats.unresolvedContradictions > 0 && (
                <Card variant="dark" className="border-accent-red">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-accent-red" />
                      <CardTitle className="text-lg">未解決の矛盾</CardTitle>
                      <Badge variant="danger" size="sm">
                        {memoryStats.unresolvedContradictions}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-paper/80">
                      {memoryStats.unresolvedContradictions}件の矛盾が見つかっています。
                      誰かが嘘をついているかもしれません。
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 最も疑わしいキャラクター */}
              {memoryStats.mostSuspiciousCharacter && (
                <Card variant="parchment">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-ink" />
                      <CardTitle className="text-lg">最も疑わしい人物</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm font-semibold text-ink">
                      {scenario.data.characters.find(
                        (c) => c.id === memoryStats.mostSuspiciousCharacter
                      )?.name || "不明"}
                    </p>
                    <p className="text-xs text-ink/60 mt-1">
                      現在の推理では、この人物が最も疑わしいと判断しています。
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card variant="dark">
              <CardContent className="p-8 text-center text-paper/60">
                記憶データがありません
              </CardContent>
            </Card>
          )}
        </div>
      ),
    }] : []),
  ];

  return (
    <motion.div
      initial={{ x: "-100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "-100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed left-0 top-16 bottom-0 z-40 w-96 border-r-2 border-gold-accent/30 ink-bg backdrop-blur-md overflow-y-auto shadow-2xl"
    >
      <div className="p-6 space-y-6">
        {/* 閉じるボタン */}
        <div className="flex items-center justify-between">
          <h2 className="font-title text-2xl font-bold text-parchment-light candle-glow">
            📜 情報
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-parchment-light/70 transition-all duration-300 hover:bg-gold-accent/20 hover:text-parchment-light hover:scale-110"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* タブ */}
        <Tabs tabs={tabs} defaultTab="handout" />
      </div>

      {/* カード詳細モーダル */}
      <AnimatePresence>
        {selectedCard && (
          <CardDetailModal
            card={selectedCard}
            gameId={game.id}
            currentUserId={currentUserId}
            isRevealed={game.cards[selectedCard.id]?.isRevealed || false}
            isOwned={game.cards[selectedCard.id]?.ownerId === currentUserId}
            locations={scenario.data.locations}
            onClose={() => setSelectedCard(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
});
