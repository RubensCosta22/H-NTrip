"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function PwaRegister() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateNetworkState = () => setOffline(!navigator.onLine);
    updateNetworkState();
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);

    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" });
    }

    return () => {
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
    };
  }, []);

  return offline ? <div className="offline-banner" role="status"><WifiOff aria-hidden="true" size={16} /> Você está offline. Dados privados não são armazenados neste dispositivo.</div> : null;
}
