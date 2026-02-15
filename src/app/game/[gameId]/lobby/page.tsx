"use client";

/**
 * Game Lobby Page
 * ゲームロビー（待機室）
 */

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  Users,
  MessageSquare,
  Play,
  Settings,
  Copy,
  Check,
  Crown,
  AlertCircle,
  UserPlus,
  BookOpen,
} from "lucide-react";
import type { GameState, Scenario } from "@/core/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Textarea,
} from "@/components";
import { PlayerCard } from "@/components/molecules/PlayerCard";

type PageProps = {
  params: Promise<{ gameId: string }>;
};

export default function LobbyPage({ params }: PageProps) {
  const { gameId } = use(params);
  const router = useRouter();

  const { userId, loading: authLoading } = useAuth();
  const currentUserId = userId || "";

  // ゲームとシナリオデータ（APIから取得）
  const [game, setGame] = useState<GameState | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [chatMessage, setChatMessage] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ player: string; message: string }>>([
    { player: "システム", message: "ロビーへようこそ！" },
    { player: "あなた", message: "よろしくお願いします！" },
  ]);
  const [isCopied, setIsCopied] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // APIからゲームとシナリオを取得
  useEffect(() => {
    const fetchGameData = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(`/api/game/${gameId}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("ゲームが見つかりません");
          }
          throw new Error("データの取得に失敗しました");
        }

        const data = await response.json();
        setGame(data.game);
        setScenario(data.scenario);

        // 初期準備完了状態を設定
        if (data.game.players[currentUserId]) {
          setIsReady(data.game.players[currentUserId].isReady);
        }
      } catch (error) {
        console.error("[Lobby] Failed to load game:", error);
        setLoadError(error instanceof Error ? error.message : "データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameData();
  }, [gameId, currentUserId]);

  // 認証ローディング中
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center ink-bg px-6">
        <Card variant="parchment" className="max-w-md text-center parchment-card">
          <CardContent className="py-16">
            <BookOpen className="mx-auto mb-4 h-16 w-16 animate-pulse text-ink-brown/30" />
            <p className="text-ink-brown">認証を確認しています...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 未認証
  if (!userId) {
    return (
      <div className="flex min-h-screen items-center justify-center ink-bg px-6">
        <Card variant="parchment" className="max-w-md text-center parchment-card">
          <CardContent className="py-16">
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-gold-accent" />
            <h1 className="mb-4 font-title text-2xl font-bold text-ink-black">
              サインインが必要です
            </h1>
            <p className="mb-6 font-body text-ink-brown">
              ゲームに参加するにはサインインしてください。
            </p>
            <Link href={`/auth/signin?redirect=/game/${gameId}/lobby`}>
              <Button variant="seal" className="gold-button">
                サインインする
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ローディング中
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center ink-bg px-6">
        <Card variant="parchment" className="max-w-md text-center parchment-card">
          <CardContent className="py-16">
            <BookOpen className="mx-auto mb-4 h-16 w-16 animate-pulse text-ink-brown/30" />
            <p className="text-ink-brown">ロビーを準備しています...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // エラーまたはデータなし
  if (loadError || !game || !scenario) {
    return (
      <div className="flex min-h-screen items-center justify-center ink-bg px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card variant="parchment" className="max-w-md text-center parchment-card border-2 border-blood-red/50">
            <CardContent className="py-16">
              <motion.div
                animate={{
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <AlertCircle className="mx-auto mb-4 h-16 w-16 text-blood-red candle-glow" />
              </motion.div>
              <h1 className="mb-4 font-title text-2xl font-bold text-ink-black">
                迷い込んだようだ...
              </h1>
              <p className="mb-6 font-body text-ink-brown">
                指定されたゲームは存在しないか、既に物語は幕を閉じた可能性があります。
              </p>
              <Link href="/library">
                <Button variant="seal" className="gold-button">
                  📚 書庫に戻る
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(gameId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return;
    setChatLog([...chatLog, { player: "あなた", message: chatMessage }]);
    setChatMessage("");
  };

  const handleToggleReady = async () => {
    try {
      const response = await fetch(`/api/game/${gameId}/toggle-ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: currentUserId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "準備状態の切り替えに失敗しました");
      }

      const data = await response.json();
      setIsReady(data.isReady);
    } catch (error) {
      console.error("Failed to toggle ready:", error);
      alert(error instanceof Error ? error.message : "準備状態の切り替えに失敗しました");
    }
  };

  const handleStartGame = async () => {
    setIsStarting(true);

    try {
      // APIでゲームを開始（AIキャラクター自動割り当て含む）
      const response = await fetch(`/api/game/${gameId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: currentUserId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "ゲームの開始に失敗しました");
      }

      // ゲーム画面に遷移
      router.push(`/game/${gameId}`);
    } catch (error) {
      console.error("Failed to start game:", error);
      alert(error instanceof Error ? error.message : "ゲームの開始に失敗しました");
      setIsStarting(false);
    }
  };

  const players = Object.entries(game.players);
  const isHost = game.hostId === currentUserId;

  // 人間プレイヤーのみの準備完了を確認（AIは常に準備完了なので除外）
  const humanPlayers = players.filter(([_, p]) => p.isHuman);
  const allHumanPlayersReady = humanPlayers.every(([_, p]) => p.isReady);

  return (
    <div className="min-h-screen ink-bg px-6 py-12">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 text-center"
        >
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              rotate: [0, 2, -2, 0]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-block mb-4"
          >
            <h1 className="font-title text-5xl font-bold text-parchment-light candle-glow">
              🏰 待機の間
            </h1>
          </motion.div>
          <p className="mt-2 font-body text-parchment-light/70">
            全員の準備が整ったら、物語が始まります
          </p>
          <div className="mt-4">
            <Badge variant="primary" size="lg" className="bg-gold-accent/20 border-gold-accent/50 text-gold-accent font-title">
              📖 {scenario.meta.title}
            </Badge>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left - Players */}
          <div className="space-y-6 lg:col-span-1">
            {/* Room Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card variant="parchment" className="parchment-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-title text-ink-black">
                    <Settings className="h-5 w-5 text-gold-accent" />
                    部屋情報
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <p className="mb-2 text-xs font-body text-ink-brown/70 flex items-center gap-1">
                      <span>🔑</span> 部屋ID
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-lg bg-ink-black/10 px-3 py-2 font-mono text-xs text-ink-black border border-gold-accent/20">
                        {gameId}
                      </code>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleCopyRoomId}
                        className="p-2 rounded-lg border border-gold-accent/30 hover:bg-gold-accent/10 transition-colors"
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4 text-emerald-accent" />
                        ) : (
                          <Copy className="h-4 w-4 text-gold-accent" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-body text-ink-brown/70 flex items-center gap-1">
                      <Crown className="h-3 w-3 text-gold-accent" /> ホスト
                    </p>
                    <p className="font-title font-semibold text-ink-black">
                      {game.players[game.hostId]?.displayName || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-body text-ink-brown/70 flex items-center gap-1">
                      <Users className="h-3 w-3 text-gold-accent" /> 参加者
                    </p>
                    <p className="font-title font-semibold text-ink-black">
                      {players.length}名 <span className="text-gold-accent">/</span> {scenario.data.characters.length}名
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Players List */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card variant="dark" className="book-card bg-ink-black/90 border-2 border-gold-accent/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-title text-parchment-light">
                    <Users className="h-5 w-5 text-gold-accent candle-glow" />
                    登場人物 ({players.length}名)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {players.map(([playerId, player], index) => {
                    const character = scenario.data.characters.find(
                      (c) => c.id === player.characterId
                    );

                    return (
                      <PlayerCard
                        key={playerId}
                        playerId={playerId}
                        displayName={player.displayName}
                        isHuman={player.isHuman}
                        isHost={playerId === game.hostId}
                        isReady={player.isReady}
                        isOnline={player.isOnline}
                        character={character}
                        index={index}
                      />
                    );
                  })}

                  {/* Empty Slots */}
                  {players.length < scenario.data.characters.length && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: players.length * 0.1 }}
                      className="rounded-lg border-2 border-dashed border-gold-accent/30 bg-parchment-texture/5 p-4 text-center"
                    >
                      <UserPlus className="mx-auto mb-2 h-6 w-6 text-gold-accent/60 candle-glow" />
                      <p className="text-sm font-body text-parchment-light/70">
                        あと {scenario.data.characters.length - players.length}名が参加可能
                      </p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right - Chat */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <Card variant="dark" className="h-[600px] flex flex-col book-card bg-ink-black/90 border-2 border-gold-accent/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-title text-parchment-light">
                    <MessageSquare className="h-5 w-5 text-gold-accent candle-glow" />
                    待機室の書簡
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                  <div className="space-y-3">
                    {chatLog.map((log, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`rounded-lg border-2 p-3 ${
                          log.player === "あなた"
                            ? "bg-gold-accent/10 border-gold-accent/30"
                            : "bg-parchment-texture/10 border-parchment-dark/30"
                        }`}
                      >
                        <p className="mb-1 text-xs font-title font-semibold text-parchment-light/70">
                          {log.player === "システム" ? "📜" : log.player === "あなた" ? "✒️" : "💬"} {log.player}
                        </p>
                        <p className="text-sm font-body text-parchment-light">{log.message}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="border-t-2 border-gold-accent/30 pt-4">
                  <div className="flex w-full gap-3">
                    <Input
                      placeholder="インクを紙に滲ませる... (Enterで送信)"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="flex-1 bg-parchment-light/10 border-gold-accent/30 text-parchment-light font-body"
                    />
                    <Button variant="seal" onClick={handleSendMessage} className="gold-button">
                      送信
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            </motion.div>

            {/* Start Game Button */}
            {isHost && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-6"
              >
                <Card variant="parchment" className="parchment-card border-2 border-gold-accent/50">
                  <CardContent className="flex items-center justify-between py-6">
                    <div className="flex-1">
                      <p className="font-title text-lg font-semibold text-ink-black flex items-center gap-2">
                        <Play className="h-5 w-5 text-gold-accent candle-glow" />
                        物語を紡ぐ
                      </p>
                      <p className="text-sm font-body text-ink-brown mt-1">
                        {allHumanPlayersReady
                          ? `✨ 全員の準備が整いました！（人間 ${humanPlayers.length}名 + AI ${players.length - humanPlayers.length}名）`
                          : `⏳ 人間プレイヤーの準備完了を待っています... (${humanPlayers.filter(([_, p]) => p.isReady).length}/${humanPlayers.length})`}
                      </p>
                    </div>
                    <motion.div
                      animate={allHumanPlayersReady ? {
                        scale: [1, 1.05, 1],
                      } : {}}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <Button
                        variant="seal"
                        size="lg"
                        onClick={handleStartGame}
                        disabled={!allHumanPlayersReady}
                        isLoading={isStarting}
                        className={allHumanPlayersReady ? "gold-button" : ""}
                      >
                        <Play className="mr-2 h-5 w-5" />
                        {isStarting ? "物語が始まる..." : "ゲーム開始"}
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Ready Button for Non-Host */}
            {!isHost && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-6"
              >
                <Card variant="parchment" className={`parchment-card border-2 ${isReady ? "border-emerald-accent/50" : "border-gold-accent/50"}`}>
                  <CardContent className="flex items-center justify-between py-6">
                    <div className="flex-1">
                      <p className="font-title text-lg font-semibold text-ink-black flex items-center gap-2">
                        {isReady ? (
                          <>
                            <Check className="h-5 w-5 text-emerald-accent candle-glow" />
                            準備完了
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-gold-accent candle-glow" />
                            準備待機中
                          </>
                        )}
                      </p>
                      <p className="text-sm font-body text-ink-brown mt-1">
                        {isReady
                          ? "✨ 準備完了しました。ホストの開始を待っています"
                          : "📝 準備ができたらボタンを押してください"}
                      </p>
                    </div>
                    <motion.div
                      animate={isReady ? {} : {
                        scale: [1, 1.05, 1],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <Button
                        variant={isReady ? "outline" : "seal"}
                        size="lg"
                        onClick={handleToggleReady}
                        className={isReady ? "border-emerald-accent text-emerald-accent" : "gold-button"}
                      >
                        <Check className="mr-2 h-5 w-5" />
                        {isReady ? "準備完了済み" : "準備完了"}
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
