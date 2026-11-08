import React from "react";
import { createRoot } from "react-dom/client";
import { DarSalam } from "@/components/dar-salam";
import "./styles.css";

type AndroidDiagnosticsWindow = Window & {
  AndroidDiagnostics?: { onGameError?: (message: string) => void };
};

const reportStartupError = (message: string) => {
  console.error("[Android startup]", message);
  (window as AndroidDiagnosticsWindow).AndroidDiagnostics?.onGameError?.(message);
};

window.addEventListener("error", (event) => {
  reportStartupError(
    "window.error: " + event.message + " at " + event.filename + ":" + event.lineno,
  );
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  reportStartupError(
    "unhandledrejection: " +
      (reason instanceof Error ? reason.stack || reason.message : String(reason)),
  );
});

const root = document.getElementById("root");
if (!root) throw new Error("Android game root element is missing");
createRoot(root).render(
  <React.StrictMode>
    <DarSalam />
  </React.StrictMode>,
);
