"use client";

/**
 * Scenario Library Page
 * 「無限のミステリー図書館」シナリオ一覧ページ
 *
 * タブ:
 * - みんなの図書館（公開シナリオ一覧）
 * - マイライブラリ（自分が作成したシナリオ一覧）
 */

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Users,
  Clock,
  Star,
  Search,
  Filter,
  Loader2,
  PlayCircle,
  Library,
  BookMarked,
  RefreshCw,
  Trash2,
  Upload,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { PublishedScenario } from "@/features/scenario/logic/publish";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  BadgeGroup,
  Input,
  Select,
  Button,
} from "@/components";
import { useAuth } from "@/lib/hooks/useAuth";
import { useToast } from "@/lib/hooks/useToast";

type SortBy = "recent" | "popular" | "stars";
type FilterGenre = "all" | "Mansion" | "School" | "SF" | "Fantasy" | "Horror";
type FilterDifficulty = "all" | "easy" | "normal" | "hard";
type TabType = "public" | "mine";

/** マイシナリオの要約型 */
interface MyScenarioSummary {
  id: string;
  title: string;
  description: string;
  genre: string;
  difficulty: string;
  artStyle: string;
  status: string;
  jobId?: string;
  isPublished: boolean;
  createdAt: number;
}

function LibraryLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-ink-light to-primary flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-paper/50" />
        <p className="font-serif text-lg text-paper/60">図書館を開いています...</p>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<LibraryLoadingFallback />}>
      <LibraryPageInner />
    </Suspense>
  );
}

function LibraryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { userId, displayName, isAuthenticated } = useAuth();

  // タブ
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get("tab") as TabType) || "public"
  );

  // Public tab state
  const [scenarios, setScenarios] = useState<PublishedScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // My library state
  const [myScenarios, setMyScenarios] = useState<MyScenarioSummary[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [filterGenre, setFilterGenre] = useState<FilterGenre>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<FilterDifficulty>("all");

  // タブ変更時にURLを更新
  const handleTabChange = useCallback(
    (tab: TabType) => {
      setActiveTab(tab);
      const newUrl = tab === "public" ? "/library" : "/library?tab=mine";
      window.history.replaceState(null, "", newUrl);
    },
    []
  );

  /**
   * 公開シナリオ一覧を取得
   */
  useEffect(() => {
    if (activeTab !== "public") return;

    const fetchScenarios = async () => {
      setLoading(true);
      setError(null);

      try {
        const orderByMap: Record<SortBy, string> = {
          recent: "publishedAt",
          popular: "playCount",
          stars: "likeCount",
        };

        const params = new URLSearchParams({
          limit: "50",
          orderBy: orderByMap[sortBy],
        });

        if (filterDifficulty !== "all") {
          params.set("difficulty", filterDifficulty);
        }

        const response = await fetch(`/api/scenario/list?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || data.error || "シナリオの取得に失敗しました");
        }

        setScenarios(data.scenarios || []);
      } catch (err) {
        console.error("Failed to fetch scenarios:", err);
        setError(err instanceof Error ? err.message : "シナリオの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    fetchScenarios();
  }, [activeTab, sortBy, filterDifficulty]);

  /**
   * マイシナリオ一覧を取得
   */
  const fetchMyScenarios = useCallback(async () => {
    if (!userId) return;

    setMyLoading(true);
    setMyError(null);

    try {
      const params = new URLSearchParams({
        tab: "mine",
        userId,
      });

      const response = await fetch(`/api/scenario/list?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "マイシナリオの取得に失敗しました");
      }

      setMyScenarios(data.scenarios || []);
    } catch (err) {
      console.error("Failed to fetch my scenarios:", err);
      setMyError(err instanceof Error ? err.message : "マイシナリオの取得に失敗しました");
    } finally {
      setMyLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (activeTab !== "mine") return;
    fetchMyScenarios();
  }, [activeTab, fetchMyScenarios]);

  // 生成中シナリオのポーリング
  useEffect(() => {
    if (activeTab !== "mine") return;
    const hasGenerating = myScenarios.some((s) => s.status === "generating");
    if (!hasGenerating) return;

    const interval = setInterval(fetchMyScenarios, 10000);
    return () => clearInterval(interval);
  }, [activeTab, myScenarios, fetchMyScenarios]);

  /**
   * クライアントサイドでのフィルタリング（公開タブ用）
   */
  const filteredScenarios = useMemo(() => {
    let result = [...scenarios];

    if (filterGenre !== "all") {
      result = result.filter((s) =>
        s.tags.some((tag) => tag.toLowerCase() === filterGenre.toLowerCase())
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    return result;
  }, [scenarios, filterGenre, searchQuery]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-ink-light to-primary px-6 pt-24 pb-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-7xl"
      >
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="font-serif text-5xl font-bold text-paper">
            The Infinite Mystery Library
          </h1>
          <p className="mt-4 font-serif text-lg text-paper/80">
            永遠に続く、謎と物語の図書館へようこそ
          </p>
          <div className="mx-auto mt-6 h-1 w-32 bg-gradient-to-r from-transparent via-accent-gold to-transparent" />

          <div className="mt-8">
            <Link
              href="/scenario/create"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-accent-gold to-amber-accent text-ink font-serif font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
            >
              新しき謎を綴る
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-xl bg-ink-black/50 p-1 border border-paper/10">
            <button
              onClick={() => handleTabChange("public")}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-serif font-bold transition-all ${
                activeTab === "public"
                  ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/30"
                  : "text-paper/60 hover:text-paper/80"
              }`}
            >
              <Library className="h-4 w-4" />
              みんなの図書館
            </button>
            <button
              onClick={() => handleTabChange("mine")}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-serif font-bold transition-all ${
                activeTab === "mine"
                  ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/30"
                  : "text-paper/60 hover:text-paper/80"
              }`}
            >
              <BookMarked className="h-4 w-4" />
              マイライブラリ
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "public" ? (
            <motion.div
              key="public"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {/* Search & Filters */}
              <Card variant="dark" className="mb-8">
                <CardContent className="space-y-6 pt-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-paper/50" />
                    <Input
                      type="text"
                      placeholder="シナリオを検索... (タイトル、説明、タグ)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Select
                      label="ジャンル"
                      value={filterGenre}
                      onChange={(value) => setFilterGenre(value as FilterGenre)}
                      options={[
                        { value: "all", label: "すべて" },
                        { value: "Mansion", label: "館" },
                        { value: "School", label: "学園" },
                        { value: "SF", label: "SF" },
                        { value: "Fantasy", label: "ファンタジー" },
                        { value: "Horror", label: "ホラー" },
                      ]}
                    />
                    <Select
                      label="難易度"
                      value={filterDifficulty}
                      onChange={(value) => setFilterDifficulty(value as FilterDifficulty)}
                      options={[
                        { value: "all", label: "すべて" },
                        { value: "easy", label: "初級" },
                        { value: "normal", label: "中級" },
                        { value: "hard", label: "上級" },
                      ]}
                    />
                    <Select
                      label="並び順"
                      value={sortBy}
                      onChange={(value) => setSortBy(value as SortBy)}
                      options={[
                        { value: "recent", label: "新着順" },
                        { value: "popular", label: "人気順" },
                        { value: "stars", label: "いいね数順" },
                      ]}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-paper/20 pt-4">
                    <p className="font-serif text-sm text-paper/70">
                      <Filter className="mr-2 inline h-4 w-4" />
                      {filteredScenarios.length}件のシナリオが見つかりました
                    </p>
                    {(searchQuery || filterGenre !== "all" || filterDifficulty !== "all") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("");
                          setFilterGenre("all");
                          setFilterDifficulty("all");
                        }}
                      >
                        フィルタをクリア
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Loading */}
              {loading && (
                <Card variant="parchment" className="text-center">
                  <CardContent className="py-16">
                    <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-ink/50" />
                    <p className="font-serif text-lg text-ink/60">シナリオを読み込み中...</p>
                  </CardContent>
                </Card>
              )}

              {/* Error */}
              {error && !loading && (
                <Card variant="parchment" className="text-center">
                  <CardContent className="py-16">
                    <BookOpen className="mx-auto mb-4 h-16 w-16 text-ink/30" />
                    <p className="font-serif text-lg text-ink/60">
                      シナリオの読み込みに失敗しました
                    </p>
                    <p className="mt-2 text-sm text-ink/50">{error}</p>
                    <Button
                      variant="quill"
                      size="sm"
                      className="mt-4"
                      onClick={() => window.location.reload()}
                    >
                      再読み込み
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Empty */}
              {!loading && !error && filteredScenarios.length === 0 && (
                <Card variant="parchment" className="text-center">
                  <CardContent className="py-16">
                    <BookOpen className="mx-auto mb-4 h-16 w-16 text-ink/30" />
                    <p className="font-serif text-lg text-ink/60">
                      条件に合うシナリオが見つかりませんでした
                    </p>
                    <p className="mt-2 text-sm text-ink/50">
                      {scenarios.length === 0
                        ? "まだ公開されたシナリオがありません。最初のシナリオを作成しませんか？"
                        : "検索条件を変更してみてください"}
                    </p>
                    {scenarios.length === 0 && (
                      <Link href="/scenario/create">
                        <Button variant="quill" size="sm" className="mt-4">
                          シナリオを作成する
                        </Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Scenario Grid */}
              {!loading && !error && filteredScenarios.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                >
                  {filteredScenarios.map((scenario, index) => (
                    <ScenarioCard key={scenario.id} scenario={scenario} index={index} />
                  ))}
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="mine"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <MyLibraryContent
                scenarios={myScenarios}
                loading={myLoading}
                error={myError}
                isAuthenticated={isAuthenticated}
                userId={userId}
                displayName={displayName}
                onRefresh={fetchMyScenarios}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}

/**
 * マイライブラリコンテンツ
 */
function MyLibraryContent({
  scenarios,
  loading,
  error,
  isAuthenticated,
  userId,
  displayName,
  onRefresh,
}: {
  scenarios: MyScenarioSummary[];
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  userId: string | null;
  displayName: string | null;
  onRefresh: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!isAuthenticated) {
    return (
      <Card variant="parchment" className="text-center">
        <CardContent className="py-20">
          <BookMarked className="mx-auto mb-6 h-20 w-20 text-ink/20" />
          <h3 className="font-serif text-2xl font-bold text-ink/80 mb-3">
            マイライブラリ
          </h3>
          <p className="font-serif text-lg text-ink/60 mb-8">
            あなたの作成したシナリオを管理できます
          </p>
          <Link href="/auth/signin">
            <Button variant="quill" size="lg" className="px-8">
              サインインしてはじめる
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card variant="parchment" className="text-center">
        <CardContent className="py-16">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-ink/50" />
          <p className="font-serif text-lg text-ink/60">マイライブラリを読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="parchment" className="text-center">
        <CardContent className="py-16">
          <BookOpen className="mx-auto mb-4 h-16 w-16 text-ink/30" />
          <p className="font-serif text-lg text-ink/60">読み込みに失敗しました</p>
          <p className="mt-2 text-sm text-ink/50">{error}</p>
          <Button variant="quill" size="sm" className="mt-4" onClick={onRefresh}>
            再読み込み
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (scenarios.length === 0) {
    return (
      <Card variant="parchment" className="text-center">
        <CardContent className="py-20">
          <div className="text-6xl mb-6">📖</div>
          <h3 className="font-serif text-2xl font-bold text-ink/80 mb-3">
            まだシナリオがありません
          </h3>
          <p className="text-ink/60 font-serif mb-2">
            あなただけのマーダーミステリーを作成しましょう
          </p>
          <p className="text-sm text-ink/40 mb-8 max-w-md mx-auto">
            ジャンル・人数・難易度を選ぶだけで、AIがオリジナルシナリオを生成します。
            生成はバックグラウンドで行われるので、待ち時間も自由に過ごせます。
          </p>
          <Link href="/scenario/create">
            <Button variant="quill" size="lg" className="px-8">
              <Sparkles className="h-4 w-4 mr-2" />
              最初のシナリオを作成する
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  /** 図書館に寄贈する */
  const handlePublish = async (scenarioId: string) => {
    if (!userId || !displayName) return;
    setActionLoading(scenarioId);
    try {
      const res = await fetch("/api/scenario/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          authorId: userId,
          authorName: displayName || "匿名",
          action: "publish",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || data.error || "公開に失敗しました");
      }
      toast.success("シナリオを図書館に寄贈しました");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "公開に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  /** 図書館から回収する */
  const handleUnpublish = async (scenarioId: string) => {
    if (!userId) return;
    setActionLoading(scenarioId);
    try {
      const res = await fetch("/api/scenario/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          authorId: userId,
          authorName: displayName || "匿名",
          action: "unpublish",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || data.error || "回収に失敗しました");
      }
      toast.success("シナリオを図書館から回収しました");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "回収に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  /** シナリオを削除する */
  const handleDelete = async (scenarioId: string) => {
    if (!confirm("このシナリオを削除しますか？この操作は取り消せません。")) return;
    setActionLoading(scenarioId);
    try {
      const res = await fetch(`/api/scenario/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, authorId: userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || data.error || "削除に失敗しました");
      }
      toast.success("シナリオを削除しました");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setActionLoading(null);
    }
  };

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    generating: {
      label: "生成中",
      color: "bg-blue-500/20 text-blue-300 border-blue-500/30",
      icon: <RefreshCw className="h-3 w-3 animate-spin" />,
    },
    ready: {
      label: "完成",
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
      icon: <BookOpen className="h-3 w-3" />,
    },
    published: {
      label: "寄贈済み",
      color: "bg-accent-gold/20 text-accent-gold border-accent-gold/30",
      icon: <Library className="h-3 w-3" />,
    },
    error: {
      label: "エラー",
      color: "bg-red-500/20 text-red-300 border-red-500/30",
      icon: <span className="text-xs">!</span>,
    },
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <p className="font-serif text-sm text-paper/70">
          {scenarios.length}件のシナリオ
        </p>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="text-paper/60">
          <RefreshCw className="h-4 w-4 mr-1" />
          更新
        </Button>
      </div>

      {/* シナリオリスト */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((scenario, index) => {
          const config = statusConfig[scenario.status] || statusConfig.ready;
          const isLoading = actionLoading === scenario.id;

          return (
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <Card variant="dark" className="h-full border border-paper/10 hover:border-paper/20 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-paper text-base line-clamp-2">
                      {scenario.title}
                    </CardTitle>
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border whitespace-nowrap ${config.color}`}
                    >
                      {config.icon}
                      {config.label}
                    </span>
                  </div>
                  <CardDescription className="text-paper/60 line-clamp-2 text-xs">
                    {scenario.status === "generating"
                      ? "シナリオを生成中です..."
                      : scenario.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0 pb-3">
                  <div className="flex items-center gap-3 text-xs text-paper/50">
                    <span>{scenario.genre}</span>
                    <span>
                      {scenario.difficulty === "easy"
                        ? "初級"
                        : scenario.difficulty === "normal"
                        ? "中級"
                        : "上級"}
                    </span>
                    <span>
                      {scenario.createdAt
                        ? new Date(scenario.createdAt).toLocaleDateString("ja-JP")
                        : ""}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 border-t border-paper/10">
                  <div className="flex gap-2 w-full pt-3">
                    {scenario.status === "ready" && (
                      <>
                        <Button
                          variant="quill"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            router.push(`/library/${scenario.id}`)
                          }
                        >
                          <PlayCircle className="h-3.5 w-3.5 mr-1" />
                          プレイ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-accent-gold"
                          disabled={isLoading}
                          onClick={() => handlePublish(scenario.id)}
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400"
                          disabled={isLoading}
                          onClick={() => handleDelete(scenario.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {scenario.status === "published" && (
                      <>
                        <Button
                          variant="quill"
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            router.push(`/library/${scenario.id}`)
                          }
                        >
                          <PlayCircle className="h-3.5 w-3.5 mr-1" />
                          プレイ
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-paper/60"
                          disabled={isLoading}
                          onClick={() => handleUnpublish(scenario.id)}
                        >
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </>
                    )}
                    {scenario.status === "generating" && (
                      <div className="flex items-center gap-2 text-xs text-blue-300 w-full">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        バックグラウンドで生成中...
                      </div>
                    )}
                    {scenario.status === "error" && (
                      <>
                        <Link href="/scenario/create" className="flex-1">
                          <Button variant="quill" size="sm" className="w-full">
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            再生成
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400"
                          disabled={isLoading}
                          onClick={() => handleDelete(scenario.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardFooter>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 公開シナリオカードコンポーネント
 */
function ScenarioCard({ scenario, index }: { scenario: PublishedScenario; index: number }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);

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

  const handleQuickPlay = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isStarting) return;
    setIsStarting(true);

    try {
      const response = await fetch("/api/game/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.originalScenarioId || scenario.id,
          hostDisplayName: "ホスト",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || data.error || "ゲームの作成に失敗しました");
      }

      router.push(`/game/${data.gameId}/lobby`);
    } catch (error) {
      console.error("Failed to create game:", error);
      alert("ゲームの作成に失敗しました。もう一度お試しください。");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Link href={`/library/${scenario.id}`}>
        <Card
          variant="parchment"
          className="group h-full transition-all duration-300 hover:scale-105 hover:shadow-2xl"
        >
          <CardHeader>
            <div className="mb-3 flex items-start justify-between">
              <Badge variant={difficultyColors[scenario.difficulty]}>
                {difficultyLabels[scenario.difficulty]}
              </Badge>
              {scenario.artStyle && (
                <Badge variant="outline" className="text-xs">
                  {scenario.artStyle}
                </Badge>
              )}
            </div>
            <CardTitle className="line-clamp-2 group-hover:text-accent-gold transition-colors">
              {scenario.title}
            </CardTitle>
            <CardDescription className="line-clamp-3 text-ink/70">
              {scenario.description}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-2 border-y border-ink/10 py-3">
              <div className="text-center">
                <Users className="mx-auto h-4 w-4 text-ink/60" />
                <p className="mt-1 text-xs font-semibold text-ink">
                  {scenario.characterCount}名
                </p>
                <p className="text-xs text-ink/40">人数</p>
              </div>
              <div className="text-center">
                <Users className="mx-auto h-4 w-4 text-ink/60" />
                <p className="mt-1 text-xs text-ink/60">
                  {scenario.stats.playCount.toLocaleString()}
                </p>
                <p className="text-xs text-ink/40">プレイ</p>
              </div>
              <div className="text-center">
                <Star className="mx-auto h-4 w-4 text-accent-gold" />
                <p className="mt-1 text-xs text-ink/60">
                  {scenario.stats.likeCount.toLocaleString()}
                </p>
                <p className="text-xs text-ink/40">いいね</p>
              </div>
              <div className="text-center">
                <Clock className="mx-auto h-4 w-4 text-ink/60" />
                <p className="mt-1 text-xs text-ink/60">{scenario.estimatedPlayTime}分</p>
                <p className="text-xs text-ink/40">時間</p>
              </div>
            </div>

            <BadgeGroup className="flex-wrap">
              {scenario.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline" size="sm" className="bg-ink/20 text-ink border-ink/30">
                  {tag}
                </Badge>
              ))}
            </BadgeGroup>

            <Button
              variant="quill"
              size="sm"
              className="w-full"
              onClick={handleQuickPlay}
              disabled={isStarting}
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  準備中...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  クイックプレイ
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex items-center justify-between border-t border-ink/10 text-xs text-ink/50">
            <span>作者: {scenario.authorName}</span>
            <span>
              {scenario.publishedAt?.toDate
                ? new Date(scenario.publishedAt.toDate()).toLocaleDateString("ja-JP")
                : "不明"}
            </span>
          </CardFooter>
        </Card>
      </Link>
    </motion.div>
  );
}
