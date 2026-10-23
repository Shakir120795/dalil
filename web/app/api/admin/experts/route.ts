import { sb } from "@/lib/server";
import { adminFromReq } from "@/lib/admin";


export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await adminFromReq(req))) return Response.json({ error: "forbidden" }, { status: 403 });
  const { data } = await sb.from("experts").select("id,name,credential,verified,active,price_inr,dua_price_inr").order("name");
  return Response.json({ experts: data });
}
export async function POST(req: Request) {
  if (!(await adminFromReq(req))) return Response.json({ error: "forbidden" }, { status: 403 });
  const { id, verified, active } = await req.json();
  await sb.from("experts").update({ verified: !!verified, active: !!active }).eq("id", id);
  return Response.json({ ok: true });
}
