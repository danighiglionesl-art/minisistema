"use client";

import React from "react";
import { BENEFITS_LIST } from "@/lib/site-data";
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
    <section className="relative border-t border-[#FFFFFF]/10 bg-[#112D3A] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/35 bg-[#56D7A1]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
            <span>Beneficios de tener tu propio MiniSistema</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#FFFFFF] sm:text-4xl lg:text-5xl">
            Menos complicaciones.{" "}
            <span className="text-[#56D7A1]">Más posibilidades.</span>
          </h2>
        </div>

        {/* 6 Tarjetas de Beneficios */}
        <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS_LIST.map((benefit) => {
            const Icon = BENEFIT_ICONS[benefit.iconName] || Fingerprint;
            return (
              <div
                key={benefit.id}
                className="group rounded-3xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-6 sm:p-7 transition-all hover:border-[#56D7A1]/60 hover:bg-[#FFFFFF]/[0.05]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#56D7A1]/35 bg-[#56D7A1]/15 text-[#56D7A1] transition-colors group-hover:bg-[#56D7A1] group-hover:text-[#112D3A]">
                  <Icon className="h-6 w-6" />
                </div>

                <h3 className="mt-5 text-xl font-extrabold text-[#FFFFFF]">
                  {benefit.title}
                </h3>

                <p className="mt-2 text-sm sm:text-base leading-relaxed text-[#FFFFFF]/80">
                  {benefit.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
