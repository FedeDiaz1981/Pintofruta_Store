import { getCurrentViewer } from "@/infrastructure/auth/pintofruta-auth";
import { createExcelSyncToken, revokeExcelSyncToken } from "@/lib/excel-sync";
import { postgresPool } from "@/infrastructure/db/postgres";

export const runtime = "nodejs";

async function requireAdmin() {
  const viewer = await getCurrentViewer();
  return viewer?.authenticated && viewer.isAdmin ? viewer : null;
}

export async function POST(request: Request) {
  const viewer = await requireAdmin();
  if (!viewer) return Response.json({ ok: false, error: "No autorizado." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({})) as { label?: string; expiresAt?: string | null };
    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) return Response.json({ ok: false, error: "La fecha de vencimiento no es válida." }, { status: 400 });
    const created = await createExcelSyncToken(body.label ?? "Planilla Excel", viewer.userId, expiresAt);
    return Response.json({ ok: true, id: created.id, token: created.token, warning: "Guardá este token ahora: no se volverá a mostrar." }, { status: 201 });
  } catch {
    return Response.json({ ok: false, error: "No se pudo generar el token." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const viewer = await requireAdmin();
  if (!viewer) return Response.json({ ok: false, error: "No autorizado." }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !postgresPool) return Response.json({ ok: false, error: "Falta el ID del token." }, { status: 400 });
  return Response.json({ ok: await revokeExcelSyncToken(id) });
}
