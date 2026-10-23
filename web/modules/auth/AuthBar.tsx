"use client";
import { useEffect, useState } from "react";
import { sbc } from "@/lib/client";
import { useUiLang } from "@/lib/i18n";

export default function AuthBar() {
  const { t } = useUiLang();
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    sbc.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data } = sbc.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  return (
    <nav className="authbar">
      <a href="/experts">{t("nav_experts")}</a><a href="/dua">{t("auth_dua")}</a><a href="/upgrade">{t("auth_premium")}</a>
      {email ? <button onClick={() => sbc.auth.signOut()}>{t("auth_logout")} ({email.split("@")[0]})</button> : <a href="/login">{t("auth_login")}</a>}
    </nav>
  );
}
