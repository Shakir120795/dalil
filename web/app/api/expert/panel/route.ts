import { sb, userFromReq } from "@/lib/server";
import { sendToUser } from "@/lib/pushSend";

async function myExpertIds(uid: string) {
  const { data } = await sb.from("experts").select("id").eq("user_id", uid);
  return (data ?? []).map(e => e.id as string);
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await userFromReq(req); if (!user) return Response.json({ error: "login" }, { status: 401 });
  const ids = await myExpertIds(user.id);
  if (!ids.length) return Response.json({ error: "You aren't registered as an expert." }, { status: 403 });
  // user ki pehchaan expert ko nahi dikhti: sirf type, time aur (dua ke liye) niyyat
  const { data } = await sb.from("bookings").select("id,type,status,scheduled_at,notes,meeting_url,amount_inr,completed_at")
    .in("expert_id", ids).in("status", ["paid", "completed"]).order("created_at", { ascending: false });
  const { data: textQuestions } = await sb.from("expert_text_questions")
    .select("id,question,answer,status,created_at,answered_at")
    .in("expert_id", ids).order("created_at", { ascending: false }).limit(50);
  return Response.json({ bookings: data, textQuestions: textQuestions ?? [] });
}
export async function POST(req: Request) {  // "dua kar di / session ho gaya" confirmation
  const user = await userFromReq(req); if (!user) return Response.json({ error: "login" }, { status: 401 });
  const { booking_id } = await req.json();
  const { data } = await sb.from("bookings").update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", booking_id).eq("status", "paid").in("expert_id", await myExpertIds(user.id)).select("id,type,user_id");
  if (!data?.length) return Response.json({ error: "The update couldn't be saved." }, { status: 400 });
  // Push: dua request poori hui to requester ko khabar (user_id expert ko response me nahi jata)
  const b = data[0] as { type: string; user_id: string | null };
  if (b.type === "dua_request" && b.user_id) await sendToUser(b.user_id, "dua", {
    title: "Your dua has been made",
    body: "An expert made dua for your request.",
    url: "/dua",
  });
  return Response.json({ ok: true });
}
