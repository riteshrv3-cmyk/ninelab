import { createRoot } from "react-dom/client";
import { installPolyfills } from "./lib/polyfills";
import App from "./App";
import "./index.css";

installPolyfills();

createRoot(document.getElementById("root")!).render(<App />);
