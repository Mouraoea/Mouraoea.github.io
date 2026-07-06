import { stripCommentLines } from "./compression.shared.ts";

function base64ToUint8Array(base64: string): Uint8Array {
  const normalized = base64.replace(/\s/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("Archive file is missing or corrupted.");
  }

  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new Error("Archive file is missing or corrupted.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function decompressTextToJson<T>(text: string): Promise<T> {
  const payload = stripCommentLines(text);
  const compressed = base64ToUint8Array(payload);
  const stream = new Blob([toArrayBuffer(compressed)])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const json = await new Response(stream).text();
  return JSON.parse(json) as T;
}
