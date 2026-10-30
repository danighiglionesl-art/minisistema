"use client";

import React, { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";

interface HumanVerificationCheckProps {
  verified: boolean;
  onChange: (verified: boolean, token: string) => void;
  id?: string;
}

export function HumanVerificationCheck({
  verified,
  onChange,
  id = "ms-human-captcha",
}: HumanVerificationCheckProps) {
  const [verifying, setVerifying] = useState(false);

  const handleToggle = () => {
    if (verifying) return;

    if (verified) {
      onChange(false, "");
      return;
    }

    setVerifying(true);
    setTimeout(() => {
      const token = `ms-human-${Date.now()}`;
      setVerifying(false);
      onChange(true, token);
    }, 280);
  };

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3.5 transition-all select-none ${
        verified
          ? "border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/5"
          : "border-[var(--color-blanco)]/20 bg-[var(--color-petroleo)] hover:border-[var(--color-menta)]"
      }`}
    >
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={verified}
        onClick={handleToggle}
        className="flex flex-1 cursor-pointer items-center gap-3.5 text-left focus:outline-none"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
            verified
              ? "border-[var(--color-menta)] bg-[var(--color-menta)] text-[var(--color-petroleo)]"
              : verifying
                ? "border-[var(--color-menta)] bg-[var(--color-petroleo)]"
                : "border-[var(--color-blanco)]/40 bg-[var(--color-petroleo)]"
          }`}
        >
          {verifying ? (
            <span
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-menta)] border-t-transparent"
              aria-hidden="true"
            />
          ) : verified ? (
            <Check className="h-4 w-4 stroke-[3]" />
          ) : null}
        </span>

        <div>
          <span className="block text-sm font-bold text-[var(--color-blanco)]">
            No soy un robot
          </span>
          <span className="block text-[11px] text-[var(--color-blanco)]/70">
            {verifying
              ? "Verificando interacción..."
              : verified
                ? "Verificación de seguridad completada"
                : "Tildá la casilla para confirmar el envío"}
          </span>
        </div>
      </button>

      <div className="flex shrink-0 flex-col items-center justify-center border-l border-[var(--color-blanco)]/10 pl-3.5 text-center">
        <ShieldCheck className="h-5 w-5 text-[var(--color-menta)]" />
        <span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wider text-[var(--color-menta)]">
          CAPTCHA
        </span>
      </div>
    </div>
  );
}
