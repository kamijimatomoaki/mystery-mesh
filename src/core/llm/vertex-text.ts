/**
 * Vertex AI Text Generation (Gemini)
 * テキスト生成・推論用のラッパー関数
 *
 * グローバルエンドポイントを使用し、シンプルなリトライロジックを提供
 */

import { getVertexAI, MODELS, executeWithRetry } from "./vertex-client";
import { GenerateContentRequest, GenerateContentResult, type ResponseSchema } from "@google-cloud/vertexai";
import { zodToGeminiSchema } from "./zod-to-gemini-schema";

/**
 * Geminiでテキスト生成を実行
 * リトライロジック付き
 *
 * @param prompt - プロンプト文字列
 * @param options - 生成オプション（temperature, maxTokensなど）
 * @returns 生成されたテキスト
 */
export async function generateText(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    systemInstruction?: string;
  }
): Promise<string> {
  return executeWithRetry(
    async () => {
      console.log(`[Gemini Text] Generating text...`);

      const vertexAI = getVertexAI();

      const generativeModel = vertexAI.getGenerativeModel({
        model: MODELS.TEXT,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 32768,
        },
        systemInstruction: options?.systemInstruction,
      });

      const request: GenerateContentRequest = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      };

      const result: GenerateContentResult = await generativeModel.generateContent(request);
      const response = result.response;

      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No response from Vertex AI");
      }

      const text = response.candidates[0].content.parts[0].text;
      if (!text) {
        throw new Error("Empty response from Vertex AI");
      }

      return text;
    },
    "generateText",
    3
  );
}

/**
 * JSONが完全かどうかをチェック（ブラケットのバランス）
 */
function isJsonComplete(text: string): boolean {
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }

  return braceCount === 0 && bracketCount === 0;
}

/**
 * AIの出力からJSONを抽出（強化版）
 * 様々なフォーマットに対応：
 * - マークダウンコードブロック
 * - XMLタグでラップされたJSON
 * - 説明テキスト付きJSON
 * - 生のJSON
 */
function extractJsonFromResponse(text: string): string | null {
  // Step 1: 生テキストをログに出力（デバッグ用）
  console.log("[extractJson] Input length:", text.length);
  console.log("[extractJson] First 200 chars:", text.substring(0, 200));

  let cleaned = text;

  // Step 2: マークダウンコードブロックを削除
  // ```json ... ``` または ``` ... ```
  cleaned = cleaned.replace(/```json\s*/gi, "");
  cleaned = cleaned.replace(/```\s*/g, "");

  // Step 3: XMLライクなタグを削除
  // <thinking>...</thinking>, <output>...</output>, etc.
  cleaned = cleaned.replace(/<\/?[a-z_-]+>/gi, "");

  // Step 4: 「以下がJSONです」のような説明文を削除
  cleaned = cleaned.replace(/^[^{\[]*(?=[\{\[])/s, "");

  // Step 5: 最初の { または [ を見つける
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  let startIndex = -1;
  let isObject = true;

  if (firstBrace === -1 && firstBracket === -1) {
    console.error("[extractJson] No JSON structure found in response");
    return null;
  } else if (firstBrace === -1) {
    startIndex = firstBracket;
    isObject = false;
  } else if (firstBracket === -1) {
    startIndex = firstBrace;
    isObject = true;
  } else {
    startIndex = Math.min(firstBrace, firstBracket);
    isObject = firstBrace < firstBracket;
  }

  // Step 6: 対応する閉じ括弧を見つける（ネストを考慮）
  const openChar = isObject ? '{' : '[';
  const closeChar = isObject ? '}' : ']';

  let depth = 0;
  let endIndex = -1;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === -1) {
    console.warn("[extractJson] Could not find matching closing bracket");
    // 最後の閉じ括弧を探す（不完全なJSONの場合）
    const lastClose = cleaned.lastIndexOf(closeChar);
    if (lastClose > startIndex) {
      endIndex = lastClose;
    } else {
      return null;
    }
  }

  const extracted = cleaned.substring(startIndex, endIndex + 1);
  console.log("[extractJson] Extracted length:", extracted.length);

  return extracted;
}

/**
 * 不完全なJSONを修復する試み
 * maxTokens切り捨てで不完全になったJSONを最後の完全なプロパティまで巻き戻す
 */
function tryRepairJson(json: string): string {
  let repaired = json;

  // Step 1: 末尾の不完全なプロパティ値を除去
  // 例: {"key": "val → {"key" を切り捨て → 最後の完全なプロパティまで巻き戻し
  const quoteCount = (repaired.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    // 未閉じの文字列がある → 最後の完全なプロパティまで巻き戻す
    // 最後のカンマ or 開き括弧を探して、そこまで切り詰める
    const lastQuote = repaired.lastIndexOf('"');
    if (lastQuote > 0) {
      // lastQuoteより前で、最後の完全なkey-valueペアの終端を探す
      // "key": "value", ← このカンマの直後が次のプロパティの開始
      let cutPoint = -1;
      // 最後のカンマを探す（文字列外のもの）
      for (let i = lastQuote - 1; i >= 0; i--) {
        const ch = repaired[i];
        if (ch === ',') {
          // このカンマの前が完全なプロパティ終端かチェック
          const before = repaired.substring(0, i).trimEnd();
          if (before.endsWith('"') || before.endsWith('}') || before.endsWith(']') || /\d$/.test(before) || before.endsWith('true') || before.endsWith('false') || before.endsWith('null')) {
            cutPoint = i;
            break;
          }
        }
        if (ch === '{' || ch === '[') {
          cutPoint = i + 1;
          break;
        }
      }
      if (cutPoint > 0) {
        repaired = repaired.substring(0, cutPoint);
        repaired = repaired.replace(/,\s*$/, '');
      }
    }
  }

  // Step 2: 末尾のカンマを除去（JSON仕様外）
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');
  repaired = repaired.replace(/,\s*$/, '');

  // Step 3: 括弧のバランスを修復
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;

  for (const char of repaired) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
  }

  // 不足している閉じ括弧を追加
  while (bracketCount > 0) {
    repaired += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    repaired += '}';
    braceCount--;
  }

  return repaired;
}

/**
 * JSONをパースする（修復を試みる）
 */
function parseJsonWithRepair<T>(jsonStr: string): T {
  // まず通常のパースを試みる
  try {
    return JSON.parse(jsonStr) as T;
  } catch (firstError) {
    console.warn("[parseJson] Initial parse failed, attempting repair...");

    // 修復を試みる
    const repaired = tryRepairJson(jsonStr);
    try {
      return JSON.parse(repaired) as T;
    } catch (secondError) {
      console.error("[parseJson] Repair failed, original error:", firstError);
      throw firstError;
    }
  }
}

/**
 * Geminiで構造化されたJSON出力を生成
 * 強化されたJSON抽出ロジック付き
 *
 * @param prompt - プロンプト文字列
 * @param options - 生成オプション
 * @returns パース済みのJSONオブジェクト
 */
export async function generateJSON<T>(
  prompt: string,
  options?: {
    temperature?: number;
    systemInstruction?: string;
    maxTokens?: number;
    schema?: import("zod").ZodType<T, any, any>;
    responseSchema?: ResponseSchema;
  }
): Promise<T> {
  const maxRetries = 3;
  let lastError: Error | null = null;
  let lastRawResponse: string = "";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // ネイティブJSONモードで直接生成（generateTextを経由しない）
      const text = await executeWithRetry(
        async () => {
          console.log(`[generateJSON] Generating JSON (attempt ${attempt})...`);

          const vertexAI = getVertexAI();

          // responseSchemaの構築（明示指定 > Zodからの自動変換）
          let resolvedResponseSchema: ResponseSchema | undefined = options?.responseSchema;
          if (!resolvedResponseSchema && options?.schema) {
            try {
              resolvedResponseSchema = zodToGeminiSchema(options.schema);
            } catch (e) {
              console.warn("[generateJSON] Zod→Gemini schema conversion failed, continuing without responseSchema:", e);
            }
          }

          const generationConfig: Record<string, unknown> = {
            temperature: options?.temperature ?? 0.3,
            maxOutputTokens: options?.maxTokens ?? 65536,
            responseMimeType: "application/json",
          };

          if (resolvedResponseSchema) {
            generationConfig.responseSchema = resolvedResponseSchema;
          }

          const generativeModel = vertexAI.getGenerativeModel({
            model: MODELS.TEXT,
            generationConfig: generationConfig as any,
            systemInstruction: options?.systemInstruction,
          });

          const request: GenerateContentRequest = {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
          };

          const result = await generativeModel.generateContent(request);
          const response = result.response;

          if (!response.candidates || response.candidates.length === 0) {
            throw new Error("No response from Vertex AI");
          }

          const responseText = response.candidates[0].content.parts[0].text;
          if (!responseText) {
            throw new Error("Empty response from Vertex AI");
          }

          return responseText;
        },
        "generateJSON",
        3
      );

      lastRawResponse = text;

      // 早期バリデーション: テキストが明らかにJSON でない場合は即座にリトライ
      const trimmedText = text.trim();
      if (trimmedText.length < 5 || (!trimmedText.includes('{') && !trimmedText.includes('['))) {
        throw new Error(`Trivially invalid response (${trimmedText.length} chars): "${trimmedText.substring(0, 100)}"`);
      }

      console.log("[generateJSON] Attempt", attempt, "- Raw response length:", text.length);
      console.log("[generateJSON] Raw response first 500 chars:", text.substring(0, 500));

      // ネイティブJSONモードの場合、直接パースを試みる
      let parsed: T;
      try {
        parsed = JSON.parse(text) as T;
      } catch {
        // ネイティブJSONモードでもパース失敗する場合はフォールバック抽出を試みる
        console.warn("[generateJSON] Direct parse failed, falling back to extraction...");

        const extractedJson = extractJsonFromResponse(text);
        if (!extractedJson) {
          throw new Error("Failed to extract JSON from response. First 500 chars: " + text.substring(0, 500));
        }

        if (!isJsonComplete(extractedJson)) {
          console.warn("[generateJSON] Incomplete JSON detected, attempting repair...");
        }

        parsed = parseJsonWithRepair<T>(extractedJson);
      }

      // 配列が返された場合は最初の要素を返す
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log("[generateJSON] Array returned, using first element");
        parsed = parsed[0] as T;
      }

      // オプショナルZodスキーマ検証
      if (options?.schema) {
        try {
          return options.schema.parse(parsed);
        } catch (zodError) {
          console.error("[generateJSON] Zod validation failed:", zodError);
          throw new Error(`Zod validation failed: ${zodError}`);
        }
      }

      return parsed;
    } catch (error) {
      lastError = error as Error;
      console.error(`[generateJSON] Attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // 指数バックオフ
        const baseDelay = 1000;
        const maxDelay = 32000;
        const jitter = Math.random() * 1000;
        const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay) + jitter;

        console.log(`[generateJSON] Waiting ${Math.round(delay)}ms before retry... (${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // 最終エラー時にrawレスポンスも含める
  throw new Error(
    `Failed to generate valid JSON after ${maxRetries} attempts. ` +
    `Last error: ${lastError?.message}. ` +
    `Last response preview: ${lastRawResponse.substring(0, 300)}`
  );
}
