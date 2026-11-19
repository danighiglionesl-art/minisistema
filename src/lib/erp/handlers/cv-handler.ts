import { NextRequest, NextResponse } from "next/server";
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
    cursosAdicionales: string;
  };
  experiencias: CvExperienceItem[];
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
        archivos: existing.archivos,
      },
    });
  }

  const brand = enforceOptionBranding(
    tenant.option_type,
    tenant.is_base,
    tenant.branding
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

  const nombres = String(body.nombres || "").trim();
  const apellidos = String(body.apellidos || "").trim();
  const nroDoc = String(body.nroDoc || "").trim();
  const fechaNacimiento = String(body.fechaNacimiento || "").trim();
  const genero = String(body.genero || "").trim();
  const estadoCivil = String(body.estadoCivil || "").trim();
  const hijosACargo = String(body.hijosACargo || "").trim();
  const nacionalidad = String(body.nacionalidad || "").trim();
  const cp = String(body.cp || "").trim();
  const domicilioCalle = String(body.domicilioCalle || "").trim();
  const domicilioNumero = String(body.domicilioNumero || "").trim();
  const domicilioPiso = String(body.domicilioPiso || "").trim();
  const domicilioDpto = String(body.domicilioDpto || "").trim();
  const domicilioEdificio = String(body.domicilioEdificio || "").trim();
  const domicilioTorre = String(body.domicilioTorre || "").trim();
  const domicilioBarrio = String(body.domicilioBarrio || "").trim();
  const whatsappNumero = String(body.whatsappNumero || "").replace(/[^\d]/g, "");
  const whatsappPrefijo = String(body.whatsappPrefijo || "+549").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const facebookUrl = String(body.facebookUrl || "").trim();
  const instagramUrl = String(body.instagramUrl || "").trim();
  const puestoPrincipal = String(body.puestoPrincipal || "").trim();
  const experienciaTotal = String(body.experienciaTotal || "").trim();
  const disponibilidadHoraria = String(body.disponibilidadHoraria || "").trim();
  const modalidad = String(body.modalidad || "").trim();
  const licenciaConducir = String(body.licenciaConducir || "").trim();
  const pretensionSalarial = String(body.pretensionSalarial || "").trim();
  const nivelEstudios = String(body.nivelEstudios || "").trim();
  const estadoEstudios = String(body.estadoEstudios || "").trim();
  const nivelPosFacturacion = String(body.nivelPosFacturacion || "").trim();
  const nivelExcel = String(body.nivelExcel || "").trim();
  const nivelAtencionDigital = String(body.nivelAtencionDigital || "").trim();
  const idiomaPrincipal = String(body.idiomaPrincipal || "").trim();

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
  if (!fechaNacimiento) {
    return NextResponse.json(
      { ok: false, message: "Por favor indicá tu Fecha de Nacimiento." },
      { status: 400 }
    );
  }
  if (!genero) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Género." },
      { status: 400 }
    );
  }
  if (!estadoCivil) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Estado Civil." },
      { status: 400 }
    );
  }
  if (!hijosACargo) {
    return NextResponse.json(
      { ok: false, message: "Por favor indicá tus Cargas de Familia." },
      { status: 400 }
    );
  }
  if (!nacionalidad) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Nacionalidad." },
      { status: 400 }
    );
  }
  if (!cp) {
    return NextResponse.json(
      { ok: false, message: "Por favor ingresá tu Código Postal." },
      { status: 400 }
    );
  }
  if (!domicilioCalle || !domicilioNumero || !domicilioBarrio) {
    return NextResponse.json(
      {
        ok: false,
        message: "Por favor completá Calle, Número y Barrio de tu domicilio.",
      },
      { status: 400 }
    );
  }
  if (!whatsappNumero || whatsappNumero.length < 6) {
    return NextResponse.json(
      { ok: false, message: "Por favor ingresá tu número de WhatsApp." },
      { status: 400 }
    );
  }
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { ok: false, message: "Por favor ingresá un correo electrónico válido." },
      { status: 400 }
    );
  }
  if (!facebookUrl || !instagramUrl) {
    return NextResponse.json(
      {
        ok: false,
        message: "Por favor completá Facebook e Instagram (o indicá 'No tengo').",
      },
      { status: 400 }
    );
  }
  if (!puestoPrincipal) {
    return NextResponse.json(
      { ok: false, message: "Seleccioná el puesto o área principal al que te postulás." },
      { status: 400 }
    );
  }
  if (!experienciaTotal) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Experiencia Laboral." },
      { status: 400 }
    );
  }
  if (!disponibilidadHoraria) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Disponibilidad Horaria." },
      { status: 400 }
    );
  }
  if (!modalidad) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Modalidad Preferida." },
      { status: 400 }
    );
  }
  if (!licenciaConducir) {
    return NextResponse.json(
      { ok: false, message: "Por favor indicá tu Licencia de Conducir." },
      { status: 400 }
    );
  }
  if (!pretensionSalarial) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná tu Pretensión Salarial." },
      { status: 400 }
    );
  }
  if (!nivelEstudios || !estadoEstudios) {
    return NextResponse.json(
      {
        ok: false,
        message: "Por favor seleccioná tu Nivel Máximo de Estudios y Estado de Estudios.",
      },
      { status: 400 }
    );
  }
  if (!nivelPosFacturacion || !nivelExcel || !nivelAtencionDigital) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Por favor completá tu nivel de Sistemas de Caja POS, Excel y WhatsApp Comercial.",
      },
      { status: 400 }
    );
  }
  if (!idiomaPrincipal) {
    return NextResponse.json(
      { ok: false, message: "Por favor seleccioná una opción en Idioma Extra." },
      { status: 400 }
    );
  }

  const { payload: db } = await getTenantDoc<CvDbDoc>(tenant, "cv_db", emptyCvDb());
  if (!Array.isArray(db.items)) db.items = [];

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
    domicilioPiso ? `Piso ${domicilioPiso}` : "",
    domicilioDpto ? `Dpto. ${domicilioDpto}` : "",
    domicilioEdificio ? `Edificio ${domicilioEdificio}` : "",
    domicilioTorre ? `Torre ${domicilioTorre}` : "",
    domicilioBarrio ? `B° ${domicilioBarrio}` : "",
  ].filter(Boolean);
  const domicilioComposed = domicilioParts.join(", ") || String(body.domicilio || "").trim();

  const cleanPrefDigits = whatsappPrefijo.replace(/[^\d+]/g, "");
  const whatsappCompleto = `${cleanPrefDigits}${whatsappNumero}`;
  const nowIso = new Date().toISOString();

  const rawExps = Array.isArray(body.experiencias) ? body.experiencias : [];
  const experiencias: CvExperienceItem[] = rawExps
    .filter((e: AnyObj) => e && (String(e.empresa || "").trim() || String(e.puesto || "").trim()))
    .slice(0, 10)
    .map((e: AnyObj) => ({
      empresa: String(e.empresa || "").trim(),
      rubroEmpresa: String(e.rubroEmpresa || "").trim(),
      puesto: String(e.puesto || "").trim(),
      antiguedad: String(e.antiguedad || "").trim(),
      desdeAnio: String(e.desdeAnio || "").trim(),
      hastaAnio: String(e.hastaAnio || "").trim(),
      motivoEgreso: String(e.motivoEgreso || "").trim(),
      referenciaNombre: String(e.referenciaNombre || "").trim(),
      referenciaTelefono: String(e.referenciaTelefono || "").trim(),
      tareas: String(e.tareas || "").trim(),
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
      pais: String(body.pais || "ARGENTINA").trim(),
      provincia: String(body.provincia || "").trim(),
      localidad: String(body.localidad || "").trim(),
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
      telefonoAlternativo: String(body.telefonoAlternativo || "").trim(),
      email,
      facebookUrl,
      instagramUrl,
      linkedinUrl: String(body.linkedinUrl || "").trim(),
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
      presentacion: String(body.presentacion || "").trim(),
    },
    formacionHabilidades: {
      nivelEstudios,
      estadoEstudios,
      tituloCarrera: String(body.tituloCarrera || "").trim(),
      institucion: String(body.institucion || "").trim(),
      nivelPosFacturacion,
      nivelExcel,
      nivelAtencionDigital,
      idiomaPrincipal,
      nivelIdioma: idiomaPrincipal === "Ninguno" ? "" : String(body.nivelIdioma || "").trim(),
      cursosAdicionales: String(body.cursosAdicionales || "").trim(),
    },
    experiencias,
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
    candidateEmail: email,
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
