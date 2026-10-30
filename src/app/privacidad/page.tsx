import React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { INITIAL_SITE_CONFIG, buildWhatsAppLink } from "@/lib/site-data";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

export const metadata = {
  title: "Política de Privacidad y Protección de Datos",
  description:
    "Política de Privacidad y tratamiento de datos personales de MiniSistema conforme a la normativa vigente en la República Argentina.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-[var(--color-petroleo)] text-[var(--color-blanco)]">
      <header className="border-b border-[var(--color-blanco)]/10 bg-[var(--color-petroleo)] py-5">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-blanco)]/20 bg-[var(--color-blanco)]/5 px-4 py-2 text-xs font-bold text-[var(--color-blanco)] transition-colors hover:border-[var(--color-menta)] hover:text-[var(--color-menta)]"
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
        <div className="rounded-3xl border border-[var(--color-blanco)]/15 bg-[var(--color-blanco)]/[0.03] p-6 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-menta)] bg-[var(--color-blanco)]/5 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[var(--color-menta)]">
            <ShieldCheck className="h-4 w-4" />
            <span>Protección de Datos Personales</span>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold text-[var(--color-blanco)] sm:text-4xl">
            Política de Privacidad
          </h1>

          <div className="mt-6 space-y-6 text-sm sm:text-base leading-relaxed text-[var(--color-blanco)]/85">
            <section>
              <h2 className="text-lg font-extrabold text-[var(--color-menta)]">
                1. Finalidad de los datos recolectados
              </h2>
              <p className="mt-2">
                En <BrandWordmark className="mx-0.5" /> <strong>— Sistemas a Medida</strong>{" "}
                recolectamos únicamente la información comercial y de contacto que el usuario
                proporciona voluntariamente a través del Configurador de Proyectos o del formulario
                de contacto (nombre y apellido, comercio o institución, localidad, provincia, número
                de WhatsApp, correo electrónico y descripción de su necesidad) con el único fin de
                analizar su consulta y elaborar una propuesta comercial personalizada.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-[var(--color-menta)]">
                2. Minimización y confidencialidad
              </h2>
              <p className="mt-2">
                No solicitamos información financiera sensible, claves ni credenciales de otros
                sistemas en nuestros formularios públicos. Los datos recibidos son tratados de forma
                confidencial y no se comercializan ni ceden a terceros ajenos a la atención
                comercial de <BrandWordmark className="mx-0.5" />
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-[var(--color-menta)]">
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
                  className="font-bold text-[var(--color-menta)] underline"
                >
                  {INITIAL_SITE_CONFIG.whatsappDisplay}
                </a>
                ).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-extrabold text-[var(--color-menta)]">
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
