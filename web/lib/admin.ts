import { userFromReq } from "./server";
export async function adminFromReq(req: Request) {
  const u = await userFromReq(req);
  const list = (process.env.ADMIN_EMAILS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  return u && u.email && list.includes(u.email.toLowerCase()) ? u : null;
}
