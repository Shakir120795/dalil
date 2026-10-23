import type { Metadata } from "next";
import LegalPage, { Section } from "../_legal/LegalPage";
import { LEGAL } from "@/lib/legal";
export const metadata: Metadata = { title: "Privacy Policy", description: "What data Dalil collects, why, and your choices.", alternates: { canonical: "/privacy" } };

const S: Section[] = [
  ["What we collect", [
    "Account: your email address, if you log in.",
    "Questions: the text you ask, language, a topic label, whether sources were found, and either an anonymous random ID (stored in your browser) or your account ID.",
    "Dua requests: the intention text you write, only if you use the dua service.",
    "Bookings and payments: booking details, and payment order/payment IDs and amounts. Card, UPI and bank details are handled by Razorpay; we never see or store them.",
    "On your device: an anonymous ID, language choice and azaan reminder setting in local storage.",
  ]],
  ["Location", ["Prayer times and Qibla use your device location. Your coordinates go from your browser directly to the Aladhan prayer-times API. Dalil does not store your location."]],
  ["How we use data", [
    "To show answers and sources, apply daily limits, process payments and bookings, and prevent abuse.",
    "To improve the app: we review question topics and unanswered questions in aggregate to decide which sources to add. Questions are not used to build advertising profiles, and we do not sell personal data.",
  ]],
  ["Dua intentions", ["A dua intention is shown only to the expert you choose, without your name or email. Experts are expected to keep it confidential."]],
  ["Service providers", [
    "We use Supabase (database and login), Vercel (hosting), Hugging Face (converts your question text into a search vector), Razorpay (payments), Daily.co (video calls for expert sessions) and Aladhan (prayer times).",
    "If AI summaries are enabled, your question and the retrieved source text are sent to the AI provider we configure to write the summary.",
  ]],
  ["Retention", ["Question logs are kept up to 24 months. Account data is kept until you delete your account. Payment and booking records are kept as long as the law requires."]],
  ["Your rights", [`You can ask to access, correct or delete your data by emailing ${LEGAL.email}. We respond within a reasonable time, in line with the Digital Personal Data Protection Act, 2023 and other applicable law.`]],
  ["Security", ["Data is stored with the providers above using access controls and encrypted connections. No system is perfectly secure, and we cannot guarantee absolute security."]],
  ["Children", ["Dalil is meant for users aged 18 and above. Younger users should use it with a parent or guardian."]],
  ["Changes and contact", [`We may update this policy and will change the date above. Questions: ${LEGAL.email}. Operated by ${LEGAL.owner}, ${LEGAL.city}.`]],
];
export default function Page() {
  return <LegalPage title="Privacy Policy" intro="Dalil (getdalil.app) respects your privacy. This policy explains what we collect and why." sections={S} />;
}
