import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
import { vessieCore } from "../VessieAI-Core/index";
import { vessieTabs } from "../VessieAI-Core/tabs";

// Runtime bridge for the existing UI and future modules.
if (typeof window !== "undefined") {
  (window as any).__VESSIE_CORE__ = vessieCore;
  (window as any).__VESSIE_TABS__ = vessieTabs;
}

createRoot(document.getElementById("root")!).render(<App />);
