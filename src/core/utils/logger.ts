/**
 * Structured Logger
 * 構造化ログシステム
 *
 * 設計思想:
 * - Dark Academiaテーマのログ表示
 * - 構造化ログ（JSON）
 * - ログレベル管理
 * - パフォーマンス計測
 * - Cloud Logging連携準備
 */

import { isDevelopment, isProduction } from "../config/env";

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/**
 * ログコンテキスト
 */
export interface LogContext {
  userId?: string;
  gameId?: string;
  scenarioId?: string;
  agentId?: string;
  requestId?: string;
  [key: string]: any;
}

/**
 * ログエントリ
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    operation: string;
  };
}

/**
 * ログフォーマッター
 */
class Logger {
  private minLevel: LogLevel;
  private context: LogContext = {};

  constructor() {
    // 本番環境では INFO 以上のみ
    this.minLevel = isProduction() ? LogLevel.INFO : LogLevel.DEBUG;
  }

  /**
   * グローバルコンテキストを設定
   */
  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  /**
   * グローバルコンテキストをクリア
   */
  clearContext() {
    this.context = {};
  }

  /**
   * DEBUGログ
   */
  debug(message: string, context?: LogContext) {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * INFOログ
   */
  info(message: string, context?: LogContext) {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * WARNログ
   */
  warn(message: string, context?: LogContext) {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * ERRORログ
   */
  error(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * FATALログ
   */
  fatal(message: string, error?: Error, context?: LogContext) {
    this.log(LogLevel.FATAL, message, context, error);
  }

  /**
   * パフォーマンス計測開始
   */
  startTimer(operation: string): () => void {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      this.info(`⏱️ ${operation}`, {
        performance: { duration: Math.round(duration), operation },
      });
    };
  }

  /**
   * ログ出力
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ) {
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      context: { ...this.context, ...context },
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
      };
    }

    // 開発環境: カラフルなコンソール出力
    if (isDevelopment()) {
      this.consoleLog(level, entry);
    } else {
      // 本番環境: JSON出力（Cloud Logging用）
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * コンソールログ（開発環境用）
   */
  private consoleLog(level: LogLevel, entry: LogEntry) {
    const emoji = this.getEmoji(level);
    const color = this.getColor(level);
    const thematicPrefix = this.getThematicPrefix(level);

    const prefix = `${emoji} ${thematicPrefix}`;
    const timestamp = new Date(entry.timestamp).toLocaleTimeString("ja-JP");

    // カラー出力
    console.log(
      `%c${prefix} [${timestamp}] ${entry.message}`,
      `color: ${color}; font-weight: bold;`
    );

    // コンテキスト
    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log("  📎 Context:", entry.context);
    }

    // エラー
    if (entry.error) {
      console.error("  ❌ Error:", entry.error.message);
      if (entry.error.stack) {
        console.error(entry.error.stack);
      }
    }

    // パフォーマンス
    if (entry.context?.performance) {
      const { duration, operation } = entry.context.performance;
      console.log(`  ⏱️ ${operation}: ${duration}ms`);
    }
  }

  /**
   * ログレベルに応じた絵文字
   */
  private getEmoji(level: LogLevel): string {
    const emojis = {
      [LogLevel.DEBUG]: "🔍",
      [LogLevel.INFO]: "📘",
      [LogLevel.WARN]: "⚠️",
      [LogLevel.ERROR]: "🔥",
      [LogLevel.FATAL]: "💀",
    };

    return emojis[level] || "📝";
  }

  /**
   * ログレベルに応じた色
   */
  private getColor(level: LogLevel): string {
    const colors = {
      [LogLevel.DEBUG]: "#6c757d",
      [LogLevel.INFO]: "#0d6efd",
      [LogLevel.WARN]: "#ffc107",
      [LogLevel.ERROR]: "#dc3545",
      [LogLevel.FATAL]: "#000000",
    };

    return colors[level] || "#000000";
  }

  /**
   * Dark Academiaテーマのプレフィックス
   */
  private getThematicPrefix(level: LogLevel): string {
    const prefixes = {
      [LogLevel.DEBUG]: "[Ink Sketch]",
      [LogLevel.INFO]: "[Chronicle]",
      [LogLevel.WARN]: "[Caution]",
      [LogLevel.ERROR]: "[Forbidden]",
      [LogLevel.FATAL]: "[Dark Tome]",
    };

    return prefixes[level] || "[Log]";
  }
}

/**
 * グローバルロガーインスタンス
 */
export const logger = new Logger();

/**
 * モジュール別ロガーを作成
 */
export function createModuleLogger(module: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      logger.debug(`[${module}] ${message}`, context),

    info: (message: string, context?: LogContext) =>
      logger.info(`[${module}] ${message}`, context),

    warn: (message: string, context?: LogContext) =>
      logger.warn(`[${module}] ${message}`, context),

    error: (message: string, error?: Error, context?: LogContext) =>
      logger.error(`[${module}] ${message}`, error, context),

    fatal: (message: string, error?: Error, context?: LogContext) =>
      logger.fatal(`[${module}] ${message}`, error, context),

    startTimer: (operation: string) =>
      logger.startTimer(`[${module}] ${operation}`),
  };
}

/**
 * デコレーター: 関数のパフォーマンスを計測
 */
export function logPerformance(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const endTimer = logger.startTimer(`${target.constructor.name}.${propertyKey}`);

    try {
      const result = await originalMethod.apply(this, args);
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      throw error;
    }
  };

  return descriptor;
}

/**
 * API Request Logger Middleware
 */
export function logApiRequest(request: Request) {
  const { method, url } = request;
  const timestamp = new Date().toISOString();

  logger.info(`📨 API Request: ${method} ${url}`, {
    method,
    url,
    timestamp,
    userAgent: request.headers.get("user-agent") || "unknown",
  });
}

/**
 * API Response Logger Middleware
 */
export function logApiResponse(
  request: Request,
  response: Response,
  duration: number
) {
  const { method, url } = request;
  const { status } = response;

  const level = status >= 500 ? LogLevel.ERROR : status >= 400 ? LogLevel.WARN : LogLevel.INFO;

  const emoji = status >= 500 ? "🔥" : status >= 400 ? "⚠️" : "✅";

  logger.info(`${emoji} API Response: ${method} ${url} - ${status}`, {
    method,
    url,
    status,
    duration: Math.round(duration),
  });
}
