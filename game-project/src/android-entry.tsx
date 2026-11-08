import React from "react";
import { createRoot } from "react-dom/client";
import { DarSalam } from "@/components/dar-salam";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Android game root element is missing");
createRoot(root).render(
  <React.StrictMode>
    <DarSalam />
  </React.StrictMode>,
);
