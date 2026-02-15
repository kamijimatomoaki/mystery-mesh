/**
 * Async Utilities
 * 並列処理最適化とAsync操作のヘルパー
 *
 * 設計思想:
 * - Promise.allを使った効率的な並列処理
 * - エラーハンドリング付き並列実行
 * - タイムアウト制御
 * - リトライロジック
 */

import { TimeoutError, toAppError, type AppError } from "./errors";

/**
 * 並列実行の結果
 */
export type ParallelResult<T> = {
  success: T[];
  errors: AppError[];
  allSucceeded: boolean;
};

/**
 * 複数のPromiseを並列実行（全て待機）
 *
 * @param promises - 実行するPromise配列
 * @returns 全ての結果
 *
 * @example
 * const results = await parallelAll([
 *   fetchUser(1),
 *   fetchUser(2),
 *   fetchUser(3),
 * ]);
 */
export async function parallelAll<T>(
  promises: Promise<T>[]
): Promise<T[]> {
  return Promise.all(promises);
}

/**
 * 複数のPromiseを並列実行（一部失敗しても続行）
 *
 * @param promises - 実行するPromise配列
 * @returns 成功した結果とエラーのリスト
 *
 * @example
 * const { success, errors } = await parallelSettled([
 *   fetchUser(1),
 *   fetchUser(2),
 *   fetchUser(3),
 * ]);
 */
export async function parallelSettled<T>(
  promises: Promise<T>[]
): Promise<ParallelResult<T>> {
  const results = await Promise.allSettled(promises);

  const success: T[] = [];
  const errors: AppError[] = [];

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      success.push(result.value);
    } else {
      errors.push(toAppError(result.reason));
    }
  });

  return {
    success,
    errors,
    allSucceeded: errors.length === 0,
  };
}

/**
 * 複数のPromiseを並列実行（最初の成功を返す）
 *
 * @param promises - 実行するPromise配列
 * @returns 最初に成功した結果
 *
 * @example
 * const result = await parallelRace([
 *   fetchFromCache(),
 *   fetchFromDB(),
 *   fetchFromAPI(),
 * ]);
 */
export async function parallelRace<T>(
  promises: Promise<T>[]
): Promise<T> {
  return Promise.race(promises);
}

/**
 * 複数の関数を並列実行（遅延評価）
 *
 * @param fns - 実行する関数配列
 * @returns 全ての結果
 *
 * @example
 * const results = await parallelMap(
 *   [1, 2, 3],
 *   async (id) => fetchUser(id)
 * );
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  return Promise.all(items.map((item, index) => fn(item, index)));
}

/**
 * チャンク単位で並列実行（同時実行数制限）
 *
 * @param items - 処理するアイテム配列
 * @param fn - 各アイテムに対する処理
 * @param chunkSize - 同時実行数
 * @returns 全ての結果
 *
 * @example
 * // 一度に3つずつ処理
 * const results = await parallelChunk(
 *   [1, 2, 3, 4, 5, 6, 7, 8, 9],
 *   async (id) => fetchUser(id),
 *   3
 * );
 */
export async function parallelChunk<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  chunkSize: number = 5
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map((item, index) => fn(item, i + index))
    );
    results.push(...chunkResults);
  }

  return results;
}

/**
 * タイムアウト付きPromise実行
 *
 * @param promise - 実行するPromise
 * @param timeout - タイムアウト時間（ミリ秒）
 * @param operation - 操作名（エラーメッセージ用）
 * @returns 結果
 *
 * @example
 * const result = await withTimeout(
 *   fetchData(),
 *   5000,
 *   "データ取得"
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  operation: string = "Operation"
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TimeoutError(operation, timeout));
    }, timeout);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * リトライ付きPromise実行
 *
 * @param fn - 実行する関数
 * @param maxRetries - 最大リトライ回数
 * @param delayMs - リトライ間隔（ミリ秒）
 * @param backoff - バックオフ係数（指数的増加）
 * @returns 結果
 *
 * @example
 * const result = await withRetry(
 *   () => fetchData(),
 *   3,
 *   1000,
 *   2
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  backoff: number = 2
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoff, attempt);
        console.warn(
          `[Retry] Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`
        );
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

/**
 * 遅延実行
 *
 * @param ms - 遅延時間（ミリ秒）
 * @returns Promise
 *
 * @example
 * await sleep(1000); // 1秒待機
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * デバウンス（一定時間内の連続呼び出しを防ぐ）
 *
 * @param fn - 実行する関数
 * @param delayMs - デバウンス時間（ミリ秒）
 * @returns デバウンスされた関数
 *
 * @example
 * const debouncedSearch = debounce(
 *   (query: string) => search(query),
 *   300
 * );
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
}

/**
 * スロットル（一定時間内に1回のみ実行）
 *
 * @param fn - 実行する関数
 * @param intervalMs - スロットル間隔（ミリ秒）
 * @returns スロットルされた関数
 *
 * @example
 * const throttledScroll = throttle(
 *   () => handleScroll(),
 *   100
 * );
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  intervalMs: number
): (...args: Parameters<T>) => void {
  let lastExecution = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastExecution >= intervalMs) {
      fn(...args);
      lastExecution = now;
    }
  };
}

/**
 * Firestoreバッチ操作のヘルパー
 *
 * @param items - 処理するアイテム配列
 * @param fn - 各アイテムに対する処理
 * @param batchSize - バッチサイズ（Firestoreは500が上限）
 * @returns 全ての結果
 *
 * @example
 * await batchProcess(
 *   users,
 *   async (user) => updateUser(user),
 *   500
 * );
 */
export async function batchProcess<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize: number = 500
): Promise<R[]> {
  return parallelChunk(items, fn, batchSize);
}
