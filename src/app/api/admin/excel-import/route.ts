import { revalidatePath } from "next/cache";
import { getCurrentViewer } from "@/infrastructure/auth/pintofruta-auth";
import { applyExcelImport, buildExcelImportPlan } from "@/lib/excel-product-import";
import { parseImportDecisions, PriceListError } from "@/lib/price-list";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const viewer = await getCurrentViewer();
    if (!viewer?.authenticated || !viewer.isAdmin) return Response.json({ ok: false, error: "No autorizado." }, { status: 403 });
    const formData = await request.formData();
    const action = formData.get("action");
    if (action !== "preview" && action !== "apply") throw new PriceListError("Accion invalida.");
    const file = formData.get("file");
    if (!(file instanceof File)) throw new PriceListError("Falta el archivo Excel.");
    const decisions = parseImportDecisions(formData.get("decisions"));
    const plan = action === "apply"
      ? await applyExcelImport(file, decisions, String(formData.get("revision") ?? ""))
      : await buildExcelImportPlan(file, decisions);
    if (action === "apply") {
      for (const path of ["/admin", "/", "/galeria", "/busqueda", "/carrito"]) revalidatePath(path);
      revalidatePath("/producto/[sku]", "page");
    }
    return Response.json({ ok: true, action, plan, message: action === "apply" ? "Lista de precios actualizada correctamente." : "Vista previa lista." });
  } catch (error) {
    if (!(error instanceof PriceListError)) console.error("[admin-excel-import]", error);
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo procesar el Excel." }, {
      status: error instanceof PriceListError ? error.status : 500,
    });
  }
}
