"use client";

import { useState } from "react";

// Owner-only panel: send a custom notification to every user (bell + push).
export function BroadcastPanel() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!message.trim()) {
      setError("Mesaj boş ola bilməz.");
      return;
    }
    if (!window.confirm("Bu bildiriş bütün istifadəçilərə göndərilsin?")) return;

    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body: message }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Göndərilmədi.");
        return;
      }
      setMsg(`${json.sent} istifadəçiyə göndərildi.`);
      setTitle("");
      setMessage("");
    } catch {
      setError("Göndərilmədi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-black/6 bg-white/90 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2F61D8]">
        İdarəetmə · Elan (hamıya)
      </p>
      <p className="mt-1 text-[12px] text-black/45">
        Bütün istifadəçilərə xüsusi bildiriş göndər.
      </p>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Başlıq (istəyə bağlı — default: Elan)"
        maxLength={80}
        className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#2F61D8]"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Mesaj..."
        rows={3}
        maxLength={500}
        className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#2F61D8]"
      />

      {msg && <div className="mt-2 text-xs text-[#128342]">{msg}</div>}
      {error && <div className="mt-2 text-xs text-[#c74252]">{error}</div>}

      <button
        onClick={send}
        disabled={busy || !message.trim()}
        className="mt-3 rounded-full bg-[#2F61D8] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-[#2854be] disabled:opacity-50"
      >
        {busy ? "Göndərilir..." : "Hamıya göndər"}
      </button>
    </section>
  );
}
