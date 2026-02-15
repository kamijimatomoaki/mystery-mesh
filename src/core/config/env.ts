/**
 * Environment Variables Validation
 * 型安全な環境変数管理（Zod）
 *
 * 設計思想:
 * - サーバー/クライアント環境変数を明確に分離
 * - 起動時バリデーション（Fail Fast）
 * - 詳細なエラーメッセージ
 * - デフォルト値の提供
 */

import { z } from "zod";

/**
 * サーバーサイド環境変数スキーマ
 */
const serverEnvSchema = z.object({
  // Google Cloud
  GOOGLE_CLOUD_PROJECT: z.string().min(1, "GOOGLE_CLOUD_PROJECT is required"),
  GOOGLE_CLOUD_LOCATION: z.string().default("us-central1"),

  // Vertex AI Models
  VERTEX_MODEL_TEXT: z.string().default("gemini-2.0-flash-exp"),
  VERTEX_MODEL_IMAGE: z.string().default("gemini-2.0-flash-exp-image"),
  VERTEX_MODEL_VIDEO: z.string().default("veo-001"),

  // Node Environment
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Optional: Firebase Admin (ADC推奨だが、明示的に指定する場合)
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
});

/**
 * クライアントサイド環境変数スキーマ
 */
const clientEnvSchema = z.object({
  // Firebase Client Config (NEXT_PUBLIC_ prefix)
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, "Firebase API Key is required"),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1, "Firebase Auth Domain is required"),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1, "Firebase Project ID is required"),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1, "Firebase Storage Bucket is required"),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1, "Firebase Messaging Sender ID is required"),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1, "Firebase App ID is required"),

  // Optional: Measurement ID
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: z.string().optional(),

  // App Config
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

/**
 * 環境変数の型
 */
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * サーバーサイド環境変数を取得（バリデーション付き）
 *
 * @throws {Error} バリデーションエラー時
 * @returns バリデーション済み環境変数
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() should only be called on the server side");
  }

  try {
    return serverEnvSchema.parse({
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
      GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION,
      VERTEX_MODEL_TEXT: process.env.VERTEX_MODEL_TEXT,
      VERTEX_MODEL_IMAGE: process.env.VERTEX_MODEL_IMAGE,
      VERTEX_MODEL_VIDEO: process.env.VERTEX_MODEL_VIDEO,
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ [ENV] Server environment variables validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      throw new Error("Server environment variables are invalid. Check console for details.");
    }
    throw error;
  }
}

/**
 * クライアントサイド環境変数を取得（バリデーション付き）
 *
 * @throws {Error} バリデーションエラー時
 * @returns バリデーション済み環境変数
 */
export function getClientEnv(): ClientEnv {
  try {
    return clientEnvSchema.parse({
      NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ [ENV] Client environment variables validation failed:");
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      throw new Error("Client environment variables are invalid. Check console for details.");
    }
    throw error;
  }
}

/**
 * 環境が本番環境かどうか
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * 環境が開発環境かどうか
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * 環境がテスト環境かどうか
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * プロジェクトIDを安全に取得
 * クライアント/サーバー両対応
 */
export function getProjectId(): string {
  // クライアントサイド
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
  }

  // サーバーサイド
  return process.env.GOOGLE_CLOUD_PROJECT || "";
}

/**
 * 起動時に環境変数をバリデーション
 * next.config.js から呼び出す
 */
export function validateEnvOnStartup() {
  console.log("🔍 [ENV] Validating environment variables...");

  try {
    const serverEnv = getServerEnv();
    console.log("✅ [ENV] Server environment variables validated");
    console.log(`   - Project: ${serverEnv.GOOGLE_CLOUD_PROJECT}`);
    console.log(`   - Location: ${serverEnv.GOOGLE_CLOUD_LOCATION}`);
    console.log(`   - Text Model: ${serverEnv.VERTEX_MODEL_TEXT}`);
    console.log(`   - Image Model: ${serverEnv.VERTEX_MODEL_IMAGE}`);
    console.log(`   - Video Model: ${serverEnv.VERTEX_MODEL_VIDEO}`);
    console.log(`   - Environment: ${serverEnv.NODE_ENV}`);
  } catch (error) {
    console.error("❌ [ENV] Server environment validation failed");
    throw error;
  }

  try {
    const clientEnv = getClientEnv();
    console.log("✅ [ENV] Client environment variables validated");
    console.log(`   - Firebase Project: ${clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`);
    console.log(`   - App URL: ${clientEnv.NEXT_PUBLIC_APP_URL}`);
  } catch (error) {
    console.error("❌ [ENV] Client environment validation failed");
    throw error;
  }

  console.log("✅ [ENV] All environment variables are valid");
}

/**
 * 後方互換性のための統合 env オブジェクト
 * @deprecated 直接 getServerEnv() または getClientEnv() を使用してください
 */
export const env = typeof window === "undefined"
  ? (() => {
      try {
        return getServerEnv();
      } catch {
        return {} as ServerEnv;
      }
    })()
  : ({} as ServerEnv);
