import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// No StrictMode: it double-mounts effects in dev, which would build the WebGL scene twice.
createRoot(document.getElementById("root")).render(<App />);
