"use client";

/**
 * Voting Panel
 * 投票パネル（犯人投票）
 */

import { useState, memo } from "react";
import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle, Users } from "lucide-react";
import type { GameState, Scenario } from "@/core/types";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/useToast";

interface VotingPanelProps {
  game: GameState;
  scenario: Scenario;
  currentUserId: string;
}

export const VotingPanel = memo(function VotingPanel({
  game,
  scenario,
  currentUserId,
}: VotingPanelProps) {
  const toast = useToast();
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 現在のプレイヤーの投票状況
  const currentPlayer = game.players[currentUserId];
  const hasVoted = !!game.votes?.[currentUserId];
  const myVote = game.votes?.[currentUserId];

  // 投票可能なキャラクター（自分以外）
  const votableCharacters = scenario.data.characters.filter(
    (char) => char.id !== currentPlayer?.characterId
  );

  // 投票を送信
  const handleSubmitVote = async () => {
    if (!selectedCharacter) {
      toast.error("投票先を選択してください", 1500);
      return;
    }

    if (hasVoted) {
      toast.info("既に投票済みです", 1500);
      return;
    }

    setSubmitting(true);

    try {
      // サーバーサイドAPIで原子的に投票（バリデーション + 条件チェック含む）
      const response = await fetch("/api/game/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: game.id,
          voterId: currentUserId,
          targetCharacterId: selectedCharacter,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "投票に失敗しました");
      }

      toast.success("投票を送信しました", 2000);
    } catch (error) {
      console.error("Failed to submit vote:", error);
      toast.error("投票の送信に失敗しました", 2000);
    } finally {
      setSubmitting(false);
    }
  };

  // 投票状況の集計
  const voteCount = Object.keys(game.votes || {}).length;
  const totalPlayers = Object.keys(game.players).length;
  const votingProgress = (voteCount / totalPlayers) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl mx-auto"
    >
      <Card variant="parchment" className="overflow-hidden">
        {/* ヘッダー */}
        <CardHeader className="bg-accent-red/10 border-b-2 border-accent-red/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-6 w-6 text-accent-red" />
              <CardTitle className="text-2xl text-accent-red">犯人投票</CardTitle>
            </div>
            <Badge variant={hasVoted ? "success" : "warning"} size="lg">
              {hasVoted ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  投票済み
                </>
              ) : (
                "未投票"
              )}
            </Badge>
          </div>

          {/* 投票進捗 */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-ink/60" />
                <span className="text-ink/80">
                  {voteCount} / {totalPlayers} 人が投票済み
                </span>
              </div>
              <span className="text-ink/60">{Math.round(votingProgress)}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-ink/10 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${votingProgress}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-accent-gold"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {hasVoted ? (
            // 投票済み表示
            <div className="text-center py-8 space-y-4">
              <CheckCircle className="h-16 w-16 text-accent-gold mx-auto" />
              <div>
                <h3 className="text-xl font-serif font-bold text-ink mb-2">
                  投票完了
                </h3>
                <p className="text-sm text-ink/70">
                  あなたは{" "}
                  <strong className="text-accent-red">
                    {scenario.data.characters.find((c) => c.id === myVote)?.name ||
                      "不明"}
                  </strong>{" "}
                  に投票しました
                </p>
              </div>
              <div className="pt-4 border-t border-ink/10">
                <p className="text-xs text-ink/60">
                  全員の投票が完了すると、真相が明らかになります。
                </p>
              </div>
            </div>
          ) : (
            // 投票フォーム
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-serif font-bold text-ink mb-3">
                  犯人だと思う人物を選択してください
                </h3>
                <p className="text-sm text-ink/70">
                  これまでの証拠と推理を元に、真犯人を見極めてください。
                </p>
              </div>

              {/* キャラクター選択 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {votableCharacters.map((char) => {
                  const isSelected = selectedCharacter === char.id;

                  return (
                    <button
                      key={char.id}
                      onClick={() => setSelectedCharacter(char.id)}
                      className={cn(
                        "text-left rounded-lg border-2 p-4 transition-all",
                        isSelected
                          ? "border-accent-red bg-accent-red/10 shadow-lg"
                          : "border-ink/20 bg-ink/5 hover:border-accent-gold/50 hover:bg-accent-gold/5"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-lg font-serif font-bold text-ink">
                          {char.name}
                        </h4>
                        {isSelected && (
                          <CheckCircle className="h-5 w-5 text-accent-red" />
                        )}
                      </div>
                      <Badge variant="outline" size="sm" className="mb-2">
                        {char.job}
                      </Badge>
                      <p className="text-xs text-ink/60 leading-relaxed">
                        {char.handout.publicInfo.slice(0, 100)}...
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* 投票ボタン */}
              <div className="pt-4 border-t-2 border-ink/10">
                <button
                  onClick={handleSubmitVote}
                  disabled={!selectedCharacter || submitting}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 rounded-lg px-6 py-4 font-bold text-lg transition-all",
                    "bg-accent-red text-paper hover:bg-accent-red/80 shadow-lg hover:shadow-xl",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg"
                  )}
                >
                  <AlertTriangle className="h-5 w-5" />
                  {submitting ? "投票中..." : "この人物に投票する"}
                </button>
                {selectedCharacter && (
                  <p className="text-xs text-ink/60 text-center mt-3">
                    💡{" "}
                    <strong>
                      {scenario.data.characters.find((c) => c.id === selectedCharacter)
                        ?.name}
                    </strong>{" "}
                    に投票します。投票後は変更できません。
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});
