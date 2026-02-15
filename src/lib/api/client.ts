/**
 * Authenticated API Client
 * Firebase Auth トークンを自動付加するAPIクライアント
 */

import { auth } from "@/core/db/firestore-client";
import { createModuleLogger } from "@/core/utils/logger";

const logger = createModuleLogger("APIClient");

const API_BASE = process.env.NEXT_PUBLIC_APP_URL || "";

/**
 * 現在のユーザーのIDトークンを取得
 */
async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) {
    logger.debug("No authenticated user");
    return null;
  }

  try {
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    logger.error("Failed to get ID token", error as Error);
    return null;
  }
}

/**
 * API呼び出しオプション
 */
export interface ApiCallOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  requireAuth?: boolean;
}

/**
 * API呼び出し結果
 */
export interface ApiResult<T> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * 認証付きAPI呼び出し
 *
 * @param endpoint - APIエンドポイント（例: /api/game/create）
 * @param options - リクエストオプション
 * @returns APIレスポンス
 */
export async function apiCall<T>(
  endpoint: string,
  options: ApiCallOptions = {}
): Promise<T> {
  const { body, requireAuth = true, ...fetchOptions } = options;
  const url = `${API_BASE}${endpoint}`;

  // ヘッダーの準備
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...fetchOptions.headers,
  };

  // 認証トークンを追加
  if (requireAuth) {
    const token = await getIdToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    } else {
      logger.warn("Auth required but no token available", { endpoint });
    }
  }

  logger.debug("API call", {
    url,
    method: fetchOptions.method || "GET",
    requireAuth,
  });

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: response.statusText,
    }));

    logger.error("API call failed", new Error(errorData.error || errorData.message), {
      url,
      status: response.status,
    });

    throw new ApiError(
      errorData.error || errorData.message || `API call failed: ${response.status}`,
      response.status,
      errorData
    );
  }

  const data = await response.json();
  logger.debug("API call success", { url });

  return data;
}

/**
 * APIエラークラス
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * GET リクエストヘルパー
 */
export async function apiGet<T>(
  endpoint: string,
  options: Omit<ApiCallOptions, "method" | "body"> = {}
): Promise<T> {
  return apiCall<T>(endpoint, { ...options, method: "GET" });
}

/**
 * POST リクエストヘルパー
 */
export async function apiPost<T>(
  endpoint: string,
  body?: unknown,
  options: Omit<ApiCallOptions, "method" | "body"> = {}
): Promise<T> {
  return apiCall<T>(endpoint, { ...options, method: "POST", body });
}

/**
 * PUT リクエストヘルパー
 */
export async function apiPut<T>(
  endpoint: string,
  body?: unknown,
  options: Omit<ApiCallOptions, "method" | "body"> = {}
): Promise<T> {
  return apiCall<T>(endpoint, { ...options, method: "PUT", body });
}

/**
 * DELETE リクエストヘルパー
 */
export async function apiDelete<T>(
  endpoint: string,
  options: Omit<ApiCallOptions, "method" | "body"> = {}
): Promise<T> {
  return apiCall<T>(endpoint, { ...options, method: "DELETE" });
}
