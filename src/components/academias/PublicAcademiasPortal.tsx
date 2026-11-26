"use client";

import { useEffect, useState } from "react";

interface PublicCurso {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  nivel: string;
  modalidad: string;
  docenteNombre: string;
  diasHorarios: string;
  aulaSala: string;
  cupoMaximo: number;
  cupoDisponible: number;
  arancelMatricula: number;
  arancelCuotaMensual: number;
  cargaHorariaHs: number;
}

interface PublicAcademiaInfo {
  tenantSlug: string;
  businessName: string;
  logoUrl: string;
  primaryHex: string;
  accentHex: string;
  direccion: string;
  localidad: string;
  whatsapp: string;
  inscripcionPublicaWeb: boolean;
  fichaSaludAptoFisico: boolean;
  reglamentoInterno: string;
  cursos: PublicCurso[];
}

interface VerifiedCert {
  codigoVerificacion: string;
  alumnoNombre: string;
  alumnoDni: string;
  cursoNombre: string;
  cargaHorariaHs: number;
  asistenciaPct: number;
  fechaEmision: string;
  calificacion: string;
}

const fmtArs = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export default function PublicAcademiasPortal(props: {
  apiEndpoint: string;
  initialCertCode?: string;
}) {
  const { apiEndpoint, initialCertCode = "" } = props;
  const [info, setInfo] = useState<PublicAcademiaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [certCode, setCertCode] = useState(initialCertCode);
  const [certResult, setCertResult] = useState<{
    academia?: string;
    certificado?: VerifiedCert;
    error?: string;
  } | null>(null);

  const [selectedCursoId, setSelectedCursoId] = useState("");
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [tutorNombre, setTutorNombre] = useState("");
  const [obsSalud, setObsSalud] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`${apiEndpoint}?action=public_info`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        if (data && data.ok) {
          setInfo(data);
          if (Array.isArray(data.cursos) && data.cursos.length > 0) {
            setSelectedCursoId(data.cursos[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [apiEndpoint]);

  const verifyCertificate = async (codeToVerify: string) => {
    const clean = codeToVerify.trim().toUpperCase();
    if (!clean) return;
    setCertResult(null);
    try {
      const res = await fetch(
        `${apiEndpoint}?action=verify_certificate&code=${encodeURIComponent(clean)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (data && data.ok && data.certificado) {
        setCertResult({ academia: data.academia, certificado: data.certificado });
      } else {
        setCertResult({ error: data?.message || "Certificado no encontrado." });
      }
    } catch {
      setCertResult({ error: "No se pudo verificar el certificado en este momento." });
    }
  };

  useEffect(() => {
    if (initialCertCode) {
      verifyCertificate(initialCertCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCertCode]);

  const handlePublicEnroll = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedCursoId || !nombre.trim()) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "public_inscribir",
          inscripcion: {
            cursoId: selectedCursoId,
            nombre,
            dni,
            whatsapp,
            email,
            tutorNombre,
            observacionesSalud: obsSalud,
          },
        }),
      });
      const data = await res.json();
      if (data && data.ok) {
        setSubmitMsg({
          ok: true,
          text: data.message || "Inscripción registrada correctamente.",
        });
        setNombre("");
        setDni("");
        setWhatsapp("");
        setEmail("");
        setTutorNombre("");
        setObsSalud("");
      } else {
        setSubmitMsg({
          ok: false,
          text: data?.message || "No se pudo completar la inscripción.",
        });
      }
    } catch {
      setSubmitMsg({ ok: false, text: "Error de conexión al enviar la inscripción." });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#112D3A] p-6 text-white">
        Cargando portal de academia...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-[#112D3A] px-6 py-8 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {info?.logoUrl ? (
              <img
                src={info.logoUrl}
                alt={info.businessName}
                className="h-14 w-14 rounded-xl bg-white object-contain p-1"
              />
            ) : null}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#56D7A1]">
                Portal Académico
              </p>
              <h1 className="text-2xl font-extrabold">
                {info?.businessName || "Gestión de Academias"}
              </h1>
              {info?.direccion || info?.localidad ? (
                <p className="text-sm text-white/80">
                  {[info.direccion, info.localidad].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          </div>
          {info?.whatsapp ? (
            <a
              href={`https://wa.me/${info.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#56D7A1] px-4 py-2 text-sm font-extrabold text-[#112D3A]"
            >
              💬 Consultar por WhatsApp
            </a>
          ) : null}
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
        {/* Verificador de Certificados */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#112D3A]">
            🎓 Verificador Oficial de Certificados
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Ingresá el código único impreso en el diploma para validar su autenticidad.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={certCode}
              onChange={(e) => setCertCode(e.target.value)}
              placeholder="Ej: CERT-0001-A9F2"
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold uppercase"
            />
            <button
              type="button"
              onClick={() => verifyCertificate(certCode)}
              className="rounded-lg bg-[#112D3A] px-4 py-2 text-sm font-bold text-white"
            >
              Verificar Código
            </button>
          </div>
          {certResult?.certificado ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <div className="font-extrabold text-emerald-800">
                ✅ Certificado Válido · {certResult.certificado.codigoVerificacion}
              </div>
              <div className="mt-1">
                Alumno/a: <strong>{certResult.certificado.alumnoNombre}</strong> (DNI{" "}
                {certResult.certificado.alumnoDni || "—"})
              </div>
              <div>
                Curso: <strong>{certResult.certificado.cursoNombre}</strong> · Asistencia:{" "}
                <strong>{certResult.certificado.asistenciaPct}%</strong> · Emitido:{" "}
                {certResult.certificado.fechaEmision}
              </div>
            </div>
          ) : null}
          {certResult?.error ? (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              {certResult.error}
            </div>
          ) : null}
        </section>

        {/* Inscripción Pública (solo si la academia habilitó el opcional) */}
        {info?.inscripcionPublicaWeb ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-[#112D3A]">
              📝 Inscripción Online a Cursos y Clases
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Al completar el formulario quedás registrado automáticamente en la base de alumnos,
              asistencias y plan de cuotas.
            </p>
            <form onSubmit={handlePublicEnroll} className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Curso / Comisión *
                </label>
                <select
                  value={selectedCursoId}
                  onChange={(e) => setSelectedCursoId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {info.cursos.map((c) => (
                    <option key={c.id} value={c.id} disabled={c.cupoDisponible <= 0}>
                      {c.nombre} · {c.diasHorarios || c.modalidad} · Cuota{" "}
                      {fmtArs.format(c.arancelCuotaMensual)} ({c.cupoDisponible} cupos)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Apellido y Nombre *
                </label>
                <input
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">DNI *</label>
                <input
                  required
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  WhatsApp *
                </label>
                <input
                  required
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">
                  Tutor / Responsable (si es menor)
                </label>
                <input
                  value={tutorNombre}
                  onChange={(e) => setTutorNombre(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {info.fichaSaludAptoFisico ? (
                <div>
                  <label className="mb-1 block text-xs font-bold text-slate-700">
                    Observaciones de salud / Apto físico
                  </label>
                  <input
                    value={obsSalud}
                    onChange={(e) => setObsSalud(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={submitting || info.cursos.length === 0}
                  className="rounded-lg bg-[#112D3A] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {submitting ? "Enviando..." : "✅ Confirmar Inscripción"}
                </button>
              </div>
            </form>
            {submitMsg ? (
              <div
                className={`mt-3 rounded-lg px-4 py-3 text-sm font-semibold ${
                  submitMsg.ok
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {submitMsg.text}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-[#112D3A]">
              📍 Inscripciones Presenciales en el Local
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Las inscripciones se realizan de forma presencial en nuestra sede. Podés consultar
              horarios y disponibilidad por WhatsApp.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
