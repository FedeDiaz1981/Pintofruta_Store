import { authenticateExcelSyncToken, applyExcelSync, catalogResponse, type ExcelSyncPayload } from "@/lib/excel-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ ok: false, error: "Token de Excel inválido o vencido." }, { status: 401 });
}

export async function GET(request: Request) {
  const auth = await authenticateExcelSyncToken(request);
  if (!auth || !auth.scopes.includes("catalog:read")) return unauthorized();
  try {
    const format = new URL(request.url).searchParams.get("format") ?? "json";
    const data = await catalogResponse(format);
    if (format === "tsv") return new Response(String(data), { headers: { "Content-Type": "text/tab-separated-values; charset=utf-8", "Cache-Control": "no-store" } });
    return Response.json({ ok: true, ...(data as { products: unknown[]; brands: unknown[]; categories: unknown[] }) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "No se pudo leer el catálogo." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateExcelSyncToken(request);
  if (!auth || !auth.scopes.includes("catalog:write")) return unauthorized();
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 2_000_000) return Response.json({ ok: false, error: "La sincronización es demasiado grande." }, { status: 413 });
    const payload = JSON.parse(body) as ExcelSyncPayload;
    const result = await applyExcelSync(payload);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo sincronizar el catálogo." }, { status: 400 });
  }
}
