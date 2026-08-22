import { appendFileSync } from "node:fs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { OrderExcelRequestItem } from "@/lib/order-excel";
import { sendOrderExcelByEmail } from "@/lib/order-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function trace(step: string, details: Record<string, unknown> = {}) {
  try {
    appendFileSync(
      "pedido-excel-trace.log",
      `${new Date().toISOString()} ${step} ${JSON.stringify(details)}\n`,
      "utf8",
    );
  } catch {
    // Ignorado a propósito para no romper la exportación si el log no se puede escribir.
  }
}

type ViewerSnapshot = {
  authenticated: boolean;
  role: "Administrador" | "Cliente";
  canSeePrices: boolean;
  name: string | null;
  email: string | null;
};

type SessionPayload = {
  authUserId: string;
  email: string;
  name: string;
  role: "Administrador" | "Cliente" | "admin" | "Cliente" | string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function normalizeRole(role: string | null | undefined): "Administrador" | "Cliente" {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "admin" || normalized === "administrador" ? "Administrador" : "Cliente";
}

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function decodeSessionCookieValue(cookieValue: string | null | undefined): SessionPayload | null {
  if (!cookieValue) {
    return null;
  }

  const [serializedPayload, signature] = cookieValue.split(".");
  if (!serializedPayload || !signature) {
    return null;
  }

  try {
    const secret = getSessionSecret();
    if (!secret) {
      return null;
    }

    const expectedSignature = createHmac("sha256", secret).update(serializedPayload).digest("base64url");
    const expectedBuffer = Buffer.from(expectedSignature);
    const signatureBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== signatureBuffer.length) {
      return null;
    }

    if (!timingSafeEqual(expectedBuffer, signatureBuffer)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(serializedPayload, "base64url").toString("utf8")) as SessionPayload;

    if (
      !payload ||
      typeof payload.authUserId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }

    return {
      authUserId: payload.authUserId,
      email: payload.email,
      name: payload.name,
      role: normalizeRole(payload.role),
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
      nonce: payload.nonce,
    };
  } catch {
    return null;
  }
}

function readViewerSnapshot(request: Request): ViewerSnapshot {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("pintofruta_session="));

  const rawCookie = sessionCookie ? decodeURIComponent(sessionCookie.slice("pintofruta_session=".length)) : null;
  const payload = decodeSessionCookieValue(rawCookie);

  if (!payload || payload.expiresAt <= Date.now()) {
    return {
      authenticated: false,
      role: "Cliente",
      canSeePrices: false,
      name: null,
      email: null,
    };
  }

  return {
    authenticated: true,
    role: normalizeRole(payload.role),
    canSeePrices: true,
    name: payload.name,
    email: payload.email,
  };
}

export async function POST(request: Request) {
  return handleExcelExport(request);
}

export async function GET(request: Request) {
  return handleExcelExport(request);
}

async function handleExcelExport(request: Request) {
  console.info("[pedido/excel] request:entered");
  trace("request:entered");
  trace("import:order-excel:start");
  const { buildOrderExcelFile } = await import("@/lib/order-excel");
  trace("import:order-excel:done");

  const body = await readRequestBody(request);
  trace("request:body", {
    hasPayload: Boolean(body?.payload),
    hasItems: Array.isArray(body?.items),
    hasCustomerDetails: Boolean(body?.customerDetails),
  });

  if (!body) {
    trace("request:missing-body");
    return NextResponse.json({ error: "Falta el pedido codificado en la URL." }, { status: 400 });
  }

  let parsedBody: {
    items?: OrderExcelRequestItem[];
    customerDetails?: {
      name?: string;
      cuit?: string;
      address?: string;
      postalCode?: string;
      schedule?: string;
      phone?: string;
    };
  };
  try {
    if (typeof body.payload === "string" && body.payload.trim()) {
      const payloadBody = JSON.parse(body.payload) as { items?: OrderExcelRequestItem[] };
      parsedBody = {
        items: payloadBody.items,
        customerDetails: body.customerDetails,
      };
    } else {
      parsedBody = { items: body.items ?? [], customerDetails: body.customerDetails };
    }
    trace("request:parse:done");
  } catch (error) {
    trace("request:parse:error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "El pedido debe enviarse en formato JSON valido." }, { status: 400 });
  }

  const items = Array.isArray(parsedBody.items) ? parsedBody.items : [];
  console.info("[pedido/excel] request:start", {
    items: items.length,
    firstItem: items[0]
      ? {
          kind: items[0].kind,
          sku: items[0].sku,
          id: items[0].id,
          quantity: items[0].quantity,
        }
      : null,
  });
  trace("request:start", {
    items: items.length,
    firstItem: items[0]
      ? {
          kind: items[0].kind,
          sku: items[0].sku,
          id: items[0].id,
          quantity: items[0].quantity,
        }
      : null,
  });

  if (items.length === 0) {
    trace("request:empty");
    return NextResponse.json({ error: "El pedido esta vacio." }, { status: 400 });
  }

  trace("viewer:start");
  const viewer = readViewerSnapshot(request);
  trace("viewer:done", {
    authenticated: Boolean(viewer?.authenticated),
    canSeePrices: Boolean(viewer?.authenticated && viewer.canSeePrices),
    role: viewer?.role ?? null,
  });
  console.info("[pedido/excel] viewer", {
    authenticated: Boolean(viewer?.authenticated),
    canSeePrices: Boolean(viewer?.authenticated && viewer.canSeePrices),
    role: viewer?.role ?? null,
  });

  trace("build:start");
  const exportResult = await buildOrderExcelFile({
    items,
    viewer: {
      authenticated: Boolean(viewer?.authenticated),
      canSeePrices: Boolean(viewer?.authenticated && viewer.canSeePrices),
      name: viewer?.name ?? null,
      email: viewer?.email ?? null,
    },
  });

  try {
    const mailResult = await sendOrderExcelByEmail({
      fileName: exportResult.fileName,
      buffer: exportResult.buffer,
      itemCount: exportResult.lines.length,
      viewerName: viewer?.name ?? null,
      viewerEmail: viewer?.email ?? null,
      audience: exportResult.audience,
      customerDetails: parsedBody.customerDetails,
    });

    if (!mailResult.sent) {
      trace("email:skipped", mailResult);
      return new NextResponse(exportResult.buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${exportResult.fileName}"`,
          "Cache-Control": "no-store",
          "X-Email-Sent": "false",
          "X-Email-Error": encodeURIComponent(mailResult.reason || "No se pudo enviar el pedido por mail."),
          "X-File-Name": exportResult.fileName,
        },
      });
    }

    console.info("[pedido/excel] email:sent", mailResult);
    trace("email:sent", mailResult);
  } catch (error) {
    console.warn("[pedido/excel] email:error", error);
    trace("email:error", {
      message: error instanceof Error ? error.message : String(error),
    });

    return new NextResponse(exportResult.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${exportResult.fileName}"`,
        "Cache-Control": "no-store",
        "X-Email-Sent": "false",
        "X-Email-Error": encodeURIComponent(
          error instanceof Error ? error.message : "No se pudo enviar el pedido por mail.",
        ),
        "X-File-Name": exportResult.fileName,
      },
    });
  }

  console.info("[pedido/excel] response:ready", {
    fileName: exportResult.fileName,
    usedTemplate: exportResult.usedTemplate,
    lines: exportResult.lines.length,
  });
  trace("response:ready", {
    fileName: exportResult.fileName,
    usedTemplate: exportResult.usedTemplate,
    lines: exportResult.lines.length,
  });

  return NextResponse.json({
    ok: true,
    fileName: exportResult.fileName,
    usedTemplate: exportResult.usedTemplate,
    lines: exportResult.lines.length,
  }, {
    headers: {
      "X-Email-Sent": "true",
      "X-File-Name": exportResult.fileName,
    },
  });
}

async function readRequestBody(request: Request): Promise<{
  payload?: string;
  items?: OrderExcelRequestItem[];
  customerDetails?: {
    name?: string;
    cuit?: string;
    address?: string;
    postalCode?: string;
    schedule?: string;
    phone?: string;
  };
} | null> {
  const method = request.method.toUpperCase();

  if (method === "POST") {
    try {
      return (await request.json()) as {
        payload?: string;
        items?: OrderExcelRequestItem[];
        customerDetails?: {
          name?: string;
          cuit?: string;
          address?: string;
          postalCode?: string;
          schedule?: string;
          phone?: string;
        };
      };
    } catch {
      return null;
    }
  }

  const payload = new URL(request.url).searchParams.get("payload");
  return payload ? { payload } : null;
}
