import type { Metadata } from "next";
import LegalPage, { Section } from "../_legal/LegalPage";
import { LEGAL } from "@/lib/legal";
export const metadata: Metadata = { title: "Refund and Cancellation Policy", description: "When Dalil refunds payments for Premium, expert sessions and dua requests.", alternates: { canonical: "/refund" } };

const S: Section[] = [
  ["Premium", [
    "Premium is a 30-day pass with no automatic renewal, so there is nothing to cancel.",
    `If a payment succeeded but Premium was not activated, we fix it or refund you. Other refund requests made within 7 days of purchase are reviewed case by case. Email ${LEGAL.email}.`,
  ]],
  ["Expert sessions", [
    "Full refund if the expert does not attend, or the session cannot happen because of a problem on our side.",
    "Cancel at least 24 hours before the session for a full refund. Later cancellations are not refunded, but we may offer a reschedule.",
  ]],
  ["Dua requests", ["Full refund if the expert has not marked the dua as done within 7 days of payment."]],
  ["How refunds are paid", ["Approved refunds go back to the original payment method through Razorpay, usually within 5 to 7 working days."]],
  ["How to ask", [`Email ${LEGAL.email} with your account email and the payment ID or booking time.`]],
];
export default function Page() {
  return <LegalPage title="Refund and Cancellation Policy" intro="This explains when Dalil refunds payments." sections={S} />;
}
