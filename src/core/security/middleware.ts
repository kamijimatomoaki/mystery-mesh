/**
 * Security Middleware Helpers
 * Next.js API Routes用のセキュリティミドルウェア
 */

import { NextRequest, NextResponse } from "next/server";
import { getRateLimiter, RATE_LIMIT_PRESETS, getIpKey, getUserKey, getEndpointKey } from "./rate-limiter";
import { createModuleLogger } from "@/core/utils/logger";
import { adminAuth } from "@/core/db/firestore-admin";

const logger = createModuleLogger("SecurityMiddleware");

/**
 * Rate Limitミドルウェア設定
 */
export interface RateLimitMiddlewareOptions {
  preset: keyof typeof RATE_LIMIT_PRESETS;
  keyGenerator?: (request: NextRequest) => string;
  onRateLimitExceeded?: (request: NextRequest) => NextResponse;
}

/**
 * Rate Limitミドルウェア
 * Next.js API Routesで使用
 */
export async function withRateLimit(
  request: NextRequest,
  options: RateLimitMiddlewareOptions
): Promise<NextResponse | null> {
  const limiter = getRateLimiter(options.preset);

  // キー生成（デフォルト: IPアドレス）
  const key = options.keyGenerator
    ? options.keyGenerator(request)
    : getIpFromRequest(request);

  // レート制限チェック
  const result = await limiter.checkLimit(key);

  // ヘッダーに制限情報を追加
  const headers = {
    "X-RateLimit-Limit": RATE_LIMIT_PRESETS[options.preset].maxRequests.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
  };

  if (!result.allowed) {
    logger.warn("Rate limit exceeded", {
      key,
      preset: options.preset,
      resetAt: new Date(result.resetAt).toISOString(),
    });

    // カスタムレスポンス or デフォルトレスポンス
    if (options.onRateLimitExceeded) {
      return options.onRateLimitExceeded(request);
    }

    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        message: RATE_LIMIT_PRESETS[options.preset].message,
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // 制限内の場合はnullを返す（処理続行）
  // ヘッダーは後で追加可能
  return null;
}

/**
 * リクエストからIPアドレスを取得
 */
export function getIpFromRequest(request: NextRequest): string {
  // Vercel/CloudflareのヘッダーからIPを取得
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  // 優先順位: CF > Real-IP > Forwarded-For > fallback
  return (
    cfConnectingIp ||
    realIp ||
    forwardedFor?.split(",")[0].trim() ||
    "unknown"
  );
}

/**
 * 認証済みユーザーのIDを取得
 * Firebase Admin SDKでトークンを検証
 */
export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.debug("No authorization header found");
    return null;
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const decodedToken = await adminAuth.verifyIdToken(token);
    logger.debug("Token verified successfully", { uid: decodedToken.uid });
    return decodedToken.uid;
  } catch (error) {
    logger.warn("Token verification failed", { error });
    return null;
  }
}

/**
 * APIエンドポイント用のRate Limitミドルウェア
 * 使用例:
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const rateLimitResponse = await checkRateLimit(request, 'standard');
 *   if (rateLimitResponse) return rateLimitResponse;
 *
 *   // 通常の処理...
 * }
 * ```
 */
export async function checkRateLimit(
  request: NextRequest,
  preset: keyof typeof RATE_LIMIT_PRESETS,
  keyGenerator?: (request: NextRequest) => string
): Promise<NextResponse | null> {
  return withRateLimit(request, {
    preset,
    keyGenerator,
  });
}

/**
 * ユーザーベースのRate Limit
 */
export async function checkUserRateLimit(
  request: NextRequest,
  preset: keyof typeof RATE_LIMIT_PRESETS
): Promise<NextResponse | null> {
  // 事前にユーザーIDを取得（非同期）
  const userId = await getUserIdFromRequest(request);

  return withRateLimit(request, {
    preset,
    keyGenerator: () => {
      if (userId) {
        return getUserKey(userId);
      }
      // ユーザーIDが取得できない場合はIPフォールバック
      return getIpKey(getIpFromRequest(request));
    },
  });
}

/**
 * エンドポイント別のRate Limit
 */
export async function checkEndpointRateLimit(
  request: NextRequest,
  preset: keyof typeof RATE_LIMIT_PRESETS
): Promise<NextResponse | null> {
  const endpoint = new URL(request.url).pathname;

  return withRateLimit(request, {
    preset,
    keyGenerator: (req) => {
      const ip = getIpFromRequest(req);
      return getEndpointKey(ip, endpoint);
    },
  });
}

/**
 * CORS設定
 */
export function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  response.headers.set("Access-Control-Max-Age", "86400");

  return response;
}

/**
 * OPTIONS リクエスト用のハンドラー
 */
export function handleCorsPreflightRequest(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

/**
 * セキュリティヘッダーを設定
 */
export function setSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

/**
 * Complete Security Middleware
 * Rate Limit + CORS + Security Headers
 */
export async function withFullSecurityCheck(
  request: NextRequest,
  preset: keyof typeof RATE_LIMIT_PRESETS = "standard"
): Promise<NextResponse | null> {
  // CORS Preflight
  if (request.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  // Rate Limit Check
  const rateLimitResponse = await checkRateLimit(request, preset);
  if (rateLimitResponse) {
    return setCorsHeaders(setSecurityHeaders(rateLimitResponse));
  }

  // 通常のリクエストは処理続行（nullを返す）
  return null;
}

/**
 * 認証必須のAPIエンドポイント用ミドルウェア
 * 未認証の場合は401エラーを返す
 *
 * @returns userId if authenticated, otherwise returns NextResponse with 401 error
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
  const userId = await getUserIdFromRequest(request);

  if (!userId) {
    logger.warn("Authentication required but no valid token found");
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "古の書物を開くには、まずサインインが必要です。",
      },
      { status: 401 }
    );
  }

  return { userId };
}

/**
 * 認証 + Rate Limit + CORS + Security Headers
 * 認証必須のAPIエンドポイント用の完全なミドルウェア
 */
export async function withAuthAndSecurityCheck(
  request: NextRequest,
  preset: keyof typeof RATE_LIMIT_PRESETS = "standard"
): Promise<{ userId: string } | NextResponse> {
  // CORS Preflight
  if (request.method === "OPTIONS") {
    return handleCorsPreflightRequest();
  }

  // Rate Limit Check
  const rateLimitResponse = await checkRateLimit(request, preset);
  if (rateLimitResponse) {
    return setCorsHeaders(setSecurityHeaders(rateLimitResponse));
  }

  // Authentication Check
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return setCorsHeaders(setSecurityHeaders(authResult));
  }

  return authResult;
}
