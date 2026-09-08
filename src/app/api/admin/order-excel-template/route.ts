import { revalidatePath } from "next/cache";
import { getCurrentViewer } from "@/infrastructure/auth/pintofruta-auth";
import { saveOrderExcelTemplate } from "@/infrastructure/order-template";
import { syncProductsWithUploadedTemplateRowMaps } from "@/application/order-template-row-map";

export const runtime = "nodejs";

function parseAudience(value: FormDataEntryValue | null) {
  return value === "member" ? "member" : "guest";
}

function parseNotes(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function refreshAdminViews() {
  revalidatePath("/admin");
}

export async function POST(request: Request) {
  try {
    const viewer = await getCurrentViewer();

    if (!viewer?.isAdmin) {
      return Response.json({ ok: false, error: "No autorizado." }, { status: 403 });
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const audience = parseAudience(formData.get("audience"));
    const notes = parseNotes(formData.get("notes"));

    if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
      return Response.json({ ok: false, error: "Falta el archivo Excel." }, { status: 400 });
    }

    const fileName = fileEntry.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return Response.json({ ok: false, error: "El archivo debe ser un Excel (.xlsx o .xls)." }, { status: 400 });
    }

    const result = await saveOrderExcelTemplate({
      audience,
      file: fileEntry,
      notes,
    });

    const syncResult = await syncProductsWithUploadedTemplateRowMaps(fileEntry, audience);
    console.info("[admin-order-template] template-row-sync", {
      audience,
      updatedProducts: syncResult.updatedProducts,
    });

    refreshAdminViews();

    return Response.json({
      ok: true,
      message: `Plantilla cargada correctamente para ${audience === "member" ? "logueados" : "invitados"}.`,
      template: result.record,
      publicUrl: result.publicUrl,
      syncedProducts: syncResult.updatedProducts,
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo subir la plantilla.",
      },
      { status: 500 },
    );
  }
}
