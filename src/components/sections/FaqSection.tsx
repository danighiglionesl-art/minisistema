"use client";

import React from "react";
import { FAQ_ITEMS } from "@/lib/site-data";
import { FaqItem } from "@/types/minisistema";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FaqSectionProps {
  faqs?: FaqItem[];
}

export function FaqSection({ faqs }: FaqSectionProps) {
  const items = faqs && faqs.length > 0 ? faqs : FAQ_ITEMS;
  return (
    <section
      id="preguntas-frecuentes"
      className="relative border-t border-[#FFFFFF]/10 bg-[#112D3A] py-20 sm:py-24"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/35 bg-[#56D7A1]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Preguntas frecuentes</span>
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-[#FFFFFF] sm:text-4xl lg:text-5xl">
            Resolvemos tus <span className="text-[#56D7A1]">dudas principales</span>.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[#FFFFFF]/80">
            Respuestas claras sobre cómo diseñamos, implementamos y acompañamos cada MiniSistema.
          </p>
        </div>

        {/* Acordeón nativo <details> con atributo name compartido (search-hidden-content) */}
        <div className="mt-12 space-y-3.5">
          {items.map((faq, index) => (
            <details
              key={faq.id}
              name="minisistema-faq"
              open={index === 0}
              className="group rounded-2xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] transition-colors open:border-[#56D7A1] open:bg-[#56D7A1]/[0.07]"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left text-base sm:text-lg font-extrabold text-[#FFFFFF] transition-colors hover:text-[#56D7A1]">
                <span>{faq.question}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/5 text-[#56D7A1] transition-transform duration-200 group-open:rotate-180 group-open:border-[#56D7A1] group-open:bg-[#56D7A1] group-open:text-[#112D3A]">
                  <ChevronDown className="h-4 w-4 stroke-[2.5]" />
                </span>
              </summary>

              <div className="border-t border-[#FFFFFF]/10 px-6 pt-4 pb-5 text-sm sm:text-base leading-relaxed text-[#FFFFFF]/85">
                <p>{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
