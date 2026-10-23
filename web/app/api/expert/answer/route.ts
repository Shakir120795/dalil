import { sb, userFromReq } from "@/lib/server";
import { sendToUser } from "@/lib/pushSend";

// Expert apne text-sawal ka jawab deta hai

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "login" }, { status: 401 });
  const { question_id, answer } = await req.json();
  if (typeof answer !== "string" || answer.trim().length < 5 || answer.length > 2000)
    return Response.json({ error: "Please write your answer in 5 to 2,000 characters." }, { status: 400 });
  const { data: ids } = await sb.from("experts").select("id").eq("user_id", user.id);
  const { data } = await sb.from("expert_text_questions")
    .update({ answer: answer.trim(), status: "answered", answered_at: new Date().toISOString() })
    .eq("id", question_id).eq("status", "open")
    .in("expert_id", (ids ?? []).map(e => e.id as string)).select("id,user_id,question");
  if (!data?.length) return Response.json({ error: "The update couldn't be saved." }, { status: 400 });
  // Push: sawal poochne wale ko khabar (fail ho to bhi jawab save ho chuka hai)
  const q = data[0] as { user_id: string | null; question: string };
  if (q.user_id) await sendToUser(q.user_id, "expert", {
    title: "Your question was answered",
    body: q.question.length > 90 ? q.question.slice(0, 87).trimEnd() + "…" : q.question,
    url: "/experts",
  });
  return Response.json({ ok: true });
}
