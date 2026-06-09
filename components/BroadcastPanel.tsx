"use client";

import { useState } from "react";

// Owner-only panel: send a custom notification either to everyone or to one
// specific shareholder (bell + push).
export function BroadcastPanel({ recipients }: { recipients: string[] }) {
  const [target, setTarget] = useState(""); // "" = everyone
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
    const toAll = target === "";
    if (toAll && !window.confirm("Bu bildiriş BÜTÜN istifadəçilərə göndərilsin?")) {
      return;
    }

    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holderName: toAll ? undefined : target,
          title,
          body: message,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Göndərilmədi.");
        return;
      }
      setMsg(toAll ? `${json.sent} istifadəçiyə göndərildi.` : `Göndərildi: ${target}.`);
      setTitle("");
      setMessage("");
    } catch {
      setError("Göndərilmədi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-black/8 bg-white/90 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bank-blue">
        İdarəetmə · Bildiriş göndər
      </p>
      <p className="mt-1 text-[12px] text-black/45">
        Hamıya və ya bir şəxsə xüsusi bildiriş göndər.
      </p>

      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        className="mt-3 w-full rounded-xl border border-black/12 bg-white px-3 py-2 text-sm outline-none transition focus:border-bank-blue"
      >
        <option value="">Hamıya (bütün istifadəçilər)</option>
        {recipients.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Başlıq (istəyə bağlı — default: Elan)"
        maxLength={80}
        className="mt-2 w-full rounded-xl border border-black/12 bg-white px-3 py-2 text-sm outline-none transition focus:border-bank-blue"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Mesaj..."
        rows={3}
        maxLength={500}
        className="mt-2 w-full resize-y rounded-xl border border-black/12 bg-white px-3 py-2 text-sm outline-none transition focus:border-bank-blue"
      />

      {msg && <div className="mt-2 text-xs text-brand-green-deep">{msg}</div>}
      {error && <div className="mt-2 text-xs text-status-late">{error}</div>}

      <button
        onClick={send}
        disabled={busy || !message.trim()}
        className="mt-3 rounded-full bg-bank-blue px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-bank-blue-deep disabled:opacity-50"
      >
        {busy ? "Göndərilir..." : target === "" ? "Hamıya göndər" : "Göndər"}
      </button>
    </section>
  );
}
