import { getCurrentViewer } from "@/infrastructure/auth/pintofruta-auth";
import { postgresPool } from "@/infrastructure/db/postgres";
import { buildCustomerOrderFile, CUSTOMER_ORDER_CONTENT_TYPE, CUSTOMER_ORDER_PRODUCTS_SQL, type CustomerOrderProduct } from "@/lib/customer-order";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const viewer = await getCurrentViewer();
    if (!viewer?.authenticated || !viewer.isAdmin) return Response.json({ ok: false, error: "No autorizado." }, { status: 403 });
    const audience = new URL(request.url).searchParams.get("audience");
    if (audience !== "public" && audience !== "member") return Response.json({ ok: false, error: "Elegí la lista pública o la lista con descuento." }, { status: 400 });
    if (!postgresPool) throw new Error("DATABASE_URL no está configurada.");
    const products = await postgresPool.query<CustomerOrderProduct>(CUSTOMER_ORDER_PRODUCTS_SQL);
    const file = await buildCustomerOrderFile(products.rows, audience);
    return new Response(new Uint8Array(file.buffer), { headers: {
      "Content-Type": CUSTOMER_ORDER_CONTENT_TYPE,
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Product-Count": String(file.productCount),
    } });
  } catch (error) {
    console.error("[admin-customer-order]", error instanceof Error ? error.message : "Error desconocido");
    return Response.json({ ok: false, error: "No se pudo generar la planilla de pedidos. Volvé a intentar." }, { status: 500 });
  }
}
