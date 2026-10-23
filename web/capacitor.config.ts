import type { CapacitorConfig } from "@capacitor/cli";
// Deploy ke baad APP_URL me apna Vercel URL daalo. App wahi live site load karta hai.
const config: CapacitorConfig = {
  appId: "app.getdalil", appName: "Dalil", webDir: "cap-www",
  server: { url: process.env.APP_URL || "https://YOUR-APP.vercel.app", androidScheme: "https" },
};
export default config;
