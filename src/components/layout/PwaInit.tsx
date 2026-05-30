"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export function PwaInit() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        // Force-check for an updated SW on every page load so stale caches
        // are cleared immediately after a new build is deployed.
        reg.update().catch(console.error);

        // When a new SW finishes installing, skip waiting so it activates
        // right away (clearing old chunk caches) without waiting for a full
        // browser restart.
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      }).catch(console.error);

      // When the SW controller changes (new SW took over), reload so the
      // browser picks up fresh chunks right away.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }

    // Show iOS install hint (only on iOS Safari, not in standalone mode)
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isInStandalone = ("standalone" in navigator) && (navigator as { standalone?: boolean }).standalone;
    const dismissed = sessionStorage.getItem("ios-banner-dismissed");
    if (isIos && !isInStandalone && !dismissed) {
      setShowBanner(true);
    }
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 z-50 max-w-sm mx-auto bg-foreground text-background rounded-2xl shadow-2xl p-4 flex items-start gap-3">
      <div className="flex-1 text-sm">
        <p className="font-semibold mb-0.5">Install FinanceApp</p>
        <p className="text-xs opacity-80">
          Tap the <strong>Share</strong> button
          {" "}(<svg className="inline w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v6.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 9.586V3a1 1 0 011-1z"/><path d="M3 15a2 2 0 012-2h10a2 2 0 012 2v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1z"/></svg>)
          {" "}then <strong>Add to Home Screen</strong>.
        </p>
      </div>
      <button
        onClick={() => { setShowBanner(false); sessionStorage.setItem("ios-banner-dismissed", "1"); }}
        className="opacity-60 hover:opacity-100 mt-0.5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
