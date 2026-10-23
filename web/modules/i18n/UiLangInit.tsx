"use client";
import { useUiLang } from "@/lib/i18n";

// Sets <html lang/dir> from the saved language prefs on mount (Urdu/Arabic
// switch the whole layout to RTL). Pages render their own strings via
// useUiLang(); this only handles the document attributes for the shell.
export default function UiLangInit() {
  useUiLang();
  return null;
}
