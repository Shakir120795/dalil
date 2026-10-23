import { ImageResponse } from "next/og";
export const runtime = "edge";
export const alt = "Dalil: Quran and Hadith answers, with sources";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center",
        padding: 90, background: "linear-gradient(180deg,#0c1626,#1d3a4a)", color: "#eef2ef" }}>
        <div style={{ display: "flex", fontSize: 150, fontWeight: 700, color: "#e3c27a" }}>Dalil</div>
        <div style={{ display: "flex", fontSize: 48, marginTop: 10 }}>Every answer, with its dalil.</div>
        <div style={{ display: "flex", fontSize: 30, marginTop: 28, color: "#9fb3b0" }}>Quran and Hadith sources · getdalil.app</div>
      </div>
    ), size);
}
