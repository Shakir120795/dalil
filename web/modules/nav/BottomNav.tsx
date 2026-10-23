"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authFetch } from "@/lib/client";
import { useUiLang, type StrKey } from "@/lib/i18n";

const TABS: { href: string; key: StrKey; icon: string }[] = [
  { href: "/", key: "nav_chat", icon: "💬" },
  { href: "/namaz", key: "nav_namaz", icon: "🕌" },
  { href: "/tasbih", key: "nav_tasbih", icon: "📿" },
  { href: "/experts", key: "nav_experts", icon: "🎓" },
  { href: "/more", key: "nav_more", icon: "☰" },
];

export default function BottomNav() {
  const p = usePathname();
  const { t } = useUiLang();
  const [unread, setUnread] = useState(false);
  useEffect(() => {
    authFetch("/api/experts/questions").then(r => r.ok ? r.json() : null).then(j => {
      if (!j?.questions?.length) return setUnread(false);
      const seen = Number(localStorage.getItem("etq_seen") || 0);
      setUnread(j.questions.some((x: any) => x.status === "answered" && new Date(x.answered_at).getTime() > seen));
    }).catch(() => {});
  }, [p]);
  return (
    <nav className="bottomnav" aria-label="Main">
      <div className="bn-in">
        {TABS.map(tab => (
          <Link key={tab.href} href={tab.href} className={"bn-tab" + (p === tab.href ? " on" : "")}>
            <span className="bn-ic">{tab.icon}{tab.href === "/experts" && unread && <i className="dot" />}</span>
            <small>{t(tab.key)}</small>
          </Link>
        ))}
      </div>
    </nav>
  );
}
