"use client";
import { useCallback, useEffect, useState } from "react";
import { getPrefs } from "@/lib/region";

export const PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export type PTime = Record<string, string>;

export function usePrayerTimes() {
  const [times, setTimes] = useState<PTime | null>(null);
  const [hijri, setHijri] = useState(""); const [ramadan, setRamadan] = useState(false);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [err, setErr] = useState(""); const [now, setNow] = useState(() => new Date());

  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);

  const load = useCallback(() => {
    setErr("");
    if (!navigator.geolocation) { setErr("Location isn't supported on this device."); return; }
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        let mp = "";
        try { const p = getPrefs(); mp = `&method=${p.prayerMethod}&school=${p.prayerSchool}`; } catch { /* defaults */ }
        const r = await fetch(`/api/prayer?lat=${coords.latitude}&lng=${coords.longitude}${mp}`);
        if (!r.ok) throw new Error("API " + r.status);
        const d = (await r.json()).data;
        setPos({ lat: coords.latitude, lng: coords.longitude });
        setTimes(d.timings); setRamadan(Number(d.date.hijri.month.number) === 9);
        setHijri(`${d.date.hijri.day} ${d.date.hijri.month.en} ${d.date.hijri.year} AH`);
      } catch (e) { setErr(`Could not load prayer times (${(e as Error).message}).`); }
    }, () => setErr("Please allow location access to see prayer times."), { timeout: 10000 });
  }, []);

  useEffect(() => { load(); }, [load]);
  return { times, hijri, ramadan, pos, err, now, reload: load };
}
