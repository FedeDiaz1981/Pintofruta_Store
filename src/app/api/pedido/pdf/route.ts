import { chromium } from "playwright";
import { NextResponse } from "next/server";
import { buildOrderPdfHtml, type OrderPdfLine } from "@/lib/order-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CartRequestBody = {
  items?: OrderPdfLine[];
};

export async function POST(request: Request) {
  let body: CartRequestBody;

  try {
    body = (await request.json()) as CartRequestBody;
  } catch {
    return NextResponse.json({ error: "El pedido debe enviarse en formato JSON." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) {
    return NextResponse.json({ error: "El pedido está vacío." }, { status: 400 });
  }

  const html = buildOrderPdfHtml({
    items,
    generatedAt: new Date().toISOString(),
  });

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1240, height: 1754 },
    });

    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "screen" });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "14mm",
        right: "14mm",
        bottom: "14mm",
        left: "14mm",
      },
    });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="pedido-pintofruta.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await browser.close();
  }
}
