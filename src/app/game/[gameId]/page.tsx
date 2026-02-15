"use client";

/**
 * Game Main Screen (Enhanced with Realtime & New UI)
 * ゲームメイン画面（リアルタイム同期 + 新UIコンポーネント統合）
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import type { GameState, Scenario } from "@/core/types";
import { useToast } from "@/lib/hooks/useToast";
import { useAuth } from "@/lib/hooks/useAuth";

// サブコンポーネント（既存）
import { CharacterAvatarHeader } from "./components/CharacterAvatarHeader";
import { LeftSidebar } from "./components/LeftSidebar";
import { RightSidebar } from "./components/RightSidebar";
import { MapView } from "./components/MapView";
import { BgmPlayer } from "./components/BgmPlayer";
import { VotingPanel } from "./components/VotingPanel";
import { ExplorationPanel } from "./components/ExplorationPanel";
import { PrologueModal } from "./components/PrologueModal";
import { PhaseGuideCompact } from "./components/PhaseGuide";
import { PhaseTransitionOverlay } from "./components/PhaseTransitionOverlay";

// 新UIコンポーネント
import { PhaseTimeline, PhaseTimer, AIThinkingIndicator, Progress } from "@/components";
import type { GamePhase } from "@/core/types";

// ========================================
// モジュールレベル定数（毎レンダリングの再作成を防止）
// ========================================
const PHASE_ORDER: GamePhase[] = [
  "setup", "generation", "lobby", "prologue",
  "exploration_1", "discussion_1",
  "exploration_2", "discussion_2",
  "voting", "ending", "ended"
];

const PHASE_LABELS: Record<string, { ja: string; subtitle: string; icon: string }> = {
  setup: { ja: "序章", subtitle: "集いの間", icon: "🚪" },
  generation: { ja: "準備", subtitle: "運命の編纂", icon: "📜" },
  lobby: { ja: "待機", subtitle: "仮面の選択", icon: "🎭" },
  prologue: { ja: "導入", subtitle: "記憶の同調", icon: "📖" },
  exploration_1: { ja: "探索一", subtitle: "前半探索", icon: "🔍" },
  discussion_1: { ja: "第一章", subtitle: "前半議論", icon: "💬" },
  exploration_2: { ja: "探索二", subtitle: "後半探索", icon: "🔎" },
  discussion_2: { ja: "第二章", subtitle: "後半議論", icon: "💭" },
  voting: { ja: "審判", subtitle: "投票", icon: "⚖️" },
  ending: { ja: "終章", subtitle: "真相開示", icon: "🎬" },
  ended: { ja: "完", subtitle: "物語の終幕", icon: "📕" },
};

const OVERLAY_SKIP_PHASES: GamePhase[] = ["setup", "generation", "lobby"];

// リアルタイム同期フック
import {
  useGameState,
  useAIThinkingStates,
  usePhaseTimer,
  useGameMessages,
} from "@/hooks/useGameRealtime";

type PageProps = {
  params: Promise<{ gameId: string }>;
};

export default function GamePage({ params }: PageProps) {
  const { gameId } = use(params);
  const router = useRouter();
  const toast = useToast();

  // 認証状態（リスナーより先に取得する必要がある）
  const { userId } = useAuth();
  const currentUserId = userId || "";

  // リアルタイム同期（Firestore Listeners）
  // userId を渡して認証完了後にのみリスナーを開始する
  const { gameState: realtimeGame, loading: realtimeLoading, error: realtimeError } = useGameState(gameId, userId);
  const { thinkingAgents } = useAIThinkingStates(gameId, userId);
  const { remainingSeconds, isActive: isTimerActive } = usePhaseTimer(realtimeGame);
  const { messages } = useGameMessages(gameId, userId);

  // シナリオデータ
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  // 犯人フラグ（サーバーから取得）
  const [isCulprit, setIsCulprit] = useState(false);

  // UI状態
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isBgmPlayerOpen, setIsBgmPlayerOpen] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [showPrologueModal, setShowPrologueModal] = useState(false);
  const [showPhaseTransition, setShowPhaseTransition] = useState(false);
  const handlePhaseTransitionComplete = useCallback(() => setShowPhaseTransition(false), []);
  const previousPhaseRef = useRef<GamePhase | null>(null);
  const showPrologueModalRef = useRef(false);

  // ========================================
  // 安定したコールバック（React.memoを壊さないため）
  // ========================================
  const handleLeftSidebarToggle = useCallback(() => setIsLeftSidebarOpen(prev => !prev), []);
  const handleRightSidebarToggle = useCallback(() => setIsRightSidebarOpen(prev => !prev), []);
  const handleBgmToggle = useCallback(() => setIsBgmPlayerOpen(prev => !prev), []);
  const handleLeftSidebarClose = useCallback(() => setIsLeftSidebarOpen(false), []);
  const handleRightSidebarClose = useCallback(() => setIsRightSidebarOpen(false), []);
  const handleBgmClose = useCallback(() => setIsBgmPlayerOpen(false), []);
  const handlePrologueModalClose = useCallback(() => setShowPrologueModal(false), []);
  const handlePrologueModalOpen = useCallback(() => setShowPrologueModal(true), []);
  const handleTimelineModalClose = useCallback(() => setShowTimelineModal(false), []);
  const handleTimelineModalOpen = useCallback(() => setShowTimelineModal(true), []);
  const handleTimeoutModalClose = useCallback(() => setShowTimeoutModal(false), []);

  // アクティブなゲームデータ（Firestoreから取得）
  const activeGame = realtimeGame;

  // フェーズ進行度を計算（メモ化）
  const phaseProgress = useMemo(() => {
    if (!activeGame?.phase) return 0;
    const index = PHASE_ORDER.indexOf(activeGame.phase);
    if (index === -1) return 0;
    return Math.round((index / (PHASE_ORDER.length - 1)) * 100);
  }, [activeGame?.phase]);

  // シナリオデータ読み込み（ゲームデータが確定したら）
  // scenarioを依存配列に入れると無限ループの原因になるため、
  // useRefで取得済み情報を追跡（scenarioId + userId）
  const fetchedRef = useRef<{ scenarioId: string; userId: string } | null>(null);

  useEffect(() => {
    if (!activeGame?.scenarioId || !currentUserId) return;
    // 既に同じシナリオ・ユーザーで取得済みならスキップ
    if (
      fetchedRef.current?.scenarioId === activeGame.scenarioId &&
      fetchedRef.current?.userId === currentUserId
    ) {
      return;
    }

    const fetchScenario = async () => {
      setScenarioLoading(true);
      try {
        // ゲームコンテキスト付きシナリオAPI（セキュリティ対策済み）
        const response = await fetch(
          `/api/game/${gameId}/scenario?userId=${encodeURIComponent(currentUserId)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch scenario");
        }
        const data = await response.json();
        // APIレスポンス形式に対応
        const scenarioData = data.scenario || data;
        setScenario(scenarioData);
        // 犯人フラグを設定
        setIsCulprit(data.isCulprit || false);
        // フェッチ完了を記録
        fetchedRef.current = {
          scenarioId: activeGame.scenarioId,
          userId: currentUserId,
        };
      } catch (error) {
        console.error("[Game] Failed to load scenario:", error);
        setScenario(null);
      } finally {
        setScenarioLoading(false);
      }
    };

    fetchScenario();
  }, [activeGame?.scenarioId, currentUserId, gameId]);

  // エラー判定
  const isGameNotFound = !realtimeLoading && !realtimeGame;
  const isScenarioNotFound = activeGame && !scenarioLoading && !scenario;

  // エンディングフェーズへの自動遷移
  useEffect(() => {
    if (activeGame?.phase === "ending") {
      router.push(`/game/${gameId}/ending`);
    }
  }, [activeGame?.phase, gameId, router]);

  // prologueフェーズでモーダルを自動表示
  useEffect(() => {
    if (activeGame?.phase === "prologue" && scenario) {
      setShowPrologueModal(true);
    }
  }, [activeGame?.phase, scenario]);

  // showPrologueModal変更時にrefも同期
  useEffect(() => { showPrologueModalRef.current = showPrologueModal; }, [showPrologueModal]);

  // フェーズがprologueから他に遷移したらモーダルを即座にクローズ
  // 遅延があるとz-50オーバーレイがクリックをブロックするため即座に閉じる
  useEffect(() => {
    if (activeGame?.phase && activeGame.phase !== "prologue" && showPrologueModalRef.current) {
      setShowPrologueModal(false);
    }
  }, [activeGame?.phase]);

  // フェーズ遷移検知 → オーバーレイ表示
  // セットアップ系フェーズ（setup, generation, lobby）では表示しない
  useEffect(() => {
    if (!activeGame?.phase) return;

    const prevPhase = previousPhaseRef.current;
    previousPhaseRef.current = activeGame.phase;

    // 初回は表示しない、セットアップ系フェーズもスキップ
    if (!prevPhase) return;
    if (prevPhase === activeGame.phase) return;
    if (OVERLAY_SKIP_PHASES.includes(activeGame.phase)) return;

    setShowPhaseTransition(true);
  }, [activeGame?.phase]);

  // 現在のプレイヤーのキャラクター情報を取得
  const currentPlayer = activeGame?.players[currentUserId];
  const currentCharacter = scenario?.data.characters.find(
    (c) => c.id === currentPlayer?.characterId
  );

  // ========================================
  // ハートビート方式AIトリガー（議論フェーズ用）
  // 各AIが独立・並列で定期的に「今発言すべきか」を判断
  // ========================================
  const heartbeatTimersRef = useRef<NodeJS.Timeout[]>([]);
  const heartbeatPendingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 議論フェーズのみ
    if (!activeGame || !scenario) return;
    if (activeGame.phase !== "discussion_1" && activeGame.phase !== "discussion_2") return;

    // AIプレイヤーを取得
    const aiPlayers = Object.entries(activeGame.players)
      .filter(([, p]) => !p.isHuman);

    if (aiPlayers.length === 0) return;

    const timers: NodeJS.Timeout[] = [];
    const HEARTBEAT_INTERVAL = 30000; // 全AI共通: 30秒間隔
    const STAGGER_OFFSET = 10000;     // AI間オフセット: 10秒

    aiPlayers.forEach(([playerId], index) => {
      const agentId = `agent_${playerId}`;
      const initialDelay = 3000 + index * STAGGER_OFFSET; // 3s, 13s, 23s...

      // 初回遅延後にスタート
      const firstTimeout = setTimeout(() => {
        callHeartbeat(gameId, agentId);

        // 以降は等間隔で定期実行
        const interval = setInterval(() => {
          callHeartbeat(gameId, agentId);
        }, HEARTBEAT_INTERVAL);

        timers.push(interval);
      }, initialDelay);

      timers.push(firstTimeout as unknown as NodeJS.Timeout);
    });

    heartbeatTimersRef.current = timers;

    return () => {
      timers.forEach(id => { clearInterval(id); clearTimeout(id); });
      heartbeatTimersRef.current = [];
      heartbeatPendingRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, activeGame?.phase, scenario]);

  /** ハートビート呼び出し関数（pendingRef排他制御付き） */
  async function callHeartbeat(gId: string, agentId: string) {
    // 前回のheartbeatがまだ処理中ならスキップ
    if (heartbeatPendingRef.current.has(agentId)) {
      console.log(`[Heartbeat] ${agentId} still pending, skipping`);
      return;
    }
    heartbeatPendingRef.current.add(agentId);

    try {
      await fetch("/api/agent/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: gId, agentId }),
      });
    } catch (error) {
      console.error(`[Heartbeat] Failed for ${agentId}:`, error);
    } finally {
      heartbeatPendingRef.current.delete(agentId);
    }
  }

  // フェーズ遷移後の安定化追跡（時間切れポップアップの誤表示防止）
  const phaseStabilizedRef = useRef(false);
  const phaseStabilizeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    phaseStabilizedRef.current = false;
    if (phaseStabilizeTimerRef.current) clearTimeout(phaseStabilizeTimerRef.current);
    phaseStabilizeTimerRef.current = setTimeout(() => {
      phaseStabilizedRef.current = true;
    }, 2000);
    return () => {
      if (phaseStabilizeTimerRef.current) clearTimeout(phaseStabilizeTimerRef.current);
    };
  }, [activeGame?.phase]);

  // 時間切れ検知（stabilized後のみ）
  useEffect(() => {
    if (
      activeGame &&
      (activeGame.phase === "discussion_1" || activeGame.phase === "discussion_2") &&
      isTimerActive &&
      remainingSeconds === 0 &&
      phaseStabilizedRef.current // フェーズ遷移から2秒以上経過
    ) {
      setShowTimeoutModal(true);
    }
  }, [activeGame?.phase, remainingSeconds, isTimerActive]);

  // フェーズ変更時にタイムアウトモーダルを閉じる
  // previousPhaseRef は上のフェーズ遷移オーバーレイ用effectで管理するため、ここでは書き込まない
  useEffect(() => {
    setShowTimeoutModal(false);
  }, [activeGame?.phase]);

  // フェーズタイマー監視（10秒ごと）
  useEffect(() => {
    if (!activeGame || activeGame.phase === "ended") {
      return;
    }

    const timerInterval = setInterval(async () => {
      try {
        await fetch(`/api/gm/phase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameId, action: "check_expired" })
        });
      } catch (error) {
        console.error("Failed to check phase timer:", error);
      }
    }, 10000); // 10秒

    return () => clearInterval(timerInterval);
  }, [gameId, activeGame?.phase]);

  /**
   * プロローグ準備完了ハンドラ
   */
  const handlePrologueReady = async () => {
    if (!currentUserId || !activeGame) return;

    try {
      const response = await fetch("/api/game/prologue-ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          userId: currentUserId,
        }),
      });

      if (response.ok) {
        toast.success("準備完了しました");
      } else {
        toast.error("準備完了に失敗しました");
      }
    } catch (error) {
      console.error("Failed to mark prologue ready:", error);
      toast.error("準備完了に失敗しました");
    }
  };

  // エラー表示（Firestoreロード完了後、かつゲームが見つからない場合）
  if (isGameNotFound) {
    return (
      <div className="flex min-h-screen items-center justify-center ink-bg">
        <div className="parchment-card p-12 text-center max-w-md">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="text-6xl mb-6"
          >
            ⚠️
          </motion.div>
          <h1 className="font-title text-2xl text-ink-black mb-4">
            迷い込んだようだ...
          </h1>
          <p className="font-body text-ink-brown mb-6">
            指定されたゲームが存在しないか、既に物語は完結しております。
          </p>
          <button
            onClick={() => router.push("/library")}
            className="gold-button w-full"
          >
            📚 書庫へ戻る
          </button>
        </div>
      </div>
    );
  }

  // シナリオが見つからない場合のエラー
  if (isScenarioNotFound) {
    return (
      <div className="flex min-h-screen items-center justify-center ink-bg">
        <div className="parchment-card p-12 text-center max-w-md">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="text-6xl mb-6"
          >
            📜
          </motion.div>
          <h1 className="font-title text-2xl text-ink-black mb-4">
            謎の書が見つからない...
          </h1>
          <p className="font-body text-ink-brown mb-6">
            シナリオデータの取得に失敗しました。
          </p>
          <button
            onClick={() => router.push("/library")}
            className="gold-button w-full"
          >
            📚 書庫へ戻る
          </button>
        </div>
      </div>
    );
  }

  // ローディング
  if (!activeGame || !scenario) {
    return (
      <div className="flex min-h-screen items-center justify-center ink-bg">
        <div className="text-center parchment-card p-12 space-y-6">
          <motion.div
            animate={{
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="text-6xl candle-glow"
          >
            📚
          </motion.div>
          <p className="font-title text-xl text-ink-black shimmer-effect">
            {realtimeLoading ? "古の書物を開く..." : "記憶を辿る..."}
          </p>
          <div className="flex gap-2 justify-center">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
              className="w-2 h-2 rounded-full bg-gold-accent"
            />
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
              className="w-2 h-2 rounded-full bg-gold-accent"
            />
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
              className="w-2 h-2 rounded-full bg-gold-accent"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden ink-bg">
      {/* ヘッダー: キャラクターアバター + フェーズ情報 */}
      <div className="absolute top-0 left-0 right-0 z-30 border-b-2 border-gold-accent/20 bg-ink-black/95 backdrop-blur-md shadow-xl">
        <CharacterAvatarHeader
          game={activeGame}
          scenario={scenario}
          currentUserId={currentUserId}
          onLeftSidebarToggle={handleLeftSidebarToggle}
          onRightSidebarToggle={handleRightSidebarToggle}
          isBgmPlaying={isBgmPlayerOpen}
          onBgmToggle={handleBgmToggle}
        />

        {/* フェーズタイマー（ヘッダー下部） */}
        <div className="px-4 pb-3">
          {/* プログレスバー（常時表示） */}
          <div className="mb-3">
            <Progress
              value={phaseProgress}
              variant="default"
              size="sm"
              animated
            />
          </div>

          <div className="flex items-center gap-3">
            {/* 左: フェーズ情報（クリックでタイムライン表示）+ タイマー + フェーズ目標 */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleTimelineModalOpen}
                className="px-3 py-1.5 rounded-lg bg-accent-gold/20 border border-accent-gold/50
                           hover:bg-accent-gold/30 transition-colors flex items-center gap-2 cursor-pointer"
                title={PHASE_LABELS[activeGame.phase]?.subtitle || activeGame.phase}
              >
                <span>{PHASE_LABELS[activeGame.phase]?.icon || "📖"}</span>
                <span className="text-xs font-serif text-accent-gold font-bold">
                  {PHASE_LABELS[activeGame.phase]?.ja || activeGame.phase}
                </span>
              </button>
              <PhaseTimer
                remainingSeconds={remainingSeconds}
                isActive={isTimerActive}
                warningThreshold={60}
                compact
              />
              {/* フェーズ目標（コンパクト版） */}
              <div className="hidden sm:block border-l border-paper/20 pl-3">
                <PhaseGuideCompact phase={activeGame.phase} />
              </div>
            </div>

            {/* 右: 手動遷移ボタン */}
            <div className="ml-auto flex items-center gap-2">

              {/* プロローグ再表示ボタン（setup, generation, lobby以外のフェーズで表示） */}
              {activeGame.phase !== "setup" && activeGame.phase !== "generation" && activeGame.phase !== "lobby" && (
                <button
                  onClick={handlePrologueModalOpen}
                  className="px-3 py-1 rounded-lg bg-paper/10 border border-paper/30 text-xs font-body text-paper/80 hover:bg-paper/20 hover:border-paper/50 transition-all duration-300 flex items-center gap-1"
                  title="あらすじを再表示"
                >
                  <span>📜</span>
                  <span>あらすじ</span>
                </button>
              )}

              {/* ホストのみ: 手動フェーズ遷移ボタン */}
              {activeGame.hostId === currentUserId && activeGame.phase !== "ended" && (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/gm/phase`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ gameId, action: "transition" })
                      });

                      if (!res.ok) {
                        toast.error("フェーズ遷移に失敗しました");
                      } else {
                        toast.success("次のフェーズへ進みました");
                      }
                    } catch (error) {
                      console.error("Phase transition error:", error);
                      toast.error("フェーズ遷移に失敗しました");
                    }
                  }}
                  className="px-3 py-1 rounded-lg bg-gold-accent/20 border border-gold-accent/50 text-xs font-body text-gold-accent hover:bg-gold-accent/30 hover:border-gold-accent transition-all duration-300 flex items-center gap-1"
                >
                  <span>⏭️</span>
                  <span>次へ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* タイムラインモーダル */}
      <AnimatePresence>
        {showTimelineModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleTimelineModalClose}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-2xl w-full max-h-[80vh] overflow-auto"
            >
              <PhaseTimeline currentPhase={activeGame.phase} />
              <div className="mt-4 text-center">
                <button
                  onClick={handleTimelineModalClose}
                  className="px-6 py-2 bg-accent-gold text-ink font-serif font-bold rounded-lg hover:bg-accent-gold/90 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI思考中インジケーター（画面下部） */}
      <AnimatePresence>
        {Array.from(thinkingAgents.entries()).map(([agentId, state]) => {
          const agent = Object.values(activeGame.players).find((p) => p.characterId === agentId);
          if (!agent) return null;

          return (
            <motion.div
              key={agentId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40"
            >
              <AIThinkingIndicator
                agentName={agent.displayName}
                state={state}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* 左サイドバー */}
      <AnimatePresence>
        {isLeftSidebarOpen && (
          <LeftSidebar
            game={activeGame}
            scenario={scenario}
            currentUserId={currentUserId}
            onClose={handleLeftSidebarClose}
          />
        )}
      </AnimatePresence>

      {/* 右サイドバー */}
      <AnimatePresence>
        {isRightSidebarOpen && (
          <RightSidebar
            game={activeGame}
            scenario={scenario}
            currentUserId={currentUserId}
            onClose={handleRightSidebarClose}
            messages={messages}
          />
        )}
      </AnimatePresence>

      {/* メインビュー: フェーズに応じて表示切り替え */}
      <div className="absolute top-36 left-0 right-0 bottom-0 overflow-hidden">
        {activeGame.phase === "voting" ? (
          // 投票フェーズ: 投票パネルを表示
          <div className="h-full flex items-center justify-center p-8 overflow-y-auto">
            <VotingPanel
              game={activeGame}
              scenario={scenario}
              currentUserId={currentUserId}
            />
          </div>
        ) : activeGame.phase === "exploration_1" ||
          activeGame.phase === "exploration_2" ? (
          // 探索フェーズ: 探索パネルを表示
          <ExplorationPanel
            game={activeGame}
            scenario={scenario}
            currentUserId={currentUserId}
          />
        ) : (
          // その他のフェーズ: マップを表示
          <MapView game={activeGame} scenario={scenario} currentUserId={currentUserId} />
        )}
      </div>

      {/* BGMプレイヤー */}
      <BgmPlayer
        isOpen={isBgmPlayerOpen}
        onClose={handleBgmClose}
        defaultTrackId="dark-library"
      />

      {/* プロローグモーダル（いつでも再表示可能） */}
      {scenario && (
        <div className={showPrologueModal ? undefined : "pointer-events-none"}>
          <PrologueModal
            scenario={scenario}
            currentCharacter={currentCharacter}
            isCulprit={isCulprit}
            isOpen={showPrologueModal}
            onClose={handlePrologueModalClose}
            showReopenHint={activeGame.phase === "prologue"}
            gameState={activeGame}
            currentUserId={currentUserId}
            onPrologueReady={handlePrologueReady}
          />
        </div>
      )}

      {/* フェーズ遷移オーバーレイ */}
      <PhaseTransitionOverlay
        currentPhase={activeGame.phase}
        isVisible={showPhaseTransition}
        onComplete={handlePhaseTransitionComplete}
      />

      {/* 時間切れモーダル */}
      <AnimatePresence>
        {showTimeoutModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 backdrop-blur-sm p-4"
            onClick={handleTimeoutModalClose}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full bg-gradient-to-br from-paper via-paper-dark to-paper rounded-xl border-2 border-accent-red shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center space-y-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                  className="text-6xl"
                >
                  ⏰
                </motion.div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-ink mb-2">
                    時間切れ！
                  </h2>
                  <p className="text-sm text-ink/70">
                    議論フェーズの制限時間が終了しました。<br />
                    まもなく次のフェーズに移行します。
                  </p>
                </div>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 3, ease: "linear" }}
                  className="h-1 bg-accent-red rounded-full"
                />
                <button
                  onClick={handleTimeoutModalClose}
                  className="px-6 py-2 bg-accent-gold text-ink font-serif font-bold rounded-lg hover:bg-accent-gold/90 transition-colors"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
