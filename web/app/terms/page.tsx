import type { Metadata } from "next";
import LegalPage, { Section } from "../_legal/LegalPage";
import { LEGAL } from "@/lib/legal";
export const metadata: Metadata = { title: "Terms of Use", description: "Rules for using Dalil, including the religious disclaimer.", alternates: { canonical: "/terms" } };

const S: Section[] = [
  ["What Dalil is", ["Dalil is a search tool. You ask a question and it shows matching passages from the Quran, Hadith and other listed books, with references."]],
  ["Not a fatwa", [
    "Dalil does not issue fatwas or religious rulings. Results are retrieved text, not a ruling on your situation.",
    "Translations and search results can be incomplete, out of context or wrong. Always check the original source and ask a qualified scholar before acting on any religious matter.",
  ]],
  ["Your account and use", [
    "You are responsible for your account. Do not misuse the service: no scraping at scale, attacks, abuse, or illegal or hateful content.",
    "Free use has daily limits. We may change limits or features at any time.",
  ]],
  ["Paid plans", ["Premium is a 30-day pass bought with a one-time payment. It does not renew automatically. See the Refund Policy for refunds."]],
  ["Experts and dua requests", [
    "Experts are independent people, not employees of Dalil. Their views are their own, and Dalil does not guarantee their advice or availability.",
    "Dua requests are a service where an expert makes dua on your behalf. No outcome is promised. Dalil does not offer taweez, astrology, fortune-telling or similar services.",
  ]],
  ["Sources and content", ["Quran, Hadith and translations belong to their respective authors and publishers and are shown with attribution on the Sources page. You may not copy the database or republish it at scale."]],
  ["Liability", ["Dalil is provided as is. To the extent permitted by law, we are not liable for losses arising from your use of results, expert advice or downtime. Our total liability is limited to the amount you paid us in the last 12 months."]],
  ["Law and contact", [`These terms are governed by the laws of India, and disputes are subject to the courts at ${LEGAL.city}. Contact: ${LEGAL.email}. Operated by ${LEGAL.owner}.`]],
];
export default function Page() {
  return <LegalPage title="Terms of Use" intro="By using Dalil you agree to these terms." sections={S} />;
}
