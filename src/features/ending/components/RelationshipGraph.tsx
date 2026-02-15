/**
 * RelationshipGraph
 * AIエージェント間の関係性をグラフ表示
 * 信頼度・疑惑度を線の太さと色で表現
 */

"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, Loading } from "@/components";
import { getRelationships } from "@/lib/api/ending";

interface Props {
  gameId: string;
}

interface RelationshipNode {
  characterId: string;
  characterName: string;
  isHuman: boolean;
  emotionalState: string;
}

interface RelationshipEdge {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  trust: number;
  suspicion: number;
  note: string;
}

const EMOTION_COLORS: Record<string, string> = {
  calm: "#8B7355",
  angry: "#DC2626",
  nervous: "#F59E0B",
  sad: "#3B82F6",
  confident: "#10B981",
};

export default function RelationshipGraph({ gameId }: Props) {
  const [nodes, setNodes] = useState<RelationshipNode[]>([]);
  const [edges, setEdges] = useState<RelationshipEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getRelationships(gameId);
        setNodes(data.nodes);
        setEdges(data.edges);
      } catch (error) {
        console.error("Failed to fetch relationships:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [gameId]);

  // ノードの配置を計算（円形レイアウト）
  const nodePositions = useMemo(() => {
    const cx = 250;
    const cy = 200;
    const radius = 140;
    const positions: Record<string, { x: number; y: number }> = {};

    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      positions[node.characterId] = {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });

    return positions;
  }, [nodes]);

  // 選択ノードに関連するエッジをフィルタ
  const filteredEdges = useMemo(() => {
    if (!selectedNode) return edges;
    return edges.filter(
      (e) => e.fromId === selectedNode || e.toId === selectedNode
    );
  }, [edges, selectedNode]);

  if (loading) {
    return <Loading variant="ink" size="md" text="関係性データを取得中..." />;
  }

  if (nodes.length === 0) {
    return (
      <Card>
        <CardContent className="text-center text-paper/50 py-8">
          関係性データがありません
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>🕸️</span>
          <span>人間関係グラフ</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* SVGグラフ */}
          <div className="flex-1">
            <svg viewBox="0 0 500 400" className="w-full h-auto">
              {/* エッジ */}
              {filteredEdges.map((edge, i) => {
                const from = nodePositions[edge.fromId];
                const to = nodePositions[edge.toId];
                if (!from || !to) return null;

                // 信頼度が高いほど緑、疑惑度が高いほど赤
                const trustRatio = edge.trust / (edge.trust + edge.suspicion + 1);
                const r = Math.round(220 * (1 - trustRatio));
                const g = Math.round(200 * trustRatio);
                const color = `rgb(${r}, ${g}, 80)`;
                const width = Math.max(1, (edge.trust + edge.suspicion) / 40);
                const opacity = selectedNode ? 0.8 : 0.4;

                return (
                  <line
                    key={`${edge.fromId}-${edge.toId}-${i}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={color}
                    strokeWidth={width}
                    opacity={opacity}
                    strokeDasharray={edge.suspicion > 70 ? "4 2" : undefined}
                  />
                );
              })}

              {/* ノード */}
              {nodes.map((node) => {
                const pos = nodePositions[node.characterId];
                if (!pos) return null;

                const isSelected = selectedNode === node.characterId;
                const emotionColor = EMOTION_COLORS[node.emotionalState] || EMOTION_COLORS.calm;

                return (
                  <g
                    key={node.characterId}
                    onClick={() =>
                      setSelectedNode(
                        isSelected ? null : node.characterId
                      )
                    }
                    className="cursor-pointer"
                  >
                    {/* 外枠（感情色） */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isSelected ? 32 : 28}
                      fill={emotionColor}
                      opacity={0.3}
                    />
                    {/* 内側 */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={24}
                      fill={node.isHuman ? "#2563EB" : "#7C3AED"}
                      stroke={isSelected ? "#D4AF37" : emotionColor}
                      strokeWidth={isSelected ? 3 : 2}
                    />
                    {/* 名前 */}
                    <text
                      x={pos.x}
                      y={pos.y + 42}
                      textAnchor="middle"
                      fill="#F5F0E8"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {node.characterName}
                    </text>
                    {/* 人間/AIラベル */}
                    <text
                      x={pos.x}
                      y={pos.y + 4}
                      textAnchor="middle"
                      fill="#FFF"
                      fontSize="10"
                    >
                      {node.isHuman ? "🧑" : "🤖"}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* 詳細パネル */}
          <div className="lg:w-64 space-y-3">
            <div className="text-xs text-paper/60 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-600" />
                <span>人間プレイヤー</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-600" />
                <span>AIエージェント</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-green-500" />
                <span>信頼</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-red-500 border-dashed border-t" />
                <span>疑惑</span>
              </div>
            </div>

            {/* 選択ノードの関係詳細 */}
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <h4 className="text-sm font-serif text-accent-gold">
                  {nodes.find((n) => n.characterId === selectedNode)?.characterName} の関係
                </h4>
                {filteredEdges
                  .filter((e) => e.fromId === selectedNode)
                  .map((edge) => (
                    <div
                      key={`detail-${edge.toId}`}
                      className="p-2 bg-paper/5 rounded text-xs"
                    >
                      <div className="font-medium">{edge.toName}</div>
                      <div className="flex gap-3 mt-1">
                        <span className="text-green-400">
                          信頼: {edge.trust}
                        </span>
                        <span className="text-red-400">
                          疑惑: {edge.suspicion}
                        </span>
                      </div>
                      {edge.note && (
                        <div className="text-paper/50 mt-1">{edge.note}</div>
                      )}
                    </div>
                  ))}
              </motion.div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
