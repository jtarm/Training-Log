import React from "react";
import ReactDOM from "react-dom/client";
import WorkoutTracker from "./App.jsx";

// Polyfill window.storage (originally Claude's artifact storage API) using
// the browser's built-in localStorage, so the app works as a normal website.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const value = localStorage.getItem(key);
      if (value === null) throw new Error("Key not found: " + key);
      return { key, value, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix) {
      const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WorkoutTracker />
  </React.StrictMode>
);
