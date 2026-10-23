// Client-side 1080x1080 share card renderer (WhatsApp status ke liye)
export type ShareCardData = {
  arabic: string | null; translation: string | null; english: string; ref: string; badge: string;
  watermark?: boolean;  // false = premium (bina watermark); default true
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = []; let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderShareCard(d: ShareCardData): Promise<Blob> {
  const S = 1080;
  const cv = document.createElement("canvas"); cv.width = S; cv.height = S;
  const ctx = cv.getContext("2d")!;
  const gold = "#e3c27a", cream = "#f6ecd0";

  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, "#0e3b2c"); g.addColorStop(1, "#071f18");
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);

  // halka Islamic geometric pattern
  ctx.strokeStyle = "rgba(227,194,122,0.10)"; ctx.lineWidth = 2;
  for (let i = -1; i < 6; i++) for (let j = -1; j < 6; j++) {
    ctx.save(); ctx.translate(i * 260 + 60, j * 260 + 60); ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-72, -72, 144, 144); ctx.restore();
  }
  // kinare par gold frame
  ctx.strokeStyle = "rgba(227,194,122,0.55)"; ctx.lineWidth = 6; ctx.strokeRect(28, 28, S - 56, S - 56);

  try {
    const F = (document as Document & { fonts: FontFaceSet }).fonts;
    await F.load('700 80px Amiri'); await F.load('400 40px "Hanken Grotesk"'); await F.load('600 34px "Hanken Grotesk"');
  } catch { /* fallback fonts */ }

  ctx.textAlign = "center";
  // header
  ctx.direction = "rtl"; ctx.fillStyle = gold; ctx.font = "700 64px Amiri, serif";
  ctx.fillText("دليل", S / 2, 140);
  ctx.direction = "ltr"; ctx.font = "600 28px 'Hanken Grotesk', sans-serif";
  ctx.fillText(d.badge.toUpperCase(), S / 2, 190);
  ctx.strokeStyle = gold; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(S / 2 - 110, 218); ctx.lineTo(S / 2 + 110, 218); ctx.stroke();

  // arabic
  let y = 330;
  if (d.arabic) {
    ctx.direction = "rtl"; ctx.fillStyle = cream; ctx.font = "700 68px Amiri, serif";
    for (const ln of wrap(ctx, d.arabic, 880).slice(0, 6)) { ctx.fillText(ln, S / 2, y); y += 108; }
    y += 24;
  }
  // translation / english
  ctx.direction = "ltr"; ctx.fillStyle = "#d7e6e1"; ctx.font = "400 38px 'Hanken Grotesk', sans-serif";
  for (const ln of wrap(ctx, d.translation || d.english, 880).slice(0, 8)) { ctx.fillText(ln, S / 2, y); y += 60; }

  // ref (+ premium par watermark nahi)
  ctx.fillStyle = gold; ctx.font = "600 34px 'Hanken Grotesk', sans-serif";
  ctx.fillText(d.ref, S / 2, S - 130);
  if (d.watermark !== false) {
    ctx.fillStyle = "rgba(227,194,122,0.8)"; ctx.font = "400 30px 'Hanken Grotesk', sans-serif";
    ctx.fillText("getdalil.app", S / 2, S - 80);
  }

  return new Promise((res, rej) => cv.toBlob(b => b ? res(b) : rej(new Error("render failed")), "image/png"));
}
