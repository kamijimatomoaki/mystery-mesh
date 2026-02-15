/**
 * useGameActions Hook
 * ゲームアクション用のReact Hook
 */

"use client";

import { useState } from "react";
import {
  createGame,
  joinGame,
  advancePhase,
  triggerAISpeak,
  generateEndingVideo,
  pollVideoGeneration,
  type CreateGameRequest,
  type JoinGameRequest,
  type AdvancePhaseRequest,
  type TriggerSpeakRequest,
  type GenerateVideoRequest,
} from "../api/game";
import { useToast } from "./useToast";

/**
 * ゲームアクションフック
 */
export function useGameActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  /**
   * ゲーム作成
   */
  const handleCreateGame = async (request: CreateGameRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await createGame(request);

      toast.success("ゲームを作成しました");

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ゲーム作成に失敗しました";
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * ゲーム参加
   */
  const handleJoinGame = async (request: JoinGameRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await joinGame(request);

      toast.success("ゲームに参加しました");

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "ゲーム参加に失敗しました";
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * フェーズ進行
   */
  const handleAdvancePhase = async (request: AdvancePhaseRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await advancePhase(request);

      if (response.success) {
        toast.success(`フェーズを ${response.newPhase} に進めました`);
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "フェーズ進行に失敗しました";
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * AI発言トリガー
   */
  const handleTriggerAISpeak = async (request: TriggerSpeakRequest) => {
    setLoading(true);
    setError(null);

    try {
      const response = await triggerAISpeak(request);

      if (response.nextSpeaker) {
        toast.info(`${response.nextSpeaker} が発言します`);
      } else {
        toast.info("発言すべきエージェントはいません");
      }

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "AI発言トリガーに失敗しました";
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * エンディング動画生成（進捗付き）
   */
  const handleGenerateVideo = async (
    request: GenerateVideoRequest,
    onProgress?: (progress: number) => void
  ) => {
    setLoading(true);
    setError(null);

    try {
      // 生成開始
      const startResponse = await generateEndingVideo(request);
      toast.info("動画生成を開始しました");

      // ポーリングで完了を待つ
      const videoUrl = await pollVideoGeneration(
        startResponse.jobId,
        onProgress
      );

      toast.success("動画生成が完了しました");

      return videoUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "動画生成に失敗しました";
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    createGame: handleCreateGame,
    joinGame: handleJoinGame,
    advancePhase: handleAdvancePhase,
    triggerAISpeak: handleTriggerAISpeak,
    generateVideo: handleGenerateVideo,
  };
}
