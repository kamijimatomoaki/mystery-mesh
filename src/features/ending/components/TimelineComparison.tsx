/**
 * TimelineComparison
 * 行動ログ vs 真相タイムライン比較表示
 * 左カラム: 真相タイムライン、右カラム: プレイヤー行動ログ
 */

"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, Badge, Loading } from "@/components";
import { getActionLogs } from "@/lib/api/ending";
import { Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface Props {
  gameId: string;
}

interface TruthEvent {
  time: string;
  event: string;
  isTrue: boolean;
  relatedCharacterName: string | null;
}

interface ActionLogEntry {
  id: string;
  actorId: string;
  characterId: string;
  characterName: string;
  type: string;
  targetId?: string;
  location?: string;
  content?: string;
  phase: string;
  timestamp: number;
}

const ACTION_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  talk: { label: "発言", icon: "💬" },
  move: { label: "移動", icon: "🚶" },
  investigate: { label: "調査", icon: "🔍" },
  reveal: { label: "公開", icon: "📖" },
  vote: { label: "投票", icon: "⚖️" },
  join: { label: "参加", icon: "👤" },
  secret_talk: { label: "密談", icon: "🤫" },
  wait: { label: "待機", icon: "⏳" },
};

export default function TimelineComparison({ gameId }: Props) {
  const [truthTimeline, setTruthTimeline] = useState<TruthEvent[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLogEntry[]>([]);
  const [culpritName, setCulpritName] = useState("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"split" | "merged">("split");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getActionLogs(gameId);
        setTruthTimeline(data.truthTimeline);
        setActionLogs(data.actionLogs);
        setCulpritName(data.culpritName);
      } catch (error) {
        console.error("Failed to fetch action logs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gameId]);

  if (loading) {
    return <Loading variant="ink" size="md" text="行動ログを取得中..." />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent-gold" />
            <span>行動ログ vs 真相タイムライン</span>
          </CardTitle>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("split")}
              className={`px-3 py-1 rounded text-xs ${
                viewMode === "split"
                  ? "bg-accent-gold text-ink"
                  : "bg-paper/10 text-paper/60"
              }`}
            >
              分割表示
            </button>
            <button
              onClick={() => setViewMode("merged")}
              className={`px-3 py-1 rounded text-xs ${
                viewMode === "merged"
                  ? "bg-accent-gold text-ink"
                  : "bg-paper/10 text-paper/60"
              }`}
            >
              統合表示
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {viewMode === "split" ? (
          <SplitView
            truthTimeline={truthTimeline}
            actionLogs={actionLogs}
            culpritName={culpritName}
          />
        ) : (
          <MergedView
            truthTimeline={truthTimeline}
            actionLogs={actionLogs}
          />
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 分割表示: 左に真相、右に行動ログ
 */
function SplitView({
  truthTimeline,
  actionLogs,
  culpritName,
}: {
  truthTimeline: TruthEvent[];
  actionLogs: ActionLogEntry[];
  culpritName: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* 左: 真相タイムライン */}
      <div>
        <h4 className="text-sm font-serif text-accent-gold mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          真相タイムライン
        </h4>
        <div className="space-y-3 relative">
          {/* 左の線 */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-paper/15" />

          {truthTimeline.map((event, index) => (
            <motion.div
              key={index}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.08 }}
              className="flex gap-3 relative"
            >
              {/* ドット */}
              <div
                className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center z-10 ${
                  event.isTrue
                    ? "bg-green-600/30 border border-green-500"
                    : "bg-red-600/30 border border-red-500"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    event.isTrue ? "bg-green-400" : "bg-red-400"
                  }`}
                />
              </div>

              {/* 内容 */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-accent-gold">
                    {event.time}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      event.isTrue
                        ? "bg-paper/10 text-paper/60"
                        : "bg-accent-red/20 text-accent-red"
                    }`}
                  >
                    {event.isTrue ? "事実" : "偽装"}
                  </span>
                </div>
                <p className="text-sm text-paper/80">{event.event}</p>
                {event.relatedCharacterName && (
                  <span className="text-xs text-paper/40">
                    関連: {event.relatedCharacterName}
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 右: プレイヤー行動ログ */}
      <div>
        <h4 className="text-sm font-serif text-accent-gold mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          プレイヤー行動ログ
        </h4>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {actionLogs.length === 0 ? (
            <div className="text-center text-paper/50 py-8">
              行動ログがありません
            </div>
          ) : (
            actionLogs.map((log, index) => {
              const actionInfo = ACTION_TYPE_LABELS[log.type] || {
                label: log.type,
                icon: "📋",
              };

              return (
                <motion.div
                  key={log.id}
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex gap-2 p-2 bg-paper/5 rounded text-sm"
                >
                  <span className="flex-shrink-0">{actionInfo.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-paper/90 truncate">
                        {log.characterName}
                      </span>
                      <Badge variant="default" className="text-xs flex-shrink-0">
                        {actionInfo.label}
                      </Badge>
                    </div>
                    {log.content && (
                      <p className="text-paper/60 text-xs mt-0.5 line-clamp-2">
                        {log.content}
                      </p>
                    )}
                    {log.location && (
                      <span className="text-paper/40 text-xs">
                        @ {log.location}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 統合表示: 時系列に混合表示
 */
function MergedView({
  truthTimeline,
  actionLogs,
}: {
  truthTimeline: TruthEvent[];
  actionLogs: ActionLogEntry[];
}) {
  return (
    <div className="space-y-4">
      {/* 真相タイムライン（全体表示） */}
      <div>
        <h4 className="text-sm font-serif text-accent-gold mb-3">
          真相タイムライン
        </h4>
        <div className="space-y-2">
          {truthTimeline.map((event, index) => (
            <div
              key={`truth-${index}`}
              className={`flex gap-3 p-3 rounded-lg ${
                event.isTrue
                  ? "bg-paper/5 border border-paper/10"
                  : "bg-accent-red/5 border border-accent-red/20"
              }`}
            >
              <span className="text-xs font-mono text-accent-gold flex-shrink-0 w-12">
                {event.time}
              </span>
              <div className="flex-1">
                <p className="text-sm text-paper/80">{event.event}</p>
              </div>
              <span
                className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                  event.isTrue
                    ? "bg-paper/10 text-paper/50"
                    : "bg-accent-red/20 text-accent-red"
                }`}
              >
                {event.isTrue ? "事実" : "偽装"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 行動ログサマリー */}
      <div>
        <h4 className="text-sm font-serif text-accent-gold mb-3">
          行動ログサマリー（{actionLogs.length} 件）
        </h4>

        {/* フェーズごとに集計 */}
        {(() => {
          const byPhase: Record<string, ActionLogEntry[]> = {};
          actionLogs.forEach((log) => {
            if (!byPhase[log.phase]) byPhase[log.phase] = [];
            byPhase[log.phase].push(log);
          });

          return Object.entries(byPhase).map(([phase, logs]) => (
            <div key={phase} className="mb-4">
              <div className="text-xs font-serif text-paper/50 mb-2 uppercase">
                {phase}
              </div>
              <div className="space-y-1">
                {logs.slice(0, 10).map((log) => {
                  const actionInfo = ACTION_TYPE_LABELS[log.type] || {
                    label: log.type,
                    icon: "📋",
                  };
                  return (
                    <div
                      key={log.id}
                      className="flex gap-2 items-center text-xs text-paper/70"
                    >
                      <span>{actionInfo.icon}</span>
                      <span className="font-medium">{log.characterName}</span>
                      <span className="text-paper/40">-</span>
                      <span>{actionInfo.label}</span>
                      {log.content && (
                        <span className="text-paper/40 truncate max-w-xs">
                          {log.content.slice(0, 40)}...
                        </span>
                      )}
                    </div>
                  );
                })}
                {logs.length > 10 && (
                  <div className="text-xs text-paper/40">
                    ... 他 {logs.length - 10} 件
                  </div>
                )}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
