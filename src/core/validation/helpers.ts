/**
 * Validation Helpers
 * バリデーションヘルパー関数
 *
 * 設計思想:
 * - Zodスキーマを使った型安全なバリデーション
 * - エラーメッセージの日本語化
 * - API Routes用のバリデーション
 */

import { z } from "zod";
import { ValidationError } from "../utils/errors";

/**
 * リクエストボディをバリデーション（API Routes用）
 *
 * @param body - リクエストボディ
 * @param schema - Zodスキーマ
 * @returns バリデーション済みデータ
 * @throws {ValidationError} バリデーションエラー時
 *
 * @example
 * const data = validateRequest(body, ScenarioGenerationRequestSchema);
 */
export function validateRequest<T extends z.ZodType>(
  body: unknown,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fields: Record<string, string> = {};

      error.errors.forEach((err) => {
        const path = err.path.join(".");
        fields[path] = err.message;
      });

      throw new ValidationError(
        "入力内容にエラーがあります",
        fields
      );
    }

    throw error;
  }
}

/**
 * クエリパラメータをバリデーション
 *
 * @param params - URLSearchParams
 * @param schema - Zodスキーマ
 * @returns バリデーション済みデータ
 *
 * @example
 * const params = new URL(request.url).searchParams;
 * const data = validateQuery(params, PaginationSchema);
 */
export function validateQuery<T extends z.ZodType>(
  params: URLSearchParams,
  schema: T
): z.infer<T> {
  const obj: Record<string, any> = {};

  params.forEach((value, key) => {
    // 数値に変換可能な場合は変換
    if (/^\d+$/.test(value)) {
      obj[key] = parseInt(value, 10);
    } else if (value === "true" || value === "false") {
      obj[key] = value === "true";
    } else {
      obj[key] = value;
    }
  });

  return validateRequest(obj, schema);
}

/**
 * 配列の各要素をバリデーション
 *
 * @param items - 配列
 * @param schema - Zodスキーマ
 * @returns バリデーション済み配列
 *
 * @example
 * const validated = validateArray(messages, ChatMessageSchema);
 */
export function validateArray<T extends z.ZodType>(
  items: unknown[],
  schema: T
): z.infer<T>[] {
  return items.map((item, index) => {
    try {
      return schema.parse(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `配列の${index}番目の要素にエラーがあります`,
          { index: index.toString(), ...formatZodError(error) }
        );
      }
      throw error;
    }
  });
}

/**
 * 部分的なバリデーション（一部のフィールドのみ）
 *
 * @param data - データ
 * @param schema - Zodスキーマ
 * @returns バリデーション済みデータ
 *
 * @example
 * const partial = validatePartial(data, UserSchema);
 */
export function validatePartial<T extends z.ZodType>(
  data: unknown,
  schema: T
): Partial<z.infer<T>> {
  if (schema instanceof z.ZodObject) {
    const partialSchema = schema.partial();
    return validateRequest(data, partialSchema);
  }

  throw new Error("Partial validation only works with ZodObject");
}

/**
 * ZodErrorを整形
 */
function formatZodError(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  error.errors.forEach((err) => {
    const path = err.path.join(".");
    fields[path] = err.message;
  });

  return fields;
}

/**
 * バリデーション結果の型
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ValidationError };

/**
 * 安全なバリデーション（例外を投げない）
 *
 * @param data - データ
 * @param schema - Zodスキーマ
 * @returns バリデーション結果
 *
 * @example
 * const result = safeValidate(data, UserSchema);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error);
 * }
 */
export function safeValidate<T extends z.ZodType>(
  data: unknown,
  schema: T
): ValidationResult<z.infer<T>> {
  try {
    const validated = validateRequest(data, schema);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error };
    }

    return {
      success: false,
      error: new ValidationError("バリデーションエラー"),
    };
  }
}

/**
 * API Routesでのバリデーション統合
 *
 * @param request - NextRequest
 * @param bodySchema - ボディスキーマ（オプション）
 * @param querySchema - クエリスキーマ（オプション）
 * @returns バリデーション済みデータ
 *
 * @example
 * const { body, query } = await validateApiRequest(request, {
 *   bodySchema: CreateGameSchema,
 *   querySchema: PaginationSchema
 * });
 */
export async function validateApiRequest<
  TBody extends z.ZodType = z.ZodNever,
  TQuery extends z.ZodType = z.ZodNever
>(
  request: Request,
  options: {
    bodySchema?: TBody;
    querySchema?: TQuery;
  } = {}
): Promise<{
  body: TBody extends z.ZodNever ? undefined : z.infer<TBody>;
  query: TQuery extends z.ZodNever ? undefined : z.infer<TQuery>;
}> {
  const result: any = {};

  // ボディのバリデーション
  if (options.bodySchema) {
    try {
      const body = await request.json();
      result.body = validateRequest(body, options.bodySchema);
    } catch (error) {
      throw new ValidationError("リクエストボディが不正です");
    }
  }

  // クエリパラメータのバリデーション
  if (options.querySchema) {
    const url = new URL(request.url);
    result.query = validateQuery(url.searchParams, options.querySchema);
  }

  return result;
}
