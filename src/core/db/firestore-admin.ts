/**
 * Firebase Admin SDK (Server-Side Only)
 * サーバー側での特権アクセス用
 *
 * IMPORTANT: このファイルはサーバーサイドでのみ使用すること
 * クライアントコンポーネントからインポートしないこと
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * Firebase Admin初期化
 * ADC（Application Default Credentials）を使用
 */
function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Cloud Run環境では、ADC（メタデータサーバー）から自動的にクレデンシャルを取得
  // ローカル開発時は、gcloud auth application-default login を実行しておく
  const app = initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });

  return app;
}

// Admin App初期化
const adminApp = initializeFirebaseAdmin();

// Firestore Admin インスタンス（mistery-mesh データベースを使用）
export const adminDb = getFirestore(adminApp, "mistery-mesh");

// Auth Admin インスタンス
export const adminAuth = getAuth(adminApp);

export default adminApp;
