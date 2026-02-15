"use client";

/**
 * Character Selection Page
 * キャラクター選択画面
 */

import { use, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/hooks/useAuth";
import { User, Check, Loader, ArrowRight, AlertCircle, BookOpen } from "lucide-react";
import type { CharacterDefinition, GameState, Scenario } from "@/core/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Modal,
} from "@/components";

type PageProps = {
  params: Promise<{ gameId: string }>;
};

export default function CharacterSetupPage({ params }: PageProps) {
  const { gameId } = use(params);
  const router = useRouter();
  const { userId } = useAuth();

  // ゲームとシナリオデータ（APIから取得）
  const [game, setGame] = useState<GameState | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      } catch (error) {
        console.error("[Setup] Failed to load game:", error);
        setLoadError(error instanceof Error ? error.message : "データの取得に失敗しました");
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameData();
  }, [gameId]);

  // 全てのフックは早期returnの前に配置する（Rules of Hooks）
  const selectedCharacter = scenario?.data.characters.find(
    (c) => c.id === selectedCharacterId
  ) ?? null;

  const takenCharacterIds = game
    ? Object.values(game.players)
        .map((p) => p.characterId)
        .filter(Boolean)
    : [];

  const availableCharacters = scenario
    ? scenario.data.characters.filter(
        (c) => !takenCharacterIds.includes(c.id)
      )
    : [];

  // Fisher-Yatesシャッフルで表示順をランダム化（犯人が常に左上に来るのを防止）
  const shuffledCharacters = useMemo(() => {
    const shuffled = [...availableCharacters];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
    // availableCharacters.lengthが変わった場合のみ再シャッフル
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableCharacters.length]);

  // ローディング中
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink via-ink-light to-primary px-6">
        <Card variant="parchment" className="max-w-md text-center">
          <CardContent className="py-16">
            <BookOpen className="mx-auto mb-4 h-16 w-16 animate-pulse text-ink/30" />
            <p className="text-ink/60">ゲームを読み込んでいます...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // エラーまたはデータなし
  if (loadError || !game || !scenario) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ink via-ink-light to-primary px-6">
        <Card variant="parchment" className="max-w-md text-center">
          <CardContent className="py-16">
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-ink/30" />
            <h1 className="mb-4 font-serif text-2xl font-bold text-ink">
              ゲームが見つかりません
            </h1>
            <p className="mb-6 text-ink/60">
              {loadError || "指定されたゲームは存在しないか、終了した可能性があります。"}
            </p>
            <Link href="/library">
              <Button variant="seal">ライブラリに戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (!selectedCharacterId || !userId) return;
    setIsConfirming(true);
    setErrorMessage(null);

    try {
      // APIでキャラクター選択を反映
      const response = await fetch(`/api/game/${gameId}/select-character`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId: userId,
          characterId: selectedCharacterId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "キャラクター選択に失敗しました");
      }

      console.log("Character selected:", selectedCharacterId);

      // ロビー画面に遷移
      router.push(`/game/${gameId}/lobby`);
    } catch (error) {
      console.error("Failed to select character:", error);
      setErrorMessage(error instanceof Error ? error.message : "キャラクター選択に失敗しました");
      setIsConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink via-ink-light to-primary px-6 py-12">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 text-center"
        >
          <h1 className="font-serif text-4xl font-bold text-paper">
            キャラクター選択
          </h1>
          <p className="mt-2 text-paper/70">
            あなたが演じる役を選んでください
          </p>
          <div className="mt-4">
            <Badge variant="primary" size="lg">
              {scenario.meta.title}
            </Badge>
          </div>
        </motion.div>

        {/* Character Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {shuffledCharacters.map((character, index) => (
            <CharacterCard
              key={character.id}
              character={character}
              isSelected={selectedCharacterId === character.id}
              onClick={() => setSelectedCharacterId(character.id)}
              index={index}
            />
          ))}
        </motion.div>

        {/* Action Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card variant="parchment">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                {selectedCharacterId ? (
                  <div className="flex items-center gap-3">
                    <Check className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-serif text-lg font-semibold text-ink">
                        {selectedCharacter?.name}を選択中
                      </p>
                      <p className="text-sm text-ink/60">
                        {selectedCharacter?.job} / {selectedCharacter?.age}歳
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <User className="h-6 w-6 text-ink/40" />
                    <p className="text-ink/60">キャラクターを選択してください</p>
                  </div>
                )}
              </div>
              <Button
                variant="seal"
                size="lg"
                onClick={() => setIsConfirmModalOpen(true)}
                disabled={!selectedCharacterId}
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                この役で決定
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => {
          if (!isConfirming) {
            setIsConfirmModalOpen(false);
            setErrorMessage(null);
          }
        }}
        title="キャラクター確定"
      >
        <div className="space-y-4">
          {/* エラーメッセージ表示 */}
          {errorMessage && (
            <div className="rounded-lg border-2 border-accent-red bg-accent-red/10 p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-accent-red" />
                <p className="font-semibold text-accent-red">エラー</p>
              </div>
              <p className="mt-2 text-sm text-ink">{errorMessage}</p>
              <p className="mt-2 text-xs text-ink/60">
                別のキャラクターを選んでください。
              </p>
            </div>
          )}

          {selectedCharacter && (
            <div className="rounded-lg border-2 border-ink/10 bg-gradient-to-br from-paper-dark/20 to-transparent p-4">
              <h3 className="mb-2 font-serif text-xl font-bold text-ink">
                {selectedCharacter.name}
              </h3>
              <p className="mb-3 text-sm text-ink/60">
                {selectedCharacter.job} / {selectedCharacter.gender} /{" "}
                {selectedCharacter.age}歳
              </p>
              {/*
               * 確認モーダルでも personality と publicInfo は非表示
               * ゲーム開始後のハンドアウトで詳細が明かされる
               */}
              <div className="rounded-lg border border-ink/10 bg-gradient-to-br from-paper-dark/10 to-transparent p-3">
                <p className="text-sm text-ink/70 text-center">
                  ゲーム開始後、詳しいプロフィールが明かされます
                </p>
              </div>
            </div>
          )}
          <p className="text-sm text-ink/70">
            ⚠️ 一度決定すると、ゲーム開始後は変更できません。
          </p>
          <div className="flex gap-4 pt-4">
            <Button
              variant="seal"
              fullWidth
              onClick={handleConfirm}
              isLoading={isConfirming}
              disabled={isConfirming}
            >
              {isConfirming ? "確定中..." : "この役で確定する"}
            </Button>
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setIsConfirmModalOpen(false);
                setErrorMessage(null);
              }}
              disabled={isConfirming}
            >
              キャンセル
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/**
 * キャラクターカードコンポーネント
 */
function CharacterCard({
  character,
  isSelected,
  onClick,
  index,
}: {
  character: CharacterDefinition;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card
        variant="parchment"
        className={`group relative cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-2xl ${
          isSelected ? "ring-4 ring-accent-gold" : ""
        }`}
        onClick={onClick}
      >
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -right-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-accent-gold shadow-lg"
          >
            <Check className="h-6 w-6 text-ink" />
          </motion.div>
        )}

        <CardHeader>
          <CardTitle className="text-xl group-hover:text-accent-gold transition-colors">
            {character.name}
          </CardTitle>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" size="sm">
              {character.job}
            </Badge>
            <Badge variant="outline" size="sm">
              {character.gender === "male" ? "男性" : "女性"}
            </Badge>
            <Badge variant="outline" size="sm">
              {character.age}歳
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/*
           * キャラ選択時は name, job, age, gender のみ表示
           * personality と publicInfo は選択後のハンドアウトで公開
           * （犯人推測を防ぐため）
           */}
          <div className="rounded-lg border border-ink/10 bg-gradient-to-br from-paper-dark/10 to-transparent p-3">
            <p className="text-sm text-ink/70 text-center">
              キャラクターを選んで詳細を確認しましょう
            </p>
          </div>
        </CardContent>

        <CardFooter className="border-t border-ink/10 pt-4">
          <Button
            variant={isSelected ? "seal" : "quill"}
            size="sm"
            fullWidth
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            {isSelected ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                選択中
              </>
            ) : (
              "この役を選ぶ"
            )}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
