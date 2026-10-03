"use client";
import { useEffect, useState } from "react";
import App from "../src/App";
export default function Workspace() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? (
    <App />
  ) : (
    <main className="welcome-shell">
      <p role="status">Opening your private workspace…</p>
    </main>
  );
}
