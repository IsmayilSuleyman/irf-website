"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-[0.22em] text-black/45">
          E-poçt
        </label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-b border-[rgba(22,163,74,0.28)] bg-transparent px-0 py-2 text-black outline-none transition focus:border-brand-green"
          placeholder="ad@example.com"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] uppercase tracking-[0.22em] text-black/45">
          Şifrə
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border-b border-[rgba(22,163,74,0.28)] bg-transparent px-0 py-2 text-black outline-none transition focus:border-brand-green"
          placeholder="••••••••"
        />
      </div>

      {error && <div className="text-xs text-brand-red">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 rounded-xl bg-brand-green px-4 py-3 text-sm font-medium uppercase tracking-[0.18em] text-white shadow-glass-green transition hover:-translate-y-0.5 hover:bg-brand-green-soft disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {loading ? "Daxil olunur…" : "Daxil ol"}
      </button>
    </motion.form>
  );
}
