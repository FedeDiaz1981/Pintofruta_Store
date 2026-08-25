import path from "node:path";
import nodemailer from "nodemailer";
import { getSiteContent } from "@/infrastructure/site-content.repository";

type SendOrderEmailParams = {
  fileName: string;
  buffer: Buffer;
  itemCount: number;
  viewerName?: string | null;
  viewerEmail?: string | null;
  audience: "guest" | "member";
  customerDetails?: {
    name?: string;
    cuit?: string;
    address?: string;
    postalCode?: string;
    schedule?: string;
    phone?: string;
  };
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT ?? "");
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (!host || !Number.isFinite(port) || port <= 0 || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    secure: port === 465,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildFieldRow(label: string, value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "";
  }

  return `
    <tr>
      <td style="padding:10px 0;color:#7d6b58;font-size:13px;font-weight:700;vertical-align:top;width:160px;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;color:#1f1a17;font-size:14px;line-height:1.6;vertical-align:top;">${escapeHtml(trimmed)}</td>
    </tr>
  `;
}

function buildOrderEmailText(params: SendOrderEmailParams) {
  return [
    "Se ha confirmado un nuevo pedido.",
    "",
    "Datos del cliente:",
    params.customerDetails?.name ? `Nombre: ${params.customerDetails.name}` : null,
    params.customerDetails?.cuit ? `CUIT: ${params.customerDetails.cuit}` : null,
    params.customerDetails?.address ? `Direccion: ${params.customerDetails.address}` : null,
    params.customerDetails?.postalCode ? `CP: ${params.customerDetails.postalCode}` : null,
    params.customerDetails?.schedule ? `Horario: ${params.customerDetails.schedule}` : null,
    params.customerDetails?.phone ? `Celular: ${params.customerDetails.phone}` : null,
    "",
    `Items: ${params.itemCount}`,
    "",
    "Se adjunta detalle del pedido y remito.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function buildOrderEmailHtml(params: SendOrderEmailParams) {
  const logoCid = "pintofruta-logo";
  const rows = [
    buildFieldRow("Nombre", params.customerDetails?.name),
    buildFieldRow("CUIT", params.customerDetails?.cuit),
    buildFieldRow("Direccion", params.customerDetails?.address),
    buildFieldRow("CP", params.customerDetails?.postalCode),
    buildFieldRow("Horario", params.customerDetails?.schedule),
    buildFieldRow("Celular", params.customerDetails?.phone),
  ].join("");

  return `<!doctype html>
  <html lang="es">
    <body style="margin:0;padding:0;background:#f5efe4;font-family:Segoe UI,Arial,sans-serif;color:#1f1a17;">
      <div style="max-width:720px;margin:0 auto;padding:32px 16px;">
        <div style="background:linear-gradient(180deg,#fffaf3 0%,#f8f1e7 100%);border:1px solid #eadfce;border-radius:24px;overflow:hidden;box-shadow:0 16px 40px rgba(74,57,38,0.12);">
          <div style="background:#1f1a17;padding:28px 32px;">
            <img src="cid:${logoCid}" alt="Pintofruta" style="display:block;width:180px;max-width:100%;height:auto;margin:0 0 10px 0;" />
            <div style="color:#f5e8d8;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;">Nuevo pedido confirmado</div>
          </div>

          <div style="padding:32px;">
            <p style="margin:0 0 18px 0;font-size:16px;line-height:1.7;color:#1f1a17;">
              Se ha confirmado un nuevo pedido.
            </p>

            <div style="background:#fff;border:1px solid #eadfce;border-radius:20px;padding:22px 22px 12px 22px;">
              <div style="margin:0 0 14px 0;font-size:12px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:#8b6c45;">
                Datos del cliente
              </div>
              <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;">
                <tbody>
                  ${rows || `<tr><td style="padding:8px 0;color:#7b6a5a;font-size:14px;">No se completaron datos del cliente.</td></tr>`}
                </tbody>
              </table>
            </div>

            <div style="margin-top:20px;background:#fff8e9;border:1px solid #f0dfb6;border-radius:18px;padding:18px 22px;">
              <p style="margin:0;font-size:14px;line-height:1.6;color:#4d3b26;"><strong>Items:</strong> ${params.itemCount}</p>
              <p style="margin:8px 0 0 0;font-size:14px;line-height:1.6;color:#4d3b26;">Se adjunta detalle del pedido y remito.</p>
            </div>

            <p style="margin:22px 0 0 0;font-size:12px;line-height:1.6;color:#8d7b68;">
              Este mensaje fue generado automaticamente por el sistema Pintofruta.
            </p>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

export async function sendOrderExcelByEmail(params: SendOrderEmailParams) {
  const smtp = getSmtpConfig();
  if (!smtp) {
    return { sent: false, reason: "SMTP no configurado" };
  }

  const content = await getSiteContent();
  const destination = content.orderNotificationEmail?.trim();
  if (!destination) {
    return { sent: false, reason: "No hay mail de destino configurado" };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  const subjectParts = ["Nuevo pedido confirmado"];
  if (params.viewerName) {
    subjectParts.push(`- ${params.viewerName}`);
  }

  const logoPath = path.join(process.cwd(), "public", "assets", "images", "logo", "logo-Pintofruta.png");

  await transporter.sendMail({
    from: smtp.user,
    to: destination,
    subject: subjectParts.join(" "),
    text: buildOrderEmailText(params),
    html: buildOrderEmailHtml(params),
    attachments: [
      {
        filename: params.fileName,
        content: params.buffer,
      },
      {
        filename: "logo-Pintofruta.png",
        path: logoPath,
        cid: "pintofruta-logo",
      },
    ],
  });

  return { sent: true, destination };
}
