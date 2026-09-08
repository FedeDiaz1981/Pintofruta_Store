import { createSupabaseServiceClient } from "@/infrastructure/auth/pintofruta-auth";
import { postgresPool } from "@/infrastructure/db/postgres";
import { storeFileOnSupabase } from "@/infrastructure/storage/supabase-storage";

export type OrderTemplateAudience = "guest" | "member";

export type OrderExcelTemplateRecord = {
  id: number;
  template_key: string;
  audience: OrderTemplateAudience;
  version: number;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderExcelTemplateSummary = Pick<
  OrderExcelTemplateRecord,
  "id" | "template_key" | "audience" | "version" | "file_name" | "active" | "updated_at"
>;

export type SaveOrderExcelTemplateInput = {
  audience: OrderTemplateAudience;
  file: File;
  notes?: string | null;
};

export async function getActiveOrderExcelTemplate(audience: OrderTemplateAudience) {
  if (!postgresPool) {
    return null;
  }

  const result = await postgresPool.query<OrderExcelTemplateRecord>(
    `
      select id, template_key, audience, version, file_name, storage_bucket, storage_path, mime_type, active, notes, created_at, updated_at
      from order_excel_templates
      where active = true
        and template_key = 'pedido_excel'
        and audience = $1
      order by version desc, updated_at desc, id desc
      limit 1
    `,
    [audience],
  );

  return result.rows[0] ?? null;
}

export async function listOrderExcelTemplates() {
  if (!postgresPool) {
    return [] as OrderExcelTemplateSummary[];
  }

  const result = await postgresPool.query<OrderExcelTemplateSummary>(
    `
      select distinct on (audience) id, template_key, audience, version, file_name, active, updated_at
      from order_excel_templates
      where template_key = 'pedido_excel'
        and active = true
      order by audience, version desc, updated_at desc, id desc
    `,
  );

  return result.rows;
}

export async function downloadOrderExcelTemplate(record: OrderExcelTemplateRecord) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage.from(record.storage_bucket || "uploads").download(record.storage_path);

  if (error || !data) {
    return null;
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return {
    buffer,
    fileName: record.file_name,
    mimeType: record.mime_type,
  };
}

export async function saveOrderExcelTemplate(input: SaveOrderExcelTemplateInput) {
  if (!postgresPool) {
    throw new Error("No hay conexion a la base de datos.");
  }

  const templateKey = "pedido_excel";
  const adminLog = (stage: string, details: Record<string, unknown> = {}) => {
    console.info(`[order-template-upload] ${stage}`, details);
  };

  adminLog("upload:start", {
    audience: input.audience,
    fileName: input.file.name,
    mimeType: input.file.type,
    size: input.file.size,
  });

  const uploadedFile = await storeFileOnSupabase(
    input.file,
    `order-templates/${input.audience}`,
    `pedido-${input.audience}`,
    adminLog,
    { allowDataUrlFallback: false },
  );

  const client = await postgresPool.connect();

  try {
    const versionResult = await client.query<{ next_version: number }>(
      `
        select coalesce(max(version), 0) + 1 as next_version
        from order_excel_templates
        where template_key = $1
          and audience = $2
      `,
      [templateKey, input.audience],
    );

    const idResult = await client.query<{ next_id: number }>(
      `
        select coalesce(max(id), 0) + 1 as next_id
        from order_excel_templates
      `,
    );

    const nextVersion = Number(versionResult.rows[0]?.next_version ?? 1);
    const nextId = Number(idResult.rows[0]?.next_id ?? 1);

    await client.query("begin");
    await client.query(
      `
        update order_excel_templates
        set active = false
        where template_key = $1
          and audience = $2
          and active = true
      `,
      [templateKey, input.audience],
    );

    const insertResult = await client.query<OrderExcelTemplateRecord>(
      `
        insert into order_excel_templates (
          id,
          template_key,
          audience,
          version,
          file_name,
          storage_bucket,
          storage_path,
          mime_type,
          active,
          notes
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
        returning id, template_key, audience, version, file_name, storage_bucket, storage_path, mime_type, active, notes, created_at, updated_at
      `,
      [
        nextId,
        templateKey,
        input.audience,
        nextVersion,
        input.file.name || uploadedFile.fileName,
        uploadedFile.bucket,
        uploadedFile.storagePath,
        uploadedFile.mimeType,
        input.notes ?? null,
      ],
    );

    await client.query("commit");

    const record = insertResult.rows[0];

    adminLog("upload:done", {
      audience: input.audience,
      version: record.version,
      id: record.id,
      storagePath: record.storage_path,
    });

    return {
      record,
      publicUrl: uploadedFile.publicUrl,
    };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    adminLog("upload:error", {
      audience: input.audience,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    client.release();
  }
}
