import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../../config/env";

export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageProvider {
  save(originalName: string, buffer: Buffer): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  resolveUrl(key: string): string;
  /** Reads an object back so an authorized route can serve it. */
  read(key: string): Promise<Buffer>;
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

function createStorageProvider(): StorageProvider {
  switch (env.storageProvider) {
    case "local":
    default:
      return new LocalStorageProvider();
  }
}

export const storageProvider: StorageProvider = createStorageProvider();
