/**
 * Google Cloud Speech-to-Text API
 * 音声をテキストに変換
 */
import { SpeechClient } from "@google-cloud/speech";
import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("VertexSTT");

// STT Client初期化
let sttClient: SpeechClient | null = null;

function getSTTClient(): SpeechClient {
  if (!sttClient) {
    sttClient = new SpeechClient({
      // ADC (Application Default Credentials)を使用
    });
    logger.info("Speech-to-Text client initialized");
  }
  return sttClient;
}

/**
 * STT認識設定
 */
export interface RecognitionConfig {
  languageCode?: string; // "ja-JP", "en-US"など（デフォルト: ja-JP）
  encoding?: "LINEAR16" | "FLAC" | "MULAW" | "AMR" | "AMR_WB" | "OGG_OPUS" | "SPEEX_WITH_HEADER_BYTE" | "WEBM_OPUS"; // 音声エンコーディング
  sampleRateHertz?: number; // サンプルレート（Hz）
  enableAutomaticPunctuation?: boolean; // 自動句読点（デフォルト: true）
  enableWordTimeOffsets?: boolean; // 単語ごとのタイムスタンプ（デフォルト: false）
  maxAlternatives?: number; // 最大認識候補数（デフォルト: 1）
}

/**
 * STT認識オプション
 */
export interface TranscribeAudioOptions {
  audioContent: Buffer; // 音声データ（Buffer）
  config?: RecognitionConfig; // 認識設定
}

/**
 * STT認識結果
 */
export interface TranscribeAudioResult {
  transcript: string; // 認識されたテキスト
  confidence: number; // 信頼度（0.0 ~ 1.0）
  alternatives?: Array<{
    transcript: string;
    confidence: number;
  }>; // 代替候補
  words?: Array<{
    word: string;
    startTime: number;
    endTime: number;
  }>; // 単語ごとのタイムスタンプ
}

/**
 * 音声をテキストに変換（同期認識）
 * @param options - STT認識オプション
 * @returns 認識結果
 */
export async function transcribeAudio(
  options: TranscribeAudioOptions
): Promise<TranscribeAudioResult> {
  const { audioContent, config } = options;

  logger.info("Transcribing audio", {
    audioSizeBytes: audioContent.length,
    languageCode: config?.languageCode || "ja-JP",
  });

  const client = getSTTClient();

  // デフォルト設定
  const recognitionConfig: RecognitionConfig = {
    languageCode: "ja-JP",
    encoding: "LINEAR16",
    sampleRateHertz: 16000,
    enableAutomaticPunctuation: true,
    enableWordTimeOffsets: false,
    maxAlternatives: 1,
    ...config,
  };

  try {
    // STT API呼び出し
    const [response] = await client.recognize({
      audio: { content: audioContent.toString("base64") },
      config: {
        languageCode: recognitionConfig.languageCode,
        encoding: recognitionConfig.encoding,
        sampleRateHertz: recognitionConfig.sampleRateHertz,
        enableAutomaticPunctuation: recognitionConfig.enableAutomaticPunctuation,
        enableWordTimeOffsets: recognitionConfig.enableWordTimeOffsets,
        maxAlternatives: recognitionConfig.maxAlternatives,
      },
    });

    if (!response.results || response.results.length === 0) {
      throw new Error("No transcription results returned from STT API");
    }

    // 最も信頼度の高い結果を取得
    const result = response.results[0];
    const alternative = result.alternatives?.[0];

    if (!alternative || !alternative.transcript) {
      throw new Error("No transcript in recognition result");
    }

    const transcript = alternative.transcript;
    const confidence = alternative.confidence || 0.0;

    logger.info("Audio transcription completed", {
      transcript: transcript.slice(0, 50),
      confidence,
    });

    // 代替候補を取得
    const alternatives = result.alternatives?.slice(1).map((alt) => ({
      transcript: alt.transcript || "",
      confidence: alt.confidence || 0.0,
    }));

    // 単語ごとのタイムスタンプを取得
    const words = recognitionConfig.enableWordTimeOffsets
      ? alternative.words?.map((word) => ({
          word: word.word || "",
          startTime: parseFloat(String(word.startTime?.seconds ?? "0")) + parseFloat(String(word.startTime?.nanos ?? "0")) / 1e9,
          endTime: parseFloat(String(word.endTime?.seconds ?? "0")) + parseFloat(String(word.endTime?.nanos ?? "0")) / 1e9,
        }))
      : undefined;

    return {
      transcript,
      confidence,
      alternatives,
      words,
    };
  } catch (error) {
    logger.error("Audio transcription failed", error as Error);
    throw error;
  }
}

/**
 * 音声URLから音声を取得してテキストに変換
 * @param audioUrl - 音声ファイルのURL（Cloud StorageなどGCSのURL）
 * @param config - 認識設定
 * @returns 認識結果
 */
export async function transcribeAudioFromUrl(
  audioUrl: string,
  config?: RecognitionConfig
): Promise<TranscribeAudioResult> {
  logger.info("Transcribing audio from URL", { audioUrl });

  const client = getSTTClient();

  // デフォルト設定
  const recognitionConfig: RecognitionConfig = {
    languageCode: "ja-JP",
    encoding: "LINEAR16",
    sampleRateHertz: 16000,
    enableAutomaticPunctuation: true,
    enableWordTimeOffsets: false,
    maxAlternatives: 1,
    ...config,
  };

  try {
    // STT API呼び出し（GCS URI）
    const [response] = await client.recognize({
      audio: { uri: audioUrl },
      config: {
        languageCode: recognitionConfig.languageCode,
        encoding: recognitionConfig.encoding,
        sampleRateHertz: recognitionConfig.sampleRateHertz,
        enableAutomaticPunctuation: recognitionConfig.enableAutomaticPunctuation,
        enableWordTimeOffsets: recognitionConfig.enableWordTimeOffsets,
        maxAlternatives: recognitionConfig.maxAlternatives,
      },
    });

    if (!response.results || response.results.length === 0) {
      throw new Error("No transcription results returned from STT API");
    }

    // 最も信頼度の高い結果を取得
    const result = response.results[0];
    const alternative = result.alternatives?.[0];

    if (!alternative || !alternative.transcript) {
      throw new Error("No transcript in recognition result");
    }

    const transcript = alternative.transcript;
    const confidence = alternative.confidence || 0.0;

    logger.info("Audio transcription completed", {
      transcript: transcript.slice(0, 50),
      confidence,
    });

    // 代替候補を取得
    const alternatives = result.alternatives?.slice(1).map((alt) => ({
      transcript: alt.transcript || "",
      confidence: alt.confidence || 0.0,
    }));

    // 単語ごとのタイムスタンプを取得
    const words = recognitionConfig.enableWordTimeOffsets
      ? alternative.words?.map((word) => ({
          word: word.word || "",
          startTime: parseFloat(String(word.startTime?.seconds ?? "0")) + parseFloat(String(word.startTime?.nanos ?? "0")) / 1e9,
          endTime: parseFloat(String(word.endTime?.seconds ?? "0")) + parseFloat(String(word.endTime?.nanos ?? "0")) / 1e9,
        }))
      : undefined;

    return {
      transcript,
      confidence,
      alternatives,
      words,
    };
  } catch (error) {
    logger.error("Audio transcription from URL failed", error as Error, { audioUrl });
    throw error;
  }
}

/**
 * リアルタイムストリーミング認識（将来実装）
 * WebSocketを使用したリアルタイム音声認識
 */
export async function streamingRecognize(audioStream: Buffer[]): Promise<TranscribeAudioResult[]> {
  // TODO: Streaming Recognition実装
  logger.warn("Streaming recognition is not yet implemented");
  throw new Error("Streaming recognition is not yet implemented");
}
