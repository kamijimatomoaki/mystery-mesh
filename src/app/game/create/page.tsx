"use client";

/**
 * Game Creation Page
 * ゲーム作成画面（部屋作成）
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  BookOpen,
  Users,
  Plus,
  Minus,
  ArrowLeft,
  Play,
  AlertCircle,
} from "lucide-react";
import type { Scenario } from "@/core/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Input,
  Radio,
  RadioGroup,
  Badge,
  Select,
} from "@/components";

// Suspense boundary for useSearchParams
export default function GameCreatePage() {
  return (
    <Suspense fallback={<GameCreateLoadingFallback />}>
      <GameCreateContent />
    </Suspense>
  );
}

function GameCreateLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink via-ink-light to-primary px-6">
      <Card variant="parchment" className="max-w-md text-center">
        <CardContent className="py-16">
          <BookOpen className="mx-auto mb-4 h-16 w-16 animate-pulse text-ink/30" />
          <p className="text-ink/60">読み込み中...</p>
        </CardContent>
      </Card>
    </div>
  );
}

function GameCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("scenarioId");
  const { userId, displayName, loading: authLoading, isAuthenticated } = useAuth();

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(true);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [humanPlayerCount, setHumanPlayerCount] = useState(1); // 最低1人（ホスト）
  const [aiPlayerCount, setAiPlayerCount] = useState(1);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (scenarioId) {
      setScenarioLoading(true);
      setScenarioError(null);

      // APIからシナリオを取得
      fetch(`/api/scenario/${scenarioId}`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Failed to fetch scenario: ${res.status}`);
          }
          return res.json();
        })
        .then((response) => {
          // APIレスポンス形式に対応: { scenario: Scenario } または Scenario
          const data = response.scenario || response;
          setScenario(data);
          setRoomName(`${data.meta.title}の部屋`);
          // 初期値: 人間1人（ホスト） + AI（残り全員）
          const totalChars = data.data.characters.length;
          setHumanPlayerCount(1);
          setAiPlayerCount(totalChars - 1);
        })
        .catch((err) => {
          console.error("[GameCreate] Failed to load scenario:", err);
          setScenarioError(err.message);
        })
        .finally(() => {
          setScenarioLoading(false);
        });
    }
  }, [scenarioId]);

  if (!scenarioId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink via-ink-light to-primary px-6">
        <Card variant="parchment" className="max-w-md text-center">
          <CardContent className="py-16">
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-ink/30" />
            <h1 className="mb-4 font-serif text-2xl font-bold text-ink">
              シナリオが指定されていません
            </h1>
            <p className="mb-6 text-ink/60">
              ライブラリからシナリオを選択してください。
            </p>
            <Link href="/library">
              <Button variant="seal">ライブラリに戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (scenarioLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink via-ink-light to-primary px-6">
        <Card variant="parchment" className="max-w-md text-center">
          <CardContent className="py-16">
            <BookOpen className="mx-auto mb-4 h-16 w-16 animate-pulse text-ink/30" />
            <p className="text-ink/60">シナリオを読み込んでいます...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (scenarioError || !scenario) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink via-ink-light to-primary px-6">
        <Card variant="parchment" className="max-w-md text-center">
          <CardContent className="py-16">
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-accent-red/50" />
            <h1 className="mb-4 font-serif text-2xl font-bold text-ink">
              シナリオの読み込みに失敗しました
            </h1>
            <p className="mb-6 text-ink/60">
              {scenarioError || "シナリオが見つかりませんでした"}
            </p>
            <Link href="/library">
              <Button variant="seal">ライブラリに戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateGame = async () => {
    if (authLoading) {
      console.log("Auth still loading, please wait...");
      return;
    }
    if (!userId) {
      console.error("User not authenticated");
      // ユーザーに認証エラーを表示（後でUIを追加）
      alert("認証が必要です。ページを再読み込みしてください。");
      return;
    }

    setIsCreating(true);

    try {
      // APIを呼び出してゲームを作成
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scenarioId: scenario.id,
          hostId: userId,
          hostName: displayName || "プレイヤー",
          roomName,
          isPrivate,
          password: isPrivate ? password : undefined,
          humanPlayerCount,
          aiPlayerCount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "ゲームの作成に失敗しました");
      }

      const data = await response.json();

      console.log("Game created:", {
        gameId: data.gameId,
        scenarioId: scenario.id,
        roomName,
        isPrivate,
        aiPlayerCount,
      });

      // キャラクター選択画面に遷移
      router.push(`/game/${data.gameId}/setup`);
    } catch (error) {
      console.error("Failed to create game:", error);
      alert(error instanceof Error ? error.message : "ゲームの作成に失敗しました");
      setIsCreating(false);
    }
  };

  const totalCharacters = scenario.data.characters.length;
  const totalPlayers = humanPlayerCount + aiPlayerCount;

  // 人間プレイヤー数を変更（AIが自動調整）
  const handleHumanCountChange = (delta: number) => {
    const newHumanCount = Math.max(1, Math.min(totalCharacters, humanPlayerCount + delta));
    const newAiCount = totalCharacters - newHumanCount;
    setHumanPlayerCount(newHumanCount);
    setAiPlayerCount(newAiCount);
  };

  // AIプレイヤー数を変更（人間が自動調整）
  const handleAiCountChange = (delta: number) => {
    const newAiCount = Math.max(0, Math.min(totalCharacters - 1, aiPlayerCount + delta));
    const newHumanCount = totalCharacters - newAiCount;
    setHumanPlayerCount(newHumanCount);
    setAiPlayerCount(newAiCount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-ink-light to-primary px-6 py-12">
      <div className="mx-auto max-w-4xl">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <Link href={`/library/${scenarioId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              シナリオ詳細に戻る
            </Button>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 text-center"
        >
          <h1 className="font-serif text-4xl font-bold text-paper">
            ゲームを作成
          </h1>
          <p className="mt-2 text-paper/70">
            部屋の設定をして、ゲームを始めましょう
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left - Scenario Info */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <Card variant="parchment">
                <CardHeader>
                  <Badge variant="primary" className="mb-2 w-fit">
                    選択中のシナリオ
                  </Badge>
                  <CardTitle className="text-xl">{scenario.meta.title}</CardTitle>
                  <CardDescription className="line-clamp-3">
                    {scenario.meta.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-ink/60">登場人物</span>
                    <span className="font-semibold text-ink">
                      {scenario.data.characters.length}名
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink/60">想定時間</span>
                    <span className="font-semibold text-ink">
                      {scenario.meta.playTimeMin}分
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-ink/60">難易度</span>
                    <Badge
                      variant={
                        scenario.meta.difficulty === "easy"
                          ? "success"
                          : scenario.meta.difficulty === "normal"
                          ? "warning"
                          : "danger"
                      }
                      size="sm"
                    >
                      {scenario.meta.difficulty === "easy"
                        ? "初級"
                        : scenario.meta.difficulty === "normal"
                        ? "中級"
                        : "上級"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Right - Room Settings */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Card variant="dark">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    部屋の設定
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Room Name */}
                  <div>
                    <Input
                      label="部屋名"
                      placeholder="例: 深夜の推理会"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      helperText="他のプレイヤーに表示される部屋の名前です"
                    />
                  </div>

                  {/* Privacy Settings */}
                  <div>
                    <RadioGroup
                      label="公開設定"
                      helperText="非公開の場合、パスワードが必要になります"
                    >
                      <Radio
                        id="public"
                        name="privacy"
                        label="🌐 公開部屋"
                        description="誰でも参加できる部屋です"
                        checked={!isPrivate}
                        onChange={() => setIsPrivate(false)}
                      />
                      <Radio
                        id="private"
                        name="privacy"
                        label="🔒 非公開部屋"
                        description="パスワードを知っている人だけが参加できます"
                        checked={isPrivate}
                        onChange={() => setIsPrivate(true)}
                      />
                    </RadioGroup>

                    {isPrivate && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4"
                      >
                        <Input
                          label="パスワード"
                          type="password"
                          placeholder="4文字以上"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          helperText="参加者はこのパスワードを入力する必要があります"
                        />
                      </motion.div>
                    )}
                  </div>

                  {/* Player Count Configuration */}
                  <div>
                    <label className="mb-3 block font-serif text-sm font-medium text-paper">
                      プレイヤー構成
                    </label>

                    <div className="space-y-4">
                      {/* 人間プレイヤー */}
                      <div className="rounded-lg border-2 border-paper/20 bg-paper/5 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-paper">👤 人間プレイヤー</span>
                          <Badge variant="outline" size="sm">最低1人</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleHumanCountChange(-1)}
                            disabled={humanPlayerCount <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <div className="flex-1 text-center">
                            <p className="text-3xl font-bold text-paper">{humanPlayerCount}</p>
                            <p className="text-xs text-paper/60">人</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleHumanCountChange(1)}
                            disabled={humanPlayerCount >= totalCharacters}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* AIプレイヤー */}
                      <div className="rounded-lg border-2 border-accent-gold/30 bg-accent-gold/10 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-paper">🤖 AIプレイヤー</span>
                          <Badge variant="outline" size="sm">0〜{totalCharacters - 1}人</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAiCountChange(-1)}
                            disabled={aiPlayerCount === 0}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <div className="flex-1 text-center">
                            <p className="text-3xl font-bold text-paper">{aiPlayerCount}</p>
                            <p className="text-xs text-paper/60">人</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAiCountChange(1)}
                            disabled={aiPlayerCount >= totalCharacters - 1}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* 合計表示 */}
                      <div className="rounded-lg border-2 border-paper/30 bg-ink/50 p-3 text-center">
                        <p className="text-sm text-paper/70">合計</p>
                        <p className="text-2xl font-bold text-paper">
                          {totalPlayers} / {totalCharacters} 名
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-paper/50">
                      💡 人数を変更すると、もう片方が自動で調整されます
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="rounded-lg border-2 border-paper/20 bg-gradient-to-br from-paper/10 to-transparent p-4">
                    <h4 className="mb-3 font-serif text-sm font-semibold text-paper">
                      ゲーム概要
                    </h4>
                    <div className="space-y-2 text-sm text-paper/80">
                      <p>
                        📖 <span className="font-semibold">{scenario.meta.title}</span>
                      </p>
                      <p>
                        👥 プレイヤー構成: 人間 {humanPlayerCount}名 + AI {aiPlayerCount}名
                        <span className="ml-2 text-xs text-paper/60">
                          （合計 {totalPlayers}名 / {totalCharacters}名）
                        </span>
                      </p>
                      <p>⏱️ 想定プレイ時間: {scenario.meta.playTimeMin}分</p>
                      <p>
                        {isPrivate ? "🔒 非公開部屋（パスワードあり）" : "🌐 公開部屋"}
                      </p>
                    </div>
                  </div>

                  {/* 認証警告 */}
                  {!authLoading && !isAuthenticated && (
                    <div className="rounded-lg border-2 border-accent-red/30 bg-accent-red/10 p-4">
                      <div className="flex items-center gap-2 text-accent-red">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-semibold">認証が必要です</span>
                      </div>
                      <p className="mt-2 text-sm text-paper/70">
                        ゲームを作成するにはログインが必要です。ページを再読み込みするか、ホームに戻ってログインしてください。
                      </p>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="flex justify-between border-t border-paper/20 pt-6">
                  <Link href={`/library/${scenarioId}`}>
                    <Button variant="ghost">キャンセル</Button>
                  </Link>
                  <Button
                    variant="seal"
                    size="lg"
                    onClick={handleCreateGame}
                    disabled={!roomName.trim() || (isPrivate && password.length < 4) || authLoading || !isAuthenticated}
                    isLoading={isCreating || authLoading}
                  >
                    <Play className="mr-2 h-5 w-5" />
                    {authLoading ? "認証確認中..." : !isAuthenticated ? "要認証" : "部屋を作成"}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
