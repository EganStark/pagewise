import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PwaManager } from "./components/PwaManager";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const themeBootstrap = `(() => { try { const preference = localStorage.getItem("pagewise-theme") || "dark"; const resolved = preference === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : preference; document.documentElement.dataset.theme = resolved; document.documentElement.style.colorScheme = resolved; const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.content = resolved === "light" ? "#f4efe6" : "#151514"; } catch {} })();`;

export const metadata: Metadata = {
  title: { default: "Pagewise", template: "%s · Pagewise" },
  description: "Your private reading library, journal, and progress tracker.",
  applicationName: "Pagewise",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pagewise",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
    ],
    shortcut: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#14161A",
  colorScheme: "dark light",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <PwaManager />
        {children}
      </body>
    </html>
  );
}
