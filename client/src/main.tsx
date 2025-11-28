// CRITICAL: Import polyfill FIRST to fix __publicField error
import "./lib/polyfills/publicField";

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
