import { revalidatePath } from "next/cache";
import { applyExcelImport, buildExcelImportPlan, type ExcelImportAction, type ExcelImportMode } from "@/lib/excel-product-import";

export const runtime = "nodejs";

function parseMode(value: FormDataEntryValue | null): ExcelImportMode {
  return value === "member" ? "member" : "guest";
}

function parseAction(value: FormDataEntryValue | null): ExcelImportAction {
  return value === "apply" ? "apply" : "preview";
}

function refreshAppViews() {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/galeria");
  revalidatePath("/busqueda");
  revalidatePath("/carrito");
  revalidatePath("/producto/[sku]");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const action = parseAction(formData.get("action"));
    const mode = parseMode(formData.get("mode"));
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return Response.json({ ok: false, error: "Falta el archivo Excel." }, { status: 400 });
    }

    if (action === "apply") {
      const plan = await applyExcelImport(fileEntry, mode);
      refreshAppViews();

      return Response.json({
        ok: true,
        action,
        message: "Importación aplicada correctamente.",
        plan,
      });
    }

    const result = await buildExcelImportPlan(fileEntry, mode);

    return Response.json({
      ok: true,
      action,
      message: "Archivo analizado correctamente.",
      plan: result.plan,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo procesar el Excel.",
      },
      { status: 500 },
    );
  }
}

