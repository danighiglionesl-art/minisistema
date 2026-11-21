import { NextRequest, NextResponse } from "next/server";
import {
  buildDefaultCvFormConfig,
  type CvFormConfig,
  getCvFieldMap,
  mergeCvFormConfig,
} from "../cv-form-config";
import { extractErpSessionFromRequest } from "../erp-session";
import referenceCatalogs from "../reference-catalogs.json";
import {
  getTenantDoc,
  putTenantDoc,
  putTenantMediaInDb,
} from "../supabase-server";
import { enforceOptionBranding } from "../tenant-service";
import { type ErpTenantRecord, GENERAL_ADMIN_USERNAME } from "../types";

type AnyObj = Record<string, any>;

export interface CvExperienceItem {
  empresa: string;
  rubroEmpresa: string;
  puesto: string;
  antiguedad: string;
  desdeAnio: string;
  hastaAnio: string;
  motivoEgreso: string;
  referenciaNombre: string;
  referenciaTelefono: string;
  tareas: string;
}

export interface CvRecord {
  id: string;
  seq: number;
  codigo: string;
  createdAt: string;
  updatedAt: string;
  hasCandidateUpdate?: boolean;
  lastCandidateUpdateAt?: string | null;
  candidateUpdateCount?: number;
  viewed: boolean;
  viewedAt: string | null;
  viewedBy: string | null;
  rating: number | null; // 1..10
  ratedAt: string | null;
  ratedBy: string | null;
  stage: string;
  notes: string;
  deleted?: boolean;
  personal: {
    nombres: string;
    apellidos: string;
    nombreCompleto: string;
    tipoDoc: string;
    nroDoc: string;
    fechaNacimiento: string;
    edad: number | null;
    genero: string;
    estadoCivil: string;
    hijosACargo: string;
    nacionalidad: string;
  };
  ubicacionContacto: {
    pais: string;
    provincia: string;
    localidad: string;
    cp: string;
    domicilio: string;
    domicilioCalle?: string;
    domicilioNumero?: string;
    domicilioPiso?: string;
    domicilioDpto?: string;
    domicilioEdificio?: string;
    domicilioTorre?: string;
    domicilioBarrio?: string;
    whatsappPais: string;
    whatsappPrefijo: string;
    whatsappNumero: string;
    whatsappCompleto: string;
    telefonoAlternativo: string;
    email: string;
    facebookUrl?: string;
    instagramUrl?: string;
    linkedinUrl: string;
  };
  postulacion: {
    puestoPrincipal: string;
    puestoSecundario: string;
    disponibilidadHoraria: string;
    incorporacion: string;
    modalidad: string;
    experienciaTotal: string;
    licenciaConducir: string;
    movilidadPropia: string;
    disponibilidadViajarRotar: string;
    pretensionSalarial: string;
    presentacion: string;
  };
  formacionHabilidades: {
    nivelEstudios: string;
    estadoEstudios: string;
    tituloCarrera: string;
    institucion: string;
    nivelPosFacturacion: string;
    nivelExcel: string;
    nivelAtencionDigital: string;
    idiomaPrincipal: string;
    nivelIdioma: string;
    idiomas?: Array<{ idioma: string; nivel: string }>;
    cursosAdicionales: string;
  };
  experiencias: CvExperienceItem[];
  customFields?: Array<{
    key: string;
    label: string;
    section: string;
    value: string;
  }>;
  archivos: {
    fotoUrl: string;
    pdfUrl: string;
    pdfNombreOriginal: string;
  };
}

interface CvDbDoc {
  updatedAt: string;
  lastSeq: number;
  items: CvRecord[];
  formConfig?: CvFormConfig;
}

export async function getTenantCvFormConfig(
  tenant: ErpTenantRecord
): Promise<CvFormConfig> {
  const { payload: db } = await getTenantDoc<CvDbDoc>(tenant, "cv_db", emptyCvDb());
  return mergeCvFormConfig(db.formConfig);
}

function emptyCvDb(): CvDbDoc {
  return {
    updatedAt: new Date().toISOString(),
    lastSeq: 0,
    items: [],
  };
}

function computeAgeFromIso(iso: string): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const birth = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age >= 14 && age <= 99 ? age : null;
}

async function trySendCandidateConfirmationEmail(params: {
  candidateEmail: string;
  candidateName: string;
  code: string;
  fantasyName: string;
  puesto: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !params.candidateEmail.includes("@")) return false;
  try {
    const fromAddress =
      process.env.SMTP_FROM?.trim() || `${params.fantasyName} <onboarding@resend.dev>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [params.candidateEmail],
        subject: `Confirmación de recepción de tu CV (${params.code}) — ${params.fantasyName}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#112D3A;color:#FFFFFF;border-radius:16px;border:2px solid #56D7A1;">
          <div style="color:#56D7A1;font-weight:800;font-size:12px;text-transform:uppercase;">${params.fantasyName} · Recursos Humanos</div>
          <h2 style="margin:8px 0 12px;color:#FFFFFF;">¡Hola ${params.candidateName}! Recibimos tu CV correctamente.</h2>
          <p style="color:rgba(255,255,255,0.86);line-height:1.5;">Tu postulación para el área <strong>${params.puesto}</strong> quedó registrada en nuestra base de selección con el comprobante <strong>${params.code}</strong>.</p>
          <p style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:16px;">Nuestro equipo evaluará tu perfil y se pondrá en contacto en caso de avanzar con una entrevista. ¡Muchas gracias por postularte!</p>
        </div>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function normalizeDocDigits(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : String(raw || "").trim().toUpperCase();
}

export async function handlePublicCvCatalogs(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const lookupDocRaw = req.nextUrl.searchParams.get("nroDoc") || "";
  if (lookupDocRaw.trim()) {
    const targetDoc = normalizeDocDigits(lookupDocRaw);
    if (!targetDoc || targetDoc.length < 6) {
      return NextResponse.json({ ok: true, found: false, cv: null });
    }
    const { payload: db } = await getTenantDoc<CvDbDoc>(tenant, "cv_db", emptyCvDb());
    const items = Array.isArray(db.items) ? db.items : [];
    const existing = items.find(
      (x) =>
        !x.deleted &&
        normalizeDocDigits(x.personal?.nroDoc || "") === targetDoc
    );
    if (!existing) {
      return NextResponse.json({ ok: true, found: false, cv: null });
    }
    return NextResponse.json({
      ok: true,
      found: true,
      cv: {
        id: existing.id,
        codigo: existing.codigo,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
        personal: existing.personal,
        ubicacionContacto: existing.ubicacionContacto,
        postulacion: existing.postulacion,
        formacionHabilidades: existing.formacionHabilidades,
        experiencias: existing.experiencias,
        customFields: existing.customFields || [],
        archivos: existing.archivos,
      },
    });
  }

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
  );
  const { payload: dbForCfg } = await getTenantDoc<CvDbDoc>(
    tenant,
    "cv_db",
    emptyCvDb()
  );
  return NextResponse.json({
    ok: true,
    tenant: {
      slug: tenant.slug,
      fantasyName: tenant.fantasy_name,
      businessName: tenant.business_name,
      primaryHex: brand.primaryHex,
      accentHex: brand.accentHex,
      logoHorizontalUrl: brand.logoHorizontalUrl,
      logoSymbolUrl: brand.logoSymbolUrl,
      defaultProvincia: brand.provincia || "CÓRDOBA",
      defaultLocalidad: brand.localidad || "RÍO CUARTO",
      defaultCp: brand.cp || "5800",
    },
    formConfig: mergeCvFormConfig(dbForCfg.formConfig),
    catalogs: {
      paises: (referenceCatalogs.catalogs as AnyObj).paises || [],
      provincias: (referenceCatalogs.catalogs as AnyObj).provincias || [],
      localidadesPorProvincia:
        (referenceCatalogs.catalogs as AnyObj).localidadesPorProvincia || {},
    },
  });
}

export async function handlePublicCvSubmission(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const body = ((await req.json().catch(() => null)) || null) as AnyObj | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, message: "Datos de formulario inválidos." },
      { status: 400 }
    );
  }

  const up = (v: unknown) => String(v || "").trim().toUpperCase();
  const nombres = up(body.nombres);
  const apellidos = up(body.apellidos);
  const nroDoc = up(body.nroDoc);
  const fechaNacimiento = String(body.fechaNacimiento || "").trim();
  const genero = String(body.genero || "").trim();
  const estadoCivil = String(body.estadoCivil || "").trim();
  const hijosACargo = String(body.hijosACargo || "").trim();
  const nacionalidad = up(body.nacionalidad);
  const cp = up(body.cp);
  const domicilioCalle = up(body.domicilioCalle);
  const domicilioNumero = up(body.domicilioNumero);
  const domicilioPiso = up(body.domicilioPiso);
  const domicilioDpto = up(body.domicilioDpto);
  const domicilioEdificio = up(body.domicilioEdificio);
  const domicilioTorre = up(body.domicilioTorre);
  const domicilioBarrio = up(body.domicilioBarrio);
  const whatsappNumero = String(body.whatsappNumero || "").replace(/[^\d]/g, "");
  const whatsappPrefijo = String(body.whatsappPrefijo || "+549").trim();
  const email = up(body.email);
  const facebookUrl = up(body.facebookUrl);
  const instagramUrl = up(body.instagramUrl);
  const puestoPrincipal = String(body.puestoPrincipal || "").trim();
  const experienciaTotal = String(body.experienciaTotal || "").trim();
  const disponibilidadHoraria = String(body.disponibilidadHoraria || "").trim();
  const modalidad = String(body.modalidad || "").trim();
  const licenciaConducir = String(body.licenciaConducir || "").trim();
  const pretensionSalarial = String(body.pretensionSalarial || "").trim();
  const nivelEstudios = String(body.nivelEstudios || "").trim();
  const estadoEstudios = String(body.estadoEstudios || "").trim();
  const tituloCarrera = up(body.tituloCarrera);
  const institucion = up(body.institucion);
  const nivelPosFacturacion = String(body.nivelPosFacturacion || "").trim();
  const nivelExcel = String(body.nivelExcel || "").trim();
  const nivelAtencionDigital = String(body.nivelAtencionDigital || "").trim();
  const rawIdiomas = Array.isArray(body.idiomas) ? body.idiomas : [];
  const idiomasParsed: Array<{ idioma: string; nivel: string }> = [];
  const seenLangs = new Set<string>();
  for (const item of rawIdiomas) {
    if (!item || typeof item !== "object") continue;
    const lang = String((item as AnyObj).idioma || "").trim();
    const lvl = String((item as AnyObj).nivel || "Básico").trim() || "Básico";
    if (!lang || lang.toLowerCase() === "ninguno") continue;
    const key = lang.toLowerCase();
    if (seenLangs.has(key)) continue;
    seenLangs.add(key);
    idiomasParsed.push({ idioma: lang, nivel: lvl });
    if (idiomasParsed.length >= 10) break;
  }
  const rawIdiomaPrincipal = String(body.idiomaPrincipal || "").trim();
  if (
    idiomasParsed.length === 0 &&
    rawIdiomaPrincipal &&
    rawIdiomaPrincipal.toLowerCase() !== "ninguno"
  ) {
    idiomasParsed.push({
      idioma: rawIdiomaPrincipal,
      nivel: String(body.nivelIdioma || "Básico").trim() || "Básico",
    });
  }
  const idiomaPrincipal =
    idiomasParsed.length > 0 ? idiomasParsed[0].idioma : rawIdiomaPrincipal;
  const nivelIdiomaFinal =
    idiomasParsed.length > 0
      ? idiomasParsed[0].nivel
      : idiomaPrincipal === "Ninguno"
      ? ""
      : String(body.nivelIdioma || "").trim();

  const { payload: db } = await getTenantDoc<CvDbDoc>(tenant, "cv_db", emptyCvDb());
  if (!Array.isArray(db.items)) db.items = [];
  const formConfig = mergeCvFormConfig(db.formConfig);
  const fmap = getCvFieldMap(formConfig);
  const isReq = (key: string) => Boolean(fmap[key]?.enabled && fmap[key]?.required);

  if (!nombres || !apellidos) {
    return NextResponse.json(
      { ok: false, message: "Por favor completá tu Nombre y Apellido." },
      { status: 400 }
    );
  }
  if (!nroDoc || nroDoc.length < 6) {
    return NextResponse.json(
      { ok: false, message: "Por favor ingresá un número de documento válido." },
      { status: 400 }
    );
  }
  if (isReq("fechaNacimiento") && !fechaNacimiento) {
    return NextResponse.json(
      { ok: false, message: "Por favor indicá tu Fecha de Nacimiento." },
      { status: 400 }
    );
  }
  if (isReq("genero") && !genero) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Género." },
      { status: 400 }
    );
  }
  if (isReq("estadoCivil") && !estadoCivil) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Estado Civil." },
      { status: 400 }
    );
  }
  if (isReq("hijosACargo") && !hijosACargo) {
    return NextResponse.json(
      { ok: false, message: "Por favor indicá tus Cargas de Familia." },
      { status: 400 }
    );
  }
  if (isReq("nacionalidad") && !nacionalidad) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Nacionalidad." },
      { status: 400 }
    );
  }
  if (isReq("cp") && !cp) {
    return NextResponse.json(
      { ok: false, message: "Por favor ingresá tu Código Postal." },
      { status: 400 }
    );
  }
  if (
    (isReq("domicilioCalle") && !domicilioCalle) ||
    (isReq("domicilioNumero") && !domicilioNumero) ||
    (isReq("domicilioBarrio") && !domicilioBarrio)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Por favor completá los datos obligatorios de tu domicilio.",
      },
      { status: 400 }
    );
  }
  if (isReq("whatsapp") && (!whatsappNumero || whatsappNumero.length < 6)) {
    return NextResponse.json(
      { ok: false, message: "Por favor ingresá tu número de WhatsApp." },
      { status: 400 }
    );
  }
  if (isReq("email") && (!email || !email.includes("@"))) {
    return NextResponse.json(
      { ok: false, message: "Por favor ingresá un correo electrónico válido." },
      { status: 400 }
    );
  }
  if (
    (isReq("facebookUrl") && !facebookUrl) ||
    (isReq("instagramUrl") && !instagramUrl)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Por favor completá los campos obligatorios de redes sociales (o indicá 'No tengo').",
      },
      { status: 400 }
    );
  }
  if (isReq("puestoPrincipal") && !puestoPrincipal) {
    return NextResponse.json(
      { ok: false, message: "Seleccioná el puesto o área principal al que te postulás." },
      { status: 400 }
    );
  }
  if (isReq("experienciaTotal") && !experienciaTotal) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Experiencia Laboral." },
      { status: 400 }
    );
  }
  if (isReq("disponibilidadHoraria") && !disponibilidadHoraria) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Disponibilidad Horaria." },
      { status: 400 }
    );
  }
  if (isReq("modalidad") && !modalidad) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Modalidad Preferida." },
      { status: 400 }
    );
  }
  if (isReq("licenciaConducir") && !licenciaConducir) {
    return NextResponse.json(
      { ok: false, message: "Por favor indicá tu Licencia de Conducir." },
      { status: 400 }
    );
  }
  if (isReq("pretensionSalarial") && !pretensionSalarial) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Pretensión Salarial." },
      { status: 400 }
    );
  }
  if (
    (isReq("nivelEstudios") && !nivelEstudios) ||
    (isReq("estadoEstudios") && !estadoEstudios)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message: "Por favor seleccioná tu Nivel Máximo de Estudios y Estado de Estudios.",
      },
      { status: 400 }
    );
  }
  if (
    (isReq("tituloCarrera") && !tituloCarrera) ||
    (isReq("institucion") && !institucion)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Por favor completá los datos obligatorios de Título / Carrera e Institución Educativa.",
      },
      { status: 400 }
    );
  }
  if (
    (isReq("nivelPosFacturacion") && !nivelPosFacturacion) ||
    (isReq("nivelExcel") && !nivelExcel) ||
    (isReq("nivelAtencionDigital") && !nivelAtencionDigital)
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Por favor completá los campos obligatorios de manejo de sistemas.",
      },
      { status: 400 }
    );
  }
  if (isReq("idiomaPrincipal") && !idiomaPrincipal) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná una opción en Idioma Extra." },
      { status: 400 }
    );
  }

  // Validar y recolectar campos personalizados habilitados
  const rawCustomObj: Record<string, unknown> =
    body.customFields && typeof body.customFields === "object" && !Array.isArray(body.customFields)
      ? (body.customFields as Record<string, unknown>)
      : {};
  const customFields: Array<{
    key: string;
    label: string;
    section: string;
    value: string;
  }> = [];
  for (const cf of formConfig.fields) {
    if (!cf.isCustom || !cf.enabled) continue;
    const rawVal = rawCustomObj[cf.key];
    const strVal =
      cf.type === "select" || cf.type === "date" || cf.type === "number"
        ? String(rawVal ?? "").trim()
        : up(rawVal);
    if (cf.required && !strVal) {
      return NextResponse.json(
        { ok: false, message: `Por favor completá el campo obligatorio: ${cf.label}.` },
        { status: 400 }
      );
    }
    if (strVal) {
      customFields.push({
        key: cf.key,
        label: cf.label,
        section: cf.section,
        value: strVal,
      });
    }
  }

  const targetDocNorm = normalizeDocDigits(nroDoc);
  const existingIdx = db.items.findIndex(
    (x) => !x.deleted && normalizeDocDigits(x.personal?.nroDoc || "") === targetDocNorm
  );
  const existingRecord = existingIdx >= 0 ? db.items[existingIdx] : null;
  const isUpdate = Boolean(existingRecord);

  const nextSeq = existingRecord ? existingRecord.seq : Number(db.lastSeq || 0) + 1;
  if (!existingRecord) {
    db.lastSeq = nextSeq;
  }
  const year = new Date().getFullYear();
  const codigo = existingRecord
    ? existingRecord.codigo
    : `CV-${year}-${String(nextSeq).padStart(4, "0")}`;
  const cvId = existingRecord ? existingRecord.id : `cv_${Date.now()}_${nextSeq}`;

  let fotoUrl = existingRecord?.archivos?.fotoUrl || "";
  const rawPhoto = String(body.fotoBase64 || "").trim();
  if (rawPhoto) {
    const mPhoto = rawPhoto.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
    if (mPhoto) {
      const ext = mPhoto[1].includes("png") ? "png" : mPhoto[1].includes("webp") ? "webp" : "jpg";
      const photoKey = `cv_photo_${nextSeq}_${Date.now()}.${ext}`;
      await putTenantMediaInDb(tenant, {
        media_key: photoKey,
        category: "products",
        mime_type: mPhoto[1].toLowerCase(),
        data_b64: mPhoto[2],
      });
      fotoUrl = `/sistema/assets/products/${photoKey}?tenant=${encodeURIComponent(tenant.slug)}`;
    } else if (rawPhoto.startsWith("/sistema/assets/") || rawPhoto.startsWith("http")) {
      fotoUrl = rawPhoto;
    }
  } else if (body.clearPhoto === true) {
    fotoUrl = "";
  }

  let pdfUrl = existingRecord?.archivos?.pdfUrl || "";
  let pdfNombreOriginal =
    String(body.pdfFileName || "").trim() ||
    existingRecord?.archivos?.pdfNombreOriginal ||
    "";
  const rawPdf = String(body.pdfBase64 || "").trim();
  if (rawPdf) {
    const mPdf = rawPdf.match(/^data:(application\/pdf);base64,(.+)$/i);
    if (!mPdf) {
      return NextResponse.json(
        { ok: false, message: "El archivo adjunto debe estar en formato PDF (.pdf)." },
        { status: 400 }
      );
    }
    // ~3 MB raw (~4.0 MB base64) check to stay safely within Vercel serverless payload limits
    if (mPdf[2].length > 4_300_000) {
      return NextResponse.json(
        { ok: false, message: "El archivo PDF supera el tamaño máximo permitido de 3 MB." },
        { status: 400 }
      );
    }
    const pdfKey = `cv_doc_${nextSeq}_${Date.now()}.pdf`;
    await putTenantMediaInDb(tenant, {
      media_key: pdfKey,
      category: "banners",
      mime_type: "application/pdf",
      data_b64: mPdf[2],
    });
    pdfUrl = `/sistema/assets/banners/${pdfKey}?tenant=${encodeURIComponent(tenant.slug)}`;
  } else if (body.clearPdf === true) {
    pdfUrl = "";
    pdfNombreOriginal = "";
  }

  const domicilioParts = [
    `${domicilioCalle} ${domicilioNumero}`.trim(),
    domicilioPiso ? `PISO ${domicilioPiso}` : "",
    domicilioDpto ? `DPTO. ${domicilioDpto}` : "",
    domicilioEdificio ? `EDIFICIO ${domicilioEdificio}` : "",
    domicilioTorre ? `TORRE ${domicilioTorre}` : "",
    domicilioBarrio ? `B° ${domicilioBarrio}` : "",
  ].filter(Boolean);
  const domicilioComposed = domicilioParts.join(", ") || up(body.domicilio);

  const cleanPrefDigits = whatsappPrefijo.replace(/[^\d+]/g, "");
  const whatsappCompleto = `${cleanPrefDigits}${whatsappNumero}`;
  const nowIso = new Date().toISOString();

  const expEnabled = fmap.experiencias ? fmap.experiencias.enabled : true;
  const sinExpPrevia =
    !expEnabled ||
    Boolean(body.sinExperienciaPrevia) ||
    experienciaTotal === "Sin experiencia / Primer empleo";
  const rawExps = Array.isArray(body.experiencias) ? body.experiencias : [];

  if (!sinExpPrevia && isReq("experiencias")) {
    if (rawExps.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Por favor completá al menos una Experiencia Laboral o marcá 'Postulación a Primer Empleo'.",
        },
        { status: 400 }
      );
    }
    for (let i = 0; i < Math.min(rawExps.length, 10); i++) {
      const e = (rawExps[i] || {}) as AnyObj;
      if (
        !String(e.empresa || "").trim() ||
        (isReq("expRubroEmpresa") && !String(e.rubroEmpresa || "").trim()) ||
        !String(e.puesto || "").trim() ||
        !String(e.desdeAnio || "").trim() ||
        !String(e.hastaAnio || "").trim() ||
        (isReq("expAntiguedad") && !String(e.antiguedad || "").trim()) ||
        (isReq("expMotivoEgreso") && !String(e.motivoEgreso || "").trim()) ||
        !String(e.referenciaNombre || "").trim() ||
        !String(e.referenciaTelefono || "").trim() ||
        !String(e.tareas || "").trim()
      ) {
        return NextResponse.json(
          {
            ok: false,
            message: `Por favor completá todos los campos obligatorios de la Experiencia Laboral #${i + 1}.`,
          },
          { status: 400 }
        );
      }
    }
  }

  const experiencias: CvExperienceItem[] = sinExpPrevia
    ? []
    : rawExps
        .filter((e: AnyObj) => e && (String(e.empresa || "").trim() || String(e.puesto || "").trim()))
        .slice(0, 10)
        .map((e: AnyObj) => ({
          empresa: up(e.empresa),
          rubroEmpresa: String(e.rubroEmpresa || "").trim(),
          puesto: up(e.puesto),
          antiguedad: String(e.antiguedad || "").trim(),
          desdeAnio: String(e.desdeAnio || "").trim(),
          hastaAnio: String(e.hastaAnio || "").trim(),
          motivoEgreso: String(e.motivoEgreso || "").trim(),
          referenciaNombre: up(e.referenciaNombre),
          referenciaTelefono: up(e.referenciaTelefono),
          tareas: up(e.tareas),
        }));

  const record: CvRecord = {
    id: cvId,
    seq: nextSeq,
    codigo,
    createdAt: existingRecord ? existingRecord.createdAt : nowIso,
    updatedAt: nowIso,
    hasCandidateUpdate: isUpdate,
    lastCandidateUpdateAt: isUpdate ? nowIso : existingRecord?.lastCandidateUpdateAt || null,
    candidateUpdateCount: isUpdate
      ? Number(existingRecord?.candidateUpdateCount || 0) + 1
      : 0,
    viewed: false,
    viewedAt: null,
    viewedBy: null,
    rating: existingRecord ? existingRecord.rating : null,
    ratedAt: existingRecord ? existingRecord.ratedAt : null,
    ratedBy: existingRecord ? existingRecord.ratedBy : null,
    stage: isUpdate ? "actualizado" : "recibido",
    notes: existingRecord ? existingRecord.notes : "",
    personal: {
      nombres,
      apellidos,
      nombreCompleto: `${apellidos.toUpperCase()}, ${nombres}`,
      tipoDoc: String(body.tipoDoc || "DNI").trim(),
      nroDoc,
      fechaNacimiento,
      edad: computeAgeFromIso(fechaNacimiento),
      genero,
      estadoCivil,
      hijosACargo,
      nacionalidad,
    },
    ubicacionContacto: {
      pais: up(body.pais || "ARGENTINA"),
      provincia: up(body.provincia),
      localidad: up(body.localidad),
      cp,
      domicilio: domicilioComposed,
      domicilioCalle,
      domicilioNumero,
      domicilioPiso,
      domicilioDpto,
      domicilioEdificio,
      domicilioTorre,
      domicilioBarrio,
      whatsappPais: String(body.whatsappPais || "Argentina").trim(),
      whatsappPrefijo: cleanPrefDigits,
      whatsappNumero,
      whatsappCompleto,
      telefonoAlternativo: up(body.telefonoAlternativo),
      email,
      facebookUrl,
      instagramUrl,
      linkedinUrl: up(body.linkedinUrl),
    },
    postulacion: {
      puestoPrincipal,
      puestoSecundario: String(body.puestoSecundario || "").trim(),
      disponibilidadHoraria,
      incorporacion: String(body.incorporacion || "Inmediata").trim(),
      modalidad,
      experienciaTotal,
      licenciaConducir,
      movilidadPropia: String(body.movilidadPropia || "No posee").trim(),
      disponibilidadViajarRotar: String(body.disponibilidadViajarRotar || "Sí").trim(),
      pretensionSalarial,
      presentacion: up(body.presentacion),
    },
    formacionHabilidades: {
      nivelEstudios,
      estadoEstudios,
      tituloCarrera,
      institucion,
      nivelPosFacturacion,
      nivelExcel,
      nivelAtencionDigital,
      idiomaPrincipal: idiomaPrincipal || "Ninguno",
      nivelIdioma: nivelIdiomaFinal,
      idiomas: idiomasParsed,
      cursosAdicionales: up(body.cursosAdicionales),
    },
    experiencias,
    customFields,
    archivos: {
      fotoUrl,
      pdfUrl,
      pdfNombreOriginal,
    },
  };

  if (existingIdx >= 0) {
    db.items.splice(existingIdx, 1);
  }
  db.items.unshift(record);
  db.updatedAt = nowIso;
  await putTenantDoc(
    tenant,
    "cv_db",
    db,
    "postulante_web",
    isUpdate ? "update_cv_by_dni" : "submit_cv"
  );

  const emailSent = await trySendCandidateConfirmationEmail({
    candidateEmail: email.toLowerCase(),
    candidateName: `${nombres} ${apellidos}`,
    code: codigo,
    fantasyName: tenant.fantasy_name || "MiniSistema",
    puesto: puestoPrincipal,
  });

  return NextResponse.json({
    ok: true,
    isUpdate,
    codigo,
    submittedAt: nowIso,
    candidateName: `${nombres} ${apellidos}`,
    puesto: puestoPrincipal,
    emailNotificationSent: emailSent,
    message: isUpdate
      ? `¡Tus datos de Curriculum Vitae (DNI ${nroDoc}) fueron actualizados correctamente bajo tu comprobante ${codigo} y se envió una alerta de nuevos datos al administrador!`
      : `¡Tu Curriculum Vitae fue enviado y registrado correctamente bajo el comprobante ${codigo}!`,
  });
}

export async function handleErpCurriculum(
  req: NextRequest,
  tenant: ErpTenantRecord
): Promise<NextResponse> {
  const sess =
    extractErpSessionFromRequest(req, tenant.slug) ||
    extractErpSessionFromRequest(req, "minisistema");
  const actorHeader = (req.headers.get("x-erp-user") || "").trim().toLowerCase();
  const actor = sess?.username || actorHeader || "";

  if (!sess && actor !== GENERAL_ADMIN_USERNAME) {
    return NextResponse.json(
      { ok: false, message: "Sesión expirada. Iniciá sesión en el sistema." },
      { status: 401 }
    );
  }

  const { payload: db } = await getTenantDoc<CvDbDoc>(tenant, "cv_db", emptyCvDb());
  if (!Array.isArray(db.items)) db.items = [];
  const activeItems = db.items.filter((x) => !x.deleted);

  if (req.method === "GET") {
    const recibidos = activeItems.filter((x) => !x.viewed);
    const actualizadosSinVer = recibidos.filter((x) => Boolean(x.hasCandidateUpdate));
    const previsualizados = activeItems.filter((x) => Boolean(x.viewed));
    const rated = previsualizados.filter(
      (x) => typeof x.rating === "number" && x.rating >= 1 && x.rating <= 10
    );
    const avgRating =
      rated.length > 0
        ? Math.round(
            (rated.reduce((acc, c) => acc + Number(c.rating || 0), 0) / rated.length) *
              10
          ) / 10
        : null;

    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "www.minisistema.com.ar";
    const proto = host.includes("localhost") || host.startsWith("127.") ? "http" : "https";
    const publicCvUrl =
      tenant.option_type === 2 && !tenant.is_base
        ? `${proto}://${host}/${tenant.slug}/cv`
        : `${proto}://${host}/cv`;

    return NextResponse.json({
      ok: true,
      publicCvUrl,
      formConfig: mergeCvFormConfig(db.formConfig),
      stats: {
        totalActivos: activeItems.length,
        recibidosSinVer: recibidos.length,
        actualizadosSinVerCount: actualizadosSinVer.length,
        previsualizadosCount: previsualizados.length,
        promedioValoracion: avgRating,
      },
      recibidos,
      previsualizados,
    });
  }

  if (req.method === "POST") {
    const body = ((await req.json().catch(() => ({}))) || {}) as AnyObj;
    const action = String(body.action || "").trim();

    if (action === "save_form_config") {
      const merged = mergeCvFormConfig(body.formConfig || body);
      merged.updatedAt = new Date().toISOString();
      merged.updatedBy = actor || "admin";
      db.formConfig = merged;
      db.updatedAt = merged.updatedAt;
      await putTenantDoc(tenant, "cv_db", db, actor || "admin", "save_cv_form_config");
      return NextResponse.json({
        ok: true,
        message: "Configuración de tablas guardada y aplicada en vivo al formulario /cv.",
        formConfig: merged,
      });
    }

    if (action === "reset_form_config") {
      const fresh = buildDefaultCvFormConfig();
      fresh.updatedBy = actor || "admin";
      db.formConfig = fresh;
      db.updatedAt = fresh.updatedAt;
      await putTenantDoc(tenant, "cv_db", db, actor || "admin", "reset_cv_form_config");
      return NextResponse.json({
        ok: true,
        message: "Configuración restablecida a los valores predeterminados.",
        formConfig: fresh,
      });
    }

    const targetId = String(body.id || "").trim();
    const item = db.items.find((x) => x.id === targetId && !x.deleted);

    if (!item) {
      return NextResponse.json(
        { ok: false, message: "Curriculum Vitae no encontrado." },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    if (action === "mark_previewed") {
      if (!item.viewed || item.hasCandidateUpdate) {
        item.viewed = true;
        item.viewedAt = nowIso;
        item.viewedBy = actor || "admin";
        item.hasCandidateUpdate = false;
        if (item.stage === "recibido" || item.stage === "actualizado") {
          item.stage = "previsualizado";
        }
        item.updatedAt = nowIso;
        db.updatedAt = nowIso;
        await putTenantDoc(tenant, "cv_db", db, actor || "admin", "mark_cv_previewed");
      }
      return NextResponse.json({ ok: true, cv: item });
    }

    if (action === "unmark_previewed") {
      item.viewed = false;
      item.viewedAt = null;
      item.viewedBy = null;
      item.updatedAt = nowIso;
      db.updatedAt = nowIso;
      await putTenantDoc(tenant, "cv_db", db, actor || "admin", "unmark_cv_previewed");
      return NextResponse.json({ ok: true, cv: item });
    }

    if (action === "rate_cv") {
      if (body.rating !== undefined && body.rating !== null && body.rating !== "") {
        const numRating = Math.round(Number(body.rating));
        if (!Number.isFinite(numRating) || numRating < 1 || numRating > 10) {
          return NextResponse.json(
            { ok: false, message: "La valoración debe ser un número del 1 al 10." },
            { status: 400 }
          );
        }
        item.rating = numRating;
        item.ratedAt = nowIso;
        item.ratedBy = actor || "admin";
      }
      if (typeof body.notes === "string") {
        item.notes = body.notes.trim();
      }
      if (typeof body.stage === "string" && body.stage.trim()) {
        item.stage = body.stage.trim();
      }
      if (!item.viewed) {
        item.viewed = true;
        item.viewedAt = nowIso;
        item.viewedBy = actor || "admin";
      }
      item.updatedAt = nowIso;
      db.updatedAt = nowIso;
      await putTenantDoc(tenant, "cv_db", db, actor || "admin", "rate_cv");
      return NextResponse.json({
        ok: true,
        message: item.rating
          ? `Valoración ${item.rating}/10 guardada para ${item.personal.nombreCompleto}.`
          : "Datos de evaluación actualizados.",
        cv: item,
      });
    }

    if (action === "delete_cv") {
      item.deleted = true;
      item.updatedAt = nowIso;
      db.updatedAt = nowIso;
      await putTenantDoc(tenant, "cv_db", db, actor || "admin", "delete_cv");
      return NextResponse.json({ ok: true, message: "CV eliminado correctamente." });
    }

    return NextResponse.json(
      { ok: false, message: `Acción desconocida: ${action}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: false }, { status: 405 });
}
