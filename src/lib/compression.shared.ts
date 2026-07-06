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

/** Detect SPA fallbacks or other non-archive responses before decompression. */
export function isArchiveFileContent(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed) return false;
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) return false;
  return trimmed.startsWith(COMPRESSION_HEADER);
}
