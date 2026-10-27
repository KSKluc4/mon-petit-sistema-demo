import "server-only";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { put } from "@vercel/blob";

const MAX_DIMENSION = 800;

interface StorageAdapter {
  upload(buffer: Buffer, filename: string): Promise<string>;
}

// Implementação local: grava em /public/uploads e devolve o caminho público.
// Usada em dev quando BLOB_READ_WRITE_TOKEN não está definido.
class LocalUploadsStorage implements StorageAdapter {
  private readonly uploadsDir = path.join(process.cwd(), "public", "uploads");

  async upload(buffer: Buffer, filename: string): Promise<string> {
    await mkdir(this.uploadsDir, { recursive: true });
    await writeFile(path.join(this.uploadsDir, filename), buffer);
    return `/uploads/${filename}`;
  }
}

// Implementação de produção: Vercel Blob. Ativada automaticamente quando
// BLOB_READ_WRITE_TOKEN existir (conectado ao projeto na Vercel).
class VercelBlobStorage implements StorageAdapter {
  async upload(buffer: Buffer, filename: string): Promise<string> {
    const blob = await put(`pets/${filename}`, buffer, {
      access: "public",
      contentType: "image/jpeg",
      addRandomSuffix: false,
    });
    return blob.url;
  }
}

const storage: StorageAdapter = process.env.BLOB_READ_WRITE_TOKEN
  ? new VercelBlobStorage()
  : new LocalUploadsStorage();

export async function uploadPetPhoto(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const resized = await sharp(Buffer.from(arrayBuffer))
    .rotate()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const filename = `${randomUUID()}.jpg`;
  return storage.upload(resized, filename);
}
