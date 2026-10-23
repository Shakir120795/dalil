const ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
let timers: ReturnType<typeof setTimeout>[] = [];
const at = (hm: string) => { const d = new Date(); const [h, m] = hm.slice(0, 5).split(":").map(Number); d.setHours(h, m, 0, 0); return d; };

// Native (Capacitor) me phone band hone par bhi chalta hai; web me sirf jab tab khula ho.
// Abhi sirf aaj ki bachi namaz schedule hoti hain; app khulne par dobara schedule hoti hain.
export async function scheduleAzaan(times: Record<string, string>, on: boolean) {
  timers.forEach(clearTimeout); timers = [];
  const list = ORDER.map((n, i) => ({ n, id: i + 1, when: at(times[n]) }));
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: list.map(x => ({ id: x.id })) });
      if (!on) return;
      if ((await LocalNotifications.requestPermissions()).display !== "granted") return;
      await LocalNotifications.schedule({ notifications: list.filter(x => x.when > new Date()).map(x => ({
        id: x.id, title: `${x.n} time`, body: "It's time for prayer.",
        schedule: { at: x.when, allowWhileIdle: true } })) });
      return;
    }
  } catch { /* web fallback */ }
  if (!on || typeof Notification === "undefined") return;
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission !== "granted") return;
  list.filter(x => x.when > new Date()).forEach(x =>
    timers.push(setTimeout(() => new Notification(`${x.n} time`, { body: "It's time for prayer." }), +x.when - Date.now())));
}
