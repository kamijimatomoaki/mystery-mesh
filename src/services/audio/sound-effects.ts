/**
 * Sound Effects Service
 * 効果音の再生管理
 */

export type SoundEffect =
  | "click"
  | "hover"
  | "success"
  | "error"
  | "notification"
  | "message_sent"
  | "message_received"
  | "card_reveal"
  | "card_flip"
  | "vote"
  | "timer_warning"
  | "timer_expired"
  | "phase_change"
  | "game_start"
  | "game_end"
  | "achievement"
  | "suspense"
  | "dramatic_reveal";

interface SoundConfig {
  src: string;
  volume: number;
  maxConcurrent?: number;
}

// 効果音設定（実際のファイルパスに置き換え）
const SOUND_EFFECTS: Record<SoundEffect, SoundConfig> = {
  click: { src: "/audio/sfx/click.mp3", volume: 0.3 },
  hover: { src: "/audio/sfx/hover.mp3", volume: 0.1 },
  success: { src: "/audio/sfx/success.mp3", volume: 0.4 },
  error: { src: "/audio/sfx/error.mp3", volume: 0.4 },
  notification: { src: "/audio/sfx/notification.mp3", volume: 0.5 },
  message_sent: { src: "/audio/sfx/message_sent.mp3", volume: 0.3 },
  message_received: { src: "/audio/sfx/message_received.mp3", volume: 0.4 },
  card_reveal: { src: "/audio/sfx/card_reveal.mp3", volume: 0.5 },
  card_flip: { src: "/audio/sfx/card_flip.mp3", volume: 0.3 },
  vote: { src: "/audio/sfx/vote.mp3", volume: 0.5 },
  timer_warning: { src: "/audio/sfx/timer_warning.mp3", volume: 0.6 },
  timer_expired: { src: "/audio/sfx/timer_expired.mp3", volume: 0.7 },
  phase_change: { src: "/audio/sfx/phase_change.mp3", volume: 0.5 },
  game_start: { src: "/audio/sfx/game_start.mp3", volume: 0.6 },
  game_end: { src: "/audio/sfx/game_end.mp3", volume: 0.6 },
  achievement: { src: "/audio/sfx/achievement.mp3", volume: 0.6 },
  suspense: { src: "/audio/sfx/suspense.mp3", volume: 0.4 },
  dramatic_reveal: { src: "/audio/sfx/dramatic_reveal.mp3", volume: 0.7 },
};

/**
 * 効果音マネージャークラス
 * シングルトンパターンで実装
 */
class SoundEffectsManager {
  private static instance: SoundEffectsManager;
  private audioCache: Map<SoundEffect, HTMLAudioElement[]> = new Map();
  private masterVolume: number = 1.0;
  private isMuted: boolean = false;
  private isEnabled: boolean = true;

  private constructor() {
    this.preloadSounds();
  }

  static getInstance(): SoundEffectsManager {
    if (!SoundEffectsManager.instance) {
      SoundEffectsManager.instance = new SoundEffectsManager();
    }
    return SoundEffectsManager.instance;
  }

  /**
   * 効果音をプリロード
   */
  private preloadSounds(): void {
    if (typeof window === "undefined") return;

    // よく使う効果音をプリロード
    const prioritySounds: SoundEffect[] = [
      "click",
      "message_sent",
      "message_received",
      "notification",
    ];

    prioritySounds.forEach((effect) => {
      this.getOrCreateAudio(effect);
    });
  }

  /**
   * オーディオ要素を取得または作成
   */
  private getOrCreateAudio(effect: SoundEffect): HTMLAudioElement {
    let audioPool = this.audioCache.get(effect);

    if (!audioPool) {
      audioPool = [];
      this.audioCache.set(effect, audioPool);
    }

    // 利用可能なオーディオ要素を探す
    let availableAudio = audioPool.find(
      (audio) => audio.paused || audio.ended
    );

    if (!availableAudio) {
      const config = SOUND_EFFECTS[effect];
      availableAudio = new Audio(config.src);
      audioPool.push(availableAudio);
    }

    return availableAudio;
  }

  /**
   * 効果音を再生
   */
  play(effect: SoundEffect, options: { volume?: number; rate?: number } = {}): void {
    if (!this.isEnabled || this.isMuted) return;
    if (typeof window === "undefined") return;

    try {
      const config = SOUND_EFFECTS[effect];
      const audio = this.getOrCreateAudio(effect);

      audio.volume = this.getEffectiveVolume(options.volume ?? config.volume);
      audio.playbackRate = options.rate ?? 1.0;
      audio.currentTime = 0;

      audio.play().catch((error) => {
        // ユーザー操作なしでの再生はブラウザによってブロックされる場合がある
        console.debug("[SFX] Playback blocked:", effect, error);
      });
    } catch (error) {
      console.error("[SFX] Failed to play:", effect, error);
    }
  }

  /**
   * 複数の効果音を順番に再生
   */
  async playSequence(
    effects: SoundEffect[],
    interval: number = 100
  ): Promise<void> {
    for (const effect of effects) {
      this.play(effect);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }

  /**
   * マスターボリュームを設定
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    console.log("[SFX] Master volume:", this.masterVolume);
  }

  /**
   * ミュート切り替え
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    console.log("[SFX] Muted:", this.isMuted);
    return this.isMuted;
  }

  /**
   * ミュート状態を設定
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  /**
   * 効果音の有効/無効を設定
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    console.log("[SFX] Enabled:", this.isEnabled);
  }

  /**
   * 現在の状態を取得
   */
  getState(): {
    volume: number;
    isMuted: boolean;
    isEnabled: boolean;
  } {
    return {
      volume: this.masterVolume,
      isMuted: this.isMuted,
      isEnabled: this.isEnabled,
    };
  }

  /**
   * 実効ボリュームを計算
   */
  private getEffectiveVolume(baseVolume: number): number {
    return baseVolume * this.masterVolume;
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.audioCache.clear();
    console.log("[SFX] Cache cleared");
  }
}

// エクスポート用のシングルトンインスタンス
export const soundEffects = SoundEffectsManager.getInstance();

/**
 * UI操作用のヘルパー関数
 */
export const uiSounds = {
  click: () => soundEffects.play("click"),
  hover: () => soundEffects.play("hover", { volume: 0.1 }),
  success: () => soundEffects.play("success"),
  error: () => soundEffects.play("error"),
};

/**
 * ゲームイベント用のヘルパー関数
 */
export const gameSounds = {
  messageSent: () => soundEffects.play("message_sent"),
  messageReceived: () => soundEffects.play("message_received"),
  cardReveal: () => soundEffects.play("card_reveal"),
  cardFlip: () => soundEffects.play("card_flip"),
  vote: () => soundEffects.play("vote"),
  phaseChange: () => soundEffects.play("phase_change"),
  timerWarning: () => soundEffects.play("timer_warning"),
  timerExpired: () => soundEffects.play("timer_expired"),
  gameStart: () => soundEffects.play("game_start"),
  gameEnd: () => soundEffects.play("game_end"),
  achievement: () => soundEffects.play("achievement"),
  dramaticReveal: () => soundEffects.play("dramatic_reveal"),
};
