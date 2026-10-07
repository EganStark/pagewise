import { Capacitor } from "@capacitor/core";

const DEFAULT_MOBILE_API_ORIGIN = "https://pagewise-rose.vercel.app";

export function apiUrl(path: string) {
  if (!Capacitor.isNativePlatform()) return path;
  const origin = (
    process.env.NEXT_PUBLIC_PAGEWISE_API_URL || DEFAULT_MOBILE_API_ORIGIN
  ).replace(/\/$/, "");
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
