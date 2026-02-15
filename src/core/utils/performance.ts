/**
 * Performance Monitoring Utilities
 * パフォーマンス計測ユーティリティ
 *
 * 設計思想:
 * - 詳細なパフォーマンス計測
 * - メモリ使用量監視
 * - ボトルネック検出
 * - メトリクス集計
 */

import { logger } from "./logger";

/**
 * パフォーマンスメトリクス
 */
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  memory?: {
    used: number;
    total: number;
  };
  metadata?: Record<string, any>;
}

/**
 * メトリクスコレクター
 */
class MetricsCollector {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000;

  /**
   * メトリクスを記録
   */
  record(metrics: PerformanceMetrics) {
    this.metrics.push(metrics);

    // 最大数を超えたら古いものを削除
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * 操作別の統計を取得
   */
  getStats(operation: string) {
    const filtered = this.metrics.filter((m) => m.operation === operation);

    if (filtered.length === 0) {
      return null;
    }

    const durations = filtered.map((m) => m.duration);

    return {
      count: filtered.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      avg: durations.reduce((a, b) => a + b, 0) / durations.length,
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
    };
  }

  /**
   * 全メトリクスを取得
   */
  getAll(): PerformanceMetrics[] {
    return [...this.metrics];
  }

  /**
   * メトリクスをクリア
   */
  clear() {
    this.metrics = [];
  }

  /**
   * パーセンタイル計算
   */
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
}

/**
 * グローバルメトリクスコレクター
 */
export const metricsCollector = new MetricsCollector();

/**
 * パフォーマンス計測器
 */
export class PerformanceTimer {
  private start: number;
  private marks: Map<string, number> = new Map();

  constructor(private operation: string) {
    this.start = performance.now();
  }

  /**
   * マーカーを追加
   */
  mark(name: string) {
    this.marks.set(name, performance.now() - this.start);
  }

  /**
   * 計測を終了
   */
  end(metadata?: Record<string, any>): number {
    const duration = performance.now() - this.start;

    const metrics: PerformanceMetrics = {
      operation: this.operation,
      duration: Math.round(duration),
      timestamp: Date.now(),
      metadata,
    };

    // メモリ使用量を取得（Node.jsのみ）
    if (typeof process !== "undefined" && process.memoryUsage) {
      const mem = process.memoryUsage();
      metrics.memory = {
        used: Math.round(mem.heapUsed / 1024 / 1024), // MB
        total: Math.round(mem.heapTotal / 1024 / 1024), // MB
      };
    }

    // メトリクスを記録
    metricsCollector.record(metrics);

    // ログ出力
    logger.info(`⏱️ ${this.operation}`, {
      performance: { duration: Math.round(duration), operation: this.operation },
      marks: Object.fromEntries(this.marks),
      ...metadata,
    });

    return duration;
  }

  /**
   * マーカー間の時間を取得
   */
  getDuration(fromMark?: string, toMark?: string): number {
    const from = fromMark ? this.marks.get(fromMark) || 0 : 0;
    const to = toMark ? this.marks.get(toMark) || performance.now() - this.start : performance.now() - this.start;

    return to - from;
  }
}

/**
 * 関数のパフォーマンスを計測
 */
export async function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const timer = new PerformanceTimer(operation);

  try {
    const result = await fn();
    timer.end();
    return result;
  } catch (error) {
    timer.end({ error: true });
    throw error;
  }
}

/**
 * 複数の操作を並列実行して計測
 */
export async function measureParallel<T>(
  operations: Array<{ name: string; fn: () => Promise<T> }>
): Promise<T[]> {
  const timer = new PerformanceTimer("Parallel Operations");

  const results = await Promise.all(
    operations.map(async ({ name, fn }) => {
      const opTimer = new PerformanceTimer(name);
      try {
        const result = await fn();
        opTimer.end();
        return result;
      } catch (error) {
        opTimer.end({ error: true });
        throw error;
      }
    })
  );

  timer.end({ operationCount: operations.length });

  return results;
}

/**
 * メモリ使用量を取得
 */
export function getMemoryUsage(): {
  used: number;
  total: number;
  percentage: number;
} | null {
  if (typeof process === "undefined" || !process.memoryUsage) {
    return null;
  }

  const mem = process.memoryUsage();
  const used = Math.round(mem.heapUsed / 1024 / 1024); // MB
  const total = Math.round(mem.heapTotal / 1024 / 1024); // MB

  return {
    used,
    total,
    percentage: Math.round((used / total) * 100),
  };
}

/**
 * メモリリークを検出
 */
export function detectMemoryLeak(threshold: number = 80): boolean {
  const usage = getMemoryUsage();

  if (!usage) {
    return false;
  }

  if (usage.percentage >= threshold) {
    logger.warn(`⚠️ High memory usage detected: ${usage.percentage}%`, {
      memory: usage,
    });
    return true;
  }

  return false;
}

/**
 * パフォーマンスレポートを生成
 */
export function generatePerformanceReport(): string {
  const allMetrics = metricsCollector.getAll();

  if (allMetrics.length === 0) {
    return "No performance metrics available";
  }

  const operations = new Set(allMetrics.map((m) => m.operation));
  const report: string[] = [];

  report.push("📊 Performance Report");
  report.push("=".repeat(60));
  report.push("");

  operations.forEach((operation) => {
    const stats = metricsCollector.getStats(operation);

    if (stats) {
      report.push(`🔍 ${operation}`);
      report.push(`   Count: ${stats.count}`);
      report.push(`   Min: ${stats.min.toFixed(2)}ms`);
      report.push(`   Max: ${stats.max.toFixed(2)}ms`);
      report.push(`   Avg: ${stats.avg.toFixed(2)}ms`);
      report.push(`   P50: ${stats.p50.toFixed(2)}ms`);
      report.push(`   P95: ${stats.p95.toFixed(2)}ms`);
      report.push(`   P99: ${stats.p99.toFixed(2)}ms`);
      report.push("");
    }
  });

  // メモリ使用量
  const memory = getMemoryUsage();
  if (memory) {
    report.push("💾 Memory Usage");
    report.push(`   Used: ${memory.used}MB`);
    report.push(`   Total: ${memory.total}MB`);
    report.push(`   Percentage: ${memory.percentage}%`);
  }

  return report.join("\n");
}

/**
 * パフォーマンスレポートをログ出力
 */
export function logPerformanceReport() {
  const report = generatePerformanceReport();
  console.log(report);
}
