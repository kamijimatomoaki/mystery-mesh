/**
 * HumanProfilingReveal
 * 「AIに心を読まれていたか」表示
 * 各AIエージェントが人間プレイヤーをどう分析していたかをカード形式で公開
 */

"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, Badge, Loading } from "@/components";
import { Eye, Brain, Shield, Sword, Target } from "lucide-react";

interface Props {
  gameId: string;
  humanPlayerId: string;
  humanCharacterName: string;
}

interface ProfilingData {
  agentId: string;
  agentCharacterName: string;
  profile: {
    suspectedCharacters: Array<{
      characterId: string;
      estimatedSuspicion: number;
      reason: string;
      confidence: number;
    }>;
    behaviorAnalysis: {
      speakingFrequency: number;
      aggressiveness: number;
      defensiveness: number;
      logicalReasoning: number;
    };
    predictedRole: {
      isCulprit: boolean;
      confidence: number;
      reasoning: string;
    };
  };
}

export default function HumanProfilingReveal({
  gameId,
  humanPlayerId,
  humanCharacterName,
}: Props) {
  const [profilingData, setProfilingData] = useState<ProfilingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiling = async () => {
      try {
        const response = await fetch(
          `/api/ending/profiling?gameId=${gameId}&humanPlayerId=${humanPlayerId}`
        );

        if (response.ok) {
          const data = await response.json();
          setProfilingData(data.profiles || []);
        }
      } catch (error) {
        console.error("Failed to fetch profiling data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiling();
  }, [gameId, humanPlayerId]);

  if (loading) {
    return <Loading variant="ink" size="md" text="プロファイリング結果を取得中..." />;
  }

  if (profilingData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            <span>AIのプロファイリング結果</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center text-paper/50 py-8">
          プロファイリングデータがありません
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-accent-gold" />
          <span>AIはあなたをこう見ていた</span>
        </CardTitle>
        <p className="text-sm text-paper/60 mt-1">
          {humanCharacterName} として行動したあなたを、各AIがどう分析していたか
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {profilingData.map((data) => (
            <motion.div
              key={data.agentId}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-paper/20 rounded-lg overflow-hidden"
            >
              {/* エージェントヘッダー */}
              <button
                onClick={() =>
                  setExpandedAgent(
                    expandedAgent === data.agentId ? null : data.agentId
                  )
                }
                className="w-full flex items-center justify-between p-4 hover:bg-paper/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center">
                    <Brain className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="font-serif font-medium">
                      {data.agentCharacterName}
                    </div>
                    <div className="text-xs text-paper/50">の分析結果</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {data.profile.predictedRole.isCulprit ? (
                    <Badge variant="danger">犯人と推測</Badge>
                  ) : (
                    <Badge variant="default">犯人ではない</Badge>
                  )}
                  <span className="text-xs text-paper/40">
                    確信度: {data.profile.predictedRole.confidence}%
                  </span>
                </div>
              </button>

              {/* 展開詳細 */}
              <AnimatePresence>
                {expandedAgent === data.agentId && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-paper/10"
                  >
                    <div className="p-4 space-y-4">
                      {/* 行動分析 */}
                      <div>
                        <h5 className="text-xs font-serif text-accent-gold mb-2">
                          行動分析
                        </h5>
                        <div className="grid grid-cols-2 gap-3">
                          <AnalysisBar
                            icon={<Sword className="w-3 h-3" />}
                            label="攻撃性"
                            value={data.profile.behaviorAnalysis.aggressiveness}
                            color="red"
                          />
                          <AnalysisBar
                            icon={<Shield className="w-3 h-3" />}
                            label="防衛性"
                            value={data.profile.behaviorAnalysis.defensiveness}
                            color="blue"
                          />
                          <AnalysisBar
                            icon={<Brain className="w-3 h-3" />}
                            label="論理性"
                            value={data.profile.behaviorAnalysis.logicalReasoning}
                            color="green"
                          />
                          <AnalysisBar
                            icon={<Target className="w-3 h-3" />}
                            label="発言頻度"
                            value={Math.min(data.profile.behaviorAnalysis.speakingFrequency * 100, 100)}
                            color="yellow"
                          />
                        </div>
                      </div>

                      {/* 推論理由 */}
                      <div>
                        <h5 className="text-xs font-serif text-accent-gold mb-2">
                          推論理由
                        </h5>
                        <p className="text-sm text-paper/80 bg-paper/5 p-3 rounded">
                          {data.profile.predictedRole.reasoning}
                        </p>
                      </div>

                      {/* 疑惑対象 */}
                      {data.profile.suspectedCharacters.length > 0 && (
                        <div>
                          <h5 className="text-xs font-serif text-accent-gold mb-2">
                            あなたが疑っていると推測した人物
                          </h5>
                          <div className="space-y-1">
                            {data.profile.suspectedCharacters.map((s, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-sm p-2 bg-paper/5 rounded"
                              >
                                <span>{s.characterId}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-accent-red text-xs">
                                    疑惑度: {s.estimatedSuspicion}%
                                  </span>
                                  <span className="text-paper/40 text-xs">
                                    (確信: {s.confidence}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * 分析バーコンポーネント
 */
function AnalysisBar({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "red" | "blue" | "green" | "yellow";
}) {
  const colorClasses = {
    red: "bg-red-500",
    blue: "bg-blue-500",
    green: "bg-green-500",
    yellow: "bg-yellow-500",
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-paper/60">
        {icon}
        <span>{label}</span>
        <span className="ml-auto">{Math.round(value)}%</span>
      </div>
      <div className="w-full bg-paper/10 rounded-full h-1.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className={`h-1.5 rounded-full ${colorClasses[color]}`}
        />
      </div>
    </div>
  );
}
