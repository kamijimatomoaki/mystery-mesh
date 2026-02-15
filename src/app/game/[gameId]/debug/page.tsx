/**
 * AI思考ログデバッグ画面
 * 管理者用：AIエージェントの思考プロセスを可視化
 */

"use client";

import { use, useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/core/db/firestore-client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components";

interface ThinkingLog {
  id: string;
  trigger: string;
  phase: string;
  thoughtProcess: string;
  decision: string;
  emotionBefore: string;
  emotionAfter: string;
  timestamp: any;
}

type PageProps = {
  params: Promise<{ gameId: string }>;
};

export default function DebugPage({ params }: PageProps) {
  const { gameId } = use(params);
  const [thoughts, setThoughts] = useState<ThinkingLog[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("agent_bot_001");

  useEffect(() => {
    // リアルタイムリスナー
    const unsubscribe = onSnapshot(
      collection(db, `games/${gameId}/agents/${selectedAgentId}/thoughts`),
      (snapshot) => {
        const logs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as ThinkingLog[];

        // タイムスタンプでソート（新しい順）
        logs.sort((a, b) => {
          const timeA = a.timestamp?.seconds || 0;
          const timeB = b.timestamp?.seconds || 0;
          return timeB - timeA;
        });

        setThoughts(logs);
      },
      (error) => {
        console.error("Error fetching thoughts:", error);
      }
    );

    return () => unsubscribe();
  }, [gameId, selectedAgentId]);

  return (
    <div className="min-h-screen bg-ink p-8">
      <div className="container mx-auto max-w-4xl">
        {/* ヘッダー */}
        <div className="mb-8">
          <h1 className="text-4xl font-serif text-paper mb-2">
            AI思考ログ
          </h1>
          <p className="text-paper/60">
            ゲームID: {gameId}
          </p>
        </div>

        {/* エージェント選択 */}
        <div className="mb-6">
          <label className="block text-paper mb-2">エージェント選択:</label>
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="bg-paper/10 text-paper border border-paper/30 rounded px-4 py-2"
          >
            <option value="agent_bot_001">Agent Bot 001</option>
            <option value="agent_bot_002">Agent Bot 002</option>
            <option value="agent_bot_003">Agent Bot 003</option>
          </select>
        </div>

        {/* 思考ログ一覧 */}
        <div className="space-y-4">
          {thoughts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-paper/60">
                まだ思考ログがありません
              </CardContent>
            </Card>
          ) : (
            thoughts.map(t => (
              <Card key={t.id} hover>
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>
                      トリガー: {t.trigger} | フェーズ: {t.phase}
                    </span>
                    <span className="text-sm text-paper/60">
                      {t.timestamp?.toDate?.()?.toLocaleString() || ""}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 思考プロセス */}
                  <div>
                    <h3 className="font-bold text-accent mb-2">思考プロセス:</h3>
                    <pre className="text-sm bg-ink/20 p-4 rounded overflow-x-auto text-paper/90 whitespace-pre-wrap">
                      {t.thoughtProcess}
                    </pre>
                  </div>

                  {/* 決定 */}
                  <div>
                    <h3 className="font-bold text-accent mb-2">決定:</h3>
                    <pre className="text-sm bg-ink/20 p-4 rounded overflow-x-auto text-paper/90 whitespace-pre-wrap">
                      {t.decision}
                    </pre>
                  </div>

                  {/* 感情変化 */}
                  <div className="flex items-center gap-4 text-sm text-paper/60">
                    <span>
                      感情: <span className="text-paper">{t.emotionBefore}</span> → <span className="text-accent">{t.emotionAfter}</span>
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
