/**
 * Speech-to-Text Service
 * 音声からテキストを生成するサービス（Web Speech API）
 */

export interface STTOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

type STTCallback = (result: STTResult) => void;
type STTErrorCallback = (error: Error) => void;

const DEFAULT_OPTIONS: STTOptions = {
  language: "ja-JP",
  continuous: false,
  interimResults: true,
  maxAlternatives: 1,
};

/**
 * Web Speech APIがサポートされているかチェック
 */
export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

// Web Speech API型定義（ブラウザ依存）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionInstance = any;

/**
 * 音声認識インスタンスを作成
 */
function createSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === "undefined") return null;

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognitionClass) return null;

  return new SpeechRecognitionClass();
}

/**
 * 音声入力マネージャークラス
 */
export class SpeechInputManager {
  private recognition: SpeechRecognitionInstance | null = null;
  private options: STTOptions;
  private isListening = false;
  private onResultCallback: STTCallback | null = null;
  private onErrorCallback: STTErrorCallback | null = null;
  private onEndCallback: (() => void) | null = null;

  constructor(options: STTOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.initRecognition();
  }

  private initRecognition(): void {
    this.recognition = createSpeechRecognition();

    if (!this.recognition) {
      console.warn("[STT] Speech recognition not supported");
      return;
    }

    this.recognition.lang = this.options.language || "ja-JP";
    this.recognition.continuous = this.options.continuous || false;
    this.recognition.interimResults = this.options.interimResults || true;
    this.recognition.maxAlternatives = this.options.maxAlternatives || 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onresult = (event: any) => {
      const results = event.results;
      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence;
        const isFinal = result.isFinal;

        if (this.onResultCallback) {
          this.onResultCallback({
            transcript,
            confidence,
            isFinal,
          });
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.recognition.onerror = (event: any) => {
      console.error("[STT] Error:", event.error);
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error(event.error));
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.onEndCallback) {
        this.onEndCallback();
      }
    };
  }

  /**
   * 音声入力を開始
   */
  start(): boolean {
    if (!this.recognition) {
      console.error("[STT] Speech recognition not initialized");
      return false;
    }

    if (this.isListening) {
      console.warn("[STT] Already listening");
      return false;
    }

    try {
      this.recognition.start();
      this.isListening = true;
      console.log("[STT] Started listening");
      return true;
    } catch (error) {
      console.error("[STT] Failed to start:", error);
      return false;
    }
  }

  /**
   * 音声入力を停止
   */
  stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      console.log("[STT] Stopped listening");
    }
  }

  /**
   * 音声入力を中断
   */
  abort(): void {
    if (this.recognition && this.isListening) {
      this.recognition.abort();
      this.isListening = false;
      console.log("[STT] Aborted listening");
    }
  }

  /**
   * リスニング状態を取得
   */
  getIsListening(): boolean {
    return this.isListening;
  }

  /**
   * 結果コールバックを設定
   */
  onResult(callback: STTCallback): void {
    this.onResultCallback = callback;
  }

  /**
   * エラーコールバックを設定
   */
  onError(callback: STTErrorCallback): void {
    this.onErrorCallback = callback;
  }

  /**
   * 終了コールバックを設定
   */
  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.stop();
    this.recognition = null;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onEndCallback = null;
  }
}

/**
 * 1回だけ音声入力を受け付けて結果を返す
 */
export function listenOnce(options: STTOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const manager = new SpeechInputManager({
      ...options,
      continuous: false,
    });

    manager.onResult((result) => {
      if (result.isFinal) {
        manager.dispose();
        resolve(result.transcript);
      }
    });

    manager.onError((error) => {
      manager.dispose();
      reject(error);
    });

    manager.onEnd(() => {
      manager.dispose();
    });

    if (!manager.start()) {
      reject(new Error("Failed to start speech recognition"));
    }
  });
}
