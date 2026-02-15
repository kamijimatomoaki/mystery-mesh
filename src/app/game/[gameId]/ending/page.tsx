/**
 * Ending Page
 * エンディング画面（エピローグ + 真相ダッシュボード + 動画 + シークレット + 登場人物一覧）
 *
 * 構成:
 * 1. エピローグナレーション（E1）
 * 2. 動画プレイヤー
 * 3. 真相ダッシュボード（犯人 + トリック + タイムライン）
 * 4. 投票結果 + MVP表彰（E6）
 * 5. シークレットアンロック（E4）
 * 5.5. 登場人物一覧
 * 6. シナリオ公開（E7）
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, Button, Loading, Badge, Modal } from "@/components";
import { useGameActions } from "@/lib/hooks/useGameActions";
import { useGameState } from "@/hooks/useGameRealtime";
import { useAuth } from "@/lib/hooks/useAuth";
import type { GameState, Scenario } from "@/core/types";
import {
  CheckCircle,
  Trophy,
  XCircle,
  BookOpen,
  Play,
  Star,
  Award,
  Crown,
  Users,
  Heart,
} from "lucide-react";
import { startEpilogueGeneration, pollEpilogueGeneration, publishScenario as publishScenarioApi } from "@/lib/api/ending";
import { db } from "@/core/db/firestore-client";
import { doc, getDoc, collection, getCountFromServer } from "firebase/firestore";
import SecretsBoard from "@/features/ending/components/SecretsBoard";

export default function EndingPage() {
  const params = useParams();
  const gameId = params.gameId as string;

  const { userId } = useAuth();
  const { gameState: realtimeGame, loading: gameLoading } = useGameState(gameId, userId);

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [showTimeline, setShowTimeline] = useState(false);

  // エピローグ関連状態
  const [epilogueText, setEpilogueText] = useState<string | null>(null);
  const [epilogueLoading, setEpilogueLoading] = useState(false);
  const [epilogueProgress, setEpilogueProgress] = useState({ percentage: 0, message: "" });

  // MVP関連状態
  const [mvpData, setMvpData] = useState<{
    mvpId: string;
    mvpName: string;
    mvpScore: number;
    mvpReasoning?: string;
    characterHighlights?: Array<{
      characterId: string;
      characterName: string;
      highlight: string;
      votedFor: string;
      performance: "excellent" | "good" | "notable";
    }>;
    scoreBreakdown: Record<string, {
      total: number;
      correctVote: number;
      contradictions: number;
      investigation: number;
      reasoning: number;
    }>;
  } | null>(null);

  // シナリオ公開関連
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  // いいね関連
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeLoading, setLikeLoading] = useState(false);

  // セクション展開制御
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["epilogue", "truth", "votes", "characters"])
  );

  const { generateVideo, loading: isGenerating } = useGameActions();

  // セクション展開トグル
  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // シナリオデータ読み込み
  useEffect(() => {
    if (!realtimeGame || !userId) return;

    const fetchScenario = async () => {
      try {
        const response = await fetch(`/api/game/${gameId}/scenario?userId=${userId}`);
        if (!response.ok) {
          console.error("Failed to fetch scenario:", response.status);
          return;
        }
        const data = await response.json();
        setScenario(data.scenario || null);
      } catch (error) {
        console.error("Failed to fetch scenario:", error);
      }
    };

    fetchScenario();
  }, [realtimeGame?.scenarioId, userId, gameId]);

  // 既存のendingDataからエピローグを復元
  useEffect(() => {
    if (realtimeGame?.endingData?.resultText) {
      setEpilogueText(realtimeGame.endingData.resultText);
    }
    if (realtimeGame?.endingData?.movieUrl) {
      setVideoUrl(realtimeGame.endingData.movieUrl);
    }
  }, [realtimeGame?.endingData]);

  // いいね状態の確認
  useEffect(() => {
    if (!realtimeGame?.scenarioId || !userId) return;

    const checkLikeStatus = async () => {
      try {
        // ユーザーのいいね状態を確認
        const likeRef = doc(db, "publishedScenarios", realtimeGame.scenarioId, "likes", userId);
        const likeDoc_ = await getDoc(likeRef);
        setLiked(likeDoc_.exists());

        // いいね数を取得
        const likesCollRef = collection(db, "publishedScenarios", realtimeGame.scenarioId, "likes");
        const countSnapshot = await getCountFromServer(likesCollRef);
        setLikeCount(countSnapshot.data().count);
      } catch {
        // publishedScenariosに存在しない（未公開）場合は無視
      }
    };

    checkLikeStatus();
  }, [realtimeGame?.scenarioId, userId]);

  // いいねトグル
  const handleToggleLike = useCallback(async () => {
    if (!realtimeGame?.scenarioId || !userId || likeLoading) return;

    setLikeLoading(true);
    const newAction = liked ? "unlike" : "like";

    try {
      const response = await fetch("/api/scenario/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: realtimeGame.scenarioId,
          userId,
          action: newAction,
        }),
      });

      if (response.ok) {
        setLiked(!liked);
        setLikeCount((prev) => prev + (newAction === "like" ? 1 : -1));
      }
    } catch (error) {
      console.error("Failed to toggle like:", error);
    } finally {
      setLikeLoading(false);
    }
  }, [realtimeGame?.scenarioId, userId, liked, likeLoading]);

  // エピローグ生成
  const handleGenerateEpilogue = useCallback(async () => {
    setEpilogueLoading(true);
    setEpilogueProgress({ percentage: 0, message: "準備中..." });

    try {
      const { jobId } = await startEpilogueGeneration(gameId);
      const result = await pollEpilogueGeneration(
        jobId,
        (percentage, message) => setEpilogueProgress({ percentage, message })
      );

      setEpilogueText(result.epilogueText);
      setMvpData({
        mvpId: result.mvpAgentId,
        mvpName: result.mvpAgentName,
        mvpScore: result.mvpScore,
        mvpReasoning: result.mvpReasoning || undefined,
        characterHighlights: result.characterHighlights || undefined,
        scoreBreakdown: result.scoreBreakdown,
      });
    } catch (error) {
      console.error("Epilogue generation failed:", error);
    } finally {
      setEpilogueLoading(false);
    }
  }, [gameId]);

  // 動画生成
  const handleGenerateVideo = async () => {
    setIsLoadingVideo(true);
    setVideoProgress(0);

    try {
      const url = await generateVideo(
        { gameId },
        (progress) => setVideoProgress(progress)
      );
      setVideoUrl(url);
    } catch (error) {
      console.error("Video generation failed:", error);
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // シナリオ公開
  const handlePublishScenario = async () => {
    if (!realtimeGame || !userId) return;
    setPublishing(true);

    try {
      await publishScenarioApi(
        gameId,
        userId,
        realtimeGame.players[userId]?.displayName || "匿名"
      );
      setPublished(true);
      setPublishModalOpen(false);
    } catch (error) {
      console.error("Failed to publish scenario:", error);
    } finally {
      setPublishing(false);
    }
  };

  if (gameLoading || !realtimeGame || !scenario) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <Loading variant="hourglass" size="lg" text="エンディングを読み込み中..." />
      </div>
    );
  }

  const truth = scenario.data.truth;
  const culprit = scenario.data.characters.find((c) => c.id === truth.culpritId);

  // 投票結果の集計
  const votes = realtimeGame.votes || {};
  const players = realtimeGame.players || {};
  const characters = scenario.data.characters;

  const voteCount: Record<string, number> = {};
  Object.values(votes).forEach((targetId) => {
    voteCount[targetId] = (voteCount[targetId] || 0) + 1;
  });

  const correctVoters = Object.entries(votes)
    .filter(([_, targetId]) => targetId === truth.culpritId)
    .map(([voterId]) => voterId);

  const isCorrectMajority = correctVoters.length > Object.keys(votes).length / 2;

  const getCharacterName = (characterId: string) => {
    const char = characters.find((c) => c.id === characterId);
    return char?.name || characterId;
  };

  const getPlayerDisplayName = (playerId: string) => {
    const player = players[playerId];
    if (player?.characterId) {
      return getCharacterName(player.characterId);
    }
    return player?.displayName || playerId;
  };

  return (
    <div className="min-h-screen bg-ink text-paper">
      {/* ヘッダー */}
      <header className="border-b border-accent-gold/30 bg-ink/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="text-6xl mb-4"
            >
              {isCorrectMajority ? "🎭" : "🌑"}
            </motion.div>
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-serif text-accent-gold mb-2"
            >
              {isCorrectMajority ? "真相開示" : "闇に葬られた真実"}
            </motion.h1>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-paper/70"
            >
              {isCorrectMajority
                ? "探偵たちの推理が、闇を照らした"
                : "犯人の狡猾な策略が、すべてを欺いた"}
            </motion.p>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {/* === Section 1: エピローグナレーション (E1) === */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <Card variant="dark" className="border-accent-gold/30">
              <CardHeader>
                <button
                  onClick={() => toggleSection("epilogue")}
                  className="w-full flex items-center justify-between"
                >
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-accent-gold" />
                    <span>エピローグ</span>
                  </CardTitle>
                  <span className="text-paper/40 text-sm">
                    {expandedSections.has("epilogue") ? "▼" : "▶"}
                  </span>
                </button>
              </CardHeader>
              <AnimatePresence>
                {expandedSections.has("epilogue") && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <CardContent>
                      {epilogueLoading ? (
                        <div className="text-center py-8">
                          <Loading variant="ink" size="md" text={epilogueProgress.message} />
                          <div className="mt-4 w-64 mx-auto">
                            <div className="text-center text-accent-gold text-sm mb-2">
                              {epilogueProgress.percentage}%
                            </div>
                            <div className="w-full bg-ink/50 rounded-full h-2">
                              <motion.div
                                className="bg-accent-gold h-2 rounded-full"
                                animate={{ width: `${epilogueProgress.percentage}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : epilogueText ? (
                        <div className="prose prose-invert max-w-none">
                          {epilogueText.split("\n").map((paragraph, i) => (
                            <motion.p
                              key={i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.3 }}
                              className="text-paper/90 leading-relaxed font-serif text-lg"
                            >
                              {paragraph}
                            </motion.p>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <p className="text-paper/60 mb-4">
                            司書（GM）がこの物語の結末を語ります
                          </p>
                          <Button
                            variant="seal"
                            onClick={handleGenerateEpilogue}
                          >
                            <BookOpen className="w-4 h-4 mr-2" />
                            エピローグを生成する
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* === Section 2: 動画プレイヤー（Veo 3.0 LROポーリング404問題のため一時停止） === */}
          {/* TODO: Veo 3.0のオペレーションポーリングが404を返す問題を修正後に復活
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Card variant="dark" className="overflow-hidden">
              <CardContent className="p-0">
                <div className="relative aspect-video bg-ink-light">
                  {isLoadingVideo ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <Loading variant="ink" size="lg" text="真相解説動画を生成中..." />
                      <div className="mt-4 w-64">
                        <div className="text-center text-accent-gold text-sm mb-2">
                          {videoProgress}%
                        </div>
                        <div className="w-full bg-ink/50 rounded-full h-2">
                          <motion.div
                            className="bg-accent-gold h-2 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${videoProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : videoUrl ? (
                    <video
                      controls
                      autoPlay
                      className="w-full h-full"
                      poster="/images/ending-poster.jpg"
                    >
                      <source src={videoUrl} type="video/mp4" />
                      お使いのブラウザは動画再生に対応していません。
                    </video>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <p className="text-paper/70 text-lg">
                        真相解説動画を生成しますか？
                      </p>
                      <Button
                        variant="seal"
                        onClick={handleGenerateVideo}
                        disabled={isGenerating}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        動画を生成する
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
          */}

          {/* === Section 3: 犯人 + トリック === */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <button
              onClick={() => toggleSection("truth")}
              className="w-full text-left mb-2"
            >
              <h2 className="text-xl font-serif text-accent-gold flex items-center gap-2">
                真相ダッシュボード
                <span className="text-sm text-paper/40">
                  {expandedSections.has("truth") ? "▼" : "▶"}
                </span>
              </h2>
            </button>
            <AnimatePresence>
              {expandedSections.has("truth") && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 犯人情報 */}
                    <Card variant="dark" className="h-full border-2 border-accent-red/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span className="text-accent-red">⚠️</span>
                          <span className="text-accent-red">真犯人</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {culprit ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-4">
                              <div className="w-24 h-24 bg-accent-red/20 rounded-full border-4 border-accent-red flex items-center justify-center overflow-hidden">
                                <img
                                  src={culprit.images.base || "/images/placeholder.png"}
                                  alt={culprit.name}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              </div>
                              <div>
                                <h3 className="text-2xl font-serif text-accent-red font-bold">
                                  {culprit.name}
                                </h3>
                                <p className="text-paper/70">{culprit.job}</p>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-serif text-accent-gold mb-2">
                                性格
                              </h4>
                              <p className="text-paper/80">{culprit.personality}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center text-paper/50">犯人情報なし</div>
                        )}
                      </CardContent>
                    </Card>

                    {/* トリック */}
                    <Card variant="dark" className="h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <span>🔍</span>
                          <span>犯行の手口</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="prose prose-invert max-w-none">
                          <p className="text-paper leading-relaxed">
                            {truth.trickExplanation || "トリックの詳細はまだ解明されていません..."}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* タイムライン */}
                  <Card variant="dark" className="mt-6">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <span>📜</span>
                          <span>真相のタイムライン</span>
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowTimeline(!showTimeline)}
                        >
                          {showTimeline ? "折りたたむ" : "展開する"}
                        </Button>
                      </div>
                    </CardHeader>
                    <AnimatePresence>
                      {showTimeline && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                        >
                          <CardContent>
                            <div className="space-y-4">
                              {(!truth.masterTimeline || truth.masterTimeline.length === 0) && (
                                <p className="text-paper/50 text-center py-4">
                                  タイムラインデータはまだ公開されていません...
                                </p>
                              )}
                              {truth.masterTimeline?.map((event, index) => (
                                <motion.div
                                  key={index}
                                  initial={{ x: -20, opacity: 0 }}
                                  animate={{ x: 0, opacity: 1 }}
                                  transition={{ delay: index * 0.1 }}
                                  className="flex gap-4"
                                >
                                  <div className="flex-shrink-0 w-20 text-accent-gold font-mono">
                                    {event.time}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                                          !event.isTrue
                                            ? "bg-accent-red/20 text-accent-red"
                                            : "bg-paper/10 text-paper/70"
                                        }`}
                                      >
                                        {event.isTrue ? "事実" : "偽装"}
                                      </span>
                                      {event.relatedCharacterId && (
                                        <span className="text-paper/70 text-sm">
                                          {getCharacterName(event.relatedCharacterId)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-paper">{event.event}</p>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* === Section 4: 投票結果 + MVP表彰 (E6) === */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.0 }}
          >
            <button
              onClick={() => toggleSection("votes")}
              className="w-full text-left mb-2"
            >
              <h2 className="text-xl font-serif text-accent-gold flex items-center gap-2">
                投票結果 &amp; MVP
                <span className="text-sm text-paper/40">
                  {expandedSections.has("votes") ? "▼" : "▶"}
                </span>
              </h2>
            </button>
            <AnimatePresence>
              {expandedSections.has("votes") && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-6"
                >
                  {/* MVP表彰 */}
                  {mvpData && (
                    <Card variant="dark" className="border-2 border-accent-gold/50 bg-gradient-to-r from-accent-gold/5 to-transparent">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", duration: 0.8 }}
                          >
                            <Award className="w-16 h-16 text-accent-gold" />
                          </motion.div>
                          <div>
                            <h3 className="text-sm font-serif text-accent-gold/70">
                              名探偵賞 (MVP)
                            </h3>
                            <p className="text-2xl font-serif font-bold text-accent-gold">
                              {mvpData.mvpName}
                            </p>
                            {mvpData.mvpReasoning && (
                              <p className="text-sm text-paper/70 mt-1 leading-relaxed">
                                {mvpData.mvpReasoning}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* 全キャラクターハイライト */}
                        {mvpData.characterHighlights && mvpData.characterHighlights.length > 0 && (
                          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                            {mvpData.characterHighlights.map((ch) => {
                              const isMvp = ch.characterId === mvpData.characterHighlights?.find(
                                h => h.characterName === mvpData.mvpName
                              )?.characterId;
                              return (
                                <motion.div
                                  key={ch.characterId}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className={`p-4 rounded-lg ${
                                    isMvp
                                      ? "bg-accent-gold/15 border-2 border-accent-gold/50"
                                      : "bg-paper/5 border border-paper/10"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    {isMvp && <Crown className="w-4 h-4 text-accent-gold" />}
                                    <span className={`font-serif font-bold ${isMvp ? "text-accent-gold" : "text-paper"}`}>
                                      {ch.characterName}
                                    </span>
                                    <Badge
                                      variant={
                                        ch.performance === "excellent" ? "warning"
                                          : ch.performance === "good" ? "default"
                                          : "outline"
                                      }
                                      size="sm"
                                      className="ml-auto"
                                    >
                                      {ch.performance === "excellent" ? "優秀"
                                        : ch.performance === "good" ? "Good"
                                        : "注目"}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-paper/80 leading-relaxed">
                                    {ch.highlight}
                                  </p>
                                  <p className="text-xs text-paper/50 mt-2">
                                    投票先: {ch.votedFor}
                                  </p>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}

                        {/* フォールバック: ルールベーススコア内訳 */}
                        {!mvpData.characterHighlights && mvpData.scoreBreakdown && Object.keys(mvpData.scoreBreakdown).length > 0 && (
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(mvpData.scoreBreakdown)
                              .sort(([, a], [, b]) => b.total - a.total)
                              .slice(0, 4)
                              .map(([playerId, score]) => {
                                const player = players[playerId];
                                const charName = player?.characterId
                                  ? getCharacterName(player.characterId)
                                  : getPlayerDisplayName(playerId);
                                const isMvp = playerId === mvpData.mvpId;

                                return (
                                  <div
                                    key={playerId}
                                    className={`p-3 rounded-lg text-center ${
                                      isMvp
                                        ? "bg-accent-gold/10 border border-accent-gold/30"
                                        : "bg-paper/5"
                                    }`}
                                  >
                                    <div className="text-xs text-paper/60 mb-1">
                                      {isMvp && <Star className="w-3 h-3 inline text-accent-gold mr-1" />}
                                      {charName}
                                    </div>
                                    <div className="text-lg font-bold text-accent-gold">
                                      {score.total}点
                                    </div>
                                    <div className="text-xs text-paper/40 mt-1 space-y-0.5">
                                      {score.correctVote > 0 && (
                                        <div>正解投票: +{score.correctVote}</div>
                                      )}
                                      {score.contradictions > 0 && (
                                        <div>矛盾発見: +{score.contradictions}</div>
                                      )}
                                      {score.investigation > 0 && (
                                        <div>調査: +{score.investigation}</div>
                                      )}
                                      {score.reasoning > 0 && (
                                        <div>推理: +{score.reasoning}</div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* 投票結果 */}
                  <Card variant="dark">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <span>⚖️</span>
                        <span>投票結果</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(votes).length === 0 ? (
                        <div className="text-center text-paper/70 py-8">
                          投票データがありません
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* 得票数サマリー */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {characters.map((char) => {
                              const count = voteCount[char.id] || 0;
                              const isCulprit = char.id === truth.culpritId;
                              return (
                                <motion.div
                                  key={char.id}
                                  initial={{ scale: 0.9, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  className={`p-4 rounded-lg border-2 text-center ${
                                    isCulprit
                                      ? "border-accent-red bg-accent-red/10"
                                      : "border-paper/20 bg-paper/5"
                                  }`}
                                >
                                  <div className="text-lg font-serif mb-1">
                                    {char.name}
                                    {isCulprit && (
                                      <Badge variant="danger" className="ml-2 text-xs">
                                        犯人
                                      </Badge>
                                    )}
                                  </div>
                                  <div
                                    className={`text-3xl font-bold ${
                                      isCulprit ? "text-accent-red" : "text-accent-gold"
                                    }`}
                                  >
                                    {count}票
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>

                          {/* 個別投票リスト */}
                          <div className="border-t border-paper/20 pt-4">
                            <h4 className="text-sm font-serif text-accent-gold mb-3">
                              投票詳細
                            </h4>
                            <div className="space-y-2">
                              {Object.entries(votes).map(([voterId, targetId], index) => {
                                const isCorrect = targetId === truth.culpritId;
                                const player = players[voterId];
                                const isHuman = player?.isHuman ?? false;

                                return (
                                  <motion.div
                                    key={voterId}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-3 rounded-lg bg-paper/5"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded ${
                                          isHuman
                                            ? "bg-blue-500/20 text-blue-400"
                                            : "bg-purple-500/20 text-purple-400"
                                        }`}
                                      >
                                        {isHuman ? "人間" : "AI"}
                                      </span>
                                      <span className="font-medium">
                                        {getPlayerDisplayName(voterId)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-paper/70">→</span>
                                      <span
                                        className={
                                          isCorrect ? "text-accent-red font-bold" : ""
                                        }
                                      >
                                        {getCharacterName(targetId as string)}
                                      </span>
                                      {isCorrect ? (
                                        <CheckCircle className="w-5 h-5 text-green-500" />
                                      ) : (
                                        <XCircle className="w-5 h-5 text-paper/30" />
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>

                          {/* 正解者サマリー */}
                          {correctVoters.length > 0 && (
                            <div className="border-t border-paper/20 pt-4">
                              <div className="flex items-center gap-2 text-green-500 mb-2">
                                <Trophy className="w-5 h-5" />
                                <h4 className="font-serif">正解者</h4>
                              </div>
                              <p className="text-paper/80">
                                {correctVoters.map((id) => getPlayerDisplayName(id)).join("、")}
                                が真犯人を見抜きました！
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* === Section 5: シークレットアンロック (E4) === */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.2 }}
          >
            <SecretsBoard gameId={gameId} />
          </motion.div>

          {/* === Section 5.5: 登場人物一覧 === */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.3 }}
          >
            <button
              onClick={() => toggleSection("characters")}
              className="w-full text-left mb-2"
            >
              <h2 className="text-xl font-serif text-accent-gold flex items-center gap-2">
                <Users className="w-5 h-5" />
                登場人物一覧
                <span className="text-sm text-paper/40">
                  {expandedSections.has("characters") ? "▼" : "▶"}
                </span>
              </h2>
            </button>
            <AnimatePresence>
              {expandedSections.has("characters") && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {characters.map((char, index) => {
                      const isCulpritChar = char.id === truth.culpritId;
                      const isVictim = char.id === truth.victimId;
                      const playerEntry = Object.entries(players).find(
                        ([, p]) => p.characterId === char.id
                      );
                      const isHuman = playerEntry?.[1]?.isHuman ?? false;

                      return (
                        <motion.div
                          key={char.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <Card
                            variant="dark"
                            className={`h-full ${
                              isCulpritChar
                                ? "border-accent-red/50"
                                : isVictim
                                ? "border-paper/30"
                                : "border-ink-light"
                            }`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 border-2 border-paper/20">
                                  <img
                                    src={char.images.base || "/images/placeholder.png"}
                                    alt={char.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-serif font-bold text-paper truncate">
                                      {char.name}
                                    </h3>
                                    {isCulpritChar && (
                                      <Badge variant="danger" size="sm">犯人</Badge>
                                    )}
                                    {isVictim && (
                                      <Badge variant="outline" size="sm">被害者</Badge>
                                    )}
                                    <Badge
                                      variant={isHuman ? "default" : "outline"}
                                      size="sm"
                                      className={
                                        isHuman
                                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                                          : "bg-purple-500/20 text-purple-400 border-purple-500/30"
                                      }
                                    >
                                      {isHuman ? "人間" : "AI"}
                                    </Badge>
                                  </div>
                                  <p className="text-paper/60 text-sm mt-0.5">{char.job}</p>
                                  <p className="text-paper/70 text-sm mt-1">{char.personality}</p>
                                </div>
                              </div>
                              {char.handout?.publicInfo && (
                                <p className="text-paper/60 text-xs mt-3 leading-relaxed border-t border-paper/10 pt-2">
                                  {char.handout.publicInfo}
                                </p>
                              )}
                              {char.handout?.secretGoal && (
                                <div className="mt-2 p-2 rounded bg-accent-gold/5 border border-accent-gold/20">
                                  <p className="text-accent-gold/80 text-xs font-serif mb-0.5">
                                    隠された秘密
                                  </p>
                                  <p className="text-paper/80 text-xs leading-relaxed">
                                    {char.handout.secretGoal}
                                  </p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* === いいねボタン === */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.4 }}
            className="flex justify-center"
          >
            <button
              onClick={handleToggleLike}
              disabled={likeLoading}
              className="group flex items-center gap-3 px-6 py-3 rounded-full border-2 border-paper/20 hover:border-accent-gold/50 transition-all disabled:opacity-50"
            >
              <motion.div
                animate={liked ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <Heart
                  className={`w-6 h-6 transition-colors ${
                    liked
                      ? "fill-red-500 text-red-500"
                      : "text-paper/50 group-hover:text-red-400"
                  }`}
                />
              </motion.div>
              <span className="text-paper/80 font-serif">
                {liked ? "いいね済み" : "このシナリオにいいね"}
              </span>
              {likeCount > 0 && (
                <span className="text-accent-gold font-bold">{likeCount}</span>
              )}
            </button>
          </motion.div>

          {/* === Section 6: シナリオ公開 + アクション (E7) === */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Button variant="outline" onClick={() => window.history.back()}>
                ゲームに戻る
              </Button>

              {!published ? (
                <Button
                  variant="seal"
                  onClick={() => setPublishModalOpen(true)}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  この物語を図書館に収蔵する
                </Button>
              ) : (
                <Button variant="seal" disabled>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  図書館に収蔵済み
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => (window.location.href = "/library")}
              >
                ライブラリへ
              </Button>
            </div>
          </motion.div>
        </div>
      </main>

      {/* シナリオ公開確認モーダル */}
      <Modal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        title="シナリオを図書館に収蔵"
        variant="dark"
      >
        <div className="space-y-4">
          <p className="text-paper/80">
            このシナリオを「無限の謎の図書館」に公開し、他のプレイヤーも遊べるようにしますか？
          </p>
          <p className="text-sm text-paper/50">
            公開後は他のプレイヤーがこのシナリオでゲームを作成できるようになります。
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="ghost"
              onClick={() => setPublishModalOpen(false)}
            >
              キャンセル
            </Button>
            <Button
              variant="seal"
              onClick={handlePublishScenario}
              disabled={publishing}
            >
              {publishing ? "公開中..." : "公開する"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
