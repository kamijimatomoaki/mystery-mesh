/**
 * Zod → Gemini ResponseSchema 変換ユーティリティ
 *
 * ZodスキーマをVertex AI Geminiの構造化出力（responseSchema）用に変換する。
 * これによりJSON出力のバリデーションをAPI側で保証できる。
 */

import { SchemaType } from "@google-cloud/vertexai";
import type { ResponseSchema } from "@google-cloud/vertexai";
import { z } from "zod";

/**
 * ZodスキーマをGemini ResponseSchemaに変換
 *
 * @param zodSchema - 変換元のZodスキーマ
 * @returns Gemini API用のResponseSchema
 * @throws 未対応のZod型が渡された場合
 */
export function zodToGeminiSchema(zodSchema: z.ZodType): ResponseSchema {
  return convertZodType(zodSchema) as ResponseSchema;
}

/**
 * Zod型を再帰的にGemini Schemaに変換
 */
function convertZodType(zodType: z.ZodType): ResponseSchema {
  // ZodOptional: 内部型を展開（requiredから除外するのは親オブジェクトの責務）
  if (zodType instanceof z.ZodOptional) {
    return convertZodType(zodType.unwrap());
  }

  // ZodNullable: nullable: true を設定
  if (zodType instanceof z.ZodNullable) {
    const inner = convertZodType(zodType.unwrap());
    return { ...inner, nullable: true };
  }

  // ZodDefault: 内部型を展開
  if (zodType instanceof z.ZodDefault) {
    return convertZodType(zodType._def.innerType);
  }

  // ZodEffects (transform, refine, etc.): 内部型を展開
  if (zodType instanceof z.ZodEffects) {
    return convertZodType(zodType._def.schema);
  }

  // ZodString
  if (zodType instanceof z.ZodString) {
    return { type: SchemaType.STRING };
  }

  // ZodNumber
  if (zodType instanceof z.ZodNumber) {
    // integer チェック
    const checks = (zodType._def as any).checks as Array<{ kind: string }> | undefined;
    const isInt = checks?.some((c) => c.kind === "int");
    return { type: isInt ? SchemaType.INTEGER : SchemaType.NUMBER };
  }

  // ZodBoolean
  if (zodType instanceof z.ZodBoolean) {
    return { type: SchemaType.BOOLEAN };
  }

  // ZodEnum
  if (zodType instanceof z.ZodEnum) {
    return {
      type: SchemaType.STRING,
      enum: zodType._def.values as string[],
    };
  }

  // ZodNativeEnum
  if (zodType instanceof z.ZodNativeEnum) {
    const enumValues = Object.values(zodType._def.values).filter(
      (v) => typeof v === "string"
    ) as string[];
    return {
      type: SchemaType.STRING,
      enum: enumValues,
    };
  }

  // ZodLiteral (string literal)
  if (zodType instanceof z.ZodLiteral) {
    const val = zodType._def.value;
    if (typeof val === "string") {
      return { type: SchemaType.STRING, enum: [val] };
    }
    if (typeof val === "number") {
      return { type: SchemaType.NUMBER };
    }
    if (typeof val === "boolean") {
      return { type: SchemaType.BOOLEAN };
    }
    return { type: SchemaType.STRING };
  }

  // ZodArray
  if (zodType instanceof z.ZodArray) {
    return {
      type: SchemaType.ARRAY,
      items: convertZodType(zodType._def.type),
    };
  }

  // ZodObject
  if (zodType instanceof z.ZodObject) {
    const shape = zodType._def.shape();
    const properties: Record<string, ResponseSchema> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convertZodType(value as z.ZodType);

      // optionalでないフィールドをrequiredに追加
      if (!(value instanceof z.ZodOptional)) {
        required.push(key);
      }
    }

    const schema: ResponseSchema = {
      type: SchemaType.OBJECT,
      properties,
    };

    if (required.length > 0) {
      schema.required = required;
    }

    return schema;
  }

  // ZodUnion / ZodDiscriminatedUnion: 最初の型を使用（Geminiはunionをサポートしない）
  if (zodType instanceof z.ZodUnion || zodType instanceof z.ZodDiscriminatedUnion) {
    const options = zodType._def.options as z.ZodType[];
    if (options.length > 0) {
      // null を含むunionの場合はnullable扱い
      const nonNullOptions = options.filter(
        (o) => !(o instanceof z.ZodNull || o instanceof z.ZodUndefined)
      );
      if (nonNullOptions.length === 1 && nonNullOptions.length < options.length) {
        const inner = convertZodType(nonNullOptions[0]);
        return { ...inner, nullable: true };
      }
      return convertZodType(options[0]);
    }
    return { type: SchemaType.STRING };
  }

  // ZodRecord: objectとして扱う（propertiesなし）
  if (zodType instanceof z.ZodRecord) {
    return { type: SchemaType.OBJECT };
  }

  // ZodNull / ZodUndefined
  if (zodType instanceof z.ZodNull || zodType instanceof z.ZodUndefined) {
    return { type: SchemaType.STRING, nullable: true };
  }

  // ZodAny / ZodUnknown
  if (zodType instanceof z.ZodAny || zodType instanceof z.ZodUnknown) {
    return { type: SchemaType.STRING };
  }

  // フォールバック: STRING
  console.warn(
    `[zodToGeminiSchema] Unsupported Zod type: ${zodType.constructor.name}, falling back to STRING`
  );
  return { type: SchemaType.STRING };
}
