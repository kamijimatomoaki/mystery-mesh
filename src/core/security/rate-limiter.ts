/**
 * Rate Limiter
 * API呼び出し回数制限によるDoS対策
 */

import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("RateLimiter");

/**
 * レート制限の設定
 */
export interface RateLimitConfig {
  windowMs: number; // 時間窓（ミリ秒）
  maxRequests: number; // 時間窓内の最大リクエスト数
  message?: string; // 制限時のメッセージ
  skipSuccessfulRequests?: boolean; // 成功したリクエストをカウントから除外
  skipFailedRequests?: boolean; // 失敗したリクエストをカウントから除外
}

/**
 * リクエストカウンター
 */
interface RequestCounter {
  count: number;
  resetAt: number; // リセット時刻（Unix timestamp）
}

/**
 * Rate Limiter（メモリ内実装）
 * 本番環境ではRedisを使用することを推奨
 */
export class RateLimiter {
  private counters: Map<string, RequestCounter> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;

    // 定期的に期限切れのカウンターをクリーンアップ（5分ごと）
    setInterval(() => {
      this.cleanupExpiredCounters();
    }, 5 * 60 * 1000);
  }

  /**
   * リクエストをチェック
   * @returns true: 許可, false: 拒否
   */
  public async checkLimit(key: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }> {
    const now = Date.now();
    const counter = this.counters.get(key);

    // カウンターが存在しないか、リセット時刻を過ぎている場合
    if (!counter || now >= counter.resetAt) {
      const newCounter: RequestCounter = {
        count: 1,
        resetAt: now + this.config.windowMs,
      };
      this.counters.set(key, newCounter);

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetAt: newCounter.resetAt,
      };
    }

    // 制限を超えている場合
    if (counter.count >= this.config.maxRequests) {
      logger.warn("Rate limit exceeded", {
        key,
        count: counter.count,
        maxRequests: this.config.maxRequests,
        resetAt: new Date(counter.resetAt).toISOString(),
      });

      return {
        allowed: false,
        remaining: 0,
        resetAt: counter.resetAt,
      };
    }

    // カウンターを増やす
    counter.count++;
    this.counters.set(key, counter);

    return {
      allowed: true,
      remaining: this.config.maxRequests - counter.count,
      resetAt: counter.resetAt,
    };
  }

  /**
   * カウンターをリセット
   */
  public resetKey(key: string): void {
    this.counters.delete(key);
    logger.info("Rate limit counter reset", { key });
  }

  /**
   * 期限切れのカウンターをクリーンアップ
   */
  private cleanupExpiredCounters(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, counter] of this.counters.entries()) {
      if (now >= counter.resetAt) {
        this.counters.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug("Cleaned up expired counters", { cleanedCount });
    }
  }

  /**
   * 統計情報を取得
   */
  public getStats(): {
    totalKeys: number;
    activeKeys: number;
  } {
    const now = Date.now();
    let activeKeys = 0;

    for (const counter of this.counters.values()) {
      if (now < counter.resetAt) {
        activeKeys++;
      }
    }

    return {
      totalKeys: this.counters.size,
      activeKeys,
    };
  }
}

/**
 * 定義済みのレート制限設定
 */
export const RATE_LIMIT_PRESETS = {
  // 厳しい制限（認証API、センシティブな操作）
  strict: {
    windowMs: 15 * 60 * 1000, // 15分
    maxRequests: 5,
    message: "Too many requests. Please try again later.",
  },

  // 標準制限（一般的なAPI）
  standard: {
    windowMs: 15 * 60 * 1000, // 15分
    maxRequests: 100,
    message: "Rate limit exceeded. Please slow down.",
  },

  // 緩やかな制限（読み取り専用API）
  loose: {
    windowMs: 15 * 60 * 1000, // 15分
    maxRequests: 500,
    message: "Rate limit exceeded.",
  },

  // AI API用（Vertex AI呼び出し）
  aiApi: {
    windowMs: 60 * 1000, // 1分
    maxRequests: 10,
    message: "AI API rate limit exceeded. Please wait before retrying.",
  },

  // シナリオ生成（重い処理）
  scenarioGeneration: {
    windowMs: 60 * 60 * 1000, // 1時間
    maxRequests: 3,
    message: "Scenario generation limit reached. Please wait before creating more scenarios.",
  },

  // ゲーム作成（spamming防止）
  gameCreation: {
    windowMs: 10 * 60 * 1000, // 10分
    maxRequests: 10,
    message: "Too many game creation requests. Please wait before creating more games.",
  },

  // ゲーム参加（spamming防止）
  gameJoin: {
    windowMs: 5 * 60 * 1000, // 5分
    maxRequests: 20,
    message: "Too many join requests. Please slow down.",
  },

  // エージェント行動（頻繁に呼ばれるが制限必要）
  agentAction: {
    windowMs: 60 * 1000, // 1分
    maxRequests: 30,
    message: "Agent action rate limit exceeded. Please wait.",
  },

  // エンディング生成（重い処理）
  endingGeneration: {
    windowMs: 30 * 60 * 1000, // 30分
    maxRequests: 5,
    message: "Ending generation limit reached. Please wait before generating more endings.",
  },
} as const;

/**
 * グローバルRate Limiterインスタンス
 */
const rateLimiters = {
  strict: new RateLimiter(RATE_LIMIT_PRESETS.strict),
  standard: new RateLimiter(RATE_LIMIT_PRESETS.standard),
  loose: new RateLimiter(RATE_LIMIT_PRESETS.loose),
  aiApi: new RateLimiter(RATE_LIMIT_PRESETS.aiApi),
  scenarioGeneration: new RateLimiter(RATE_LIMIT_PRESETS.scenarioGeneration),
  gameCreation: new RateLimiter(RATE_LIMIT_PRESETS.gameCreation),
  gameJoin: new RateLimiter(RATE_LIMIT_PRESETS.gameJoin),
  agentAction: new RateLimiter(RATE_LIMIT_PRESETS.agentAction),
  endingGeneration: new RateLimiter(RATE_LIMIT_PRESETS.endingGeneration),
};

/**
 * Rate Limiterを取得
 */
export function getRateLimiter(
  preset: keyof typeof RATE_LIMIT_PRESETS
): RateLimiter {
  return rateLimiters[preset];
}

/**
 * Exponential Backoff計算
 * @param attempt - 試行回数（0始まり）
 * @param baseDelay - 基本遅延時間（ミリ秒）
 * @param maxDelay - 最大遅延時間（ミリ秒）
 * @returns 待機時間（ミリ秒）
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 32000
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

  // ジッター追加（±25%）
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);

  return Math.floor(delay + jitter);
}

/**
 * Exponential Backoffでリトライ実行
 * @param fn - 実行する非同期関数
 * @param maxAttempts - 最大試行回数
 * @param baseDelay - 基本遅延時間（ミリ秒）
 * @returns 関数の実行結果
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // 最後の試行の場合はエラーを投げる
      if (attempt === maxAttempts - 1) {
        logger.error("Max retry attempts reached", lastError, {
          maxAttempts,
          lastAttempt: attempt + 1,
        });
        throw lastError;
      }

      // バックオフ計算
      const delay = calculateBackoff(attempt, baseDelay);

      logger.warn("Request failed, retrying with backoff", {
        attempt: attempt + 1,
        maxAttempts,
        delayMs: delay,
        error: lastError.message,
      });

      // 待機
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScriptの型チェック用（実際には到達しない）
  throw lastError!;
}

/**
 * IPアドレスからキーを生成
 */
export function getIpKey(ip: string): string {
  return `ip:${ip}`;
}

/**
 * ユーザーIDからキーを生成
 */
export function getUserKey(userId: string): string {
  return `user:${userId}`;
}

/**
 * APIエンドポイントごとのキーを生成
 */
export function getEndpointKey(ip: string, endpoint: string): string {
  return `${ip}:${endpoint}`;
}
