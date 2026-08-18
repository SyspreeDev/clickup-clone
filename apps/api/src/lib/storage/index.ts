import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env, isR2Configured } from "../../config/env";

export interface StoredFile {
  key: string;
  url: string;
}

export interface PresignedUpload {
  key: string;
  uploadUrl: string;
}

export interface StorageProvider {
  save(originalName: string, buffer: Buffer): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  resolveUrl(key: string): string;
  /** Reads an object back so an authorized route can serve it. */
  read(key: string): Promise<Buffer>;
  /**
   * Issues a short-lived URL the browser can upload straight to, bypassing our
   * server (and the Vercel proxy's request-body ceiling) for the file bytes.
   * Only providers that support direct browser uploads implement this —
   * callers must treat its absence as "fall back to the buffered upload path."
   */
  presignUpload?(originalName: string, contentType: string): Promise<PresignedUpload>;
}

class LocalStorageProvider implements StorageProvider {
  private readonly root = path.resolve(process.cwd(), env.uploadDir);

  private async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true });
  }

  async save(originalName: string, buffer: Buffer): Promise<StoredFile> {
    await this.ensureRoot();
    const ext = path.extname(originalName);
    const key = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(this.root, key), buffer);
    return { key, url: this.resolveUrl(key) };
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(this.root, key), { force: true });
  }

  async read(key: string): Promise<Buffer> {
    // Keys are generated UUIDs, but this is reached with a caller-supplied
    // value, so confine the read to the upload root regardless.
    const resolved = path.resolve(this.root, path.basename(key));
    if (!resolved.startsWith(this.root)) throw new Error("Invalid storage key");
    return fs.readFile(resolved);
  }

  resolveUrl(key: string): string {
    return `/uploads/${key}`;
  }
}

/**
 * Cloudflare R2 (S3-compatible). `resolveUrl` deliberately keeps the same
 * `/uploads/<key>` shape as the local provider — the `url` column is an
 * internal reference stripped back to a bare key on read (see
 * file.service.ts `readFileForUser`), not a real public URL. Files are never
 * served directly from R2; every read still goes through our own
 * per-file-authorized download route.
 */
class R2StorageProvider implements StorageProvider {
  private readonly bucket = env.r2Bucket!;
  private client: import("@aws-sdk/client-s3").S3Client | null = null;

  private async getClient() {
    if (!this.client) {
      const { S3Client } = await import("@aws-sdk/client-s3");
      this.client = new S3Client({
        region: "auto",
        endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: env.r2AccessKeyId!,
          secretAccessKey: env.r2SecretAccessKey!,
        },
      });
    }
    return this.client;
  }

  private newKey(originalName: string): string {
    const ext = path.extname(originalName);
    return `${crypto.randomUUID()}${ext}`;
  }

  async save(originalName: string, buffer: Buffer): Promise<StoredFile> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    const key = this.newKey(originalName);
    await client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer }));
    return { key, url: this.resolveUrl(key) };
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async read(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    const result = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const chunks: Buffer[] = [];
    // @ts-expect-error - Body is a Node.js Readable at runtime in the SDK's Node build
    for await (const chunk of result.Body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  resolveUrl(key: string): string {
    return `/uploads/${key}`;
  }

  async presignUpload(originalName: string, contentType: string): Promise<PresignedUpload> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const client = await this.getClient();
    const key = this.newKey(originalName);
    const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    return { key, uploadUrl };
  }
}

function createStorageProvider(): StorageProvider {
  switch (env.storageProvider) {
    case "r2":
      if (!isR2Configured) {
        console.warn("[storage] STORAGE_PROVIDER=r2 but R2_* env vars are incomplete — falling back to local disk.");
        return new LocalStorageProvider();
      }
      return new R2StorageProvider();
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

export const storageProvider: StorageProvider = createStorageProvider();
