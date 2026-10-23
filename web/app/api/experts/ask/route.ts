import { sb, userFromReq, flag, planOf } from "@/lib/server";

// Logged-in user verified/active expert se likh ke sawal poochta hai (async)
// Quota: free = 1 sawal/mahina, premium/trial = 10/mahina

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });
  if (!(await flag("experts"))) return Response.json({ error: "The expert service is currently unavailable." }, { status: 403 });
  const { expert_id, question } = await req.json();
  if (typeof question !== "string" || question.trim().length < 5 || question.length > 1000)
    return Response.json({ error: "Please write your question in 5 to 1,000 characters." }, { status: 400 });
  const { data: ex } = await sb.from("experts").select("id").eq("id", expert_id).eq("verified", true).eq("active", true).single();
  if (!ex) return Response.json({ error: "This expert isn't available." }, { status: 404 });
  const plan = await planOf(user.id);
  const premium = !!plan && plan.code !== "free";
  const quota = premium ? 10 : 1;
  const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await sb.from("expert_text_questions").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", monthStart.toISOString());
  if ((count ?? 0) >= quota) return Response.json({
    error: premium ? `You have used all ${quota} of this month's expert questions. Please try again next month.`
      : "The free plan includes 1 expert question a month. Get Premium for 10 questions a month.", upgrade: !premium },
    { status: 402 });
  const { error } = await sb.from("expert_text_questions")
    .insert({ user_id: user.id, expert_id: ex.id, question: question.trim() });
  if (error) return Response.json({ error: "Your question couldn't be sent." }, { status: 500 });
  return Response.json({ ok: true });
}
