"use client";

/**
 * Scenario Detail Page
 * シナリオ詳細ページ
 */

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  Users,
  Clock,
  Star,
  Play,
  ArrowLeft,
  User,
  FileText,
  Calendar,
  Award,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  BadgeGroup,
  Button,
} from "@/components";
import type { Scenario } from "@/core/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Firestoreから取得したTimestamp（シリアライズ済み）を日付文字列に変換
 */
function formatCreatedAt(createdAt: unknown): string {
  if (!createdAt) return "不明";

  // Firestoreのシリアライズ済みTimestamp形式
  if (typeof createdAt === "object" && createdAt !== null) {
    const ts = createdAt as { _seconds?: number; seconds?: number; toMillis?: () => number };

    // toMillis()がある場合（クライアントSDKのTimestamp）
    if (typeof ts.toMillis === "function") {
      return new Date(ts.toMillis()).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // _seconds または seconds がある場合（シリアライズ済み）
    const seconds = ts._seconds ?? ts.seconds;
    if (typeof seconds === "number") {
      return new Date(seconds * 1000).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }

  return "不明";
}

export default function ScenarioDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScenario = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/scenario/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "シナリオの取得に失敗しました");
          return;
        }

        setScenario(data.scenario);
      } catch (err) {
        console.error("Fetch scenario error:", err);
        setError("シナリオの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchScenario();
  }, [id]);

  // ローディング中
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink via-ink-light to-primary px-6">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <RefreshCw className="h-8 w-8 text-parchment-light" />
        </motion.div>
      </div>
    );
  }

  // エラーまたはシナリオが見つからない
  if (error || !scenario) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink via-ink-light to-primary px-6">
        <Card variant="parchment" className="max-w-md text-center">
          <CardContent className="py-16">
            <BookOpen className="mx-auto mb-4 h-16 w-16 text-ink/30" />
            <h1 className="mb-4 font-serif text-2xl font-bold text-ink">
              シナリオが見つかりません
            </h1>
            <p className="mb-6 text-ink/60">
              {error || "指定されたシナリオは存在しないか、削除された可能性があります。"}
            </p>
            <Link href="/library">
              <Button variant="seal">図書館に戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const difficultyColors = {
    easy: "success",
    normal: "warning",
    hard: "danger",
  } as const;

  const difficultyLabels = {
    easy: "初級",
    normal: "中級",
    hard: "上級",
  };

  const artStyleLabels = {
    anime: "アニメ調",
    oil_painting: "油絵風",
    realistic: "リアル",
    sketch: "スケッチ風",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-ink-light to-primary px-6 py-12">
      <div className="mx-auto max-w-5xl">
        {/* Back Button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <Link href="/library">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              図書館に戻る
            </Button>
          </Link>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header Card */}
          <Card variant="parchment" className="mb-6">
            <CardHeader>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge variant={difficultyColors[scenario.meta.difficulty]} size="lg">
                  {difficultyLabels[scenario.meta.difficulty]}
                </Badge>
                <Badge variant="outline">{scenario.meta.genre}</Badge>
                <Badge variant="secondary">{artStyleLabels[scenario.meta.artStyle]}</Badge>
              </div>

              <CardTitle className="text-4xl">{scenario.meta.title}</CardTitle>

              <CardDescription className="mt-4 text-base leading-relaxed">
                {scenario.meta.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border-2 border-ink/10 bg-gradient-to-br from-paper-dark/30 to-transparent p-6 md:grid-cols-4">
                <div className="text-center">
                  <Users className="mx-auto mb-2 h-6 w-6 text-ink/60" />
                  <p className="text-2xl font-bold text-ink">
                    {(scenario.meta.playCount ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-ink/60">プレイ数</p>
                </div>
                <div className="text-center">
                  <Star className="mx-auto mb-2 h-6 w-6 text-accent-gold" />
                  <p className="text-2xl font-bold text-ink">
                    {(scenario.meta.stars ?? 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-ink/60">いいね</p>
                </div>
                <div className="text-center">
                  <Clock className="mx-auto mb-2 h-6 w-6 text-ink/60" />
                  <p className="text-2xl font-bold text-ink">{scenario.meta.playTimeMin ?? 60}分</p>
                  <p className="text-sm text-ink/60">想定時間</p>
                </div>
                <div className="text-center">
                  <User className="mx-auto mb-2 h-6 w-6 text-ink/60" />
                  <p className="text-2xl font-bold text-ink">
                    {scenario.data.characters?.length ?? 0}人
                  </p>
                  <p className="text-sm text-ink/60">登場人物</p>
                </div>
              </div>

              {/* Tags */}
              {scenario.meta.tags && scenario.meta.tags.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center font-serif text-lg font-semibold text-ink">
                  <Award className="mr-2 h-5 w-5" />
                  タグ
                </h3>
                <BadgeGroup>
                  {scenario.meta.tags.map((tag) => (
                    <Badge key={tag} variant="primary">
                      {tag}
                    </Badge>
                  ))}
                </BadgeGroup>
              </div>
              )}

              {/* Introduction Text */}
              <div>
                <h3 className="mb-3 flex items-center font-serif text-lg font-semibold text-ink">
                  <FileText className="mr-2 h-5 w-5" />
                  導入ストーリー
                </h3>
                <div className="rounded-lg border-2 border-ink/10 bg-gradient-to-br from-paper-dark/20 to-transparent p-6">
                  <p className="whitespace-pre-line font-serif leading-relaxed text-ink/80">
                    {scenario.data.introText}
                  </p>
                </div>
              </div>

              {/* Characters */}
              {scenario.data.characters && scenario.data.characters.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center font-serif text-lg font-semibold text-ink">
                  <Users className="mr-2 h-5 w-5" />
                  登場人物（{scenario.data.characters.length}名）
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {scenario.data.characters.map((char) => (
                    <div
                      key={char.id}
                      className="rounded-lg border-2 border-ink/10 bg-gradient-to-br from-paper-dark/20 to-transparent p-4"
                    >
                      <h4 className="mb-1 font-serif text-lg font-bold text-ink">
                        {char.name}
                      </h4>
                      <p className="mb-2 text-sm text-ink/60">
                        {char.job} / {char.gender === "male" ? "男性" : char.gender === "female" ? "女性" : char.gender} / {char.age}歳
                      </p>
                      <p className="text-sm italic text-ink/70">「{char.personality}」</p>
                      <p className="mt-2 text-sm text-ink/60">
                        {char.handout.publicInfo}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Metadata */}
              <div className="flex items-center justify-between border-t border-ink/10 pt-4 text-sm text-ink/60">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>作者: {scenario.authorName || "不明"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatCreatedAt(scenario.createdAt)}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex justify-center border-t border-ink/10 pt-6">
              <Link href={`/game/create?scenarioId=${scenario.id}`}>
                <Button
                  variant="seal"
                  size="lg"
                  className="px-12"
                  data-testid="create-game-button"
                >
                  <Play className="mr-2 h-5 w-5" />
                  このシナリオでプレイする
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
