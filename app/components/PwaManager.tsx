"use client";

import {
  Download,
  RefreshCw,
  Share,
  Smartphone,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pagewise-install-dismissed-v1";

function installSuggestionDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberInstallDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Storage can be unavailable in private or restricted browsing contexts.
  }
}

export function PwaManager() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(
    null,
  );
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [offline, setOffline] = useState(false);
  const [serviceWorkerError, setServiceWorkerError] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const wasOffline = useRef(false);
  const reconnectTimer = useRef<number | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const initialStatus = window.setTimeout(() => {
      const startsOffline = !navigator.onLine;
      setOffline(startsOffline);
      wasOffline.current = startsOffline;
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      const ios =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setIsIos(ios);
      if (!standalone && ios && !installSuggestionDismissed())
        setShowInstall(true);
      const action = new URLSearchParams(window.location.search).get("action");
      if (action === "add-book" || action === "quick-log") {
        window.dispatchEvent(
          new CustomEvent("pagewise-shortcut", { detail: action }),
        );
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 150);
    const online = () => {
      setOffline(false);
      if (!wasOffline.current) return;
      wasOffline.current = false;
      setReconnected(true);
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      reconnectTimer.current = window.setTimeout(
        () => setReconnected(false),
        3500,
      );
    };
    const offlineNow = () => {
      wasOffline.current = true;
      setReconnected(false);
      setOffline(true);
    };
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      if (!installSuggestionDismissed()) setShowInstall(true);
    };
    const installed = () => {
      setShowInstall(false);
      setInstallPrompt(null);
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offlineNow);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          setServiceWorkerError(false);
          if (registration.waiting) setWaitingWorker(registration.waiting);
          registration.addEventListener("updatefound", () => {
            const worker = registration.installing;
            worker?.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setWaitingWorker(worker);
            });
          });
          void registration.update();
        })
        .catch(() => setServiceWorkerError(true));
    }
    return () => {
      window.clearTimeout(initialStatus);
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offlineNow);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  function dismissInstall() {
    rememberInstallDismissal();
    setShowInstall(false);
    setShowIosGuide(false);
  }

  async function install() {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setShowInstall(false);
    setInstallPrompt(null);
  }

  function update() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
  }

  return (
    <>
      {offline && (
        <div className="connection-banner" role="status">
          <WifiOff size={14} />
          You’re offline. Reading changes are unavailable until you reconnect.
        </div>
      )}
      {reconnected && (
        <div className="connection-banner connection-restored" role="status">
          <Wifi size={14} />
          Connection restored. Pagewise is ready to sync again.
        </div>
      )}
      {serviceWorkerError && !offline ? (
        <div className="connection-banner" role="status">
          <WifiOff size={14} />
          Install and offline support are temporarily unavailable. Pagewise
          still works in this browser.
        </div>
      ) : null}
      {showInstall && (
        <aside className="install-card" aria-label="Install Pagewise">
          <span className="install-icon">
            <Smartphone size={19} />
          </span>
          <div>
            <strong>Keep Pagewise close</strong>
            <small>
              {isIos
                ? "Add it to your Home Screen."
                : "Install the app on this device."}
            </small>
          </div>
          <button onClick={() => void install()}>
            <Download size={14} />
            Install
          </button>
          <button
            className="icon-button"
            aria-label="Dismiss install suggestion"
            onClick={dismissInstall}
          >
            <X size={15} />
          </button>
        </aside>
      )}
      {showIosGuide && (
        <div
          className="install-guide-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
        >
          <div className="install-guide">
            <span>
              <Share size={22} />
            </span>
            <p className="eyebrow">iPhone and iPad</p>
            <h2 id="ios-install-title">Add Pagewise to your Home Screen</h2>
            <ol>
              <li>Open this page in Safari.</li>
              <li>
                Tap the <strong>Share</strong> button.
              </li>
              <li>
                Choose <strong>Add to Home Screen</strong>, then tap Add.
              </li>
            </ol>
            <button className="button button-primary" onClick={dismissInstall}>
              Got it
            </button>
          </div>
        </div>
      )}
      {waitingWorker && (
        <div className="pwa-update" role="status">
          <RefreshCw size={16} />
          <span>
            <strong>Pagewise update ready</strong>
            <small>Refresh when you’re ready.</small>
          </span>
          <button onClick={update}>Update</button>
          <button
            className="icon-button"
            aria-label="Dismiss update"
            onClick={() => setWaitingWorker(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
