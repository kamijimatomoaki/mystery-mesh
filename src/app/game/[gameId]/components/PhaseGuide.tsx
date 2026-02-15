"use client";

/**
 * PhaseGuide
 * 現在フェーズの目標を表示するコンポーネント
 * ユーザーが今何をすべきかを明確に示す
 */

import { motion } from "framer-motion";
import { Target, Info } from "lucide-react";
import type { GamePhase } from "@/core/types";

interface PhaseGuideProps {
  phase: GamePhase;
  className?: string;
}

/**
 * フェーズごとのガイド情報
 */
const PHASE_GUIDES: Record<GamePhase, { title: string; goal: string; tip?: string }> = {
  setup: {
    title: "セットアップ",
    goal: "ゲームの準備を行います",
  },
  generation: {
    title: "シナリオ生成中",
    goal: "AIがシナリオを執筆しています。しばらくお待ちください...",
  },
  lobby: {
    title: "待機ロビー",
    goal: "キャラクターを選択し、他のプレイヤーを待ちましょう",
  },
  prologue: {
    title: "プロローグ",
    goal: "あらすじを読み、あなたのキャラクターを理解しましょう",
    tip: "タブを切り替えて、タイムラインや自分の役割も確認できます",
  },
  exploration_1: {
    title: "探索フェーズ1",
    goal: "カードを調査して証拠を集めましょう",
    tip: "ターンが来たら、気になるカードを選んで調査してください",
  },
  discussion_1: {
    title: "議論フェーズ1",
    goal: "集めた情報を共有し、犯人について議論しましょう",
    tip: "他のプレイヤーのアリバイや行動を確認してみましょう",
  },
  exploration_2: {
    title: "探索フェーズ2",
    goal: "追加の証拠を集めましょう",
    tip: "まだ調査していない重要そうなカードを優先しましょう",
  },
  discussion_2: {
    title: "最終議論",
    goal: "全ての証拠を踏まえて犯人を特定しましょう",
    tip: "投票の前に、自分の推理をしっかりまとめておきましょう",
  },
  voting: {
    title: "投票",
    goal: "犯人だと思う人物に投票してください",
    tip: "一度投票すると変更できません。慎重に選んでください",
  },
  ending: {
    title: "結果発表",
    goal: "真相が明らかになります",
  },
  ended: {
    title: "ゲーム終了",
    goal: "お疲れ様でした！",
  },
};

export function PhaseGuide({ phase, className = "" }: PhaseGuideProps) {
  const guide = PHASE_GUIDES[phase] || { title: phase, goal: "" };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-ink/60 backdrop-blur-sm border border-accent-gold/30 rounded-lg px-4 py-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        {/* アイコン */}
        <div className="flex-shrink-0 mt-0.5">
          <Target className="h-5 w-5 text-accent-gold" />
        </div>

        {/* コンテンツ */}
        <div className="flex-1 min-w-0">
          {/* 目標 */}
          <p className="text-sm text-paper font-medium leading-relaxed">
            {guide.goal}
          </p>

          {/* ヒント（ある場合） */}
          {guide.tip && (
            <div className="mt-2 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-paper/50 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-paper/60">
                {guide.tip}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * コンパクト版（ヘッダー用）
 */
export function PhaseGuideCompact({ phase, className = "" }: PhaseGuideProps) {
  const guide = PHASE_GUIDES[phase] || { title: phase, goal: "" };

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      <Target className="h-3.5 w-3.5 text-accent-gold flex-shrink-0" />
      <span className="text-paper/80 truncate">{guide.goal}</span>
    </div>
  );
}
