"use client";

import React, { useCallback, useEffect, useState } from "react";

interface PublicLabProps {
  tenantSlug: string;
  fantasyName: string;
  primaryHex: string;
  accentHex: string;
  initialQr?: string;
}

function formatDniDots(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return raw || "";
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDateAr(iso: string): string {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso || "";
}

function parseRefLines(raw: string): Array<{ left: string; right: string }> {
  if (!raw) return [];
  return String(raw)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes("|")) {
        const [a, ...rest] = line.split("|");
        return { left: a.trim(), right: rest.join("|").trim() };
      }
      return { left: "", right: line };
    });
}

function paginatePracticesForA4(practicas: any[]): any[][] {
  const pages: any[][] = [];
  let current: any[] = [];
  let usedUnits = 0;
  let maxUnits = 26; // Primera hoja tiene banner institucional arriba

  for (const p of practicas || []) {
    const resCount = Array.isArray(p.resultados) ? p.resultados.length : 1;
    let refExtra = 0;
    for (const r of p.resultados || []) {
      const lines = String(r.rangoReferencia || "").split(/\n/).filter(Boolean).length;
      if (lines > 1) refExtra += (lines - 1) * 0.65;
    }
    const noteUnits = p.notaPractica ? 2.6 : 0;
    const weight = 2.2 + resCount * 1.05 + refExtra + noteUnits;

    if (current.length > 0 && usedUnits + weight > maxUnits) {
      pages.push(current);
      current = [p];
      usedUnits = weight;
      maxUnits = 31; // Hojas siguientes sin banner superior grande
    } else {
      current.push(p);
      usedUnits += weight;
    }
  }
  if (current.length > 0) pages.push(current);
  if (pages.length === 0) pages.push([]);
  return pages;
}

export default function PublicLaboratorioPortal({
  tenantSlug,
  fantasyName,
  primaryHex,
  accentHex,
  initialQr = "",
}: PublicLabProps) {
  const [qrInput, setQrInput] = useState(initialQr);
  const [dniInput, setDniInput] = useState("");
  const [protoInput, setProtoInput] = useState("");
  const [searchMode, setSearchMode] = useState<"qr" | "protocolo">("qr");
  const [loading, setLoading] = useState(Boolean(initialQr));
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  const fetchLookup = useCallback(
    async (qrVal: string, dniVal: string, protoVal: string) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("tenant", tenantSlug);
        if (qrVal.trim()) params.set("qr", qrVal.trim().toUpperCase());
        if (dniVal.trim()) params.set("dni", dniVal.trim());
        if (protoVal.trim()) params.set("protocolo", protoVal.trim());

        const res = await fetch(`/api/laboratorio?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!json.ok) {
          setError(json.message || "No se encontró el protocolo.");
          setData(null);
        } else {
          setData(json);
        }
      } catch {
        setError("Error de conexión al consultar los resultados.");
      } finally {
        setLoading(false);
      }
    },
    [tenantSlug]
  );

  useEffect(() => {
    if (initialQr) {
      fetchLookup(initialQr, "", "");
    }
  }, [initialQr, fetchLookup]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchMode === "qr") {
      if (!qrInput.trim()) {
        setError("Ingresá el código impreso en tu tarjeta QR (ej: LAB-XXXX-XXXX).");
        return;
      }
      fetchLookup(qrInput, dniInput, "");
    } else {
      if (!protoInput.trim() || !dniInput.trim()) {
        setError("Ingresá tu Número de Protocolo y tu DNI.");
        return;
      }
      fetchLookup("", dniInput, protoInput);
    }
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const order = data?.order;
  const cfg = data?.labConfig || data?.labInfo || {};
  const pages = order?.practicas ? paginatePracticesForA4(order.practicas) : [];

  return (
    <div>
      {/* Estilos de impresión A4 exactos al modelo bioquímico clásico argentino */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body { background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .lab-a4-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            min-height: 274mm !important;
            max-height: 276mm !important;
            page-break-after: always;
            break-after: page;
          }
          .lab-a4-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
        .lab-a4-sheet {
          font-family: "Times New Roman", Georgia, Cambria, serif;
          color: #000000;
          background: #ffffff;
          width: 210mm;
          min-height: 292mm;
          margin: 0 auto 1.75rem auto;
          padding: 11mm 13mm 10mm 13mm;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 12px 36px rgba(15, 23, 42, 0.14);
          border: 1px solid #cbd5e1;
        }
        .lab-dot-leader {
          flex: 1;
          border-bottom: 1px dotted #334155;
          margin: 0 8px 4px 6px;
          min-width: 16px;
        }
      `}</style>

      {/* Panel buscador (oculto al imprimir el PDF) */}
      <div className="no-print mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              Consulta Online de Resultados Bioquímicos
            </h2>
            <p className="text-sm text-slate-600">
              Escaneá el QR de tu tarjeta entregada en recepción o ingresá tu código manualmente.
            </p>
          </div>
          <div className="flex rounded-lg bg-slate-100 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSearchMode("qr")}
              className={`rounded-md px-3 py-1.5 transition ${
                searchMode === "qr" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
              }`}
            >
              Por Tarjeta QR
            </button>
            <button
              type="button"
              onClick={() => setSearchMode("protocolo")}
              className={`rounded-md px-3 py-1.5 transition ${
                searchMode === "protocolo"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Por Protocolo + DNI
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          {searchMode === "qr" ? (
            <>
              <div className="sm:col-span-6">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                  Código de Tarjeta QR
                </label>
                <input
                  type="text"
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value.toUpperCase())}
                  placeholder="Ej: LAB-8F4K-29M1"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono text-sm font-bold uppercase focus:border-emerald-500 focus:outline-none"
                />
              </div>
              {data?.requiresDniVerification && (
                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                    DNI del Paciente
                  </label>
                  <input
                    type="text"
                    value={dniInput}
                    onChange={(e) => setDniInput(e.target.value)}
                    placeholder="Tu número de DNI"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                  N° de Protocolo
                </label>
                <input
                  type="number"
                  value={protoInput}
                  onChange={(e) => setProtoInput(e.target.value)}
                  placeholder="Ej: 19928"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-600">
                  DNI del Paciente
                </label>
                <input
                  type="text"
                  value={dniInput}
                  onChange={(e) => setDniInput(e.target.value)}
                  placeholder="Sin puntos"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </>
          )}
          <div className="flex items-end sm:col-span-4">
            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: primaryHex }}
              className="w-full rounded-xl px-5 py-2.5 text-sm font-extrabold text-white shadow hover:opacity-95 disabled:opacity-50"
            >
              {loading ? "Consultando..." : "Consultar Resultados"}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        )}

        {data?.requiresDniVerification && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            Por privacidad médica, ingresá tu número de DNI para visualizar el Protocolo N°{" "}
            {data.protocoloNro}.
          </div>
        )}

        {data?.cardOnly && (
          <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
            {data.message}
          </div>
        )}
      </div>

      {/* Estado En Proceso vs Validado */}
      {order && !data.isValidated && (
        <div className="no-print rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <span className="inline-block rounded-full bg-amber-200 px-3 py-1 text-xs font-black uppercase text-amber-900">
            ⏳ Estudio en Proceso Analítico
          </span>
          <h3 className="mt-3 text-xl font-black text-slate-900">
            Paciente: {order.pacienteNombreCompleto} · Protocolo N° {order.protocoloNro}
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Fecha de ingreso: <strong>{formatDateAr(order.fecha)}</strong> · Médico solicitante:{" "}
            <strong>{order.medicoSolicitante}</strong>
          </p>
          <p className="mt-3 text-sm text-slate-700">
            Tus muestras están siendo procesadas y validadas por el profesional bioquímico. Apenas
            finalice la validación recibirás confirmación y podrás descargar aquí mismo tu informe
            firmado.
          </p>
        </div>
      )}

      {/* Barra de Acción de Impresión / Descarga PDF cuando está Validado */}
      {order && data.isValidated && (
        <div>
          <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">
                ✓ Informe Bioquímico Validado y Firmado Digitalmente
              </div>
              <div className="text-base font-black text-slate-900">
                Protocolo N° {order.protocoloNro} — {order.pacienteNombreCompleto} ({pages.length}{" "}
                {pages.length === 1 ? "hoja" : "hojas"})
              </div>
            </div>
            <button
              type="button"
              onClick={handlePrintPdf}
              style={{ backgroundColor: accentHex, color: "#112D3A" }}
              className="rounded-xl px-5 py-2.5 text-sm font-black shadow-md transition hover:scale-[1.01]"
            >
              🖨️ Descargar / Imprimir Informe Oficial PDF
            </button>
          </div>

          {/* Hojas A4 idénticas al reporte bioquímico clásico argentino */}
          <div className="overflow-x-auto pb-8">
            {pages.map((pagePractices, pageIdx) => (
              <div key={pageIdx} className="lab-a4-sheet">
                <div>
                  {/* Encabezado Institucional en Hoja 1 */}
                  {pageIdx === 0 && (
                    <div
                      style={{
                        position: "relative",
                        borderBottom: "2px solid #94a3b8",
                        paddingBottom: "8px",
                        marginBottom: "8px",
                        background:
                          "linear-gradient(180deg, rgba(219,234,254,0.65) 0%, rgba(255,255,255,1) 100%)",
                        borderRadius: "6px 6px 0 0",
                        padding: "10px 14px 8px 14px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "14px",
                        }}
                      >
                        {cfg.logoUrl ? (
                          <img
                            src={cfg.logoUrl}
                            alt={cfg.nombreLaboratorio || fantasyName}
                            style={{
                              width: "66px",
                              height: "66px",
                              objectFit: "contain",
                              borderRadius: "50%",
                              border: `3px solid ${cfg.bannerColorPrimary || "#1e5aa8"}`,
                              background: "#fff",
                              padding: "3px",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "62px",
                              height: "62px",
                              borderRadius: "50%",
                              border: `3px solid ${cfg.bannerColorPrimary || "#1e5aa8"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 900,
                              fontSize: "22px",
                              color: cfg.bannerColorPrimary || "#1e5aa8",
                              background: "#fff",
                            }}
                          >
                            ⚗️
                          </div>
                        )}
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div
                            style={{
                              fontSize: "23px",
                              fontWeight: 700,
                              letterSpacing: "2.5px",
                              color: "#0f172a",
                              borderBottom: `1.5px solid ${cfg.bannerColorPrimary || "#1e5aa8"}`,
                              display: "inline-block",
                              paddingBottom: "2px",
                            }}
                          >
                            {cfg.nombreLaboratorio || fantasyName}
                          </div>
                          {cfg.subtituloDirector && (
                            <div
                              style={{
                                fontSize: "12.5px",
                                fontWeight: 700,
                                marginTop: "4px",
                                color: "#0f172a",
                              }}
                            >
                              {cfg.subtituloDirector}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: "12.5px",
                              fontWeight: 700,
                              marginTop: "4px",
                              display: "flex",
                              justifyContent: "center",
                              gap: "28px",
                              flexWrap: "wrap",
                            }}
                          >
                            {cfg.direccion && <span>{cfg.direccion}</span>}
                            {cfg.telefono && <span>{cfg.telefono}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cabecera repetida en TODAS las hojas (Paciente / DNI / Protocolo / Fecha / Médico / Hoja X / Y) */}
                  <div
                    style={{
                      borderTop: pageIdx === 0 ? "1.5px solid #000" : "none",
                      borderBottom: "1.5px solid #000",
                      padding: "5px 2px",
                      fontSize: "12.5px",
                      lineHeight: 1.45,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <span>Paciente: </span>
                        <strong style={{ fontStyle: "italic", fontSize: "13.5px" }}>
                          {order.pacienteNombreCompleto}
                        </strong>
                        <strong style={{ fontStyle: "italic", marginLeft: "14px", fontSize: "13px" }}>
                          DNI: {formatDniDots(order.pacienteDni)}
                        </strong>
                      </div>
                      <div>
                        <span>Protocolo: </span>
                        <strong style={{ fontStyle: "italic", fontSize: "13.5px" }}>
                          {order.protocoloNro}
                        </strong>
                      </div>
                      <div>
                        <span>Fecha: </span>
                        <strong>{formatDateAr(order.fecha)}</strong>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginTop: "2px",
                      }}
                    >
                      <div>
                        <span>Médico: </span>
                        <span style={{ marginLeft: "8px" }}>{order.medicoSolicitante}</span>
                      </div>
                      <div>
                        <span>Hoja: </span>
                        <strong style={{ marginLeft: "6px" }}>
                          {pageIdx + 1} / {pages.length}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Títulos de columnas */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "46% 24% 30%",
                      padding: "4px 2px 8px 2px",
                      fontSize: "11.5px",
                    }}
                  >
                    <div />
                    <div style={{ fontWeight: 600 }}>Resultado</div>
                    <div style={{ fontWeight: 600, paddingLeft: "8px" }}>Rango de referencia</div>
                  </div>

                  {/* Cuerpo de Prácticas Bioquímicas de esta hoja */}
                  <div>
                    {pagePractices.map((prac: any) => {
                      let lastSubgrupo = "";
                      return (
                        <div key={prac.codigo} style={{ marginBottom: "13px" }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "13px",
                              textTransform: "uppercase",
                              letterSpacing: "0.2px",
                            }}
                          >
                            {prac.nombre}
                          </div>
                          {prac.metodo && (
                            <div
                              style={{
                                fontSize: "10.5px",
                                color: "#1e293b",
                                marginBottom: "4px",
                              }}
                            >
                              Método: {prac.metodo}
                            </div>
                          )}

                          {(prac.resultados || []).map((res: any) => {
                            const showSub =
                              res.subgrupo && res.subgrupo !== lastSubgrupo;
                            if (res.subgrupo) lastSubgrupo = res.subgrupo;
                            const refLines = parseRefLines(res.rangoReferencia);

                            return (
                              <React.Fragment key={res.analyteId}>
                                {showSub && (
                                  <div
                                    style={{
                                      fontFamily: "Arial, Helvetica, sans-serif",
                                      fontWeight: 700,
                                      fontSize: "11px",
                                      textTransform: "uppercase",
                                      marginTop: "7px",
                                      marginBottom: "3px",
                                    }}
                                  >
                                    {res.subgrupo}
                                  </div>
                                )}
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "46% 24% 30%",
                                    alignItems: "start",
                                    fontSize: "12px",
                                    lineHeight: 1.32,
                                    marginBottom: "2px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "baseline",
                                      fontFamily: "Arial, Helvetica, sans-serif",
                                      fontSize: "11.5px",
                                    }}
                                  >
                                    <span>
                                      {res.label}
                                      {res.subgrupo?.includes("ORINA") ||
                                      res.subgrupo?.includes("EXAMEN")
                                        ? ""
                                        : ":"}
                                    </span>
                                    <span className="lab-dot-leader" />
                                  </div>

                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "14px",
                                      fontWeight:
                                        res.flag === "ALTO" || res.flag === "BAJO" ? 700 : 400,
                                    }}
                                  >
                                    <span>
                                      {res.valor || "—"}{" "}
                                      {res.unidad ? <span>{res.unidad}</span> : null}
                                    </span>
                                    {res.valorSecundario && (
                                      <span>{res.valorSecundario}</span>
                                    )}
                                  </div>

                                  <div
                                    style={{
                                      paddingLeft: "8px",
                                      fontSize: "10.2px",
                                      lineHeight: 1.28,
                                    }}
                                  >
                                    {refLines.map((rl, idx) => (
                                      <div
                                        key={idx}
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: rl.left ? "48% 52%" : "1fr",
                                          gap: "4px",
                                        }}
                                      >
                                        {rl.left && <span>{rl.left}</span>}
                                        <span>{rl.right}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </React.Fragment>
                            );
                          })}

                          {prac.notaPractica && (
                            <div
                              style={{
                                marginTop: "4px",
                                fontFamily: "Arial, Helvetica, sans-serif",
                                fontSize: "10.5px",
                                lineHeight: 1.35,
                                whiteSpace: "pre-line",
                              }}
                            >
                              <strong>Nota:</strong>
                              {"\n"}
                              {prac.notaPractica}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pie de Página: Firma Digital del Bioquímico + Leyenda Colegio de Bioquímicos */}
                <div style={{ marginTop: "14px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      marginBottom: "10px",
                    }}
                  >
                    {cfg.mostrarQrVerificacionEnPdf !== false ? (
                      <div
                        style={{
                          fontFamily: "Arial, Helvetica, sans-serif",
                          fontSize: "9px",
                          color: "#475569",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&margin=2&data=${encodeURIComponent(
                            data.portalUrl || window.location.href
                          )}`}
                          alt={`QR ${order.qrCode}`}
                          style={{ width: "48px", height: "48px" }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>
                            Validación QR: {order.qrCode}
                          </div>
                          <div>Protocolo N° {order.protocoloNro}</div>
                        </div>
                      </div>
                    ) : (
                      <div />
                    )}

                    <div
                      style={{
                        textAlign: "center",
                        minWidth: "185px",
                        marginRight: "18px",
                        fontFamily: "Arial, Helvetica, sans-serif",
                      }}
                    >
                      {order.validadoFirmaDataUrl && (
                        <img
                          src={order.validadoFirmaDataUrl}
                          alt="Firma Bioquímico"
                          style={{
                            height: "54px",
                            maxWidth: "170px",
                            objectFit: "contain",
                            margin: "0 auto -4px auto",
                            display: "block",
                          }}
                        />
                      )}
                      {order.validadoPorNombre && (
                        <div style={{ fontWeight: 700, fontSize: "11px", color: "#000" }}>
                          {order.validadoPorNombre}
                        </div>
                      )}
                      <div style={{ fontSize: "10.5px", color: "#111" }}>
                        {order.validadoPorTitulo || "Bioquímico"}{" "}
                        {order.validadoPorMatricula || ""}
                      </div>
                    </div>
                  </div>

                  {cfg.leyendaPiePagina && (
                    <div
                      style={{
                        textAlign: "center",
                        fontFamily: "Arial, Helvetica, sans-serif",
                        fontSize: "9.5px",
                        color: "#1e293b",
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: "4px",
                      }}
                    >
                      {cfg.leyendaPiePagina}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
