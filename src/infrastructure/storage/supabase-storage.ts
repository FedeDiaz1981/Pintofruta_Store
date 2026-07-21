import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL no está configurada.");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY no está configurada.");
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseClient;
}

export async function storeImageOnSupabase(file: File, scope: string, fallbackName: string, adminLog?: (stage: string, details?: Record<string, unknown>) => void) {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
  const extension = extname(file.name || "").toLowerCase() || ".png";
  const safeName = slugify(fallbackName || file.name || "imagen");
  const fileName = `${safeName}-${Date.now()}-${randomUUID().slice(0, 8)}${extension}`;
  const storagePath = `${scope}/${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";

  adminLog?.("upload:start", {
    scope,
    bucket,
    fileName: file.name,
    mimeType,
    size: file.size,
    storagePath,
  });

  try {
    const supabase = getSupabaseClient();
    const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const publicUrl = data.publicUrl;

    adminLog?.("upload:stored-in-supabase", {
      scope,
      bucket,
      storagePath,
      publicUrl,
      size: buffer.length,
    });

    return publicUrl;
  } catch (error) {
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;
    adminLog?.("upload:supabase-failed-data-url-fallback", {
      scope,
      bucket,
      storagePath,
      error: error instanceof Error ? error.message : String(error),
      fallbackLength: dataUrl.length,
    });
    return dataUrl;
  }
}
