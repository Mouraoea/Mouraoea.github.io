import { gunzipSync, gzipSync } from "node:zlib";
import {
  COMPRESSION_HEADER,
  formatCompressedFile,
  stripCommentLines,
} from "./compression.shared.ts";

export { COMPRESSION_HEADER, formatCompressedFile, stripCommentLines };

export function compressJsonToText(data: unknown): string {
  const raw = Buffer.from(JSON.stringify(data), "utf-8");
  return gzipSync(raw).toString("base64");
}

export function decompressTextToJson<T>(text: string): T {
  const payload = stripCommentLines(text);
  const raw = gunzipSync(Buffer.from(payload, "base64"));
  return JSON.parse(raw.toString("utf-8")) as T;
}
