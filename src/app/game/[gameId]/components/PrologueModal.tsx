"use client";

/**
 * PrologueModal
 * プロローグフェーズで表示されるモーダル
 * - あらすじ
 * - 個人タイムライン（自分の行動記録のみ）
 * - あなたの役割（キャラクター情報）
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, BookOpen, Clock, User, Loader2, CheckCircle, AlertTriangle, Shield } from "lucide-react";
import type { Scenario, CharacterDefinition, GameState } from "@/core/types";
import { Card, CardHeader, CardTitle, CardContent, Badge, Tabs } from "@/components";
import type { Tab } from "@/components";

interface PrologueModalProps {
  scenario: Scenario;
  currentCharacter: CharacterDefinition | undefined;
  /** 犯人かどうか（サーバーから取得） */
  isCulprit: boolean;
  isOpen: boolean;
  onClose: () => void;
  /** 再表示可能であることをヒント表示するか（プロローグフェーズ時のみtrue） */
  showReopenHint?: boolean;
  /** ゲーム状態（Readyボタン表示用） */
  gameState?: GameState;
  /** 現在のユーザーID */
  currentUserId?: string;
  /** 準備完了コールバック */
  onPrologueReady?: () => void;
}

/**
 * あらすじタブ
 */
function StoryTab({
  introText,
  onPlayNarration,
  onPauseNarration,
  isPlaying,
  isLoading,
}: {
  introText: string;
  onPlayNarration: () => void;
  onPauseNarration: () => void;
  isPlaying: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* ナレーション再生ボタン */}
      <div className="flex justify-center">
        <button
          onClick={isPlaying ? onPauseNarration : onPlayNarration}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-accent/20
                     border border-gold-accent/50 hover:bg-gold-accent/30 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-gold-accent" />
              <span className="text-sm text-parchment-light">生成中...</span>
            </>
          ) : isPlaying ? (
            <>
              <Pause className="w-5 h-5 text-gold-accent" />
              <span className="text-sm text-parchment-light">一時停止</span>
            </>
          ) : (
            <>
              <Play className="w-5 h-5 text-gold-accent" />
              <span className="text-sm text-parchment-light">ナレーションを再生</span>
            </>
          )}
        </button>
      </div>

      {/* 再生中インジケーター */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-center gap-2 text-sm text-gold-accent"
          >
            <Volume2 className="w-4 h-4 animate-pulse" />
            <span>ナレーション再生中...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* あらすじテキスト */}
      <Card variant="parchment">
        <CardContent className="p-6">
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap font-serif">
            {introText}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * タイムラインタブ
 * 自分のキャラクターの個人タイムライン（handout.timeline）のみを表示
 * ※全体のmasterTimelineは表示しない（プレイヤー同士で情報共有して推理する）
 */
function TimelineTab({
  character,
}: {
  character: CharacterDefinition | undefined;
}) {
  if (!character) {
    return (
      <Card variant="dark">
        <CardContent className="p-8 text-center text-paper/60">
          キャラクターが選択されていません
        </CardContent>
      </Card>
    );
  }

  const personalTimeline = character.handout?.timeline || [];

  return (
    <div className="space-y-4">
      <Card variant="dark">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-paper" />
            <CardTitle className="text-lg">あなたの行動記録</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {personalTimeline.length > 0 ? (
            <div className="space-y-2">
              {personalTimeline.map((item, index) => {
                // "10:00 - 行動内容" 形式をパース
                const [time, ...rest] = item.split(" - ");
                const action = rest.join(" - ");
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex gap-3 rounded-lg border-2 border-gold-accent/30 bg-gold-accent/10 p-3"
                  >
                    <div className="flex-shrink-0 w-16 text-sm font-semibold text-gold-accent">
                      {time}
                    </div>
                    <div className="flex-1 text-sm text-paper/80">
                      {action || item}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-paper/60 text-center py-4">
              行動記録がありません
            </p>
          )}
        </CardContent>
      </Card>

      <Card variant="parchment">
        <CardContent className="p-4">
          <p className="text-xs text-ink/60 text-center">
            これはあなただけが知っている行動記録です。
            <br />
            他のプレイヤーと情報を共有して、事件の全貌を解き明かしましょう。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * キャラクタータブ
 * 役割通知（犯人/無実）を含む
 */
function CharacterTab({
  character,
  isCulprit,
}: {
  character: CharacterDefinition | undefined;
  isCulprit: boolean;
}) {
  if (!character) {
    return (
      <Card variant="dark">
        <CardContent className="p-8 text-center text-paper/60">
          キャラクターが選択されていません
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* 役割通知（全員に表示） */}
      {isCulprit ? (
        <Card variant="dark" className="border-2 border-accent-red/70 bg-accent-red/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2 rounded-full bg-accent-red/20">
                <AlertTriangle className="h-6 w-6 text-accent-red" />
              </div>
              <div>
                <p className="text-lg font-bold text-accent-red font-serif">あなたは犯人です</p>
                <p className="text-sm text-paper/70 mt-1">
                  あなたの秘密を守り、疑いを他者に向けてください。
                  <br />
                  推理の矛先があなたに向かないよう、慎重に行動しましょう。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card variant="dark" className="border-2 border-green-500/70 bg-green-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2 rounded-full bg-green-500/20">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-green-500 font-serif">あなたは犯人ではありません</p>
                <p className="text-sm text-paper/70 mt-1">
                  真犯人を見つけ出し、正義を実現してください。
                  <br />
                  他のプレイヤーの証言や行動をよく観察しましょう。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* キャラクター基本情報 */}
      <Card variant="parchment">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-ink" />
            <CardTitle className="text-lg">あなたの役割</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {/* キャラクター画像 */}
            {character.images?.base && (
              <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 border-gold-accent/30">
                <img
                  src={character.images.base}
                  alt={character.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-lg font-bold text-ink font-serif">{character.name}</p>
                <p className="text-sm text-ink/60">{character.job}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" size="sm">
                  {character.gender === "male" ? "男性" : "女性"}
                </Badge>
                <Badge variant="outline" size="sm">
                  {character.age}歳
                </Badge>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-ink/10">
            <p className="text-xs text-ink/60 mb-2">性格</p>
            <p className="text-sm text-ink">{character.personality}</p>
          </div>

          {character.description && (
            <div className="pt-3 border-t border-ink/10">
              <p className="text-xs text-ink/60 mb-2">概要</p>
              <p className="text-sm text-ink leading-relaxed">{character.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 秘密の情報 */}
      <Card variant="dark">
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent-red" />
            <CardTitle className="text-lg">秘密</CardTitle>
            <Badge variant="danger" size="sm">機密</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-paper/80 leading-relaxed whitespace-pre-wrap">
            {character.secretInfo || character.handout?.secretGoal || "秘密の情報がありません"}
          </p>
        </CardContent>
      </Card>

      {/* 公開プロフィール */}
      <Card variant="parchment">
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-ink" />
            <CardTitle className="text-lg">公開プロフィール</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink/80 leading-relaxed">
            {character.handout?.publicInfo || "公開情報がありません"}
          </p>
        </CardContent>
      </Card>

      {/* 個人タイムラインはTimelineTabに移動しました */}
    </div>
  );
}

/**
 * プロローグ準備状況表示コンポーネント
 */
function PrologueReadyStatus({
  gameState,
  currentUserId,
}: {
  gameState: GameState;
  currentUserId?: string;
}) {
  const players = Object.entries(gameState.players);
  const readyCount = players.filter(([_, p]) => p.isPrologueReady).length;
  const totalCount = players.length;
  const allReady = readyCount === totalCount;

  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        {players.map(([uid, player]) => (
          <div
            key={uid}
            title={player.displayName}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              player.isPrologueReady
                ? "bg-green-500"
                : "bg-paper/30"
            }`}
          />
        ))}
      </div>
      <span className={`${allReady ? "text-green-400" : "text-paper/60"}`}>
        準備完了: {readyCount}/{totalCount}
      </span>
      {allReady && (
        <Badge variant="success" size="sm">
          全員準備完了
        </Badge>
      )}
    </div>
  );
}

export function PrologueModal({
  scenario,
  currentCharacter,
  isCulprit,
  isOpen,
  onClose,
  showReopenHint = false,
  gameState,
  currentUserId,
  onPrologueReady,
}: PrologueModalProps) {
  // 音声再生状態
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // オーディオ要素の初期化
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.onended = () => setIsPlaying(false);
    audioRef.current.onpause = () => setIsPlaying(false);
    audioRef.current.onplay = () => setIsPlaying(true);

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // モーダルが閉じたら音声を停止
  useEffect(() => {
    if (!isOpen && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isOpen]);

  // 緊急修正B: Escapeキーでモーダルを強制クローズ（フェールセーフ）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * ナレーション再生
   * 事前生成されたURLがあればそれを使用、なければオンデマンド生成
   */
  const handlePlayNarration = async () => {
    if (!audioRef.current) return;

    // 既に音声URLがあれば再生
    if (audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      return;
    }

    // 事前生成されたナレーションURLがあれば使用
    const preGeneratedUrl = scenario.data.prologueNarrationUrl;
    if (preGeneratedUrl) {
      console.log("[PrologueModal] Using pre-generated narration:", preGeneratedUrl);
      setAudioUrl(preGeneratedUrl);
      audioRef.current.src = preGeneratedUrl;
      audioRef.current.play();
      return;
    }

    // フォールバック: オンデマンド生成
    console.log("[PrologueModal] Generating narration on-demand");
    setIsLoading(true);

    try {
      // 1. SSML生成
      const ssmlRes = await fetch("/api/tts/generate-ssml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: scenario.data.introText,
          type: "narration",
        }),
      });

      if (!ssmlRes.ok) {
        throw new Error("SSML generation failed");
      }

      const { ssml } = await ssmlRes.json();

      // 2. TTS合成（低めの女性ボイス、やや速め）
      // Neural2-B: 女性, Neural2-C: 男性, Neural2-D: 男性
      const audioRes = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ssml,
          voiceConfig: {
            languageCode: "ja-JP",
            name: "ja-JP-Neural2-B", // 女性の声
            ssmlGender: "FEMALE",
            pitch: -2.0, // 低めのトーン（ミステリー感）
            speakingRate: 1.15, // やや速め
          },
          saveToBucket: false, // Base64で直接取得
        }),
      });

      if (!audioRes.ok) {
        throw new Error("TTS synthesis failed");
      }

      const { audioBase64 } = await audioRes.json();

      // 3. 音声URLを生成して再生
      const blob = base64ToBlob(audioBase64, "audio/mp3");
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      audioRef.current.src = url;
      audioRef.current.play();
    } catch (error) {
      console.error("Narration playback failed:", error);
      // エラー時は通常のテキストでフォールバック（または通知）
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ナレーション一時停止
   */
  const handlePauseNarration = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  // タブ定義
  const tabs: Tab[] = [
    {
      id: "story",
      label: "あらすじ",
      icon: <BookOpen className="h-4 w-4" />,
      content: (
        <StoryTab
          introText={scenario.data.introText}
          onPlayNarration={handlePlayNarration}
          onPauseNarration={handlePauseNarration}
          isPlaying={isPlaying}
          isLoading={isLoading}
        />
      ),
    },
    {
      id: "timeline",
      label: "タイムライン",
      icon: <Clock className="h-4 w-4" />,
      content: (
        <TimelineTab character={currentCharacter} />
      ),
    },
    {
      id: "character",
      label: "あなたの役割",
      icon: <User className="h-4 w-4" />,
      content: <CharacterTab character={currentCharacter} isCulprit={isCulprit} />,
    },
  ];

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl w-full max-h-[85vh] overflow-hidden rounded-xl border-2 border-gold-accent/50 shadow-2xl bg-gradient-to-br from-ink-black via-ink to-ink-black"
          >
            {/* ヘッダー */}
            <div className="p-6 border-b border-gold-accent/30 bg-gold-accent/5">
              <div className="flex items-center gap-3">
                <div className="text-4xl">📜</div>
                <div>
                  <h2 className="text-2xl font-title font-bold text-parchment-light candle-glow">
                    {scenario.meta.title}
                  </h2>
                  <p className="text-sm text-parchment-light/60">
                    物語の幕が上がります...
                  </p>
                </div>
              </div>
            </div>

            {/* タブコンテンツ */}
            <div className="p-6 overflow-y-auto max-h-[55vh]">
              <Tabs tabs={tabs} defaultTab="story" />
            </div>

            {/* フッター */}
            <div className="p-4 border-t border-gold-accent/30 bg-gold-accent/5 space-y-3">
              {/* 準備状況表示（prologueフェーズ時のみ） */}
              {gameState && showReopenHint && (
                <PrologueReadyStatus
                  gameState={gameState}
                  currentUserId={currentUserId}
                />
              )}

              {/* ボタン群 */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-lg border border-paper/30 text-paper/80 font-serif
                             hover:bg-paper/10 transition-colors"
                >
                  閉じる
                </button>
                {showReopenHint && onPrologueReady && currentUserId && gameState && (
                  <button
                    onClick={() => {
                      onPrologueReady();
                      onClose();
                    }}
                    disabled={gameState.players[currentUserId]?.isPrologueReady}
                    className="px-6 py-2.5 rounded-lg bg-gold-accent text-ink font-serif font-bold
                               hover:bg-gold-accent/90 transition-colors shadow-lg hover:shadow-gold-accent/30
                               disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {gameState.players[currentUserId]?.isPrologueReady ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        準備完了済み
                      </>
                    ) : (
                      "準備完了"
                    )}
                  </button>
                )}
              </div>

              {showReopenHint && (
                <p className="text-xs text-paper/50 text-center">
                  このウィンドウは左上の 📜 ボタンからいつでも開けます
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Base64文字列をBlobに変換
 */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}
