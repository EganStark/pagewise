import React from "react";
import ReactDOM from "react-dom/client";
import { AuthGate } from "../app/components/AuthGate";
import { initializeDeviceDatabase } from "../app/lib/device-db";
import "../app/globals.css";

const storedTheme = localStorage.getItem("pagewise-theme") ?? "dark";
const theme =
  storedTheme === "system"
    ? window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark"
    : storedTheme;
document.documentElement.dataset.theme = theme;
document.documentElement.style.colorScheme = theme;

void initializeDeviceDatabase().catch((error: unknown) => {
  console.error("[device-db] Could not initialize the local library", error);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>,
);
