import { getCurrentViewer } from "@/infrastructure/auth/pintofruta-auth";
import { postgresPool } from "@/infrastructure/db/postgres";
import { readPriceListProducts } from "@/lib/excel-product-import";
import { createPriceListWorkbook } from "@/lib/price-list";

export const runtime = "nodejs";

export async function GET() {
  try {
    const viewer = await getCurrentViewer();
    if (!viewer?.authenticated || !viewer.isAdmin) return Response.json({ ok: false, error: "No autorizado." }, { status: 403 });
    if (!postgresPool) throw new Error("DATABASE_URL no esta configurada.");
    const products = await readPriceListProducts(postgresPool);
    const buffer = await createPriceListWorkbook(products);
    const date = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short" }).format(new Date());
    return new Response(new Uint8Array(buffer), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Lista_de_precios_${date}.xlsx"`,
      "Cache-Control": "private, no-store",
    } });
  } catch (error) {
    console.error("[admin-price-list]", error);
    return Response.json({ ok: false, error: "No se pudo descargar la lista de precios." }, { status: 500 });
  }
}
