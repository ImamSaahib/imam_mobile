import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
const isPlatform = import.meta.env.DEV && (window.location.pathname === "/__platform" || window.location.pathname.startsWith("/app/"));
const isGallery = import.meta.env.DEV && window.location.pathname === "/__ui";

// Register the PWA service worker on secure origins (HTTPS / localhost).
if (!isGallery && !isPlatform && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("PWA service worker registration failed:", error);
    });
  });
}
const root = ReactDOM.createRoot(document.getElementById("root"));
if (import.meta.env.DEV && window.location.pathname === "/__ui") {
  import("./platform/ui/Gallery").then(({ default: Gallery }) => {
    root.render(<React.StrictMode><Gallery /></React.StrictMode>);
  });
} else if (isPlatform) {
  import("./platform/navigation/Runtime").then(({ default: Runtime }) => {
    const base = import.meta.env.VITE_API_BASE || "https://imam-mobile-api-dev.imamsaahib.workers.dev";
    root.render(<React.StrictMode><Runtime bootstrapUrl={base + "/api/bootstrap"} /></React.StrictMode>);
  });
} else {
  import("./styles.css").then(() => root.render(<React.StrictMode><App /></React.StrictMode>));
}
