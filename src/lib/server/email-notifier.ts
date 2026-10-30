import net from "node:net";
import tls from "node:tls";
import type { StoredInquiry } from "@/lib/server/data-store";

/**
 * Destinatario interno oculto para el envío de todos los formularios del sitio.
 * Este correo se procesa exclusivamente en el servidor (backend) y nunca se expone
 * en el HTML público, componentes cliente ni respuestas de la API pública.
 */
const HIDDEN_RECIPIENT_EMAIL =
  process.env.NOTIFICATION_RECIPIENT_EMAIL?.trim() || "danighiglionesl@gmail.com";

export interface EmailDispatchResult {
  sent: boolean;
  provider: "smtp" | "resend" | "formsubmit" | "none";
  detail: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailSubject(inquiry: StoredInquiry): string {
  const originLabel =
    inquiry.source === "configurador"
      ? "Configurador de Proyectos"
      : "Formulario de Contacto";
  return `[MiniSistema ${inquiry.id}] Nueva consulta (${originLabel}) — ${inquiry.contact.fullName}`;
}

function buildEmailPlainText(inquiry: StoredInquiry): string {
  const originLabel =
    inquiry.source === "configurador"
      ? "Configurador Interactivo de Proyectos"
      : "Formulario de Contacto Directo";

  return [
    `NUEVA CONSULTA RECIBIDA EN MINISISTEMA (${inquiry.id})`,
    `============================================================`,
    `Origen: ${originLabel}`,
    `Fecha: ${new Date(inquiry.createdAt).toLocaleString("es-AR")}`,
    ``,
    `DATOS DE CONTACTO`,
    `-----------------`,
    `Nombre y apellido: ${inquiry.contact.fullName}`,
    `Comercio / Institución: ${inquiry.contact.businessName}`,
    `WhatsApp: ${inquiry.contact.whatsapp}`,
    `Correo electrónico: ${inquiry.contact.email}`,
    `Localidad y Provincia: ${inquiry.contact.city}, ${inquiry.contact.province}`,
    ``,
    `DETALLE DE LA SOLICITUD`,
    `-----------------------`,
    `Actividad / Rubro: ${inquiry.businessActivity}`,
    `Necesidades seleccionadas: ${inquiry.selectedNeeds.join(", ") || "Consulta general"}`,
    `Sistema actual: ${inquiry.currentSystemStatus}`,
    ...(inquiry.preselectedCategory
      ? [`Categoría preseleccionada: ${inquiry.preselectedCategory}`]
      : []),
    ...(inquiry.preselectedService
      ? [`Servicio preseleccionado: ${inquiry.preselectedService}`]
      : []),
    ``,
    `MENSAJE / DESCRIPCIÓN DEL PROYECTO:`,
    `${inquiry.projectDescription}`,
  ].join("\n");
}

function buildEmailHtml(inquiry: StoredInquiry): string {
  const originLabel =
    inquiry.source === "configurador"
      ? "Configurador Interactivo de Proyectos"
      : "Formulario de Contacto Directo";

  const cleanWa = inquiry.contact.whatsapp.replace(/\D/g, "");
  const waHref = cleanWa ? `https://wa.me/${cleanWa}` : "#";

  return `<!DOCTYPE html>
<html lang="es">
  <body style="margin:0;padding:24px;background-color:#112D3A;color:#FFFFFF;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background-color:#112D3A;border:2px solid #56D7A1;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid rgba(255,255,255,0.15);">
          <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#56D7A1;">
            MiniSistema · ${escapeHtml(originLabel)}
          </div>
          <h1 style="margin:6px 0 0 0;font-size:20px;color:#FFFFFF;">
            Solicitud ${escapeHtml(inquiry.id)} — ${escapeHtml(inquiry.contact.fullName)}
          </h1>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 24px;">
          <h2 style="margin:0 0 10px 0;font-size:14px;text-transform:uppercase;color:#56D7A1;">
            Datos de contacto
          </h2>
          <p style="margin:4px 0;font-size:14px;color:#FFFFFF;">
            <strong>Nombre y apellido:</strong> ${escapeHtml(inquiry.contact.fullName)}
          </p>
          <p style="margin:4px 0;font-size:14px;color:#FFFFFF;">
            <strong>Comercio / Empresa:</strong> ${escapeHtml(inquiry.contact.businessName)}
          </p>
          <p style="margin:4px 0;font-size:14px;color:#FFFFFF;">
            <strong>WhatsApp:</strong> <a href="${waHref}" style="color:#56D7A1;text-decoration:underline;">${escapeHtml(inquiry.contact.whatsapp)}</a>
          </p>
          <p style="margin:4px 0;font-size:14px;color:#FFFFFF;">
            <strong>Correo electrónico:</strong> <a href="mailto:${escapeHtml(inquiry.contact.email)}" style="color:#56D7A1;text-decoration:underline;">${escapeHtml(inquiry.contact.email)}</a>
          </p>
          <p style="margin:4px 0 18px 0;font-size:14px;color:#FFFFFF;">
            <strong>Ubicación:</strong> ${escapeHtml(inquiry.contact.city)}, ${escapeHtml(inquiry.contact.province)}
          </p>

          <h2 style="margin:0 0 10px 0;font-size:14px;text-transform:uppercase;color:#56D7A1;">
            Detalle de la consulta
          </h2>
          <p style="margin:4px 0;font-size:14px;color:#FFFFFF;">
            <strong>Actividad:</strong> ${escapeHtml(inquiry.businessActivity)}
          </p>
          <p style="margin:4px 0;font-size:14px;color:#FFFFFF;">
            <strong>Necesidades:</strong> ${escapeHtml(inquiry.selectedNeeds.join(", ") || "Consulta general")}
          </p>
          <p style="margin:4px 0 14px 0;font-size:14px;color:#FFFFFF;">
            <strong>Sistema actual:</strong> ${escapeHtml(inquiry.currentSystemStatus)}
          </p>

          <div style="padding:14px;border:1px solid #56D7A1;border-radius:12px;background-color:rgba(255,255,255,0.05);">
            <div style="font-size:12px;font-weight:700;color:#56D7A1;margin-bottom:6px;">
              Mensaje / Descripción del proyecto:
            </div>
            <div style="font-size:14px;line-height:1.5;color:#FFFFFF;white-space:pre-line;">${escapeHtml(inquiry.projectDescription)}</div>
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Envío mediante API de Resend si RESEND_API_KEY está configurada en variables de entorno.
 */
async function sendViaResend(
  recipients: string[],
  inquiry: StoredInquiry
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return false;

  const fromAddress =
    process.env.SMTP_FROM?.trim() || "MiniSistema Web <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(6000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: recipients,
      reply_to: inquiry.contact.email,
      subject: buildEmailSubject(inquiry),
      text: buildEmailPlainText(inquiry),
      html: buildEmailHtml(inquiry),
    }),
  });

  return res.ok;
}

/**
 * Envío directo por SMTPS (puerto 465) si se configuran SMTP_HOST, SMTP_USER y SMTP_PASS.
 */
async function sendViaSmtp(
  recipients: string[],
  inquiry: StoredInquiry
): Promise<boolean> {
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const port = Number(process.env.SMTP_PORT || "465");

  if (!user || !pass) return false;

  return new Promise<boolean>((resolve) => {
    const socket =
      port === 465
        ? tls.connect({ host, port, rejectUnauthorized: false })
        : net.createConnection({ host, port });

    let step = 0;
    let buffer = "";

    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 10000);

    const finish = (ok: boolean) => {
      clearTimeout(timeout);
      try {
        socket.end();
      } catch {
        // ignore
      }
      resolve(ok);
    };

    const sendLine = (line: string) => {
      socket.write(`${line}\r\n`);
    };

    socket.on("error", () => finish(false));

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf-8");
      if (!buffer.endsWith("\r\n")) return;
      const lines = buffer.trim().split("\r\n");
      const lastLine = lines[lines.length - 1] || "";
      if (lastLine.length >= 4 && lastLine[3] === "-") return;
      buffer = "";

      const code = Number(lastLine.slice(0, 3));
      if (code >= 400) {
        finish(false);
        return;
      }

      if (step === 0 && code === 220) {
        step = 1;
        sendLine("EHLO minisistema.com.ar");
      } else if (step === 1 && code === 250) {
        step = 2;
        sendLine("AUTH LOGIN");
      } else if (step === 2 && code === 334) {
        step = 3;
        sendLine(Buffer.from(user).toString("base64"));
      } else if (step === 3 && code === 334) {
        step = 4;
        sendLine(Buffer.from(pass).toString("base64"));
      } else if (step === 4 && code === 235) {
        step = 5;
        sendLine(`MAIL FROM:<${user}>`);
      } else if (step === 5 && code === 250) {
        step = 6;
        sendLine(`RCPT TO:<${recipients[0]}>`);
      } else if (step === 6 && code === 250) {
        step = 7;
        sendLine("DATA");
      } else if (step === 7 && code === 354) {
        step = 8;
        const subjectB64 = Buffer.from(buildEmailSubject(inquiry), "utf-8").toString("base64");
        const htmlBody = buildEmailHtml(inquiry);
        const mime = [
          `From: "MiniSistema Web" <${user}>`,
          `To: ${recipients.join(", ")}`,
          `Reply-To: ${inquiry.contact.email}`,
          `Subject: =?UTF-8?B?${subjectB64}?=`,
          `MIME-Version: 1.0`,
          `Content-Type: text/html; charset=UTF-8`,
          ``,
          htmlBody,
          `.`,
        ].join("\r\n");
        sendLine(mime);
      } else if (step === 8 && code === 250) {
        step = 9;
        sendLine("QUIT");
        finish(true);
      }
    });
  });
}

/**
 * Envío mediante FormSubmit AJAX desde el backend con reintento automático.
 */
async function sendViaFormSubmitBackend(
  recipient: string,
  inquiry: StoredInquiry
): Promise<boolean> {
  const originLabel =
    inquiry.source === "configurador"
      ? "Configurador Interactivo de Proyectos"
      : "Formulario de Contacto Directo";

  const payload = JSON.stringify({
    _subject: buildEmailSubject(inquiry),
    _template: "table",
    _captcha: "false",
    _replyto: inquiry.contact.email,
    ID_Solicitud: inquiry.id,
    Origen: originLabel,
    Nombre_y_Apellido: inquiry.contact.fullName,
    Comercio_o_Institucion: inquiry.contact.businessName,
    WhatsApp: inquiry.contact.whatsapp,
    Email_Cliente: inquiry.contact.email,
    Ubicacion: `${inquiry.contact.city}, ${inquiry.contact.province}`,
    Actividad: inquiry.businessActivity,
    Necesidades: inquiry.selectedNeeds.join(", ") || "Consulta general",
    Sistema_Actual: inquiry.currentSystemStatus,
    Mensaje_o_Proyecto: inquiry.projectDescription,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`, {
        method: "POST",
        signal: AbortSignal.timeout(7000),
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Origin: process.env.NEXT_PUBLIC_SITE_URL || "https://www.minisistema.com.ar",
          Referer: process.env.NEXT_PUBLIC_SITE_URL || "https://www.minisistema.com.ar/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        },
        body: payload,
      });

      if (response.ok) {
        return true;
      }
    } catch {
      // retry once
    }
  }

  return false;
}

/**
 * Envía los datos del formulario (Contacto o Configurador) al correo oculto
 * `danighiglionesl@gmail.com` sin exponer jamás dicha dirección en el cliente.
 */
export async function sendHiddenInquiryEmail(
  inquiry: StoredInquiry,
  additionalRecipients: string[] = []
): Promise<EmailDispatchResult> {
  const recipients = Array.from(
    new Set([HIDDEN_RECIPIENT_EMAIL, ...additionalRecipients].filter(Boolean))
  );

  try {
    if (process.env.RESEND_API_KEY) {
      const ok = await sendViaResend(recipients, inquiry);
      if (ok) {
        return { sent: true, provider: "resend", detail: "Notificación enviada por Resend." };
      }
    }

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const ok = await sendViaSmtp(recipients, inquiry);
      if (ok) {
        return { sent: true, provider: "smtp", detail: "Notificación enviada por SMTP." };
      }
    }

    const ok = await sendViaFormSubmitBackend(HIDDEN_RECIPIENT_EMAIL, inquiry);
    if (ok) {
      return {
        sent: true,
        provider: "formsubmit",
        detail: "Notificación enviada al correo destinatario oculto.",
      };
    }

    return {
      sent: false,
      provider: "none",
      detail: "Consulta almacenada; el proveedor de correo externo no confirmó el despacho inmediato.",
    };
  } catch {
    return {
      sent: false,
      provider: "none",
      detail: "Consulta almacenada en base de datos; error de red al despachar correo.",
    };
  }
}
