import { sb, userFromReq } from "@/lib/server";

// User ke apne text-sawal + expert ke jawab

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await userFromReq(req);
  if (!user) return Response.json({ error: "login" }, { status: 401 });
  const { data } = await sb.from("expert_text_questions")
    .select("id,question,answer,status,created_at,answered_at,expert:experts(name)")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  return Response.json({ questions: data ?? [] });
}
