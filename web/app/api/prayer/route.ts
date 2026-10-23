export const dynamic = "force-dynamic";
// Browser se seedha Aladhan call fail ho sakta hai (blocker/network), isliye server se.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat")), lng = Number(u.searchParams.get("lng"));
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return Response.json({ error: "bad" }, { status: 400 });
  // Optional calculation prefs (user profile / region detection); defaults keep the old behaviour.
  const mRaw = parseInt(u.searchParams.get("method") ?? "", 10);
  const method = Number.isFinite(mRaw) ? Math.min(24, Math.max(0, mRaw)) : 1;
  const sRaw = parseInt(u.searchParams.get("school") ?? "", 10);
  const school = sRaw === 0 || sRaw === 1 ? sRaw : 1;
  try {
    const r = await fetch(`https://api.aladhan.com/v1/timings/${Math.floor(Date.now() / 1000)}?latitude=${lat}&longitude=${lng}&method=${method}&school=${school}`,
      { signal: AbortSignal.timeout(8000) });
    return r.ok ? Response.json(await r.json()) : Response.json({ error: "upstream" }, { status: 502 });
  } catch { return Response.json({ error: "upstream" }, { status: 502 }); }
}
