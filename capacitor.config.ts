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
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
  },
};

export default config;
