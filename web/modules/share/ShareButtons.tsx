"use client";
import { useState } from "react";
import { renderShareCard, type ShareCardData } from "@/lib/shareCard";
import { authFetch } from "@/lib/client";
import { useUiLang } from "@/lib/i18n";

// Premium ho to share card bina watermark ke — plan ek hi baar poochho (module cache)
let premiumP: Promise<boolean> | null = null;
function isPremiumUser(): Promise<boolean> {
  if (!premiumP) premiumP = authFetch("/api/subscribe/status").then(r => r.json())
    .then(j => !!j?.loggedIn && j.plan_code !== "free").catch(() => false);
  return premiumP;
}

export default function ShareButtons({ card }: { card: ShareCardData }) {
  const { t } = useUiLang();
  const [busy, setBusy] = useState(false);
  async function make(): Promise<Blob | null> {
    setBusy(true);
    try { return await renderShareCard({ ...card, watermark: !(await isPremiumUser()) }); }
    catch { return null; } finally { setBusy(false); }
  }
  async function download() {
    const b = await make(); if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `dalil-${card.ref.replace(/[^a-z0-9]+/gi, "-")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function share() {
    const b = await make(); if (!b) return;
    const file = new File([b], "dalil.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "Dalil" }); return; }
    } catch (e) { if ((e as Error)?.name === "AbortError") return; }
    download();  // share na ho to download fallback
  }
  return (
    <div className="sharebtns">
      <button type="button" onClick={download} disabled={busy} aria-label={t("download_image_aria")}>⤓ {t("share_image")}</button>
      <button type="button" onClick={share} disabled={busy} aria-label={t("share_image_aria")}>↗ {t("share_share")}</button>
    </div>
  );
}
