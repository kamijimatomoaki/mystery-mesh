"use client";

/**
 * Join Game Page
 * ルームID参加ページ
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { LogIn, AlertCircle, Home, Users, Clock } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Badge,
} from "@/components";

interface GameSearchResult {
  game: {
    id: string;
    phase: string;
    isPrivate: boolean;
    currentPlayerCount: number;
    humanPlayerCount: number;
    aiPlayerCount: number;
    maxPlayers: number;
    canJoin: boolean;
  };
  scenario: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    genre: string;
    characterCount: number;
  };
}

export default function JoinGamePage() {
  const router = useRouter();
  const { userId, displayName, isAuthenticated, loading: authLoading, signInAsGuest } = useAuth();

  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [foundGame, setFoundGame] = useState<GameSearchResult | null>(null);

  /**
   * ゲームを検索
   */
  const handleSearch = async () => {
    if (!roomId.trim()) {
      setErrorMessage("ルームIDを入力してください");
      return;
    }

    setErrorMessage(null);
    setIsSearching(true);
    setFoundGame(null);

    try {
      const response = await fetch(`/api/game/search?gameId=${encodeURIComponent(roomId.trim())}`);
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          setErrorMessage("指定されたルームIDのゲームが見つかりませんでした");
        } else {
          setErrorMessage(data.error || "ゲームの検索に失敗しました");
        }
        return;
      }

      if (!data.game.canJoin) {
        if (data.game.phase !== "lobby") {
          setErrorMessage("このゲームは既に開始されています");
        } else {
          setErrorMessage("このゲームは定員に達しています");
        }
        // ゲーム情報は表示するが参加不可
        setFoundGame(data);
        return;
      }

      setFoundGame(data);
    } catch (error) {
      console.error("Search error:", error);
      setErrorMessage("ネットワークエラーが発生しました");
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * ゲームに参加
   */
  const handleJoin = async () => {
    if (!foundGame) return;

    // 認証チェック
    if (!isAuthenticated) {
      // 未認証の場合はゲストとしてサインイン
      try {
        await signInAsGuest();
      } catch (error) {
        setErrorMessage("ゲストログインに失敗しました");
        return;
      }
    }

    // パスワードチェック（非公開部屋の場合）
    if (foundGame.game.isPrivate && !password.trim()) {
      setErrorMessage("パスワードを入力してください");
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/game/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: foundGame.game.id,
          playerId: userId,
          playerName: displayName || "ゲスト",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "ゲームへの参加に失敗しました");
        return;
      }

      // キャラクター選択画面に遷移
      router.push(`/game/${foundGame.game.id}/setup`);
    } catch (error) {
      console.error("Join error:", error);
      setErrorMessage("ネットワークエラーが発生しました");
    } finally {
      setIsJoining(false);
    }
  };

  // 認証ローディング中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ink via-ink-light to-primary px-6 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-paper mx-auto mb-4" />
          <p className="text-paper/70">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-ink-light to-primary px-6 pt-24 pb-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 text-center"
        >
          <h1 className="font-serif text-4xl font-bold text-paper">
            ゲームに参加
          </h1>
          <p className="mt-2 text-paper/70">
            友達から送られたルームIDを入力してください
          </p>
        </motion.div>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card variant="dark">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                ルーム情報を入力
              </CardTitle>
              <CardDescription>
                ルームIDは部屋のホストから共有されます
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* エラーメッセージ */}
              {errorMessage && (
                <div className="rounded-lg border-2 border-accent-red bg-accent-red/10 p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-accent-red" />
                    <p className="font-semibold text-accent-red">エラー</p>
                  </div>
                  <p className="mt-2 text-sm text-paper">{errorMessage}</p>
                </div>
              )}

              {/* ルームID入力 */}
              <div>
                <Input
                  label="ルームID"
                  placeholder="例: game_1234567890_abc1234"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  helperText="ホストから共有されたIDを入力してください"
                />
                {!foundGame && (
                  <div className="mt-3">
                    <Button
                      variant="quill"
                      fullWidth
                      onClick={handleSearch}
                      isLoading={isSearching}
                      disabled={isSearching}
                    >
                      ルームを検索
                    </Button>
                  </div>
                )}
              </div>

              {/* 見つかったゲーム情報 */}
              {foundGame && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border-2 border-accent-gold bg-accent-gold/10 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-serif text-lg font-semibold text-paper">
                        ルームが見つかりました！
                      </p>
                      <div className="flex gap-2">
                        {foundGame.game.isPrivate && (
                          <Badge variant="warning" size="sm">
                            非公開
                          </Badge>
                        )}
                        <Badge
                          variant={foundGame.game.canJoin ? "success" : "danger"}
                          size="sm"
                        >
                          {foundGame.game.canJoin ? "参加可能" : "参加不可"}
                        </Badge>
                      </div>
                    </div>

                    {/* シナリオ情報 */}
                    <div className="space-y-2">
                      <p className="text-sm text-paper/80">
                        シナリオ: <span className="font-semibold">{foundGame.scenario.title}</span>
                      </p>
                      <p className="text-xs text-paper/60 line-clamp-2">
                        {foundGame.scenario.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-paper/60">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {foundGame.game.currentPlayerCount}/{foundGame.game.maxPlayers}名
                        </span>
                        <span>
                          難易度: {foundGame.scenario.difficulty === "easy" ? "初級" : foundGame.scenario.difficulty === "normal" ? "中級" : "上級"}
                        </span>
                        <span>{foundGame.scenario.genre}</span>
                      </div>
                      <p className="mt-1 text-xs text-paper/50">
                        ルームID: {foundGame.game.id}
                      </p>
                    </div>
                  </div>

                  {/* パスワード入力（非公開部屋の場合） */}
                  {foundGame.game.isPrivate && (
                    <div className="mt-4">
                      <Input
                        label="パスワード"
                        type="password"
                        placeholder="部屋のパスワードを入力"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleJoin();
                          }
                        }}
                        helperText="ホストから共有されたパスワードを入力してください"
                      />
                    </div>
                  )}

                  {/* 別のルームを検索 */}
                  <div className="mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFoundGame(null);
                        setRoomId("");
                        setErrorMessage(null);
                      }}
                    >
                      別のルームを検索
                    </Button>
                  </div>
                </motion.div>
              )}
            </CardContent>

            <CardFooter className="flex justify-between border-t border-paper/20 pt-6">
              <Link href="/">
                <Button variant="ghost">
                  <Home className="mr-2 h-4 w-4" />
                  ホームに戻る
                </Button>
              </Link>
              {foundGame && foundGame.game.canJoin && (
                <Button
                  variant="seal"
                  size="lg"
                  onClick={handleJoin}
                  isLoading={isJoining}
                  disabled={isJoining}
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  参加する
                </Button>
              )}
            </CardFooter>
          </Card>
        </motion.div>

        {/* ヘルプテキスト */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 space-y-4"
        >
          <div className="text-center">
            <p className="text-sm text-paper/60">
              ルームIDが分からない場合は、ホストに確認してください
            </p>
            <p className="mt-2 text-sm text-paper/60">
              または、
              <Link href="/game/create" className="ml-1 text-accent-gold hover:underline">
                新しいゲームを作成
              </Link>
              することもできます
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
