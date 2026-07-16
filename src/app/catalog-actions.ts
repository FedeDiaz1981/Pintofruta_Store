"use server";

import { revalidatePath } from "next/cache";
import { postgresPool } from "@/infrastructure/db/postgres";
import { siteContentSchemaSql } from "@/infrastructure/site-content/schema";

async function ensureDatabase() {
  if (!postgresPool) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  await postgresPool.query(siteContentSchemaSql);
}

async function updateProductCounter(productId: number, column: "views_count" | "sales_count") {
  await ensureDatabase();

  await postgresPool!.query(
    `
      update products
      set ${column} = coalesce(${column}, 0) + 1,
          updated_at = now()
      where id = $1
    `,
    [productId],
  );
}

export async function recordProductView(productId: number) {
  await updateProductCounter(productId, "views_count");
  revalidatePath("/");
  revalidatePath("/galeria");
  revalidatePath("/producto/[sku]");
}

export async function recordProductSale(productId: number) {
  await updateProductCounter(productId, "sales_count");
  revalidatePath("/");
  revalidatePath("/galeria");
  revalidatePath("/producto/[sku]");
}
