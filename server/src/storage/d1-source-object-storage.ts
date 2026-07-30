import {
  SourceObjectNotFoundError,
  sourceBytesToArrayBuffer,
  type SourceObjectStorage
} from "./source-object-storage.js";

const CHUNK_SIZE_BYTES = 128 * 1024;

type D1ResultLike = {
  meta: { changes?: number };
};

type D1AllResultLike<T> = {
  results?: T[];
};

type D1StatementLike = {
  bind(...values: unknown[]): D1StatementLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1AllResultLike<T>>;
  run(): Promise<D1ResultLike>;
};

export interface D1SourceDatabaseLike {
  prepare(sql: string): D1StatementLike;
}

type SourceChunkRow = {
  chunk_index: number;
  data_base64: string;
  content_type: string | null;
  size_bytes: number;
};

type SourceHeadRow = {
  content_type: string | null;
  size_bytes: number;
};

export class D1SourceObjectStorage implements SourceObjectStorage {
  constructor(private readonly database: D1SourceDatabaseLike) {}

  async putObject(input: {
    key: string;
    bytes: Uint8Array | ArrayBuffer | Blob;
    contentType?: string;
    metadata?: Record<string, string>;
  }): Promise<{ key: string; sizeBytes: number }> {
    const bytes = new Uint8Array(await sourceBytesToArrayBuffer(input.bytes));
    await this.database
      .prepare("DELETE FROM source_objects WHERE object_key = ?")
      .bind(input.key)
      .run();

    const chunkCount = Math.max(1, Math.ceil(bytes.byteLength / CHUNK_SIZE_BYTES));
    for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
      const start = chunkIndex * CHUNK_SIZE_BYTES;
      const chunk = bytes.subarray(start, start + CHUNK_SIZE_BYTES);
      await this.database
        .prepare(
          "INSERT INTO source_objects (object_key, chunk_index, data_base64, content_type, size_bytes, metadata_json, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(
          input.key,
          chunkIndex,
          bytesToBase64(chunk),
          input.contentType ?? null,
          bytes.byteLength,
          input.metadata ? JSON.stringify(input.metadata) : null
        )
        .run();
    }
    return { key: input.key, sizeBytes: bytes.byteLength };
  }

  async getObject(key: string): Promise<{
    bytes: ArrayBuffer;
    contentType?: string;
    sizeBytes?: number;
  }> {
    const result = await this.database
      .prepare(
        "SELECT chunk_index, data_base64, content_type, size_bytes FROM source_objects WHERE object_key = ? ORDER BY chunk_index"
      )
      .bind(key)
      .all<SourceChunkRow>();
    const rows = result.results ?? [];
    if (rows.length === 0) throw new SourceObjectNotFoundError(key);

    const chunks = rows.map((row) => base64ToBytes(row.data_base64));
    const sizeBytes = rows[0]?.size_bytes ?? chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const bytes = new Uint8Array(sizeBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const contentType = rows[0]?.content_type ?? undefined;
    return {
      bytes: bytes.buffer,
      ...(contentType ? { contentType } : {}),
      sizeBytes
    };
  }

  async headObject(key: string): Promise<{
    exists: boolean;
    contentType?: string;
    sizeBytes?: number;
  }> {
    const row = await this.database
      .prepare(
        "SELECT content_type, size_bytes FROM source_objects WHERE object_key = ? AND chunk_index = 0"
      )
      .bind(key)
      .first<SourceHeadRow>();
    if (!row) return { exists: false };
    return {
      exists: true,
      ...(row.content_type ? { contentType: row.content_type } : {}),
      sizeBytes: row.size_bytes
    };
  }

  async deleteObject(key: string): Promise<{ deleted: boolean }> {
    const result = await this.database
      .prepare("DELETE FROM source_objects WHERE object_key = ?")
      .bind(key)
      .run();
    return { deleted: (result.meta.changes ?? 0) > 0 };
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
