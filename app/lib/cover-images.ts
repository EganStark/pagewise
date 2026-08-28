const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1800;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export function validateCoverFile(file: File) {
  if (!ACCEPTED_TYPES.has(file.type))
    return "Choose a JPEG, PNG, WebP, or AVIF image.";
  if (file.size > MAX_SOURCE_BYTES)
    return "Cover images must be 10 MB or smaller before compression.";
  return null;
}

export async function compressCoverImage(file: File): Promise<Blob> {
  const validationError = validateCoverFile(file);
  if (validationError) throw new Error(validationError);

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_WIDTH / bitmap.width,
    MAX_HEIGHT / bitmap.height,
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error("This browser could not prepare the cover image.");
  }
  context.fillStyle = "#14161A";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.84),
  );
  if (!blob) throw new Error("The cover image could not be compressed.");
  if (blob.size > 5 * 1024 * 1024)
    throw new Error(
      "The compressed cover is still larger than 5 MB. Choose a smaller image.",
    );
  return blob;
}

export function normalizeIsbn(value: string | null | undefined) {
  return (value ?? "").replace(/[^0-9X]/gi, "").toUpperCase();
}

export function normalizeBookText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, " ")
    .trim();
}
