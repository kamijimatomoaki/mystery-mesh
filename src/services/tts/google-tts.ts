/**
 * Google Text-to-Speech Service
 * テキストから音声を生成するサービス
 */

export interface TTSOptions {
  languageCode?: string;
  voiceName?: string;
  speakingRate?: number;
  pitch?: number;
  volumeGainDb?: number;
}

export interface TTSResult {
  audioContent: ArrayBuffer;
  audioUrl: string;
}

const DEFAULT_OPTIONS: TTSOptions = {
  languageCode: "ja-JP",
  voiceName: "ja-JP-Neural2-B", // 自然な女性音声
  speakingRate: 1.0,
  pitch: 0,
  volumeGainDb: 0,
};

/**
 * テキストを音声に変換
 *
 * @param text - 変換するテキスト
 * @param options - TTS オプション
 * @returns 音声データとURL
 */
export async function synthesizeSpeech(
  text: string,
  options: TTSOptions = {}
): Promise<TTSResult> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    const response = await fetch("/api/tts/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        ...mergedOptions,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.statusText}`);
    }

    const audioContent = await response.arrayBuffer();
    const audioBlob = new Blob([audioContent], { type: "audio/mp3" });
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioContent,
      audioUrl,
    };
  } catch (error) {
    console.error("[TTS] Synthesis failed:", error);
    throw error;
  }
}

/**
 * 音声を再生
 *
 * @param audioUrl - 音声URL
 * @param options - 再生オプション
 */
export function playAudio(
  audioUrl: string,
  options: { volume?: number; onEnd?: () => void } = {}
): HTMLAudioElement {
  const audio = new Audio(audioUrl);
  audio.volume = options.volume ?? 1.0;

  if (options.onEnd) {
    audio.addEventListener("ended", options.onEnd);
  }

  audio.play().catch((error) => {
    console.error("[TTS] Playback failed:", error);
  });

  return audio;
}

/**
 * テキストを音声に変換して即座に再生
 *
 * @param text - 変換するテキスト
 * @param options - TTSとプレイバックオプション
 */
export async function speakText(
  text: string,
  options: TTSOptions & { volume?: number; onEnd?: () => void } = {}
): Promise<HTMLAudioElement> {
  const { volume, onEnd, ...ttsOptions } = options;
  const result = await synthesizeSpeech(text, ttsOptions);
  return playAudio(result.audioUrl, { volume, onEnd });
}

/**
 * 音声URLを解放
 *
 * @param audioUrl - 解放するURL
 */
export function revokeAudioUrl(audioUrl: string): void {
  URL.revokeObjectURL(audioUrl);
}

/**
 * キャラクター別の音声設定を取得
 */
export function getCharacterVoice(
  characterId: string,
  gender: "male" | "female"
): TTSOptions {
  // キャラクターごとに異なる声質を設定
  const maleVoices = [
    "ja-JP-Neural2-C",
    "ja-JP-Neural2-D",
  ];
  const femaleVoices = [
    "ja-JP-Neural2-B",
    "ja-JP-Wavenet-A",
  ];

  const voices = gender === "male" ? maleVoices : femaleVoices;
  const voiceIndex = characterId.charCodeAt(characterId.length - 1) % voices.length;

  return {
    languageCode: "ja-JP",
    voiceName: voices[voiceIndex],
    speakingRate: 0.9 + Math.random() * 0.2, // 0.9 - 1.1
    pitch: gender === "male" ? -2 + Math.random() * 2 : Math.random() * 2,
  };
}
