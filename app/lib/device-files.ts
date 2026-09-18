import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";

async function fileToBase64(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export async function deviceFileBlob(path: string) {
  const base64 = await readDeviceFile(path);
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const extension = path.split(".").pop()?.toLowerCase();
  const type = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return new Blob([bytes], { type });
}

export async function writeDeviceBlob(path: string, file: Blob) {
  await writeDeviceFile(path, await fileToBase64(file));
  return { path, url: await deviceFileUrl(path) };
}

export async function deviceFileUrl(path: string | null) {
  if (!path) return null;
  const result = await Filesystem.getUri({ path, directory: Directory.Data });
  return Capacitor.convertFileSrc(result.uri);
}

export async function saveDeviceImage(file: Blob, folder: "covers" | "avatars") {
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  await Filesystem.writeFile({
    path,
    directory: Directory.Data,
    data: await fileToBase64(file),
    recursive: true,
  });
  return { path, url: await deviceFileUrl(path) };
}

export async function deleteDeviceFile(path: string | null) {
  if (!path) return;
  try {
    await Filesystem.deleteFile({ path, directory: Directory.Data });
  } catch {
    // Removing a missing image is already the desired result.
  }
}

export async function readDeviceFile(path: string) {
  const result = await Filesystem.readFile({ path, directory: Directory.Data });
  return typeof result.data === "string" ? result.data : "";
}

export async function writeDeviceFile(path: string, data: string) {
  await Filesystem.writeFile({ path, data, directory: Directory.Data, recursive: true });
}
