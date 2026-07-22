import { storeImageOnSupabase } from "@/infrastructure/storage/supabase-storage";

export const runtime = "nodejs";

function adminLog(stage: string, details: Record<string, unknown> = {}) {
  console.info(`[admin-upload] ${stage}`, details);
}

function toStringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const scope = toStringValue(formData.get("scope")) || "uploads";
    const fallbackName = toStringValue(formData.get("fallbackName")) || "imagen";

    if (!(fileEntry instanceof File) || fileEntry.size <= 0) {
      return Response.json({ ok: false, error: "Falta el archivo de imagen." }, { status: 400 });
    }

    adminLog("request:start", {
      scope,
      fallbackName,
      fileName: fileEntry.name,
      mimeType: fileEntry.type,
      size: fileEntry.size,
    });

    const publicUrl = await storeImageOnSupabase(fileEntry, scope, fallbackName, adminLog);

    if (!publicUrl.startsWith("http")) {
      throw new Error("No se pudo guardar la imagen en Supabase Storage.");
    }

    adminLog("request:done", {
      scope,
      fallbackName,
      fileName: fileEntry.name,
      hasPublicUrl: publicUrl.startsWith("http"),
    });

    return Response.json({
      ok: true,
      publicUrl,
    });
  } catch (error) {
    adminLog("request:error", {
      error: error instanceof Error ? error.message : String(error),
    });

    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo subir la imagen.",
      },
      { status: 500 },
    );
  }
}
