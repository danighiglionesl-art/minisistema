import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { INITIAL_SITE_CONFIG, buildWhatsAppLink } from "@/lib/site-data";

export const metadata = {
  title: "Política de Privacidad y Protección de Datos",
  description:
    "Política de Privacidad y tratamiento de datos personales de MiniSistema conforme a la normativa vigente en la República Argentina.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-[#112D3A] text-[#FFFFFF]">
      <header className="border-b border-[#FFFFFF]/10 bg-[#112D3A] py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[#FFFFFF]/20 bg-[#FFFFFF]/5 px-4 py-2 text-xs font-bold text-[#FFFFFF] transition-colors hover:border-[#56D7A1] hover:text-[#56D7A1]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al inicio</span>
          </Link>

          <img
            src="/brand/header-isologotipo.png"
            alt="minisistema. SISTEMAS A MEDIDA"
            width={180}
            height={42}
            className="h-8 w-auto object-contain"
          />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-[#FFFFFF]/15 bg-[#FFFFFF]/[0.03] p-6 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#56D7A1]/40 bg-[#56D7A1]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#56D7A1]">
            <ShieldCheck className="h-4 w-4" />
            <span>Protección de Datos Personales</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold text-[#FFFFFF] sm:text-4xl">
            Política de Privacidad
          </h1>

          <div className="mt-6 space-y-6 text-sm sm:text-base leading-relaxed text-[#FFFFFF]/85">
            <section>
              <h2 className="text-lg font-extrabold text-[#56D7A1]">
                1. Finalidad de los datos recolectados
              </h2>
              <p className="mt-2">
                En <strong>MiniSistema — Sistemas a Medida</strong> recolectamos únicamente la
                información comercial y de contacto que el usuario proporciona voluntariamente a
                través del Configurador de Proyectos o del formulario de contacto (nombre y
                apellido, comercio o institución, localidad, provincia, número de WhatsApp, correo
                electrónico y descripción de su necesidad) con el único fin de analizar su consulta
                y elaborar una propuesta comercial personalizada.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-[#56D7A1]">
                2. Minimización y confidencialidad
              </h2>
              <p className="mt-2">
                No solicitamos información financiera sensible, claves ni credenciales de otros
                sistemas en nuestros formularios públicos. Los datos recibidos son tratados de forma
                confidencial y no se comercializan ni ceden a terceros ajenos a la atención
                comercial de MiniSistema.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-[#56D7A1]">
                3. Derechos de acceso, rectificación y supresión (Ley 25.326)
              </h2>
              <p className="mt-2">
                En cumplimiento de la normativa aplicable en la República Argentina en materia de
                Protección de los Datos Personales (Ley N° 25.326), el titular de los datos podrá en
                cualquier momento solicitar el acceso, actualización, rectificación o eliminación de
                sus datos comunicándose a través de nuestro canal oficial de WhatsApp comercial (
                <a
                  href={buildWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#56D7A1] underline"
                >
                  {INITIAL_SITE_CONFIG.whatsappDisplay}
                </a>
                ).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-[#56D7A1]">
                4. Seguridad de las comunicaciones
              </h2>
              <p className="mt-2">
                Todas las comunicaciones del sitio se realizan mediante conexiones cifradas HTTPS y
                controles de acceso restringidos para la administración interna de consultas.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
