"use client";

/**
 * Right Sidebar (Chat Log)
 * 右サイドバー（会話ログ + 入力欄）
 *
 * 重要: メッセージの購読は page.tsx の useGameMessages で一元管理
 * このコンポーネントは messages を props として受け取る
 */

import { motion } from "framer-motion";
import { X, Send, MessageCircle } from "lucide-react";
import { useState, useRef, useEffect, memo } from "react";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/core/db/firestore-client";
import type { GameState, Scenario, ChatMessage } from "@/core/types";
import { Badge } from "@/components";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/hooks/useToast";

interface RightSidebarProps {
  game: GameState;
  scenario: Scenario;
  currentUserId: string;
  onClose: () => void;
  /** メッセージリスト（page.tsx から props として渡される） */
  messages: ChatMessage[];
}

/**
 * フェーズに基づいてHuman入力のデフォルト値を取得
 * 既存データ（フラグ未設定）への後方互換対応
 */
function getDefaultAllowHumanInput(phase: string | undefined): boolean {
  const allowedPhases = ["exploration_1", "exploration_2", "discussion_1", "discussion_2"];
  return allowedPhases.includes(phase || "");
}

export const RightSidebar = memo(function RightSidebar({
  game,
  scenario,
  currentUserId,
  onClose,
  messages,
}: RightSidebarProps) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // フラグが未定義の場合はフェーズに基づいてフォールバック値を使用（既存データ対応）
  const allowHumanInput = game.allowHumanInput ?? getDefaultAllowHumanInput(game.phase);

  // 自動スクロール（メッセージが更新されたら末尾にスクロール）
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const currentPlayer = game.players[currentUserId];
    const character = scenario.data.characters.find(
      (c) => c.id === currentPlayer?.characterId
    );

    // 新しいメッセージを作成
    const messageId = `msg_${Date.now()}_${currentUserId}`;
    const newMessage: ChatMessage = {
      id: messageId,
      senderId: currentUserId,
      senderName: character?.name || currentPlayer?.displayName || "不明",
      characterId: currentPlayer?.characterId || "",
      content: message.trim(),
      timestamp: Timestamp.now(),
    };

    try {
      // Firestoreサブコレクションに保存
      const messageRef = doc(db, "games", game.id, "messages", messageId);
      await setDoc(messageRef, newMessage);

      setMessage("");
      toast.success("メッセージを送信しました", 1500);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("メッセージの送信に失敗しました", 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed right-0 top-16 bottom-0 z-40 w-96 border-l-2 border-gold-accent/30 ink-bg backdrop-blur-md flex flex-col shadow-2xl"
    >
      {/* ヘッダー */}
      <div className="flex items-center justify-between p-6 border-b-2 border-gold-accent/20">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-gold-accent candle-glow" />
          <h2 className="font-title text-2xl font-bold text-parchment-light candle-glow">
            💬 会話ログ
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-parchment-light/70 transition-all duration-300 hover:bg-gold-accent/20 hover:text-parchment-light hover:scale-110"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* メッセージリスト */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {messages.map((msg) => {
          const isCurrentUser = msg.senderId === currentUserId;

          // AIエージェントかどうかを判定（senderId が "agent_" で始まる場合はAI）
          const isAI = msg.senderId.startsWith("agent_");

          // Timestamp を Date に変換
          const timestamp = msg.timestamp?.toDate
            ? msg.timestamp.toDate()
            : msg.timestamp?.seconds
              ? new Date(msg.timestamp.seconds * 1000)
              : new Date();

          return (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                isCurrentUser && "flex-row-reverse"
              )}
            >
              {/* アバター */}
              <div className="flex-shrink-0">
                {(() => {
                  const character = scenario.data.characters.find(
                    (c) => c.id === msg.characterId
                  );
                  const imageUrl = character?.images?.base;
                  return (
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg transition-all duration-300 overflow-hidden",
                        isCurrentUser
                          ? "border-gold-accent bg-gold-accent/30 shadow-lg shadow-gold-accent/50"
                          : "border-parchment-dark bg-ink-brown shadow-md"
                      )}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={msg.senderName}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove("hidden");
                          }}
                        />
                      ) : null}
                      <span className={imageUrl ? "hidden" : ""}>
                        {isAI ? "🤖" : "👤"}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* メッセージ内容 */}
              <div
                className={cn(
                  "flex-1 space-y-1 ink-spread-animated",
                  isCurrentUser && "flex flex-col items-end"
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-2",
                    isCurrentUser && "flex-row-reverse"
                  )}
                >
                  <p className="text-sm font-body font-semibold text-parchment-light">
                    {msg.senderName}
                  </p>
                  {isAI && (
                    <Badge variant="outline" size="sm" className="text-xs">
                      AI
                    </Badge>
                  )}
                </div>

                <div
                  className={cn(
                    "rounded-lg px-4 py-3 shadow-parchment transition-all duration-300 hover:shadow-card-hover",
                    isCurrentUser
                      ? "bg-parchment-texture text-ink-black border border-gold-accent/50"
                      : "bg-ink-brown/60 text-parchment-light border border-parchment-dark/30"
                  )}
                >
                  <p className="text-sm font-body leading-relaxed">
                    {msg.content}
                  </p>
                </div>

                <p className="text-xs text-parchment-light/50 font-ui">
                  {timestamp.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 入力欄 */}
      <div className="p-6 border-t-2 border-gold-accent/20 bg-ink-brown/30">
        {/* 入力禁止時のメッセージ */}
        {!allowHumanInput && (
          <div className="mb-3 px-4 py-2 rounded-lg bg-ink-brown/50 border border-parchment-dark/30 text-center">
            <p className="text-sm text-parchment-light/70 font-body">
              📜 現在は入力できません
            </p>
          </div>
        )}
        <div className="flex gap-3">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={!allowHumanInput
              ? "このフェーズでは発言できません..."
              : "インクを紙に滲ませる... (Enterで送信)"
            }
            disabled={!allowHumanInput}
            className={cn(
              "flex-1 rounded-lg border-2 px-4 py-3 text-sm font-body transition-all duration-300",
              !allowHumanInput
                ? "border-parchment-dark/30 bg-ink-brown/30 text-parchment-light/40 cursor-not-allowed"
                : "border-gold-accent/30 bg-parchment-light/10 text-parchment-light placeholder:text-parchment-light/40 focus:border-gold-accent focus:bg-parchment-light/20 focus:outline-none focus:ring-2 focus:ring-gold-accent/20"
            )}
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim() || !allowHumanInput}
            className="gold-button flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-xs text-parchment-light/50 text-center font-ui">
          🖋️ Shift+Enterで改行 | Enterで封印して送信
        </p>
      </div>
    </motion.div>
  );
});
