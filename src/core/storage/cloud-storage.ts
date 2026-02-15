/**
 * Cloud Storage Client
 * Google Cloud Storageへのファイルアップロード
 */

import { Storage } from "@google-cloud/storage";
import { getServerEnv } from "../config/env";
import { createModuleLogger } from "../utils/logger";

const logger = createModuleLogger("CloudStorage");

let storageInstance: Storage | null = null;

/**
 * Cloud Storageクライアントを取得
 */
export function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = new Storage({
      projectId: getServerEnv().GOOGLE_CLOUD_PROJECT,
    });
  }

  return storageInstance;
}

/**
 * Base64データをCloud Storageにアップロード
 *
 * @param base64Data - Base64エンコードされたデータ
 * @param fileName - ファイル名
 * @param mimeType - MIMEタイプ
 * @param bucketName - バケット名（オプション）
 * @returns 公開URL
 */
export async function uploadBase64ToStorage(
  base64Data: string,
  fileName: string,
  mimeType: string,
  bucketName?: string
): Promise<string> {
  const env = getServerEnv();
  const bucket = bucketName || `${env.GOOGLE_CLOUD_PROJECT}-videos`;

  logger.info("Uploading file to Cloud Storage", {
    fileName,
    mimeType,
    bucket,
  });

  const storage = getStorage();

  // Bufferに変換
  const buffer = Buffer.from(base64Data, "base64");

  // ファイルをアップロード
  const file = storage.bucket(bucket).file(fileName);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
    public: true, // 公開アクセス許可
  });

  // 公開URLを生成
  const publicUrl = `https://storage.googleapis.com/${bucket}/${fileName}`;

  logger.info("File uploaded successfully", { publicUrl });

  return publicUrl;
}

/**
 * 動画ファイルをCloud Storageにアップロード
 *
 * @param buffer - 動画データ
 * @param fileName - ファイル名
 * @returns 公開URL
 */
export async function uploadVideoToStorage(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  return uploadBufferToStorage(buffer, fileName, "video/mp4");
}

/**
 * Bufferデータをアップロード
 */
export async function uploadBufferToStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  bucketName?: string
): Promise<string> {
  const env = getServerEnv();
  const bucket = bucketName || `${env.GOOGLE_CLOUD_PROJECT}-videos`;

  logger.info("Uploading buffer to Cloud Storage", {
    fileName,
    mimeType,
    bucket,
    size: buffer.length,
  });

  const storage = getStorage();
  const file = storage.bucket(bucket).file(fileName);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
    public: true,
  });

  const publicUrl = `https://storage.googleapis.com/${bucket}/${fileName}`;

  logger.info("Buffer uploaded successfully", { publicUrl });

  return publicUrl;
}

/**
 * バケットの存在を確認し、なければ作成
 */
export async function ensureBucketExists(bucketName: string): Promise<void> {
  const storage = getStorage();
  const bucket = storage.bucket(bucketName);

  const [exists] = await bucket.exists();

  if (!exists) {
    logger.info("Creating bucket", { bucketName });

    await storage.createBucket(bucketName, {
      location: getServerEnv().GOOGLE_CLOUD_LOCATION,
      storageClass: "STANDARD",
    });

    logger.info("Bucket created", { bucketName });
  }
}

/**
 * ファイルを削除
 */
export async function deleteFile(
  fileName: string,
  bucketName?: string
): Promise<void> {
  const env = getServerEnv();
  const bucket = bucketName || `${env.GOOGLE_CLOUD_PROJECT}-videos`;

  logger.info("Deleting file from Cloud Storage", { fileName, bucket });

  const storage = getStorage();
  await storage.bucket(bucket).file(fileName).delete();

  logger.info("File deleted", { fileName });
}
