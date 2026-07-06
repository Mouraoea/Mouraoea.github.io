export const COMPRESSION_HEADER = "# idleclans-market v1 gzip+base64";

export function stripCommentLines(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .join("\n");
}

export function formatCompressedFile(payload: string): string {
  return `${COMPRESSION_HEADER}\n${payload}`;
}
