import { describe, expect, it } from "vitest";
import {
  D1SourceObjectStorage,
  type D1SourceDatabaseLike
} from "./d1-source-object-storage.js";

type StoredChunk = {
  chunkIndex: number;
  dataBase64: string;
  contentType: string | null;
  sizeBytes: number;
};

class FakeD1Database implements D1SourceDatabaseLike {
  readonly objects = new Map<string, StoredChunk[]>();

  prepare(sql: string) {
    let values: unknown[] = [];
    const statement = {
      bind: (...input: unknown[]) => {
        values = input;
        return statement;
      },
      first: async <T>() => {
        const key = String(values[0]);
        const first = this.objects.get(key)?.[0];
        if (!first) return null;
        return {
          content_type: first.contentType,
          size_bytes: first.sizeBytes
        } as T;
      },
      all: async <T>() => {
        const key = String(values[0]);
        return {
          results: (this.objects.get(key) ?? []).map((chunk) => ({
            chunk_index: chunk.chunkIndex,
            data_base64: chunk.dataBase64,
            content_type: chunk.contentType,
            size_bytes: chunk.sizeBytes
          })) as T[]
        };
      },
      run: async () => {
        const key = String(values[0]);
        if (sql.startsWith("DELETE")) {
          const deleted = this.objects.delete(key);
          return { meta: { changes: deleted ? 1 : 0 } };
        }
        const chunk: StoredChunk = {
          chunkIndex: Number(values[1]),
          dataBase64: String(values[2]),
          contentType: values[3] === null ? null : String(values[3]),
          sizeBytes: Number(values[4])
        };
        const chunks = this.objects.get(key) ?? [];
        chunks.push(chunk);
        chunks.sort((left, right) => left.chunkIndex - right.chunkIndex);
        this.objects.set(key, chunks);
        return { meta: { changes: 1 } };
      }
    };
    return statement;
  }
}

describe("D1SourceObjectStorage", () => {
  it("stores, restores, checks, and deletes chunked private source objects", async () => {
    const database = new FakeD1Database();
    const storage = new D1SourceObjectStorage(database);
    const key = "private/sources/source-1/source.txt";
    const text = "小安和哥哥一起看小说。".repeat(20_000);
    const bytes = new TextEncoder().encode(text);

    await expect(
      storage.putObject({
        key,
        bytes,
        contentType: "text/plain;charset=utf-8"
      })
    ).resolves.toEqual({ key, sizeBytes: bytes.byteLength });
    expect(database.objects.get(key)!.length).toBeGreaterThan(1);

    await expect(storage.headObject(key)).resolves.toEqual({
      exists: true,
      contentType: "text/plain;charset=utf-8",
      sizeBytes: bytes.byteLength
    });
    const restored = await storage.getObject(key);
    expect(new TextDecoder().decode(restored.bytes)).toBe(text);

    await expect(storage.deleteObject(key)).resolves.toEqual({ deleted: true });
    await expect(storage.headObject(key)).resolves.toEqual({ exists: false });
    await expect(storage.getObject(key)).rejects.toThrow("Source object not found");
  });

  it("preserves empty objects", async () => {
    const storage = new D1SourceObjectStorage(new FakeD1Database());

    await storage.putObject({ key: "empty", bytes: new Uint8Array() });
    const restored = await storage.getObject("empty");
    expect(restored.sizeBytes).toBe(0);
    expect(restored.bytes.byteLength).toBe(0);
  });
});
