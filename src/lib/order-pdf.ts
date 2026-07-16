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
      const typeLabel = item.kind === "pack" ? "Promoción" : "Producto";

      return `
        <tr>
          <td class="item-cell">
            <div class="item-name">${escapeHtml(item.name)}</div>
            <div class="item-meta">${escapeHtml(item.brand)} · ${escapeHtml(item.presentation)}</div>
            <div class="item-chip">${escapeHtml(typeLabel)}</div>
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
          --pf-bg: #f7f2e8;
          --pf-surface: #fffdf8;
          --pf-border: rgba(168, 109, 69, 0.22);
          --pf-border-strong: rgba(168, 109, 69, 0.42);
          --pf-text: #2f2a25;
          --pf-muted: #6e665f;
          --pf-primary: #a86d45;
          --pf-primary-dark: #7b4c2d;
          --pf-soft: #efe1cb;
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
          background: var(--pf-bg);
          color: var(--pf-text);
          font-family: Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          padding: 0;
        }

        .sheet {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(250, 245, 236, 0.98));
          border: 1px solid var(--pf-border);
          border-radius: 28px;
          padding: 28px;
          box-shadow: 0 16px 50px rgba(74, 57, 38, 0.12);
        }

        .header {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(168, 109, 69, 0.18);
          margin-bottom: 20px;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 14px;
        }

        .brand-mark {
          width: 54px;
          height: 54px;
          border-radius: 18px;
          background: linear-gradient(180deg, var(--pf-primary), var(--pf-primary-dark));
          display: grid;
          place-items: center;
          color: white;
          font-weight: 800;
          font-size: 18px;
          letter-spacing: 0.08em;
        }

        .brand-name {
          font-size: 24px;
          font-weight: 900;
          line-height: 1;
        }

        .brand-subtitle {
          margin-top: 6px;
          color: var(--pf-muted);
          font-size: 12px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .meta-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          min-width: 250px;
        }

        .meta-card {
          border: 1px solid var(--pf-border);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.88);
          padding: 12px 14px;
        }

        .meta-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          color: var(--pf-muted);
          margin-bottom: 6px;
          font-weight: 700;
        }

        .meta-value {
          font-size: 14px;
          font-weight: 700;
        }

        .highlight {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .highlight-card {
          border: 1px solid var(--pf-border);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.84);
          padding: 14px 16px;
        }

        .highlight-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.24em;
          color: var(--pf-muted);
          font-weight: 700;
        }

        .highlight-value {
          margin-top: 8px;
          font-size: 24px;
          font-weight: 900;
        }

        .table-wrap {
          border: 1px solid rgba(168, 109, 69, 0.18);
          border-radius: 22px;
          overflow: hidden;
          background: var(--pf-surface);
          margin-bottom: 18px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        thead th {
          background: linear-gradient(180deg, rgba(239, 225, 203, 0.88), rgba(245, 236, 221, 0.92));
          color: var(--pf-primary-dark);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          padding: 14px 12px;
          text-align: left;
        }

        tbody td {
          padding: 16px 12px;
          border-top: 1px solid rgba(168, 109, 69, 0.12);
          vertical-align: top;
          font-size: 12px;
        }

        tbody tr:nth-child(even) {
          background: rgba(251, 248, 241, 0.74);
        }

        .item-cell {
          padding-right: 12px;
        }

        .item-name {
          font-size: 14px;
          font-weight: 800;
          margin-bottom: 4px;
        }

        .item-meta {
          color: var(--pf-muted);
          font-size: 11px;
          line-height: 1.4;
        }

        .item-chip {
          display: inline-block;
          margin-top: 8px;
          border: 1px solid rgba(168, 109, 69, 0.2);
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--pf-primary-dark);
          background: rgba(255, 255, 255, 0.9);
        }

        .mono {
          font-family: "Courier New", Courier, monospace;
          font-size: 11px;
          color: var(--pf-muted);
        }

        .center {
          text-align: center;
        }

        .right {
          text-align: right;
        }

        .strong {
          font-weight: 800;
          color: var(--pf-text);
        }

        .summary {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 12px;
          align-items: start;
        }

        .summary-card,
        .note-card {
          border: 1px solid var(--pf-border);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.88);
          padding: 16px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 8px 0;
          font-size: 13px;
        }

        .summary-row.total {
          margin-top: 10px;
          padding-top: 14px;
          border-top: 1px solid rgba(168, 109, 69, 0.16);
          font-size: 18px;
          font-weight: 900;
        }

        .summary-row strong {
          font-weight: 900;
        }

        .note-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.24em;
          color: var(--pf-primary-dark);
          font-weight: 800;
          margin-bottom: 8px;
        }

        .note-text {
          color: var(--pf-muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .footer {
          margin-top: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          color: var(--pf-muted);
          font-size: 11px;
          border-top: 1px solid rgba(168, 109, 69, 0.12);
          padding-top: 12px;
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <section class="header">
          <div>
            <div class="brand">
              <div class="brand-mark">PF</div>
              <div>
                <div class="brand-name">Pintofruta</div>
                <div class="brand-subtitle">Pedido comercial</div>
              </div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-card">
              <div class="meta-label">Pedido</div>
              <div class="meta-value">${escapeHtml(orderNumber)}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Fecha</div>
              <div class="meta-value">${escapeHtml(generatedAt)}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Productos</div>
              <div class="meta-value">${items.length}</div>
            </div>
            <div class="meta-card">
              <div class="meta-label">Unidades</div>
              <div class="meta-value">${totalItems}</div>
            </div>
          </div>
        </section>

        <section class="highlight">
          <div class="highlight-card">
            <div class="highlight-label">Total estimado</div>
            <div class="highlight-value">${formatCurrency(totalPrice)}</div>
          </div>
          <div class="highlight-card">
            <div class="highlight-label">Cantidad de líneas</div>
            <div class="highlight-value">${items.length}</div>
          </div>
          <div class="highlight-card">
            <div class="highlight-label">Unidades totales</div>
            <div class="highlight-value">${totalItems}</div>
          </div>
        </section>

        <section class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 34%;">Producto</th>
                <th style="width: 16%;">SKU</th>
                <th style="width: 10%;" class="center">Cant.</th>
                <th style="width: 20%;" class="right">Unitario</th>
                <th style="width: 20%;" class="right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </section>

        <section class="summary">
          <div class="summary-card">
            <div class="summary-row">
              <span>Subtotal</span>
              <strong>${formatCurrency(totalPrice)}</strong>
            </div>
            <div class="summary-row">
              <span>Unidades</span>
              <strong>${totalItems}</strong>
            </div>
            <div class="summary-row total">
              <span>Total pedido</span>
              <strong>${formatCurrency(totalPrice)}</strong>
            </div>
          </div>

          <div class="note-card">
            <div class="note-title">Observación</div>
            <div class="note-text">
              Este comprobante está pensado para revisión interna y envío al vendedor. Más adelante podemos agregar datos
              de cliente, teléfono, dirección y un pie con condiciones de entrega.
            </div>
          </div>
        </section>

        <div class="footer">
          <div>Pintofruta · Pedido generado automáticamente desde la tienda</div>
          <div>Documento listo para compartir o enviar por mail</div>
        </div>
      </main>
    </body>
  </html>`;
}
