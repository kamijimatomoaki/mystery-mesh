"use client";

/**
 * Chat Log
 * 会話ログ（画面下部）
 * Firestoreリアルタイム連携対応
 */

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Send, Loader2 } from "lucide-react";
import { collection, doc, setDoc, onSnapshot, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/core/db/firestore-client";
import type { GameState, Scenario, ChatMessage } from "@/core/types";
import { Button, Textarea, Badge, SpeechPlayer } from "@/components";
import { useToast } from "@/lib/hooks/useToast";
import { cn } from "@/lib/utils";

interface ChatLogProps {
  game: GameState;
  scenario: Scenario;
  currentUserId: string;
}

export function ChatLog({ game, scenario, currentUserId }: ChatLogProps) {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Firestoreからのメッセージ
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // 再生中のメッセージID（TTS再生中のバブルをハイライト）
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  // Firestoreリアルタイムリスナー（メッセージサブコレクション）
  useEffect(() => {
    if (!game.id || !currentUserId) return;

    const messagesRef = collection(db, "games", game.id, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as ChatMessage[];
        setMessages(msgs);
        // AIトリガーはハートビート方式に移行済み（page.tsxで管理）
      },
      (error) => {
        console.error("Failed to listen to messages:", error);
        toast.error("メッセージの取得に失敗しました", 2000);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [game.id, currentUserId, toast]);

  // 自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  /**
   * メッセージ送信処理
   * 1. Firestoreにメッセージを保存
   * 2. AI発言トリガーAPI呼び出し
   */
  const handleSendMessage = async () => {
    if (!message.trim()) {
      toast.warning("メッセージを入力してください");
      return;
    }

    setIsSending(true);

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
      toast.success("発言しました", 1500);

      // AI発言トリガーは onSnapshot 内の scheduleAITrigger で自動的に行われる
      // （メッセージがFirestoreに保存されると、リスナーが検知してスケジュール）
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("メッセージの送信に失敗しました", 2000);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  /**
   * プレイヤー情報を取得
   * ChatMessage.senderId からプレイヤー情報を引く
   */
  const getPlayerInfo = (senderId: string, senderName: string, characterId: string) => {
    if (senderId === "system") {
      return { name: "システム", icon: "📢", imageUrl: null, isAI: false };
    }

    const player = game.players[senderId];
    const character = scenario.data.characters.find(
      (c) => c.id === characterId
    );

    // AIエージェントかどうか判定（senderId が "agent_" で始まる場合はAI）
    const isAI = senderId.startsWith("agent_");

    return {
      name: senderName || character?.name || player?.displayName || "不明",
      icon: isAI ? "🤖" : "👤",
      imageUrl: character?.images?.base || null,
      isAI,
    };
  };

  /**
   * Timestampを Date に変換
   */
  const toDate = (timestamp: ChatMessage["timestamp"]): Date => {
    if (timestamp?.toDate) {
      return timestamp.toDate();
    }
    if (timestamp && "seconds" in timestamp) {
      return new Date((timestamp as { seconds: number }).seconds * 1000);
    }
    return new Date();
  };

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="flex items-center justify-between border-b border-paper/20 px-4 py-2">
        <h3 className="font-serif text-sm font-semibold text-paper">
          会話・行動ログ
        </h3>
        <Badge variant="outline" size="sm">
          {messages.length}件
        </Badge>
      </div>

      {/* メッセージリスト */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-paper/20 scrollbar-track-transparent"
      >
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-paper/50">メッセージはまだありません</p>
          </div>
        )}
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;
          const playerInfo = getPlayerInfo(msg.senderId, msg.senderName, msg.characterId);
          const isCurrentUser = msg.senderId === currentUserId;
          const timestamp = toDate(msg.timestamp);

          // システムメッセージ（senderId が "system" の場合）
          if (msg.senderId === "system") {
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center"
              >
                <div className="rounded-full bg-paper/10 px-4 py-2 flex items-center gap-2">
                  <p className="text-xs text-paper/70">{msg.content}</p>
                  <SpeechPlayer text={msg.content} isSystem />
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex items-start gap-3",
                isCurrentUser && "flex-row-reverse"
              )}
            >
              {/* アバター */}
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-paper/30 bg-ink-light text-xl overflow-hidden">
                {playerInfo.imageUrl ? (
                  <img
                    src={playerInfo.imageUrl}
                    alt={playerInfo.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.nextElementSibling?.classList.remove("hidden");
                    }}
                  />
                ) : null}
                <span className={playerInfo.imageUrl ? "hidden" : ""}>
                  {playerInfo.icon}
                </span>
              </div>

              {/* メッセージ */}
              <div
                className={cn(
                  "max-w-md space-y-1",
                  isCurrentUser && "items-end"
                )}
              >
                <div className={cn(
                  "flex items-center gap-2",
                  isCurrentUser && "flex-row-reverse"
                )}>
                  <p className="text-xs font-semibold text-paper">
                    {playerInfo.name}
                  </p>
                  {playerInfo.isAI && (
                    <Badge variant="outline" size="sm" className="text-xs">
                      AI
                    </Badge>
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 transition-all duration-300",
                    isCurrentUser
                      ? "bg-accent-gold/20 text-paper"
                      : "bg-paper/10 text-paper",
                    // TTS再生中のバブルをハイライト
                    playingMessageId === msg.id && "ring-2 ring-accent-gold shadow-lg shadow-accent-gold/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <p className="text-sm leading-relaxed flex-1">{msg.content}</p>
                    <SpeechPlayer
                      text={msg.content}
                      characterId={msg.characterId}
                      isSystem={false}
                      onStart={() => setPlayingMessageId(msg.id)}
                      onEnd={() => setPlayingMessageId(null)}
                    />
                  </div>
                </div>
                <p className="text-xs text-paper/40">
                  {timestamp.toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </motion.div>
          );
        })}

        {/* AI思考中インジケーターはpage.tsxレベルで表示（ハートビート方式） */}
      </div>

      {/* 入力エリア */}
      <div className="border-t border-paper/20 px-4 py-3">
        <div className="flex items-end gap-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="発言内容を入力... (Shift+Enterで改行)"
            className="flex-1 resize-none"
            rows={2}
          />
          <Button
            variant="seal"
            size="lg"
            onClick={handleSendMessage}
            disabled={isSending || !message.trim()}
            isLoading={isSending}
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="mt-2 text-xs text-paper/50">
          💡 Enterで送信、Shift+Enterで改行
        </p>
      </div>
    </div>
  );
}
