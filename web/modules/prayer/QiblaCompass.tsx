"use client";
import { useEffect, useState } from "react";
import { useUiLang } from "@/lib/i18n";

export function qiblaBearing(lat: number, lng: number) {
  const r = Math.PI / 180, k = 21.4225 * r, g = 39.8262 * r, l = lat * r, d = g - lng * r;
  return (Math.atan2(Math.sin(d) * Math.cos(k), Math.cos(l) * Math.sin(k) - Math.sin(l) * Math.cos(k) * Math.cos(d)) / r + 360) % 360;
}

export default function QiblaCompass({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useUiLang();
  const bearing = qiblaBearing(lat, lng);
  const [heading, setHeading] = useState<number | null>(null);
  const [needsPerm, setNeedsPerm] = useState(false);

  function listen() {
    const h = (e: any) => {
      if (typeof e.webkitCompassHeading === "number") setHeading(e.webkitCompassHeading);      // iOS
      else if (e.absolute && e.alpha != null) setHeading((360 - e.alpha) % 360);               // Android
    };
    window.addEventListener("deviceorientationabsolute" as any, h, true);
    window.addEventListener("deviceorientation", h, true);
  }
  async function enable() {
    const D: any = DeviceOrientationEvent;
    if (typeof D.requestPermission === "function") { if ((await D.requestPermission()) !== "granted") return; }
    setNeedsPerm(false); listen();
  }
  useEffect(() => {
    const D: any = typeof DeviceOrientationEvent !== "undefined" ? DeviceOrientationEvent : null;
    if (D && typeof D.requestPermission === "function") setNeedsPerm(true); else if (D) listen();
  }, []);

  const rot = heading == null ? bearing : (bearing - heading + 360) % 360;
  return (
    <div className="qibla">
      <svg viewBox="0 0 100 100" style={{ transform: `rotate(${rot}deg)` }} role="img" aria-label="Qibla direction">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" />
        <path d="M50 8 L60 52 L50 46 L40 52 Z" fill="#e3c27a" />
      </svg>
      <div>{t("qibla_line", { deg: Math.round(bearing) })}{heading == null ? "  · " + t("qibla_no_sensor") : ""}</div>
      {needsPerm && <button onClick={enable}>{t("enable_compass")}</button>}
    </div>
  );
}
