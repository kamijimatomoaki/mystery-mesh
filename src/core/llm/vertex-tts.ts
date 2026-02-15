/**
 * Google Cloud Text-to-Speech API
 * テキストを音声に変換
 */
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { Storage } from "@google-cloud/storage";
import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("VertexTTS");

// TTS Client初期化
let ttsClient: TextToSpeechClient | null = null;
let storageClient: Storage | null = null;

function getTTSClient(): TextToSpeechClient {
  if (!ttsClient) {
    ttsClient = new TextToSpeechClient({
      // ADC (Application Default Credentials)を使用
    });
    logger.info("Text-to-Speech client initialized");
  }
  return ttsClient;
}

function getStorageClient(): Storage {
  if (!storageClient) {
    storageClient = new Storage({
      // ADC (Application Default Credentials)を使用
    });
    logger.info("Cloud Storage client initialized");
  }
  return storageClient;
}

/**
 * 音声設定型
 */
export interface VoiceConfig {
  languageCode: string; // "ja-JP", "en-US"など
  name: string; // "ja-JP-Wavenet-A", "en-US-Neural2-A"など
  ssmlGender: "MALE" | "FEMALE" | "NEUTRAL";
  pitch?: number; // -20.0 ~ 20.0（デフォルト: 0.0）
  speakingRate?: number; // 0.25 ~ 4.0（デフォルト: 1.0）
}

/**
 * キャラクター音声マッピング
 * 各キャラクターに異なる声を割り当て
 */
export const CHARACTER_VOICES: Record<string, VoiceConfig> = {
  // デフォルト（システムメッセージなど）
  // NEUTRALは日本語Neural2音声と組み合わせると失敗する可能性があるため、FEMALEを使用
  default: {
    languageCode: "ja-JP",
    name: "ja-JP-Neural2-B",
    ssmlGender: "FEMALE",
  },

  // 探偵キャラクター（男性、低め）
  detective: {
    languageCode: "ja-JP",
    name: "ja-JP-Neural2-C",
    ssmlGender: "MALE",
    pitch: -2.0,
    speakingRate: 0.9,
  },

  // 若い女性キャラクター（女性、高め）
  young_female: {
    languageCode: "ja-JP",
    name: "ja-JP-Neural2-B",
    ssmlGender: "FEMALE",
    pitch: 2.0,
    speakingRate: 1.1,
  },

  // 老人キャラクター（男性、低め、ゆっくり）
  elderly_male: {
    languageCode: "ja-JP",
    name: "ja-JP-Neural2-D",
    ssmlGender: "MALE",
    pitch: -4.0,
    speakingRate: 0.8,
  },

  // 子供キャラクター（女性、高め、速め）
  child: {
    languageCode: "ja-JP",
    name: "ja-JP-Neural2-B",
    ssmlGender: "FEMALE",
    pitch: 6.0,
    speakingRate: 1.2,
  },

  // ミステリアスなナレーター（女性、低め、やや速め）
  // 落ち着いた雰囲気のミステリー向けナレーション
  // Neural2-B: 女性, Neural2-C: 男性, Neural2-D: 男性
  mysterious: {
    languageCode: "ja-JP",
    name: "ja-JP-Neural2-B", // 女性の声
    ssmlGender: "FEMALE",
    pitch: -2.0, // 低めのトーン（ミステリー感）
    speakingRate: 1.1, // やや速め
  },
};

/**
 * TTS合成オプション
 */
export interface SynthesizeSpeechOptions {
  text?: string; // 合成するテキスト（textまたはssmlのいずれかが必須）
  ssml?: string; // SSMLフォーマットのテキスト（textより優先）
  voiceConfig?: VoiceConfig; // 音声設定（省略時はdefault）
  characterId?: string; // キャラクターID（CHARACTER_VOICESから自動選択）
  outputFormat?: "MP3" | "OGG_OPUS" | "LINEAR16"; // 出力形式（デフォルト: MP3）
  saveToBucket?: boolean; // Cloud Storageに保存するか（デフォルト: true）
}

/**
 * TTS合成結果
 */
export interface SynthesizeSpeechResult {
  audioContent: Buffer; // 音声データ（Buffer）
  audioUrl?: string; // Cloud StorageのURL（saveToBucket=trueの場合）
  duration?: number; // 音声の長さ（秒）
}

/**
 * テキストを音声に変換
 * @param options - TTS合成オプション
 * @returns 音声データとURL
 */
export async function synthesizeSpeech(
  options: SynthesizeSpeechOptions
): Promise<SynthesizeSpeechResult> {
  const {
    text,
    ssml,
    voiceConfig,
    characterId,
    outputFormat = "MP3",
    saveToBucket = true,
  } = options;

  // textまたはssmlのいずれかが必須
  if (!text && !ssml) {
    throw new Error("Either text or ssml must be provided");
  }

  const inputPreview = ssml ? ssml.slice(0, 50) : text?.slice(0, 50);
  const inputType = ssml ? "ssml" : "text";
  logger.info("Synthesizing speech", { inputType, inputPreview, characterId, outputFormat });

  // 音声設定を決定
  let voice: VoiceConfig;
  if (voiceConfig) {
    voice = voiceConfig;
  } else if (characterId && CHARACTER_VOICES[characterId]) {
    voice = CHARACTER_VOICES[characterId];
  } else {
    voice = CHARACTER_VOICES.default;
  }

  const client = getTTSClient();

  try {
    // TTS API呼び出し（SSMLまたはテキスト）
    const input = ssml ? { ssml } : { text: text! };

    const [response] = await client.synthesizeSpeech({
      input,
      voice: {
        languageCode: voice.languageCode,
        name: voice.name,
        ssmlGender: voice.ssmlGender,
      },
      audioConfig: {
        audioEncoding: outputFormat === "MP3" ? "MP3" : outputFormat === "OGG_OPUS" ? "OGG_OPUS" : "LINEAR16",
        pitch: voice.pitch || 0.0,
        speakingRate: voice.speakingRate || 1.0,
      },
    });

    if (!response.audioContent) {
      throw new Error("No audio content returned from TTS API");
    }

    const audioBuffer = Buffer.from(response.audioContent as Uint8Array);

    logger.info("Speech synthesis completed", {
      audioSizeBytes: audioBuffer.length,
      characterId,
    });

    // Cloud Storageに保存
    let audioUrl: string | undefined;
    if (saveToBucket) {
      audioUrl = await saveToCloudStorage(audioBuffer, outputFormat.toLowerCase());
      logger.info("Audio saved to Cloud Storage", { audioUrl });
    }

    // 音声の長さを推定（1秒あたり約16KBと仮定 - MP3の場合）
    const estimatedDuration = outputFormat === "MP3" ? audioBuffer.length / 16000 : undefined;

    return {
      audioContent: audioBuffer,
      audioUrl,
      duration: estimatedDuration,
    };
  } catch (error) {
    logger.error("Speech synthesis failed", error as Error, { inputPreview });
    throw error;
  }
}

/**
 * 音声データをCloud Storageに保存
 * @param audioBuffer - 音声データ
 * @param format - ファイル形式
 * @returns 公開URL
 */
async function saveToCloudStorage(audioBuffer: Buffer, format: string): Promise<string> {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID + "-tts";
  const fileName = `audio_${Date.now()}_${Math.random().toString(36).slice(2)}.${format}`;

  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(fileName);

  try {
    await file.save(audioBuffer, {
      metadata: {
        contentType: `audio/${format}`,
      },
      public: true, // 公開設定
    });

    // 公開URLを生成
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;

    logger.info("Audio file saved to Cloud Storage", { fileName, publicUrl });

    return publicUrl;
  } catch (error) {
    logger.error("Failed to save audio to Cloud Storage", error as Error, { fileName });
    throw error;
  }
}

/**
 * キャラクターIDから音声設定を取得
 * @param characterId - キャラクターID
 * @returns 音声設定
 */
export function getVoiceForCharacter(characterId: string): VoiceConfig {
  return CHARACTER_VOICES[characterId] || CHARACTER_VOICES.default;
}

/**
 * 複数のテキストをバッチで音声合成
 * @param texts - テキスト配列
 * @param characterId - キャラクターID
 * @returns 音声データの配列
 */
export async function synthesizeBatch(
  texts: string[],
  characterId?: string
): Promise<SynthesizeSpeechResult[]> {
  logger.info("Batch speech synthesis started", { count: texts.length, characterId });

  const results = await Promise.all(
    texts.map((text) =>
      synthesizeSpeech({
        text,
        characterId,
        saveToBucket: true,
      })
    )
  );

  logger.info("Batch speech synthesis completed", { count: results.length });

  return results;
}
