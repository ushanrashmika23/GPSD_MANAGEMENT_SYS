// ── Upload rules ──────────────────────────────────────────────────────────────
// One place for what each material type accepts, shared by the bulk upload queue
// and the Materials upload modal so the two cannot drift apart.
//
// This side exists to fail fast, with a message the user can act on. It is not
// the enforcement point: the API applies the same rules
// (backend/src/utils/fileValidation.js), because anything checked only in the
// browser can be skipped by editing the request.

export type MaterialType = "DOCUMENT" | "VIDEO";

export const DOCUMENT_EXTENSIONS = ["pdf"];
export const VIDEO_EXTENSIONS = ["mp4", "mov", "m4v", "webm", "avi", "mkv"];

const MB = 1024 * 1024;
export const DOCUMENT_MAX_BYTES = 500 * MB;        // 500 MB
export const VIDEO_MAX_BYTES = 5 * 1024 * MB;      // 5 GB

export const extensionsFor = (type: MaterialType): string[] =>
  type === "VIDEO" ? VIDEO_EXTENSIONS : DOCUMENT_EXTENSIONS;

export const maxBytesFor = (type: MaterialType): number =>
  type === "VIDEO" ? VIDEO_MAX_BYTES : DOCUMENT_MAX_BYTES;

/** `accept` for <input type="file"> — extension based, matching the rules here. */
export const acceptFor = (type: MaterialType): string =>
  extensionsFor(type).map((e) => `.${e}`).join(",");

/** Human-readable limit for the type, for use in labels and errors. */
export const maxLabelFor = (type: MaterialType): string =>
  type === "VIDEO" ? "5 GB" : "500 MB";

/** Lowercased extension without the dot — "" when the name has none. */
export const extensionOf = (fileName: string): string => {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1 || lastDot === fileName.length - 1) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
};

export const formatSize = (bytes: number): string => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Checks a file against the rules for the material type it is being uploaded
 * as. Extension and size only — the MIME type a browser reports is trivially
 * spoofed and, for many valid .mkv/.avi files, simply wrong.
 */
export function validateFile(
  file: { name: string; size: number },
  type: MaterialType
): ValidationResult {
  const allowed = extensionsFor(type);
  const ext = extensionOf(file.name);

  if (!ext || !allowed.includes(ext)) {
    return {
      ok: false,
      reason:
        type === "VIDEO"
          ? `"${file.name}" is not a supported video format. Allowed: ${allowed.join(", ")}.`
          : `"${file.name}" is not a PDF. Documents must be PDF files.`,
    };
  }

  const max = maxBytesFor(type);
  if (file.size > max) {
    return {
      ok: false,
      reason: `"${file.name}" is ${formatSize(file.size)} — the limit for a ${
        type === "VIDEO" ? "video" : "document"
      } is ${maxLabelFor(type)}.`,
    };
  }

  return { ok: true };
}
