import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.eganstark.pagewise",
  appName: "Pagewise",
  webDir: "mobile-dist",
  server: {
    androidScheme: "https",
  },
  android: {
    backgroundColor: "#1c1917",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
      hidden: false,
      animation: "NONE",
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
