/**
 * BGM Player Service
 * バックグラウンドミュージックの再生管理
 */

export type BGMTrack =
  | "lobby"
  | "prologue"
  | "exploration"
  | "discussion"
  | "voting"
  | "ending"
  | "tension"
  | "mystery";

interface BGMConfig {
  src: string;
  volume: number;
  loop: boolean;
}

// BGMトラック設定（実際のファイルパスに置き換え）
const BGM_TRACKS: Record<BGMTrack, BGMConfig> = {
  lobby: {
    src: "/audio/bgm/lobby.mp3",
    volume: 0.3,
    loop: true,
  },
  prologue: {
    src: "/audio/bgm/prologue.mp3",
    volume: 0.4,
    loop: true,
  },
  exploration: {
    src: "/audio/bgm/exploration.mp3",
    volume: 0.35,
    loop: true,
  },
  discussion: {
    src: "/audio/bgm/discussion.mp3",
    volume: 0.3,
    loop: true,
  },
  voting: {
    src: "/audio/bgm/voting.mp3",
    volume: 0.4,
    loop: true,
  },
  ending: {
    src: "/audio/bgm/ending.mp3",
    volume: 0.5,
    loop: false,
  },
  tension: {
    src: "/audio/bgm/tension.mp3",
    volume: 0.4,
    loop: true,
  },
  mystery: {
    src: "/audio/bgm/mystery.mp3",
    volume: 0.35,
    loop: true,
  },
};

/**
 * BGM プレイヤークラス
 * シングルトンパターンで実装
 */
class BGMPlayer {
  private static instance: BGMPlayer;
  private currentAudio: HTMLAudioElement | null = null;
  private currentTrack: BGMTrack | null = null;
  private masterVolume: number = 1.0;
  private isMuted: boolean = false;
  private fadeInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): BGMPlayer {
    if (!BGMPlayer.instance) {
      BGMPlayer.instance = new BGMPlayer();
    }
    return BGMPlayer.instance;
  }

  /**
   * BGMを再生
   */
  play(track: BGMTrack, options: { fadeIn?: boolean; fadeDuration?: number } = {}): void {
    const { fadeIn = true, fadeDuration = 1000 } = options;

    // 同じトラックが再生中なら何もしない
    if (this.currentTrack === track && this.currentAudio && !this.currentAudio.paused) {
      return;
    }

    // 現在のトラックを停止
    if (this.currentAudio) {
      this.stop({ fadeOut: fadeIn, fadeDuration });
    }

    const config = BGM_TRACKS[track];
    const audio = new Audio(config.src);
    audio.loop = config.loop;
    audio.volume = fadeIn ? 0 : this.getEffectiveVolume(config.volume);

    this.currentAudio = audio;
    this.currentTrack = track;

    audio.play().catch((error) => {
      console.error("[BGM] Failed to play:", error);
    });

    if (fadeIn) {
      this.fadeVolume(0, this.getEffectiveVolume(config.volume), fadeDuration);
    }

    console.log("[BGM] Playing:", track);
  }

  /**
   * BGMを停止
   */
  stop(options: { fadeOut?: boolean; fadeDuration?: number } = {}): void {
    const { fadeOut = true, fadeDuration = 500 } = options;

    if (!this.currentAudio) return;

    if (fadeOut) {
      const audio = this.currentAudio;
      this.fadeVolume(audio.volume, 0, fadeDuration, () => {
        audio.pause();
        audio.currentTime = 0;
      });
    } else {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    this.currentAudio = null;
    this.currentTrack = null;

    console.log("[BGM] Stopped");
  }

  /**
   * BGMを一時停止
   */
  pause(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      console.log("[BGM] Paused");
    }
  }

  /**
   * BGMを再開
   */
  resume(): void {
    if (this.currentAudio) {
      this.currentAudio.play().catch((error) => {
        console.error("[BGM] Failed to resume:", error);
      });
      console.log("[BGM] Resumed");
    }
  }

  /**
   * マスターボリュームを設定
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolume();
    console.log("[BGM] Master volume:", this.masterVolume);
  }

  /**
   * ミュート切り替え
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.updateVolume();
    console.log("[BGM] Muted:", this.isMuted);
    return this.isMuted;
  }

  /**
   * ミュート状態を設定
   */
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateVolume();
  }

  /**
   * 現在の再生状態を取得
   */
  getState(): {
    isPlaying: boolean;
    currentTrack: BGMTrack | null;
    volume: number;
    isMuted: boolean;
  } {
    return {
      isPlaying: this.currentAudio ? !this.currentAudio.paused : false,
      currentTrack: this.currentTrack,
      volume: this.masterVolume,
      isMuted: this.isMuted,
    };
  }

  /**
   * 実効ボリュームを計算
   */
  private getEffectiveVolume(trackVolume: number): number {
    return this.isMuted ? 0 : trackVolume * this.masterVolume;
  }

  /**
   * ボリュームを更新
   */
  private updateVolume(): void {
    if (this.currentAudio && this.currentTrack) {
      const config = BGM_TRACKS[this.currentTrack];
      this.currentAudio.volume = this.getEffectiveVolume(config.volume);
    }
  }

  /**
   * ボリュームをフェード
   */
  private fadeVolume(
    from: number,
    to: number,
    duration: number,
    onComplete?: () => void
  ): void {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
    }

    if (!this.currentAudio) return;

    const audio = this.currentAudio;
    const steps = Math.ceil(duration / 50);
    const volumeStep = (to - from) / steps;
    let currentStep = 0;

    audio.volume = from;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      audio.volume = Math.max(0, Math.min(1, from + volumeStep * currentStep));

      if (currentStep >= steps) {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        audio.volume = to;
        if (onComplete) onComplete();
      }
    }, 50);
  }
}

// エクスポート用のシングルトンインスタンス
export const bgmPlayer = BGMPlayer.getInstance();

/**
 * ゲームフェーズに対応するBGMを取得
 */
export function getBGMForPhase(phase: string): BGMTrack | null {
  const phaseMapping: Record<string, BGMTrack> = {
    lobby: "lobby",
    prologue: "prologue",
    exploration_1: "exploration",
    exploration_2: "exploration",
    discussion_1: "discussion",
    discussion_2: "discussion",
    voting: "voting",
    ending: "ending",
  };

  return phaseMapping[phase] || null;
}
