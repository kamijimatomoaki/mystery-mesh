/**
 * Error Handling Utilities
 * 統一的なエラー処理システム
 *
 * 設計思想:
 * - Dark Academiaテーマに沿ったエラーメッセージ
 * - 型安全なエラークラス
 * - ユーザーフレンドリーなメッセージ
 * - 開発者向け詳細ログ
 */

/**
 * アプリケーションエラーの基底クラス
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly userMessage?: string,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * ユーザーに表示するメッセージ（Dark Academiaテーマ）
   */
  getUserMessage(): string {
    return this.userMessage || this.getDarkAcademiaMessage();
  }

  /**
   * Dark Academiaテーマのエラーメッセージ
   */
  private getDarkAcademiaMessage(): string {
    const thematicMessages: Record<number, string> = {
      400: "この書物は読み取れません...",
      401: "この書庫への入室は許可されていません",
      403: "これは禁書です。閲覧できません",
      404: "その書物は図書館に存在しません...",
      500: "インクが滲んでしまいました。しばらくお待ちください",
      503: "図書館は一時的に閉館中です",
    };

    return thematicMessages[this.statusCode] || "予期せぬ事態が発生しました";
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields?: Record<string, string>
  ) {
    super(
      message,
      "VALIDATION_ERROR",
      400,
      "入力内容に誤りがあります",
      { fields }
    );
  }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends AppError {
  constructor(message: string = "Authentication required") {
    super(
      message,
      "AUTHENTICATION_ERROR",
      401,
      "この書庫への入室は許可されていません"
    );
  }
}

/**
 * 認可エラー
 */
export class AuthorizationError extends AppError {
  constructor(message: string = "Insufficient permissions") {
    super(
      message,
      "AUTHORIZATION_ERROR",
      403,
      "これは禁書です。閲覧できません"
    );
  }
}

/**
 * リソース未検出エラー
 */
export class NotFoundError extends AppError {
  constructor(
    resource: string,
    identifier?: string
  ) {
    const message = identifier
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;

    super(
      message,
      "NOT_FOUND",
      404,
      `その${resource}は図書館に存在しません...`
    );
  }
}

/**
 * AI生成エラー
 */
export class AIGenerationError extends AppError {
  constructor(
    message: string,
    public readonly model?: string,
    public readonly prompt?: string
  ) {
    super(
      message,
      "AI_GENERATION_ERROR",
      500,
      "AIの筆が止まりました。もう一度お試しください",
      { model, prompt }
    );
  }
}

/**
 * Firestore操作エラー
 */
export class FirestoreError extends AppError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly collection?: string
  ) {
    super(
      message,
      "FIRESTORE_ERROR",
      500,
      "書庫の記録に失敗しました",
      { operation, collection }
    );
  }
}

/**
 * レート制限エラー
 */
export class RateLimitError extends AppError {
  constructor(
    retryAfter?: number
  ) {
    super(
      "Rate limit exceeded",
      "RATE_LIMIT",
      429,
      "あまりに多くのリクエストです。少しお待ちください",
      { retryAfter }
    );
  }
}

/**
 * タイムアウトエラー
 */
export class TimeoutError extends AppError {
  constructor(
    operation: string,
    timeout: number
  ) {
    super(
      `Operation timeout: ${operation}`,
      "TIMEOUT",
      504,
      "時間切れです。もう一度お試しください",
      { operation, timeout }
    );
  }
}

/**
 * エラーをAppErrorに変換
 */
export function toAppError(error: unknown): AppError {
  // 既にAppErrorの場合
  if (error instanceof AppError) {
    return error;
  }

  // Errorオブジェクトの場合
  if (error instanceof Error) {
    // Firestore エラー
    if (error.message.includes("firestore") || error.message.includes("PERMISSION_DENIED")) {
      return new FirestoreError(error.message, "unknown");
    }

    // Vertex AI エラー
    if (error.message.includes("vertex") || error.message.includes("gemini")) {
      return new AIGenerationError(error.message);
    }

    // 一般的なエラー
    return new AppError(error.message, "UNKNOWN_ERROR", 500);
  }

  // その他（文字列など）
  return new AppError(
    String(error),
    "UNKNOWN_ERROR",
    500
  );
}

/**
 * エラーログを出力
 */
export function logError(error: AppError | Error, context?: string) {
  const timestamp = new Date().toISOString();
  const prefix = context ? `[${context}]` : "[ERROR]";

  if (error instanceof AppError) {
    console.error(`${prefix} ${timestamp}`, {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      metadata: error.metadata,
      stack: error.stack,
    });
  } else {
    console.error(`${prefix} ${timestamp}`, {
      message: error.message,
      stack: error.stack,
    });
  }
}

/**
 * エラーレスポンスを生成（API Routes用）
 */
export function createErrorResponse(error: unknown) {
  const appError = toAppError(error);

  // 開発環境ではスタックトレースも含める
  const isDevelopment = process.env.NODE_ENV === "development";

  return {
    error: {
      code: appError.code,
      message: appError.getUserMessage(),
      ...(isDevelopment && {
        details: appError.message,
        metadata: appError.metadata,
        stack: appError.stack,
      }),
    },
  };
}

/**
 * エラーをtry-catchで安全に処理
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<[T | null, AppError | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    const appError = toAppError(error);
    if (context) {
      logError(appError, context);
    }
    return [null, appError];
  }
}

/**
 * エラーハンドラーデコレーター（API Routes用）
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  context?: string
): T {
  return (async (...args: any[]) => {
    try {
      return await handler(...args);
    } catch (error) {
      const appError = toAppError(error);
      logError(appError, context);

      return Response.json(
        createErrorResponse(appError),
        { status: appError.statusCode }
      );
    }
  }) as T;
}
