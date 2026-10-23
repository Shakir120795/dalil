"use client";
import { useUiLang } from "@/lib/i18n";

export default function More() {
  const { t } = useUiLang();
  // Labels/descriptions localized; Admin + legal pages stay English (scope).
  const items: { ic: string; label: string; desc: string; href: string }[] = [
    { ic: "👤", label: t("profile_title"), desc: t("m_profile_d"), href: "/profile" },
    { ic: "🤲", label: t("dua_request"), desc: t("m_dua_d"), href: "/dua" },
    { ic: "🎓", label: t("nav_experts"), desc: t("m_experts_d"), href: "/experts" },
    { ic: "⭐", label: t("auth_premium"), desc: t("m_premium_d"), href: "/upgrade" },
    { ic: "🕌", label: t("namaz_title"), desc: t("m_namaz_d"), href: "/namaz" },
    { ic: "📿", label: t("nav_tasbih"), desc: t("m_tasbih_d"), href: "/tasbih" },
    { ic: "💰", label: t("zakat_title"), desc: t("m_zakat_d"), href: "/zakat" },
    { ic: "ℹ️", label: t("about_word"), desc: t("m_about_d"), href: "/about" },
    { ic: "📜", label: t("sources"), desc: t("m_sources_d"), href: "/attribution" },
    { ic: "👤", label: t("auth_login"), desc: t("m_login_d"), href: "/login" },
    { ic: "🛠", label: "Admin", desc: "Dashboard (admins only)", href: "/admin" },
    { ic: "🔒", label: "Privacy", desc: "Privacy policy", href: "/privacy" },
    { ic: "📄", label: "Terms", desc: "Terms of use", href: "/terms" },
    { ic: "💸", label: "Refunds", desc: "Refund policy", href: "/refund" },
  ];
  return (
    <main>
      <div className="pagehead"><h1>{t("nav_more")}</h1><p>{t("more_sub")}</p></div>
      <div className="menu">
        {items.map(it => (
          <a key={it.href} href={it.href}><span className="mi">{it.ic}</span>
            <span><b>{it.label}</b><small>{it.desc}</small></span></a>))}
      </div>
    </main>
  );
}
