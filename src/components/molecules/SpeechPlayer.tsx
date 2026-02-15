"use client";

/**
 * SpeechPlayer Component
 * テキストを音声で再生するコンポーネント
 *
 * ハイブリッド方式:
 * - システムメッセージ → WebSpeech API（無料、即時）
 * - キャラクター発言 → Google Cloud TTS（高品質）
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Loader2, Play, Pause } from "lucide-react";
import { Button } from "@/components";

interface SpeechPlayerProps {
  text: string;
  characterId?: string;
  isSystem?: boolean;
  autoPlay?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

type PlaybackState = "idle" | "loading" | "playing" | "paused" | "error";

/**
 * SpeechPlayer - 音声再生コンポーネント
 */
export function SpeechPlayer({
  text,
  characterId,
  isSystem = false,
  autoPlay = false,
  onStart,
  onEnd,
  onError,
  className = "",
}: SpeechPlayerProps) {
  const [state, setState] = useState<PlaybackState>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // WebSpeech API が利用可能かチェック
  const isWebSpeechAvailable = typeof window !== "undefined" && "speechSynthesis" in window;

  /**
   * WebSpeech API で再生（システムメッセージ用）
   */
  const playWithWebSpeech = useCallback(async () => {
    if (!isWebSpeechAvailable) {
      throw new Error("WebSpeech API is not available");
    }

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setState("playing");
        onStart?.();
      };

      utterance.onend = () => {
        setState("idle");
        onEnd?.();
        resolve();
      };

      utterance.onerror = (event) => {
        const err = new Error(event.error || "WebSpeech error");
        setState("error");
        setError(err.message);
        onError?.(err);
        reject(err);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, [text, isWebSpeechAvailable, onStart, onEnd, onError]);

  /**
   * Google Cloud TTS で再生（キャラクター発言用）
   */
  const playWithCloudTTS = useCallback(async () => {
    setState("loading");

    try {
      const response = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          characterId,
          outputFormat: "MP3",
          saveToBucket: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "TTS synthesis failed");
      }

      const data = await response.json();

      if (!data.audioUrl) {
        throw new Error("No audio URL returned");
      }

      // Audio要素で再生
      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setState("playing");
        onStart?.();
      };

      audio.onended = () => {
        setState("idle");
        onEnd?.();
      };

      audio.onerror = () => {
        const err = new Error("Audio playback error");
        setState("error");
        setError(err.message);
        onError?.(err);
      };

      await audio.play();
    } catch (err) {
      const error = err as Error;
      setState("error");
      setError(error.message);
      onError?.(error);
    }
  }, [text, characterId, onStart, onEnd, onError]);

  /**
   * 再生開始
   */
  const play = useCallback(async () => {
    setError(null);

    if (isSystem && isWebSpeechAvailable) {
      await playWithWebSpeech();
    } else {
      await playWithCloudTTS();
    }
  }, [isSystem, isWebSpeechAvailable, playWithWebSpeech, playWithCloudTTS]);

  /**
   * 一時停止
   */
  const pause = useCallback(() => {
    if (isSystem && utteranceRef.current) {
      window.speechSynthesis.pause();
      setState("paused");
    } else if (audioRef.current) {
      audioRef.current.pause();
      setState("paused");
    }
  }, [isSystem]);

  /**
   * 再開
   */
  const resume = useCallback(() => {
    if (isSystem) {
      window.speechSynthesis.resume();
      setState("playing");
    } else if (audioRef.current) {
      audioRef.current.play();
      setState("playing");
    }
  }, [isSystem]);

  /**
   * 停止
   */
  const stop = useCallback(() => {
    if (isSystem) {
      window.speechSynthesis.cancel();
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setState("idle");
  }, [isSystem]);

  /**
   * 自動再生
   */
  useEffect(() => {
    if (autoPlay && state === "idle") {
      play();
    }
  }, [autoPlay, state, play]);

  /**
   * クリーンアップ
   */
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  /**
   * トグル再生
   */
  const togglePlay = () => {
    if (state === "playing") {
      pause();
    } else if (state === "paused") {
      resume();
    } else {
      play();
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={togglePlay}
        disabled={state === "loading"}
        className="p-1 h-6 w-6"
        title={state === "playing" ? "一時停止" : "再生"}
      >
        <AnimatePresence mode="wait">
          {state === "loading" ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Loader2 className="h-3 w-3 animate-spin text-paper/60" />
            </motion.div>
          ) : state === "playing" ? (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Pause className="h-3 w-3 text-accent-gold" />
            </motion.div>
          ) : state === "error" ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <VolumeX className="h-3 w-3 text-accent-red" />
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Volume2 className="h-3 w-3 text-paper/60 hover:text-accent-gold transition-colors" />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>

      {/* エラー表示 */}
      {error && (
        <span className="text-xs text-accent-red" title={error}>
          !
        </span>
      )}

      {/* 再生中インジケーター */}
      <AnimatePresence>
        {state === "playing" && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="flex items-center gap-0.5"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-0.5 bg-accent-gold rounded-full"
                animate={{
                  height: [4, 12, 4],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.15,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 自動再生キュー用のフック
 */
export function useSpeechQueue() {
  const [queue, setQueue] = useState<Array<{ text: string; characterId?: string; isSystem?: boolean }>>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  const addToQueue = useCallback((item: { text: string; characterId?: string; isSystem?: boolean }) => {
    setQueue((prev) => [...prev, item]);
  }, []);

  const playNext = useCallback(() => {
    if (queue.length === 0) {
      setIsPlaying(false);
      return null;
    }

    const [next, ...rest] = queue;
    setQueue(rest);
    setIsPlaying(true);
    return next;
  }, [queue]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setIsPlaying(false);
  }, []);

  return {
    queue,
    isPlaying,
    addToQueue,
    playNext,
    clearQueue,
    queueLength: queue.length,
  };
}

export default SpeechPlayer;
