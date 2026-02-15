/**
 * Firestoreユーティリティ
 * Firestoreに保存する前にデータをサニタイズするヘルパー関数
 */

import { Timestamp } from "firebase-admin/firestore";

/**
 * オブジェクトから再帰的にundefined値を除去する
 * Firestoreはundefined値を拒否するため、保存前にサニタイズが必要
 *
 * @param obj - サニタイズ対象のオブジェクト
 * @returns undefinedを除去したオブジェクト
 */
export function removeUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefined(item)) as T;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  // Timestamp等の特殊オブジェクトはそのまま保持
  if (obj instanceof Timestamp || obj instanceof Date) {
    return obj;
  }

  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (value !== undefined) {
      cleaned[key] = removeUndefined(value);
    }
  }
  return cleaned as T;
}
