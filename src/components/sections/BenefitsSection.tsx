"use client";

import React from "react";
import { BENEFITS_LIST } from "@/lib/site-data";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import {
  Fingerprint,
  MousePointerClick,
  Database,
  MonitorSmartphone,
  TrendingUp,
  Handshake,
} from "lucide-react";

const BENEFIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Fingerprint,
  MousePointerClick,
  Database,
  MonitorSmartphone,
  TrendingUp,
  Handshake,
};

export function BenefitsSection() {
  return (
    <section className="relative border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
            <span className="inline-flex items-center gap-1.5">
              <span>Beneficios de tener tu propio</span>
              <BrandWordmark className="h-3.5" />
            </span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-4xl lg:text-5xl">
            Menos complicaciones.{" "}
            <span className="text-[var(--color-menta)]">Más posibilidades.</span>
          </h2>
        </div>

        {/* 6 Beneficios en disposición liviana, abierta y de lectura rápida */}
        <div className="mt-16 grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS_LIST.map((benefit, idx) => {
            const Icon = BENEFIT_ICONS[benefit.iconName] || Fingerprint;
            return (
              <div
                key={benefit.id}
                className="group relative flex items-start gap-4 border-l-2 border-[var(--color-menta)]/40 pl-5 py-2 transition-all hover:border-[var(--color-menta)]"
              >
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-menta)]/60 bg-[var(--color-menta)]/10 text-[var(--color-menta)] shadow-[0_0_20px_rgba(86,215,161,0.12)] transition-all group-hover:bg-[var(--color-menta)] group-hover:text-[var(--color-petroleo)]">
                  <Icon className="h-6 w-6" />
                  <span className="absolute -top-2 -right-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-petroleo)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--color-menta)]">
                    0{idx + 1}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-[var(--color-blanco)]">
                    {benefit.title}
                  </h3>

                  <p className="mt-2 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/80">
                    {benefit.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
