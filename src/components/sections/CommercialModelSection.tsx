"use client";

import React from "react";
import { COMMERCIAL_SERVICES } from "@/lib/site-data";
import { Check, ArrowUpRight, ShieldAlert, Code2, Wrench, TrendingUp } from "lucide-react";
import { ServiceHeaderIllustration } from "@/components/illustrations/SectionDiagrams";
import { renderWithBrandWordmark } from "@/components/brand/BrandWordmark";

interface CommercialModelSectionProps {
  onOpenConfiguratorWithService: (serviceTitle: string) => void;
}

const SERVICE_ICONS = [Code2, Wrench, TrendingUp];

export function CommercialModelSection({
  onOpenConfiguratorWithService,
}: CommercialModelSectionProps) {
  return (
    <section className="relative border-t border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
            <span>Modelo comercial transparente</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[var(--color-blanco)] sm:text-4xl lg:text-5xl">
            Tres servicios. Un mismo compromiso:{" "}
            <span className="text-[var(--color-menta)]">acompañar tu crecimiento</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg leading-relaxed text-[var(--color-blanco)]/80">
            Cada negocio tiene necesidades diferentes. Por eso ofrecemos una propuesta flexible que
            combina desarrollo, mantenimiento y evolución.
          </p>
        </div>

        {/* Tres tarjetas de servicios diferenciados */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
          {COMMERCIAL_SERVICES.map((service, idx) => {
            const Icon = SERVICE_ICONS[idx] || Code2;
            const isInitial = idx === 0;

            return (
              <article
                key={service.id}
                className={`flex flex-col justify-between rounded-3xl border p-6 sm:p-8 transition-all ${
                  isInitial
                    ? "border-2 border-[var(--color-menta)] bg-[var(--color-blanco)]/[0.05] shadow-2xl"
                    : "border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] hover:border-[var(--color-menta)]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3 py-1 text-xs font-extrabold tracking-wider text-[var(--color-menta)]">
                      {service.number}
                    </span>
                    <span className="text-xs font-semibold text-[var(--color-blanco)]/70">
                      {service.badge}
                    </span>
                  </div>

                  {/* Ilustración tecnológica distintiva para cada servicio comercial */}
                  <div className="mt-4">
                    <ServiceHeaderIllustration serviceId={service.id} />
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-menta)] text-[var(--color-petroleo)]">
                      <Icon className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold tracking-wide text-[var(--color-blanco)]">
                        {service.title}
                      </h3>
                      <p className="text-sm font-bold text-[var(--color-menta)]">
                        {renderWithBrandWordmark(service.headline)}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-[var(--color-blanco)]/85">
                    {renderWithBrandWordmark(service.description)}
                  </p>

                  <div className="mt-6 border-t border-[var(--color-blanco)]/10 pt-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
                      {service.itemsLabel}
                    </p>

                    <ul className="mt-3.5 grid grid-cols-1 gap-2">
                      {service.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 rounded-xl border border-[var(--color-blanco)]/8 bg-[var(--color-petroleo)]/60 px-3 py-2 text-xs sm:text-sm text-[var(--color-blanco)]/90"
                        >
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-menta)] stroke-[2.5]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-8 border-t border-[var(--color-blanco)]/10 pt-5">
                  <div className="rounded-2xl border border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)]/80 p-3.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--color-menta)]">
                      Modalidad comercial
                    </span>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-[var(--color-blanco)]">
                      {service.commercialModality}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenConfiguratorWithService(service.title)}
                    className={`mt-4 inline-flex w-full cursor-pointer items-center justify-between rounded-xl px-5 py-3.5 text-xs sm:text-sm font-extrabold transition-all ${
                      isInitial
                        ? "bg-[var(--color-menta)] text-[var(--color-petroleo)] hover:bg-[var(--color-blanco)]"
                        : "border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 text-[var(--color-blanco)] hover:bg-[var(--color-menta)] hover:text-[var(--color-petroleo)]"
                    }`}
                  >
                    <span>{service.ctaLabel}</span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 stroke-[2.5]" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Aclaraciones comerciales obligatorias (Sección 12) */}
        <div className="mt-10 rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-menta)]" />
            <div className="text-xs leading-relaxed text-[var(--color-blanco)]/75 space-y-1.5">
              <p className="font-bold text-[var(--color-blanco)]">
                Claridad y transparencia comercial:
              </p>
              <p>
                Desarrollo inicial, mantenimiento y evolución son servicios claramente
                diferenciados. Los alcances, tiempos de respuesta, infraestructura, mantenimiento y
                funcionalidades adicionales se establecen en la propuesta comercial y contrato
                correspondiente de cada proyecto. La contratación del servicio de mantenimiento no
                implica automáticamente el desarrollo de nuevas funcionalidades.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
