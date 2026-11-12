import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
const isGallery = import.meta.env.DEV && window.location.pathname === "/__ui";

// Register the PWA service worker on secure origins (HTTPS / localhost).
if (!isGallery && "serviceWorker" in navigator) {
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
} else {
  import("./styles.css").then(() => root.render(<React.StrictMode><App /></React.StrictMode>));
}
