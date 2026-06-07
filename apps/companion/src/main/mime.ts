export const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export const ASSET_MIME_BY_EXT: Record<string, string> = {
  ".skel": "application/octet-stream",
  ".atlas": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
};

export const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function mimeFromExtension(
  ext: string,
  map: Record<string, string>,
  fallback = "application/octet-stream",
): string {
  return map[ext.toLowerCase()] ?? fallback;
}
