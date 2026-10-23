"use client";
import { useState } from "react";
import { sbc } from "@/lib/client";
import { useUiLang } from "@/lib/i18n";

export default function Login() {
  const { t } = useUiLang();
  const [email, setEmail] = useState(""); const [msg, setMsg] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sbc.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
    setMsg(error ? t("login_err") : t("login_sent"));
  }
  return (
    <main>
      <h1>{t("login_title")}</h1><p className="sub">{t("login_sub")}</p>
      <form onSubmit={go} style={{ position: "static", padding: 0 }}><div className="row">
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t("email_word")} aria-label={t("email_word")} />
        <button>{t("send_link")}</button></div></form>
      {msg && <p className="note">{msg}</p>}<p className="note"><a href="/">{t("back_chat")}</a></p>
    </main>
  );
}
