export type OrderPdfLine = {
  kind?: "product" | "pack";
  id: number;
  sku: string;
  name: string;
  brand: string;
  presentation: string;
  image?: string;
  publicPrice: number;
  quantity: number;
};

export type OrderPdfData = {
  items: OrderPdfLine[];
  generatedAt?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function buildOrderPdfHtml(data: OrderPdfData) {
  const items = data.items
    .map((item) => ({
      ...item,
      quantity: Math.max(1, Number(item.quantity) || 1),
      publicPrice: Math.max(0, Number(item.publicPrice) || 0),
    }))
    .filter((item) => item.sku && item.name);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.quantity * item.publicPrice, 0);
  const generatedAt = formatDate(data.generatedAt ?? new Date().toISOString());
  const orderNumber = `PF-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "").slice(0, 14)}`;

  const rows = items
    .map((item) => {
      const subtotal = item.quantity * item.publicPrice;
      const typeLabel = item.kind === "pack" ? "Promocion" : "Producto";

      return `
        <tr>
          <td>
            <div class="product-name">${escapeHtml(item.name)}</div>
            <div class="product-meta">${escapeHtml(item.brand)} · ${escapeHtml(item.presentation)}</div>
            <div class="product-type">${escapeHtml(typeLabel)}</div>
          </td>
          <td class="mono">${escapeHtml(item.sku)}</td>
          <td class="center">${item.quantity}</td>
          <td class="right">${formatCurrency(item.publicPrice)}</td>
          <td class="right strong">${formatCurrency(subtotal)}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Pedido Pintofruta</title>
      <style>
        :root {
          --text: #1f2328;
          --muted: #5f6b7a;
          --line: #d8dee6;
          --line-strong: #b9c3cf;
          --soft: #f7f9fc;
        }

        @page {
          size: A4;
          margin: 14mm;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: var(--text);
          font-family: Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .page {
          padding: 0;
        }

        .topbar {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          padding-bottom: 18px;
          margin-bottom: 18px;
          border-bottom: 2px solid var(--line-strong);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .brand-mark {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          background: #1f2328;
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .brand-title {
          font-size: 22px;
          font-weight: 800;
          line-height: 1.1;
        }

        .brand-subtitle {
          margin-top: 4px;
          color: var(--muted);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
        }

        .doc-meta {
          min-width: 250px;
          text-align: right;
        }

        .doc-label {
          color: var(--muted);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          margin-bottom: 6px;
          font-weight: 700;
        }

        .doc-value {
          font-size: 13px;
          font-weight: 700;
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .summary-card {
          border: 1px solid var(--line);
          border-radius: 14px;
          background: var(--soft);
          padding: 12px 14px;
        }

        .summary-card .label {
          color: var(--muted);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin-bottom: 8px;
          font-weight: 700;
        }

        .summary-card .value {
          font-size: 18px;
          font-weight: 800;
        }

        .table-wrap {
          border: 1px solid var(--line);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 18px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        thead th {
          background: #eef3f8;
          border-bottom: 1px solid var(--line-strong);
          color: #334155;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          padding: 12px 10px;
          text-align: left;
        }

        tbody td {
          border-top: 1px solid var(--line);
          padding: 12px 10px;
          vertical-align: top;
          font-size: 12px;
        }

        tbody tr:nth-child(even) {
          background: #fbfcfe;
        }

        .product-name {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .product-meta {
          color: var(--muted);
          font-size: 11px;
          line-height: 1.35;
        }

        .product-type {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 8px;
          border: 1px solid var(--line);
          border-radius: 999px;
          color: var(--muted);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          background: #fff;
        }

        .mono {
          font-family: "Courier New", Courier, monospace;
          color: var(--muted);
          font-size: 11px;
        }

        .center {
          text-align: center;
        }

        .right {
          text-align: right;
        }

        .strong {
          font-weight: 700;
          color: var(--text);
        }

        .footer {
          display: flex;
          justify-content: flex-end;
        }

        .totals {
          width: min(100%, 420px);
          border: 1px solid var(--line);
          border-radius: 12px;
          background: #fff;
          padding: 14px;
        }

        .section-title {
          margin-bottom: 8px;
          color: #334155;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-weight: 700;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 7px 0;
          font-size: 13px;
        }

        .total-row.final {
          border-top: 1px solid var(--line);
          margin-top: 8px;
          padding-top: 12px;
          font-size: 16px;
          font-weight: 800;
        }

      </style>
    </head>
    <body>
      <main class="page">
        <section class="topbar">
          <div class="brand">
            <div class="brand-mark">PF</div>
            <div>
              <div class="brand-title">Pintofruta</div>
              <div class="brand-subtitle">Pedido comercial</div>
            </div>
          </div>

          <div class="doc-meta">
            <div class="doc-label">Pedido</div>
            <div class="doc-value">${escapeHtml(orderNumber)}</div>
            <div class="doc-label" style="margin-top: 10px;">Fecha</div>
            <div class="doc-value">${escapeHtml(generatedAt)}</div>
          </div>
        </section>

        <section class="summary">
          <div class="summary-card">
            <div class="label">Total estimado</div>
            <div class="value">${formatCurrency(totalPrice)}</div>
          </div>
          <div class="summary-card">
            <div class="label">Lineas</div>
            <div class="value">${items.length}</div>
          </div>
          <div class="summary-card">
            <div class="label">Unidades</div>
            <div class="value">${totalItems}</div>
          </div>
        </section>

        <section class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 38%;">Producto</th>
                <th style="width: 16%;">SKU</th>
                <th style="width: 10%;" class="center">Cant.</th>
                <th style="width: 18%;" class="right">Unitario</th>
                <th style="width: 18%;" class="right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </section>

        <section class="footer">
          <div class="totals">
            <div class="section-title">Resumen</div>
            <div class="total-row">
              <span>Subtotal</span>
              <strong>${formatCurrency(totalPrice)}</strong>
            </div>
            <div class="total-row">
              <span>Unidades</span>
              <strong>${totalItems}</strong>
            </div>
            <div class="total-row final">
              <span>Total pedido</span>
              <strong>${formatCurrency(totalPrice)}</strong>
            </div>
</div>
        </section>
      </main>
    </body>
  </html>`;
}
