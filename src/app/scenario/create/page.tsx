"use client";

/**
 * Scenario Creation Page (Wizard)
 * シナリオ生成ウィザード画面
 *
 * 4ステップのウィザード形式でシナリオを生成
 * Step 1: ジャンル選択
 * Step 2: プレイヤー設定
 * Step 3: アートスタイル
 * Step 4: 確認
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Select,
  Button,
  Progress,
  type SelectOption
} from "@/components";
import { ProgressStepper } from "@/components/molecules/ProgressStepper";
import { useToast } from "@/lib/hooks/useToast";
import {
  BookOpen,
  Sparkles,
  Users,
  Target,
  Palette,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Check,
  CheckCircle2,
  Shield,
  Library,
} from "lucide-react";

// ジョブステータス型
interface JobStatus {
  status: "processing" | "completed" | "failed";
  progress?: {
    stage: string;
    percentage: number;
    message: string;
  };
  result?: {
    id: string;
  };
  error?: string;
}

// ウィザードステップ定義
const WIZARD_STEPS = [
  { id: 1, label: "ジャンル", description: "物語の舞台" },
  { id: 2, label: "プレイヤー", description: "人数と難易度" },
  { id: 3, label: "スタイル", description: "アート設定" },
  { id: 4, label: "確認", description: "最終確認" },
];

export default function ScenarioCreatePage() {
  const router = useRouter();
  const toast = useToast();
  const { userId, displayName } = useAuth();

  // ウィザードステップ
  const [currentStep, setCurrentStep] = useState(1);

  // フォームパラメータ
  const [params, setParams] = useState({
    genre: "",
    playerCount: 4,
    difficulty: "normal" as "easy" | "normal" | "hard",
    artStyle: "anime" as "anime" | "oil_painting" | "realistic" | "sketch",
    userId: userId || "",
    userName: displayName || "探偵見習い"
  });

  // 認証状態が変化したらparamsを更新
  useEffect(() => {
    if (userId) {
      setParams((prev) => ({
        ...prev,
        userId,
        userName: displayName || prev.userName
      }));
    }
  }, [userId, displayName]);

  // 生成状態
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // ポーリング管理用refs（依存配列に入れないため）
  const pollingAttemptsRef = useRef(0);
  const isCompletedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // プレイヤー数オプション
  const playerCountOptions: SelectOption[] = [
    { value: "3", label: "3人" },
    { value: "4", label: "4人（推奨）" },
    { value: "5", label: "5人" },
    { value: "6", label: "6人" },
    { value: "7", label: "7人" },
    { value: "8", label: "8人" },
  ];

  // 難易度オプション
  const difficultyOptions: SelectOption[] = [
    { value: "easy", label: "初級 - 証拠は明確、推理は易しめ" },
    { value: "normal", label: "中級 - ほどよい難易度" },
    { value: "hard", label: "上級 - 複雑なトリック" },
  ];

  // アートスタイルオプション
  const artStyleOptions: SelectOption[] = [
    { value: "anime", label: "アニメ風" },
    { value: "oil_painting", label: "油絵風" },
    { value: "realistic", label: "リアル" },
    { value: "sketch", label: "スケッチ風" },
  ];

  // ジャンルプリセット
  const genrePresets = [
    "古典的な洋館殺人事件",
    "近未来のサイバー犯罪",
    "学園ミステリー",
    "豪華客船での密室殺人",
    "京都の老舗旅館での怪事件",
    "アイドルグループの楽屋裏事件",
  ];

  // ステップバリデーション
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!params.genre.trim()) {
          toast.error("ジャンルを入力してください");
          return false;
        }
        if (params.genre.length < 5) {
          toast.error("ジャンルは5文字以上で入力してください");
          return false;
        }
        return true;
      case 2:
      case 3:
        return true;
      default:
        return true;
    }
  };

  // 次のステップへ
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  // 前のステップへ
  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // シナリオ生成開始
  const handleGenerate = async () => {
    setIsGenerating(true);
    pollingAttemptsRef.current = 0;
    isCompletedRef.current = false;

    try {
      const res = await fetch("/api/scenario/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "シナリオ生成に失敗しました");
      }

      const data = await res.json();
      setJobId(data.jobId);
      toast.success("シナリオ生成を開始しました");
    } catch (error) {
      console.error("Scenario generation error:", error);
      toast.error(error instanceof Error ? error.message : "シナリオ生成に失敗しました");
      setIsGenerating(false);
    }
  };

  // ジョブステータスをポーリング
  useEffect(() => {
    if (!jobId) return;

    // 新しいAbortControllerを作成
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const pollJobStatus = async () => {
      // 既に完了処理済みの場合はスキップ
      if (isCompletedRef.current) return;

      try {
        const res = await fetch(`/api/scenario/status?jobId=${jobId}`, { signal });

        // アボートされた場合は処理しない
        if (signal.aborted) return;

        if (!res.ok) {
          throw new Error("ステータス取得に失敗しました");
        }

        const data: JobStatus = await res.json();
        setJobStatus(data);

        if (data.status === "completed") {
          // 完了フラグを立てて重複処理を防ぐ
          if (isCompletedRef.current) return;
          isCompletedRef.current = true;

          toast.success("シナリオが完成しました！");

          // 即座にナビゲーション（isGeneratingはtrueのまま維持して画面を安定させる）
          const scenarioId = data.result?.id;
          console.log("[Scenario Create] Completed, navigating to:", scenarioId);

          if (scenarioId) {
            router.push(`/library/${scenarioId}`);
          } else {
            console.warn("[Scenario Create] No scenario ID in result, redirecting to library");
            router.push("/library?tab=mine");
          }
          return;
        } else if (data.status === "failed") {
          // 失敗フラグも立てる
          if (isCompletedRef.current) return;
          isCompletedRef.current = true;

          console.error("[Scenario Create] Generation failed:", data.error);
          toast.error(`シナリオ生成に失敗しました: ${data.error || "不明なエラー"}`);
          setIsGenerating(false);
          return;
        }

        pollingAttemptsRef.current += 1;
      } catch (error) {
        // アボートエラーは無視
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("Polling error:", error);
        pollingAttemptsRef.current += 1;
      }
    };

    // 初回ポーリング
    pollJobStatus();

    // 定期ポーリング
    const interval = setInterval(() => {
      // 完了済みの場合は停止
      if (isCompletedRef.current) {
        clearInterval(interval);
        return;
      }

      // タイムアウトチェック (360回 * 5秒 = 30分)
      if (pollingAttemptsRef.current >= 360) {
        clearInterval(interval);
        if (!isCompletedRef.current) {
          isCompletedRef.current = true;
          toast.error("シナリオ生成がタイムアウトしました。もう一度お試しください。");
          setIsGenerating(false);
        }
        return;
      }

      pollJobStatus();
    }, 5000);

    // クリーンアップ
    return () => {
      clearInterval(interval);
      abortControllerRef.current?.abort();
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [jobId, router, toast]);

  // リセット
  const handleReset = useCallback(() => {
    // 進行中のリクエストをキャンセル
    abortControllerRef.current?.abort();
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }

    setJobId(null);
    setJobStatus(null);
    setIsGenerating(false);
    pollingAttemptsRef.current = 0;
    isCompletedRef.current = false;
    setCurrentStep(1);
  }, []);

  // ステップコンテンツのアニメーション
  const stepVariants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  return (
    <div className="min-h-screen ink-bg px-6 pt-24 pb-12">
      <div className="max-w-3xl mx-auto">
        {/* ヘッダー */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-parchment-light/70 hover:text-parchment-light transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-body">戻る</span>
          </button>

          <div className="flex items-center gap-4 mb-2">
            <motion.div
              animate={{
                rotate: [0, 5, -5, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <BookOpen className="h-10 w-10 text-gold-accent candle-glow" />
            </motion.div>
            <h1 className="font-title text-4xl text-parchment-light">
              新しき謎を綴る
            </h1>
          </div>
          <p className="text-parchment-light/70 font-body text-sm ml-14">
            あなただけのマーダーミステリーシナリオを生成します
          </p>
        </motion.div>

        {/* メインコンテンツ */}
        <AnimatePresence mode="wait">
          {!isGenerating ? (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* プログレスステッパー */}
              <div className="mb-8">
                <ProgressStepper
                  steps={WIZARD_STEPS}
                  currentStep={currentStep}
                  onStepClick={(step) => {
                    if (step < currentStep) setCurrentStep(step);
                  }}
                />
              </div>

              <Card variant="parchment" className="parchment-card">
                <CardHeader>
                  <CardTitle>
                    {currentStep === 1 && "物語のジャンルを選択"}
                    {currentStep === 2 && "プレイヤー設定"}
                    {currentStep === 3 && "アートスタイル"}
                    {currentStep === 4 && "設定の確認"}
                  </CardTitle>
                  <CardDescription>
                    {currentStep === 1 && "どんな雰囲気のミステリーにしますか？"}
                    {currentStep === 2 && "参加人数と難易度を設定します"}
                    {currentStep === 3 && "キャラクター画像のスタイルを選択"}
                    {currentStep === 4 && "設定内容を確認して生成を開始"}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <AnimatePresence mode="wait">
                    {/* Step 1: ジャンル選択 */}
                    {currentStep === 1 && (
                      <motion.div
                        key="step1"
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-6"
                      >
                        <div>
                          <label className="flex items-center gap-2 text-sm font-body font-semibold text-ink-black mb-2">
                            <Sparkles className="h-4 w-4 text-gold-accent" />
                            物語のジャンル
                          </label>
                          <Input
                            placeholder="例: 古典的な洋館殺人事件、近未来のサイバー犯罪..."
                            value={params.genre}
                            onChange={(e) => setParams({ ...params, genre: e.target.value })}
                          />
                          <p className="text-xs text-ink-brown/70 mt-1 font-body">
                            具体的に書くほど、イメージに近いシナリオが生成されます
                          </p>
                        </div>

                        {/* ジャンルプリセット */}
                        <div>
                          <p className="text-xs text-ink-brown/70 mb-2 font-body">
                            または、おすすめから選ぶ:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {genrePresets.map((preset) => (
                              <button
                                key={preset}
                                onClick={() => setParams({ ...params, genre: preset })}
                                className={`
                                  px-3 py-1.5 text-xs font-body rounded-full
                                  transition-all border
                                  ${params.genre === preset
                                    ? "bg-gold-accent text-ink-black border-gold-accent"
                                    : "bg-transparent text-ink-brown border-ink-brown/30 hover:border-gold-accent hover:text-gold-accent"
                                  }
                                `}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: プレイヤー設定 */}
                    {currentStep === 2 && (
                      <motion.div
                        key="step2"
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-6"
                      >
                        <div>
                          <label className="flex items-center gap-2 text-sm font-body font-semibold text-ink-black mb-2">
                            <Users className="h-4 w-4 text-gold-accent" />
                            プレイヤー数
                          </label>
                          <Select
                            options={playerCountOptions}
                            value={String(params.playerCount)}
                            onChange={(value) => setParams({ ...params, playerCount: Number(value) })}
                          />
                          <p className="text-xs text-ink-brown/70 mt-1 font-body">
                            AIエージェントと人間プレイヤーを合わせた総数です
                          </p>
                        </div>

                        <div>
                          <label className="flex items-center gap-2 text-sm font-body font-semibold text-ink-black mb-2">
                            <Target className="h-4 w-4 text-gold-accent" />
                            難易度
                          </label>
                          <Select
                            options={difficultyOptions}
                            value={params.difficulty}
                            onChange={(value) => setParams({ ...params, difficulty: value as any })}
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: アートスタイル */}
                    {currentStep === 3 && (
                      <motion.div
                        key="step3"
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-6"
                      >
                        <div>
                          <label className="flex items-center gap-2 text-sm font-body font-semibold text-ink-black mb-2">
                            <Palette className="h-4 w-4 text-gold-accent" />
                            アートスタイル
                          </label>

                          {/* ビジュアルなスタイル選択 */}
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            {artStyleOptions.map((style) => (
                              <button
                                key={style.value}
                                onClick={() => setParams({ ...params, artStyle: style.value as any })}
                                className={`
                                  p-4 rounded-lg border-2 transition-all text-left
                                  ${params.artStyle === style.value
                                    ? "border-gold-accent bg-gold-accent/10"
                                    : "border-ink-brown/20 hover:border-gold-accent/50"
                                  }
                                `}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-2xl">
                                    {style.value === "anime" && "🎨"}
                                    {style.value === "oil_painting" && "🖼"}
                                    {style.value === "realistic" && "📷"}
                                    {style.value === "sketch" && "✏️"}
                                  </span>
                                  {params.artStyle === style.value && (
                                    <Check className="h-5 w-5 text-gold-accent" />
                                  )}
                                </div>
                                <p className="font-body font-semibold text-ink-black">
                                  {style.label}
                                </p>
                                <p className="text-xs text-ink-brown/70 mt-1">
                                  {style.value === "anime" && "明るく親しみやすい雰囲気"}
                                  {style.value === "oil_painting" && "重厚で芸術的な雰囲気"}
                                  {style.value === "realistic" && "リアルで臨場感のある雰囲気"}
                                  {style.value === "sketch" && "手書きの温かみのある雰囲気"}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 4: 確認 */}
                    {currentStep === 4 && (
                      <motion.div
                        key="step4"
                        variants={stepVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="space-y-6"
                      >
                        <div className="bg-ink-brown/5 rounded-lg p-4 space-y-4">
                          <div className="flex justify-between items-center py-2 border-b border-ink-brown/10">
                            <span className="text-ink-brown/70 font-body">ジャンル</span>
                            <span className="font-body font-semibold text-ink-black">{params.genre}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-ink-brown/10">
                            <span className="text-ink-brown/70 font-body">プレイヤー数</span>
                            <span className="font-body font-semibold text-ink-black">{params.playerCount}人</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-ink-brown/10">
                            <span className="text-ink-brown/70 font-body">難易度</span>
                            <span className="font-body font-semibold text-ink-black">
                              {difficultyOptions.find((d) => d.value === params.difficulty)?.label.split(" - ")[0]}
                            </span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-ink-brown/70 font-body">アートスタイル</span>
                            <span className="font-body font-semibold text-ink-black">
                              {artStyleOptions.find((a) => a.value === params.artStyle)?.label}
                            </span>
                          </div>
                        </div>

                        <div className="bg-gold-accent/10 rounded-lg p-4 border border-gold-accent/30">
                          <p className="text-sm text-ink-brown font-body">
                            <strong>注意:</strong> シナリオの生成には数分かかる場合があります。
                            生成はバックグラウンドで実行されるため、このページを離れても大丈夫です。
                            マイライブラリで進捗を確認できます。
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ナビゲーションボタン */}
                  <div className="flex justify-between mt-8 pt-6 border-t border-ink-brown/10">
                    <Button
                      onClick={handlePrev}
                      variant="ghost"
                      disabled={currentStep === 1}
                      className="text-ink-brown"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      戻る
                    </Button>

                    {currentStep < 4 ? (
                      <Button onClick={handleNext} variant="seal" className="gold-button">
                        次へ
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    ) : (
                      <Button onClick={handleGenerate} variant="seal" className="gold-button">
                        <Sparkles className="h-4 w-4 mr-2" />
                        シナリオを生成する
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            // 進捗表示
            <motion.div
              key="progress"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card variant="dark" className="book-card bg-ink-black/90 border-2 border-gold-accent/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-parchment-light">
                      シナリオを綴っています...
                    </CardTitle>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <RefreshCw className="h-5 w-5 text-gold-accent" />
                    </motion.div>
                  </div>
                  <CardDescription className="text-parchment-light/70">
                    {jobStatus?.progress?.message || "準備中..."}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div>
                    <Progress
                      value={jobStatus?.progress?.percentage || 0}
                      variant="success"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-sm text-parchment-light/70 font-body">
                        {jobStatus?.progress?.stage || "準備中"}
                      </p>
                      <p className="text-sm font-title text-gold-accent font-bold">
                        {jobStatus?.progress?.percentage || 0}%
                      </p>
                    </div>
                  </div>

                  <div className="parchment-card p-4 space-y-2">
                    <h4 className="text-sm font-title font-bold text-ink-black mb-3">
                      生成の流れ
                    </h4>
                    <div className="space-y-2 text-xs font-body text-ink-brown">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (jobStatus?.progress?.percentage ?? 0) >= 10 ? "bg-gold-accent" : "bg-ink-brown/30"
                        }`} />
                        <span>真相とトリックの確定</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (jobStatus?.progress?.percentage ?? 0) >= 30 ? "bg-gold-accent" : "bg-ink-brown/30"
                        }`} />
                        <span>登場人物の設定</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (jobStatus?.progress?.percentage ?? 0) >= 50 ? "bg-gold-accent" : "bg-ink-brown/30"
                        }`} />
                        <span>証拠品の配置</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (jobStatus?.progress?.percentage ?? 0) >= 70 ? "bg-gold-accent" : "bg-ink-brown/30"
                        }`} />
                        <span>キャラクター画像の生成</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          (jobStatus?.progress?.percentage ?? 0) >= 90 ? "bg-gold-accent" : "bg-ink-brown/30"
                        }`} />
                        <span>バランスの検証</span>
                      </div>
                    </div>
                  </div>

                  {/* 安心メッセージ */}
                  <div className="rounded-lg border border-gold-accent/20 bg-gold-accent/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-gold-accent">
                      <Shield className="h-4 w-4" />
                      <span className="text-sm font-body font-semibold">このページを離れても、生成は続きます</span>
                    </div>
                    <p className="text-xs text-parchment-light/60 font-body ml-6">
                      マイライブラリでいつでも進捗を確認できます
                    </p>
                    <div className="ml-6 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-parchment-light/70 font-body">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        バックグラウンドで安全に生成されます
                      </div>
                      <div className="flex items-center gap-2 text-xs text-parchment-light/70 font-body">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        完成したらマイライブラリに表示されます
                      </div>
                      <div className="flex items-center gap-2 text-xs text-parchment-light/70 font-body">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        他のシナリオで遊びながら待てます
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        router.push("/library?tab=mine");
                      }}
                      variant="ghost"
                      className="w-full py-3 text-gold-accent hover:text-ink-black hover:bg-gold-accent border-2 border-gold-accent/50 hover:border-gold-accent rounded-lg font-body font-semibold transition-all"
                    >
                      <Library className="h-4 w-4 mr-2" />
                      マイライブラリで確認する
                    </Button>
                    <Button
                      onClick={handleReset}
                      variant="ghost"
                      className="w-full text-parchment-light/50 hover:text-parchment-light text-xs"
                    >
                      生成をキャンセルする
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
