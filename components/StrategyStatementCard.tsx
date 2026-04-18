"use client";

import { useState, useTransition } from "react";
import { saveStrategyStatement } from "@/app/dashboard/strategy-actions";

export function StrategyStatementCard({
  initialValue,
  canEdit,
}: {
  initialValue: string;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  const hasValue = value.trim().length > 0;
  const showContent = canEdit || expanded;

  function onCancel() {
    setDraft(value);
    setEditing(false);
    setError(null);
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const result = await saveStrategyStatement(draft);
      if (!result.ok) {
        setError(result.error ?? "Xəta baş verdi.");
        return;
      }
      setValue(draft);
      setEditing(false);
    });
  }

  return (
    <div className="glass p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-brand-green/80">
          Fondumuzun strategiyası haqqında bəyanat
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-[11px] uppercase tracking-[0.18em] text-brand-green hover:text-brand-green-deep transition-colors"
          >
            {hasValue ? "Redaktə et" : "Yaz"}
          </button>
        )}
        {!canEdit && hasValue && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] uppercase tracking-[0.18em] text-brand-green hover:text-brand-green-deep transition-colors"
          >
            {expanded ? "Gizlət" : "Göstər"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder="Növbəti hərəkətləriniz barədə səhmdarlara məlumat..."
            className="w-full resize-y rounded-lg border border-black/10 bg-white/60 p-3 text-sm text-black/80 outline-none focus:border-brand-green/50 focus:ring-1 focus:ring-brand-green/30"
            disabled={pending}
          />
          {error && <div className="text-xs text-brand-red">{error}</div>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-md px-3 py-1.5 text-xs text-black/55 hover:text-black/80 transition-colors disabled:opacity-50"
            >
              Ləğv et
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={pending}
              className="rounded-md bg-brand-green px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-green-deep transition-colors disabled:opacity-50"
            >
              {pending ? "Saxlanılır..." : "Yadda saxla"}
            </button>
          </div>
        </div>
      ) : hasValue ? (
        showContent && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-black/75">
            {value}
          </p>
        )
      ) : (
        <p className="text-sm text-black/35">
          {canEdit
            ? "Səhmdarlara növbəti hərəkətləriniz barədə məlumat vermək üçün yazın."
            : "Hələ bəyanat yoxdur."}
        </p>
      )}
    </div>
  );
}
