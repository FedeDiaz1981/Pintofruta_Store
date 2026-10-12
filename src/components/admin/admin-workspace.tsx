"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { deleteAdminRecord, deleteAdminRecords, saveAdminRecord, setProductSoldOut } from "@/app/admin/actions";
import { ExcelImportButton } from "@/components/admin/excel-import-button";
import { OrderExcelTemplateButton } from "@/components/admin/order-excel-template-button";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import type {
  AdminCrudViewModel,
  AdminFieldDefinition,
  AdminTableDefinition,
  AdminTableKey,
} from "@/application/admin-crud";
import type { ProductItem } from "@/domain/site-content";
import { formatCurrency } from "@/lib/catalog";
import { getTemplateRowMapKey } from "@/lib/order-template-row-map-key";

type DraftRecord = Record<string, string | number | boolean | null>;

type PackSelection = {
  productId: number;
  quantity: number;
  order: number;
};

type TemplateRowMap = Record<string, number>;

type CatalogProductRow = Pick<
  ProductItem,
  "id" | "sku" | "name" | "brand" | "categoryName" | "categoryNames" | "publicPrice" | "image" | "stock"
>;

type EditorState = {
  tableKey: AdminTableKey;
  rowId: string;
  draft: DraftRecord;
};

type BulkDeleteState = {
  open: boolean;
  loading: boolean;
  count: number;
  message?: string;
  error?: string;
};

type UploadState = {
  loading: boolean;
  error?: string;
  fileName?: string;
};

const CLEAR_IMAGE_VALUE = "__pf_clear_image__";
const ADMIN_PAGE_SIZE = 50;

const sidebarSections: { title: string; keys: AdminTableKey[] }[] = [
  { title: "Configuración", keys: ["site_content_meta"] },
  { title: "Listas", keys: ["products", "packs", "brands", "categories", "users"] },
  { title: "Contenido", keys: ["hero_slides", "banners"] },
];

function toDraftValue(field: AdminFieldDefinition, value: unknown): string | number | boolean | null {
  if (field.key === "role" && field.kind === "select" && typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "admin") {
      return "Administrador";
    }
    if (normalized === "customer" || normalized === "client") {
      return "Cliente";
    }
  }

  if (field.kind === "pack_products") {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    return "[]";
  }

  if (field.kind === "multiselect") {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    return "[]";
  }

  if (field.kind === "template_rows") {
    if (typeof value === "string") {
      return value;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return JSON.stringify(value);
    }

    return "{}";
  }

  if (field.kind === "file") {
    return value == null ? "" : String(value);
  }

  if (field.kind === "select") {
    return value == null ? "" : String(value);
  }

  if (field.kind === "password") {
    return value == null ? "" : String(value);
  }

  if (field.kind === "boolean") {
    return Boolean(value);
  }

  if (field.kind === "number") {
    if (value === "" || value == null) {
      return "";
    }

    return Number(value);
  }

  return value == null ? "" : String(value);
}

function emptyDraftFor(table: AdminTableDefinition): DraftRecord {
  const draft: DraftRecord = {};

  for (const field of table.fields) {
    if (field.kind === "boolean") {
      draft[field.key] = ["active", "visible", "homeMenu"].includes(field.key);
      continue;
    }

    if (field.kind === "pack_products" || field.kind === "multiselect") {
      draft[field.key] = "[]";
      continue;
    }

    if (field.kind === "template_rows") {
      draft[field.key] = "{}";
      continue;
    }

    draft[field.key] = "";
  }

  return draft;
}

function draftFromRow(table: AdminTableDefinition, row: Record<string, unknown> | null | undefined): DraftRecord {
  const draft = emptyDraftFor(table);

  if (!row) {
    return draft;
  }

  for (const field of table.fields) {
    if (table.key === "products" && field.kind === "template_rows") {
      draft[field.key] = toDraftValue(field, row.template_row_map ?? row.templateRowMap);
      continue;
    }

    if (table.key === "products" && field.key === "active" && field.kind === "boolean" && row.active == null) {
      draft[field.key] = String(row.status ?? "").toLowerCase() !== "inactive";
      continue;
    }

    draft[field.key] = toDraftValue(field, row[field.key]);
  }

  return draft;
}

function stringifyDraft(draft: DraftRecord) {
  return JSON.stringify(draft);
}

function parsePackSelections(value: unknown): PackSelection[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const candidate = item as Record<string, unknown>;
        const productId = Number(candidate.productId);
        const quantity = Math.max(1, Number(candidate.quantity) || 1);
        const order = Math.max(1, Number(candidate.order) || index + 1);

        if (!productId) {
          return null;
        }

        return { productId, quantity, order };
      })
      .filter((item): item is PackSelection => Boolean(item))
      .sort((left, right) => left.order - right.order);
  } catch {
    return [];
  }
}

function parseMultiSelectValues(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return [] as string[];
  }

  try {
    const parsed = JSON.parse(value) as unknown[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => String(item)).filter(Boolean);
  } catch {
    return [];
  }
}

function serializeMultiSelectValues(values: string[]) {
  return JSON.stringify(values);
}

function serializePackSelections(selections: PackSelection[]) {
  return JSON.stringify(selections.map((item, index) => ({ ...item, order: index + 1 })));
}

function parseTemplateRowMap(value: unknown): TemplateRowMap {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed as Record<string, unknown>).reduce<TemplateRowMap>((acc, [key, currentValue]) => {
      const rowNumber = Math.floor(Number(currentValue));
      if (key && Number.isFinite(rowNumber) && rowNumber > 0) {
        acc[key] = rowNumber;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function serializeTemplateRowMap(values: TemplateRowMap) {
  return JSON.stringify(values);
}

function getSidebarSectionTitle(tableKey: AdminTableKey) {
  return sidebarSections.find((section) => section.keys.includes(tableKey))?.title ?? "Datos";
}

async function uploadAdminImage(file: File, scope: string, fallbackName: string) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("scope", scope);
  formData.set("fallbackName", fallbackName);

  const response = await fetch("/api/admin/upload-image", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; publicUrl?: string; error?: string };

  if (!response.ok || !payload.ok || !payload.publicUrl) {
    throw new Error(payload.error || "No se pudo subir la imagen.");
  }

  return payload.publicUrl;
}

function formatCellValue(field: AdminFieldDefinition | undefined, value: unknown) {
  if (field?.kind === "boolean") {
    return value ? "Activo" : "Inactivo";
  }

  if (field?.kind === "multiselect") {
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown[];
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item)).filter(Boolean).join(", ");
        }
      } catch {
        return value;
      }
    }

    if (Array.isArray(value)) {
      return value.map((item) => String(item)).filter(Boolean).join(", ");
    }
  }

  if (field?.key === "role" && typeof value === "string") {
    const roles: Record<string, string> = {
      admin: "Administrador",
      customer: "Cliente",
      client: "Cliente",
    };

    return roles[value.toLowerCase()] ?? value;
  }

  if (field?.key === "status" && typeof value === "string") {
    const statuses: Record<string, string> = {
      active: "Activo",
      published: "Publicado",
      visible: "Visible",
      enabled: "Habilitado",
      inactive: "Inactivo",
    };

    return statuses[value.toLowerCase()] ?? value;
  }

  if (field?.kind === "number") {
    if (value == null || value === "") {
      return "—";
    }

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return String(value);
    }

    if (field.key.toLowerCase().includes("price")) {
      return formatCurrency(numeric);
    }

    return new Intl.NumberFormat("es-AR").format(numeric);
  }

  if (value == null || value === "") {
    return "—";
  }

  return String(value);
}

function getCreateLabel(table: AdminTableDefinition) {
  switch (table.key) {
    case "hero_slides":
      return "Nuevo carrusel";
    case "products":
      return "Nuevo producto";
    case "packs":
      return "Nueva promoción";
    case "brands":
      return "Nueva marca";
    case "categories":
      return "Nueva categoría";
    case "users":
      return "Nuevo usuario";
    default:
      return "Nuevo registro";
  }
}

function getActiveCount(rows: Record<string, unknown>[]) {
  return rows.filter((row) => {
    if (typeof row.active === "boolean") {
      return row.active;
    }

    if (typeof row.visible === "boolean") {
      return row.visible;
    }

    if (typeof row.featured === "boolean") {
      return row.featured;
    }

    if (typeof row.status === "string") {
      return ["active", "published", "visible", "enabled"].includes(row.status.toLowerCase());
    }

    return false;
  }).length;
}

function getMaxOrder(rows: Record<string, unknown>[]) {
  const keys = ["order", "order_index", "sort_order", "position"];

  let max = 0;

  for (const row of rows) {
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        max = Math.max(max, value);
      }
    }
  }

  return max;
}

function getSidebarCount(table: AdminTableDefinition) {
  const rows = table.rows as Record<string, unknown>[];

  return rows.filter((row) => isVisibleAdminRow(table.key, row)).length;
}

function getRowId(table: AdminTableDefinition, row: Record<string, unknown>) {
  return String(row[table.idField] ?? "");
}

function isVisibleAdminRow(tableKey: AdminTableKey, row: Record<string, unknown>) {
  if (tableKey === "brands") {
    return row.active !== false;
  }

  if (tableKey === "categories") {
    return row.visible !== false;
  }

  if (tableKey === "products") {
    return String(row.status ?? "").toLowerCase() !== "inactive";
  }

  if (typeof row.active === "boolean") {
    return row.active;
  }

  if (typeof row.visible === "boolean") {
    return row.visible;
  }

  if (typeof row.status === "string") {
    return row.status.toLowerCase() !== "inactive";
  }

  return true;
}

function PackProductsField({
  value,
  onChange,
  products,
  search,
  onSearchChange,
}: {
  value: string | number | boolean | null;
  onChange: (nextValue: string) => void;
  products: CatalogProductRow[];
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const selections = parsePackSelections(value);
  const selectedIds = new Set(selections.map((item) => item.productId));
  const normalizedSearch = search.trim().toLowerCase();

  const filteredProducts = products.filter((product) => {
    if (!normalizedSearch) {
      return true;
    }

    return [product.name, product.sku, product.brand, product.categoryName, ...(product.categoryNames ?? [])]
      .filter(Boolean)
      .some((entry) => String(entry).toLowerCase().includes(normalizedSearch));
  });

  const updateSelections = (nextSelections: PackSelection[]) => {
    onChange(serializePackSelections(nextSelections));
  };

  const toggleProduct = (product: CatalogProductRow) => {
    const productId = Number(product.id);
    const current = selections.find((item) => item.productId === productId);

    if (current) {
      updateSelections(selections.filter((item) => item.productId !== productId));
      return;
    }

    updateSelections([
      ...selections,
      {
        productId,
        quantity: 1,
        order: selections.length + 1,
      },
    ]);
  };

  const setQuantity = (productId: number, quantity: number) => {
    updateSelections(
      selections.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item,
      ),
    );
  };

  return (
    <div className="space-y-4 rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex h-12 flex-1 items-center rounded-full border border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] px-4 text-[var(--pf-muted)]">
          <span className="text-sm">Buscar</span>
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="ml-3 flex-1 bg-transparent text-sm text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-muted)]"
            placeholder="SKU, nombre, marca o categoría"
          />
        </label>

        <button
          type="button"
          onClick={() => updateSelections([])}
          className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
        >
          Limpiar selección
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {selections.length > 0 ? (
          selections.map((selection) => {
            const product = products.find((item) => Number(item.id) === selection.productId);

            if (!product) {
              return null;
            }

            return (
              <span
                key={selection.productId}
                className="inline-flex items-center gap-2 rounded-full border border-[rgba(168,109,69,0.16)] bg-[rgba(168,109,69,0.08)] px-3 py-1 text-xs font-semibold text-[var(--pf-primary-darker)]"
              >
                {String(product.name)}
                <button
                  type="button"
                  className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black"
                  onClick={() => updateSelections(selections.filter((item) => item.productId !== selection.productId))}
                >
                  Quitar
                </button>
              </span>
            );
          })
        ) : (
          <span className="text-sm text-[var(--pf-muted)]">Todavía no seleccionaste productos para este pack.</span>
        )}
      </div>

      <div className="max-h-[320px] overflow-auto rounded-[20px] border border-[var(--pf-border-soft)]">
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_auto] gap-3 border-b border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] px-4 py-3 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
          <span>Producto</span>
          <span>Cantidad</span>
          <span>Acción</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-[var(--pf-muted)]">
              No hay productos cargados para seleccionar. Primero completá la tabla de productos.
            </div>
          ) : (
            filteredProducts.map((product) => {
            const productId = Number(product.id);
            const selected = selectedIds.has(productId);
            const selection = selections.find((item) => item.productId === productId);

            return (
              <div key={productId} className={`grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_auto] items-center gap-3 px-4 py-3 ${selected ? "bg-[#fff8ec]" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[var(--pf-text)]">{product.name}</p>
                  <p className="text-sm text-[var(--pf-muted)]">
                    {product.sku} · {product.brand}
                  </p>
                </div>

                <div>
                  <input
                    type="number"
                    min={1}
                    value={selection?.quantity ?? 1}
                    onChange={(event) => setQuantity(productId, Number(event.target.value))}
                    disabled={!selected}
                    className="w-full rounded-xl border border-[var(--pf-border-soft)] bg-white px-3 py-2 text-sm font-semibold text-[var(--pf-text)] outline-none disabled:bg-[rgba(248,242,232,0.6)]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => toggleProduct(product)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                    selected
                      ? "border border-[rgba(168,109,69,0.18)] bg-[rgba(168,109,69,0.12)] text-[var(--pf-primary-darker)]"
                      : "border border-[var(--pf-border-soft)] bg-white text-[var(--pf-primary-darker)] hover:bg-[rgba(248,242,232,0.6)]"
                  }`}
                >
                  {selected ? "Quitar" : "Agregar"}
                </button>
              </div>
            );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminWorkspace({ model }: { model: AdminCrudViewModel }) {
  const { overview, tables, productSelectionRows } = model;
  const router = useRouter();
  const initialTableKey = (tables.find((table) => table.key === "hero_slides")?.key ?? tables[0]?.key ?? "") as AdminTableKey;

  const [selectedTableKey, setSelectedTableKey] = useState<AdminTableKey>(initialTableKey);
  const [isQuickActionPending, startQuickActionTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [packSearch, setPackSearch] = useState("");
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [selectedRowId, setSelectedRowId] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [imageManagerOpen, setImageManagerOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [bulkDeleteState, setBulkDeleteState] = useState<BulkDeleteState | null>(null);
  const [soldOutOverrides, setSoldOutOverrides] = useState<Record<string, boolean>>({});
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const selectedTable = useMemo(
    () => tables.find((table) => table.key === selectedTableKey) ?? tables[0],
    [selectedTableKey, tables],
  );
  const selectedSectionTitle = useMemo(() => getSidebarSectionTitle(selectedTable.key), [selectedTable.key]);

  const selectedRows = useMemo(() => (selectedTable?.rows as Record<string, unknown>[]) ?? [], [selectedTable]);
  const fieldMap = useMemo(
    () => new Map((selectedTable?.fields ?? []).map((field) => [field.key, field] as const)),
    [selectedTable],
  );
  const visibleColumns = useMemo(
    () =>
      selectedTable.key === "products"
        ? selectedTable.columns.filter((column) => ["id", "name", "brand"].includes(column.key))
        : selectedTable.columns,
    [selectedTable],
  );
  const tableMinWidthClass = selectedTable.key === "products" ? "min-w-[620px]" : "min-w-[960px]";

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const queryFilteredRows = !normalized
      ? selectedRows
      : selectedRows.filter((row) =>
          Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(normalized)),
        );

    return queryFilteredRows.filter((row) => isVisibleAdminRow(selectedTable.key, row));
  }, [query, selectedRows, selectedTable.key]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ADMIN_PAGE_SIZE));
  const visibleRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * ADMIN_PAGE_SIZE, currentPage * ADMIN_PAGE_SIZE),
    [currentPage, filteredRows],
  );
  const visibleRowIds = useMemo(() => visibleRows.map((row) => getRowId(selectedTable, row)), [selectedTable, visibleRows]);
  const selectedRowIdSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);
  const selectedVisibleCount = useMemo(
    () => visibleRowIds.filter((rowId) => selectedRowIdSet.has(rowId)).length,
    [selectedRowIdSet, visibleRowIds],
  );
  const allVisibleSelected = visibleRowIds.length > 0 && selectedVisibleCount === visibleRowIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const activeCount = getActiveCount(filteredRows as Record<string, unknown>[]);
  const maxOrder = getMaxOrder(filteredRows as Record<string, unknown>[]);
  const totalCount = filteredRows.length;
  const hasPendingUploads = useMemo(
    () => Object.values(uploadStates).some((uploadState) => uploadState.loading),
    [uploadStates],
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected, visibleRowIds]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, selectedTableKey]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  async function handleSave(formData: FormData) {
    await saveAdminRecord(formData);
    setEditor(null);
  }

  async function handleBulkDelete() {
    if (selectedRowIds.length === 0) {
      return;
    }

    const confirmed = window.confirm(`Borrar ${selectedRowIds.length} elementos seleccionados?`);
    if (!confirmed) {
      return;
    }

    setBulkDeleteState({
      open: true,
      loading: true,
      count: selectedRowIds.length,
    });

    try {
      const formData = new FormData();
      formData.set("table", selectedTable.key);
      formData.set("ids_json", JSON.stringify(selectedRowIds));

      await deleteAdminRecords(formData);

      setSelectedRowIds([]);
      setSelectedRowId("");
      setBulkDeleteState({
        open: true,
        loading: false,
        count: 0,
        message: "Borrado completado",
      });

      window.setTimeout(() => {
        setBulkDeleteState(null);
      }, 1200);
    } catch (error) {
      setBulkDeleteState({
        open: true,
        loading: false,
        count: selectedRowIds.length,
        error: error instanceof Error ? error.message : "No se pudo borrar.",
      });
    }
  }

  async function handleQuickDelete(table: AdminTableDefinition, row: Record<string, unknown>) {
    const rowId = getRowId(table, row);
    const rowLabel = String(row[table.rowLabelField] ?? rowId);

    if (!window.confirm(`Eliminar ${rowLabel}?`)) {
      return;
    }

    const formData = new FormData();
    formData.set("table", table.key);
    formData.set("id", rowId);

    await deleteAdminRecord(formData);

    setSelectedRowIds((current) => current.filter((id) => id !== rowId));
    setSelectedRowId((current) => (current === rowId ? "" : current));
  }

  function getProductSoldOut(row: Record<string, unknown>) {
    const rowId = getRowId(selectedTable, row);
    return soldOutOverrides[rowId] ?? Boolean(row.soldOut);
  }

  function handleProductSoldOutToggle(row: Record<string, unknown>) {
    const productId = Number(row.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return;
    }

    const rowId = getRowId(selectedTable, row);
    const previous = getProductSoldOut(row);
    const next = !previous;

    setSoldOutOverrides((current) => ({ ...current, [rowId]: next }));

    startQuickActionTransition(() => {
      void setProductSoldOut(productId, next)
        .then(() => {
          router.refresh();
        })
        .catch((error) => {
          setSoldOutOverrides((current) => ({ ...current, [rowId]: previous }));
          window.alert(error instanceof Error ? error.message : "No se pudo actualizar agotado.");
        });
    });
  }

  function openNew(table: AdminTableDefinition) {
    setSelectedTableKey(table.key);
    setSelectedRowId("");
    setSelectedRowIds([]);
    setQuery("");
    setPackSearch("");
    setFileNames({});
    setUploadStates({});
    setEditor({
      tableKey: table.key,
      rowId: "",
      draft: emptyDraftFor(table),
    });
  }

  function openEdit(table: AdminTableDefinition, row: Record<string, unknown>) {
    const rowId = getRowId(table, row);

    setSelectedTableKey(table.key);
    setSelectedRowId(rowId);
    setSelectedRowIds([]);
    setPackSearch("");
    setFileNames({});
    setUploadStates({});
    setEditor({
      tableKey: table.key,
      rowId,
      draft: draftFromRow(table, row),
    });
  }

  function closeEditor() {
    setFileNames({});
    setUploadStates({});
    setEditor(null);
  }

  if (!selectedTable) {
    return null;
  }

  return (
    <main className="pf-admin min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,252,246,0.98),_rgba(244,235,221,0.96)_44%,_rgba(232,218,194,0.98))] text-[var(--pf-text)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col xl:flex-row">
        <aside className="border-b border-[var(--pf-border)] bg-[linear-gradient(180deg,var(--pf-primary-darker)_0%,var(--pf-primary-dark)_52%,var(--pf-primary)_100%)] px-4 py-5 text-[#fff8ee] shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] xl:w-[300px] xl:shrink-0 xl:border-b-0 xl:border-r xl:px-5 xl:py-6">
          <div className="rounded-[28px] border border-white/10 bg-white/10 p-4 shadow-[0_20px_50px_rgba(74,57,38,0.14)]">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,var(--pf-secondary-dark)_0%,var(--pf-primary)_100%)] text-lg font-black tracking-tight text-white">
                PF
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--pf-secondary-faint)]">Pintofruta</p>
                <p className="text-sm text-[#f8f1e7]/80">Panel de administración</p>
              </div>
            </div>
          </div>

          <nav className="mt-6 space-y-5">
            {sidebarSections.map((section) => {
              const sectionTables = section.keys
                .map((key) => tables.find((table) => table.key === key))
                .filter((table): table is AdminTableDefinition => Boolean(table));

              if (sectionTables.length === 0) {
                return null;
              }

              return (
                <div key={section.title}>
                  <div className="mb-3 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.34em] text-[#f8f1e7]/70">
                    <span>{section.title}</span>
                    <span>▾</span>
                  </div>
                  <div className="space-y-2">
                    {sectionTables.map((table) => {
                      const active = table.key === selectedTable.key;

                      return (
                        <button
                          key={table.key}
                          type="button"
                          onClick={() => {
                            setSelectedTableKey(table.key);
                            setSelectedRowId("");
                            setSelectedRowIds([]);
                            setQuery("");
                            setPackSearch("");
                            setEditor(null);
                          }}
                          className={`flex w-full items-center justify-between rounded-[18px] px-4 py-4 text-left transition ${
                            active
                              ? "bg-[linear-gradient(90deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] text-[var(--pf-text)] shadow-[0_14px_30px_rgba(168,109,69,0.18)]"
                              : "bg-transparent text-[#f8f1e7]/80 hover:bg-white/10"
                          }`}
                        >
                          <span className="text-sm font-semibold">{table.label}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? "bg-white/40" : "bg-white/10"}`}>
                            {getSidebarCount(table)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setImageManagerOpen(true)}
            className="mt-6 flex w-full items-center justify-between rounded-[18px] border border-white/10 bg-white/10 px-4 py-4 text-left text-[#f8f1e7]/90 transition hover:bg-white/15"
          >
            <span>
              <span className="block text-sm font-semibold">Imagenes de productos</span>
              <span className="mt-1 block text-xs text-[#f8f1e7]/60">Cargar y ordenar fotos</span>
            </span>
            <span className="text-lg" aria-hidden="true">▧</span>
          </button>

        </aside>

        <section className="min-w-0 flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="min-w-0 rounded-[30px] border border-[var(--pf-border)] bg-[rgba(250,246,239,0.92)] p-5 shadow-[0_24px_60px_rgba(58,44,25,0.12)] backdrop-blur">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-black uppercase tracking-[0.36em] text-[var(--pf-secondary)]">Administracion</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--pf-text)] sm:text-5xl">
                  {selectedTable.label}
                </h1>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[860px] xl:grid-cols-6 2xl:w-[960px]">
                <div className="flex min-h-[94px] min-w-[132px] flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.22em] text-[var(--pf-muted)]">Productos</p>
                  <p className="text-2xl font-black leading-none text-[var(--pf-text)]">{overview.counts.products}</p>
                </div>
                <div className="flex min-h-[94px] min-w-[132px] flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.22em] text-[var(--pf-muted)]">Promociones</p>
                  <p className="text-2xl font-black leading-none text-[var(--pf-text)]">{overview.counts.packs}</p>
                </div>
                <div className="flex min-h-[94px] min-w-[132px] flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.22em] text-[var(--pf-muted)]">Categorías</p>
                  <p className="text-2xl font-black leading-none text-[var(--pf-text)]">{overview.counts.categories}</p>
                </div>
                <div className="flex min-h-[94px] min-w-[132px] flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.22em] text-[var(--pf-muted)]">Marcas</p>
                  <p className="text-2xl font-black leading-none text-[var(--pf-text)]">{overview.counts.brands}</p>
                </div>
                <div className="flex min-h-[94px] min-w-[132px] flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.22em] text-[var(--pf-muted)]">Usuarios</p>
                  <p className="text-2xl font-black leading-none text-[var(--pf-text)]">{overview.counts.users}</p>
                </div>
                <div className="flex min-h-[94px] min-w-[132px] flex-col justify-between overflow-hidden rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="truncate text-[9px] font-black uppercase leading-none tracking-[0.22em] text-[var(--pf-muted)]">Registro</p>
                  <p className="text-2xl font-black leading-none text-[var(--pf-text)]">{totalCount}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="flex h-14 flex-1 items-center rounded-full border border-[var(--pf-border-soft)] bg-white px-5 text-[var(--pf-muted)] shadow-[0_8px_22px_rgba(58,44,25,0.06)]">
                <span className="text-sm">Buscar</span>
                              <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="ml-3 flex-1 bg-transparent text-sm text-[var(--pf-text)] outline-none placeholder:text-[var(--pf-muted)]"
                  placeholder={selectedTable.key === "products" ? "Buscar por ID, nombre o marca" : "Buscar por SKU, nombre, email o estado"}
                />
              </label>

              <div className="flex flex-wrap gap-3">
                {selectedTable.key !== "site_content_meta" && selectedRowIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="inline-flex h-14 items-center justify-center rounded-full border border-[rgba(111,69,40,0.18)] bg-[linear-gradient(180deg,var(--pf-primary-soft),var(--pf-primary))] px-6 text-sm font-black text-white shadow-[0_14px_28px_rgba(111,69,40,0.18)] transition hover:brightness-105"
                  >
                    Borrar seleccionados ({selectedRowIds.length})
                  </button>
                ) : null}

                {selectedTable.key === "products" ? <ExcelImportButton /> : null}

                {selectedTable.key === "products" ? <OrderExcelTemplateButton /> : null}

                <button
                  type="button"
                  onClick={() => {
                    if (selectedTable.key === "site_content_meta") {
                      const metaRow = (selectedRows[0] as Record<string, unknown> | undefined) ?? null;
                      if (metaRow) {
                        openEdit(selectedTable, metaRow);
                        return;
                      }
                    }

                    openNew(selectedTable);
                  }}
                  className="inline-flex h-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] px-6 text-sm font-black text-white shadow-[0_14px_30px_rgba(168,109,69,0.22)] transition hover:brightness-105"
                >
                  {selectedTable.key === "site_content_meta" ? "Editar configuración" : getCreateLabel(selectedTable)}
                </button>
              </div>

              <Link
                href="/"
                className="inline-flex h-14 items-center justify-center rounded-full border border-transparent px-5 text-sm font-semibold text-[var(--pf-text)] transition hover:bg-white/60"
              >
                Ir a la web
              </Link>
            </div>

            <div className="mt-6">
              <section className="rounded-[28px] border border-[var(--pf-border-soft)] bg-[rgba(255,250,242,0.94)] p-4 shadow-[0_16px_40px_rgba(58,44,25,0.08)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary)]">
                      {selectedSectionTitle} / {selectedTable.label}
                    </p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">Listado de registros</h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="min-w-[120px] rounded-[20px] border border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Activos</p>
                      <p className="mt-1 text-xl font-black text-[var(--pf-text)]">{activeCount}</p>
                    </div>
                    <div className="min-w-[120px] rounded-[20px] border border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Orden max</p>
                      <p className="mt-1 text-xl font-black text-[var(--pf-text)]">{maxOrder}</p>
                    </div>
                    <div className="min-w-[120px] rounded-[20px] border border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">Total</p>
                      <p className="mt-1 text-xl font-black text-[var(--pf-text)]">{totalCount}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-[var(--pf-border-soft)] bg-white">
                  <div className="overflow-x-auto">
                    <table className={`${tableMinWidthClass} w-full border-collapse`}>
                      <thead className="bg-[rgba(248,242,232,0.6)]">
                        <tr>
                          <th className="border-b border-[var(--pf-border-soft)] px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            <input
                              ref={selectAllRef}
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={(event) => {
                                const checked = event.target.checked;

                                setSelectedRowIds((current) => {
                                  const next = new Set(current);

                                  for (const rowId of visibleRowIds) {
                                    if (checked) {
                                      next.add(rowId);
                                    } else {
                                      next.delete(rowId);
                                    }
                                  }

                                  return Array.from(next);
                                });
                              }}
                              className="h-4 w-4 accent-[var(--pf-primary)]"
                              aria-label="Seleccionar todos los visibles"
                            />
                          </th>
                          {visibleColumns.map((column) => (
                            <th
                              key={column.key}
                              className="border-b border-[var(--pf-border-soft)] px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]"
                            >
                              {column.label}
                            </th>
                          ))}
                          <th className="border-b border-[var(--pf-border-soft)] px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRows.map((row) => {
                          const rowId = getRowId(selectedTable, row);
                          const isSelected = rowId === selectedRowId || selectedRowIdSet.has(rowId);

                          return (
                            <tr
                              key={rowId}
                              className={`border-b border-[var(--pf-border-soft)] transition ${
                                isSelected ? "bg-[#fff8ec]" : "hover:bg-[#fdf8ef]"
                              }`}
                            >
                              <td className="px-4 py-4 align-top">
                                <input
                                  type="checkbox"
                                  checked={selectedRowIdSet.has(rowId)}
                                  onChange={(event) => {
                                    const checked = event.target.checked;

                                    setSelectedRowIds((current) => {
                                      if (checked) {
                                        return current.includes(rowId) ? current : [...current, rowId];
                                      }

                                      return current.filter((id) => id !== rowId);
                                    });
                                  }}
                                  className="h-4 w-4 accent-[var(--pf-primary)]"
                                aria-label={`Seleccionar ${String(row[selectedTable.rowLabelField] ?? rowId)}`}
                              />
                              </td>
                              {visibleColumns.map((column) => {
                                const field = fieldMap.get(column.key);

                                return (
                                  <td
                                    key={column.key}
                                    className={`px-5 py-4 align-top text-sm text-[var(--pf-text)] ${
                                      selectedTable.key === "products" && column.key === "name" ? "w-full" : ""
                                    }`}
                                  >
                                    <div
                                      className={
                                        field?.kind === "boolean"
                                          ? "inline-flex rounded-full bg-[rgba(168,109,69,0.12)] px-3 py-1 text-[11px] font-bold text-[var(--pf-primary-darker)]"
                                          : selectedTable.key === "products" && column.key === "name"
                                            ? "max-w-none break-words leading-6"
                                          : "max-w-[15rem] break-words leading-6"
                                      }
                                    >
                                      {formatCellValue(field, row[column.key])}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-5 py-4 align-top">
                                <div className="flex flex-wrap gap-2">
                                  {selectedTable.key === "products" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleProductSoldOutToggle(row)}
                                      disabled={isQuickActionPending}
                                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${
                                        getProductSoldOut(row)
                                          ? "border-[rgba(216,75,57,0.22)] bg-[#d84b39] text-white shadow-[0_10px_22px_rgba(216,75,57,0.18)] hover:brightness-105"
                                          : "border-[rgba(111,69,40,0.14)] bg-[rgba(248,242,232,0.82)] text-[var(--pf-primary-darker)] hover:bg-[rgba(238,230,214,0.95)]"
                                      }`}
                                      aria-pressed={getProductSoldOut(row)}
                                      title={getProductSoldOut(row) ? "Producto marcado como agotado" : "Producto disponible"}
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${
                                          getProductSoldOut(row) ? "bg-white" : "bg-[rgba(111,69,40,0.38)]"
                                        }`}
                                        aria-hidden="true"
                                      />
                                      Agotado
                                    </button>
                                  ) : null}

                                  <button
                                    type="button"
                                    onClick={() => openEdit(selectedTable, row)}
                                    className="rounded-full border border-[rgba(111,69,40,0.18)] bg-[var(--pf-primary)] px-4 py-2 text-xs font-bold text-white transition hover:brightness-105"
                                  >
                                    Editar
                                  </button>

                                  {selectedTable.key !== "site_content_meta" ? (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickDelete(selectedTable, row)}
                                      className="rounded-full border border-[rgba(111,69,40,0.18)] bg-[var(--pf-primary-darker)] px-4 py-2 text-xs font-bold text-white transition hover:brightness-105"
                                    >
                                      Borrar
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-[20px] border border-[var(--pf-border-soft)] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[var(--pf-muted)]">
                    Mostrando {visibleRows.length === 0 ? 0 : (currentPage - 1) * ADMIN_PAGE_SIZE + 1}-{Math.min(currentPage * ADMIN_PAGE_SIZE, totalCount)} de {totalCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-xs font-bold text-[var(--pf-primary-darker)] transition hover:bg-[#fff4e5] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Anterior
                    </button>
                    <span className="min-w-20 text-center text-xs font-black text-[var(--pf-primary-darker)]">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-xs font-bold text-[var(--pf-primary-darker)] transition hover:bg-[#fff4e5] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>

      {imageManagerOpen ? (
        <div className="fixed inset-0 z-[13000] flex items-start justify-center overflow-y-auto bg-[#2d1f1480] px-4 py-6 backdrop-blur-sm lg:px-8 lg:py-10">
          <ProductImageManager
            products={productSelectionRows}
            onClose={() => setImageManagerOpen(false)}
          />
        </div>
      ) : null}

      {bulkDeleteState?.open ? (
        <div className="fixed inset-0 z-[12050] flex items-start justify-center bg-[#2d1f1470] px-4 py-6 pt-[96px] backdrop-blur-sm lg:pt-[136px]">
          <div className="w-full max-w-md rounded-[28px] border border-[var(--pf-border-soft)] bg-[#fbf8f1] p-6 shadow-[0_32px_120px_rgba(74,57,38,0.3)]">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${
                  bulkDeleteState.loading
                    ? "border-[rgba(168,109,69,0.22)] bg-[rgba(168,109,69,0.12)]"
                    : bulkDeleteState.error
                      ? "border-[rgba(185,79,54,0.24)] bg-[rgba(185,79,54,0.12)]"
                      : "border-[rgba(74,57,38,0.14)] bg-white"
                }`}
              >
                {bulkDeleteState.loading ? (
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--pf-primary)] border-t-transparent" />
                ) : bulkDeleteState.error ? (
                  <span className="text-lg font-black text-[var(--pf-wood-muted)]">!</span>
                ) : (
                  <span className="text-lg font-black text-[var(--pf-primary-darker)]">✓</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[var(--pf-secondary)]">Borrado en curso</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-[var(--pf-text)]">
                  {bulkDeleteState.loading
                    ? `Eliminando ${bulkDeleteState.count} elementos`
                    : bulkDeleteState.error
                      ? "No se pudo borrar"
                      : "Borrado completado"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--pf-primary-darker)]">
                  {bulkDeleteState.loading
                    ? "Estamos aplicando los cambios y actualizando las relaciones para que no quede nada roto."
                    : bulkDeleteState.error
                      ? bulkDeleteState.message
                      : "Los elementos ya no se muestran en la grilla."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteState(null)}
                className="rounded-full border border-[var(--pf-border-soft)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
              >
                {bulkDeleteState.loading ? "Procesando..." : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editor ? (
        <div
          className="fixed inset-0 z-[12050] flex items-start justify-center bg-[#2d1f1480] px-4 pt-[96px] pb-8 backdrop-blur-sm lg:pt-[136px] lg:pb-10"
          onClick={closeEditor}
        >
        <div
          className="flex max-h-[calc(100svh-10rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-[var(--pf-border-soft)] bg-[#fbf8f1] shadow-[0_40px_120px_rgba(74,57,38,0.28)]"
          onClick={(event) => event.stopPropagation()}
        >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--pf-border-soft)] px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary)]">Edición</p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)]">
                  {editor.rowId ? "Editar registro" : "Nuevo registro"}
                </h3>
                <p className="mt-2 text-sm text-[var(--pf-primary-darker)]">
                  {selectedTable.label} / {editor.rowId || "creación"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
              >
                Cerrar
              </button>
            </div>

            <form
              action={handleSave}
              onSubmit={(event) => {
                if (hasPendingUploads) {
                  event.preventDefault();
                }
              }}
              className="min-h-0 flex-1 overflow-y-auto px-6 py-6 pb-12"
            >
              <input type="hidden" name="table" value={editor.tableKey} />
              <input type="hidden" name="payload_json" value={stringifyDraft(editor.draft)} />

              <div className="grid gap-4 md:grid-cols-2">
                {selectedTable.fields.map((field) => {
                  if (field.hidden || field.readonly) {
                    return null;
                  }

                  const value = editor.draft[field.key];
              const fullWidth =
                    field.kind === "textarea" ||
                    field.kind === "file" ||
                    field.kind === "select" ||
                    field.kind === "password" ||
                    field.kind === "boolean" ||
                    field.kind === "pack_products" ||
                    field.kind === "multiselect" ||
                    field.kind === "template_rows";

                  if (field.kind === "pack_products") {
                    return (
                      <div
                        key={field.key}
                        id={`admin-file-field-${selectedTable.key}-${field.key}`}
                        data-testid={`admin-file-field-${selectedTable.key}-${field.key}`}
                        className={`block ${fullWidth ? "md:col-span-2" : ""}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                        </div>
                        <PackProductsField
                          value={value}
                          onChange={(nextValue) =>
                            setEditor((current) =>
                              current
                                ? {
                                    ...current,
                                    draft: { ...current.draft, [field.key]: nextValue },
                                  }
                                : current,
                            )
                          }
                          products={productSelectionRows as CatalogProductRow[]}
                          search={packSearch}
                          onSearchChange={setPackSearch}
                        />
                      </div>
                    );
                  }

                  if (field.kind === "multiselect") {
                    const selectedValues = new Set(parseMultiSelectValues(value));
                    const options = field.options ?? [];

                    return (
                      <div key={field.key} className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                        </div>

                        {options.length === 0 ? (
                          <div className="rounded-[22px] border border-dashed border-[var(--pf-border-soft)] bg-white px-4 py-4 text-sm text-[var(--pf-muted)]">
                            No hay categorías visibles para seleccionar.
                          </div>
                        ) : (
                          <div className="space-y-3 rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4">
                            <div className="flex flex-wrap gap-2">
                              {[...selectedValues].map((selectedValue) => {
                                const option = options.find((item) => item.value === selectedValue);

                                return (
                                  <span
                                    key={selectedValue}
                                    className="inline-flex items-center gap-2 rounded-full border border-[rgba(168,109,69,0.18)] bg-[rgba(168,109,69,0.08)] px-3 py-1 text-xs font-semibold text-[var(--pf-primary-darker)]"
                                  >
                                    {option?.label ?? selectedValue}
                                    <button
                                      type="button"
                                      className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black"
                                      onClick={() =>
                                        setEditor((current) =>
                                          current
                                            ? {
                                                ...current,
                                                draft: {
                                                  ...current.draft,
                                                  [field.key]: serializeMultiSelectValues(
                                                    parseMultiSelectValues(current.draft[field.key]).filter(
                                                      (item) => item !== selectedValue,
                                                    ),
                                                  ),
                                                },
                                              }
                                            : current,
                                        )
                                      }
                                    >
                                      Quitar
                                    </button>
                                  </span>
                                );
                              })}
                            </div>

                            <div className="grid gap-2 sm:grid-cols-2">
                              {options.map((option) => {
                                const checked = selectedValues.has(option.value);

                                return (
                                  <label
                                    key={option.value}
                                    className={`flex cursor-pointer items-center justify-between rounded-[18px] border px-4 py-3 transition ${
                                      checked
                                        ? "border-[rgba(168,109,69,0.2)] bg-[rgba(168,109,69,0.08)]"
                                        : "border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] hover:bg-white"
                                    }`}
                                  >
                                    <span className="text-sm font-semibold text-[var(--pf-text)]">{option.label}</span>
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={(event) =>
                                        setEditor((current) =>
                                          current
                                            ? {
                                                ...current,
                                                draft: {
                                                  ...current.draft,
                                                  [field.key]: serializeMultiSelectValues(
                                                    (() => {
                                                      const next = new Set(parseMultiSelectValues(current.draft[field.key]));
                                                      if (event.target.checked) {
                                                        next.add(option.value);
                                                      } else {
                                                        next.delete(option.value);
                                                      }
                                                      return [...next];
                                                    })(),
                                                  ),
                                                },
                                              }
                                            : current,
                                        )
                                      }
                                      className="h-4 w-4 accent-[var(--pf-primary)]"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (field.kind === "boolean") {
                    return (
                      <label
                        key={field.key}
                        className={`flex items-center justify-between rounded-[22px] border border-[var(--pf-border-soft)] bg-white px-4 py-4 ${
                          fullWidth ? "md:col-span-2" : ""
                        }`}
                      >
                        <div className="pr-4">
                          <span className="block text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                            {field.label}
                          </span>
                          {field.helper ? <span className="mt-1 block text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(value)}
                          onChange={(event) =>
                            setEditor((current) =>
                              current
                                ? {
                                    ...current,
                                    draft: { ...current.draft, [field.key]: event.target.checked },
                                  }
                                : current,
                            )
                          }
                          className="h-5 w-5 accent-[var(--pf-primary)]"
                        />
                      </label>
                    );
                  }

                  if (field.kind === "select") {
                    const options = field.options ?? [];

                    return (
                      <label key={field.key} className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                        </div>
                        <select
                          value={String(value ?? "")}
                          onChange={(event) =>
                            setEditor((current) =>
                              current
                                ? {
                                    ...current,
                                    draft: { ...current.draft, [field.key]: event.target.value },
                                  }
                                : current,
                            )
                          }
                          className="w-full rounded-[22px] border border-[var(--pf-border-soft)] bg-white px-4 py-3 text-sm text-[var(--pf-text)] outline-none transition focus:border-[var(--pf-primary)]"
                        >
                          <option value="">Seleccionar...</option>
                          {options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    );
                  }

                  if (field.kind === "textarea") {
                    return (
                      <label key={field.key} className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                        </div>
                        <textarea
                          value={String(value ?? "")}
                          onChange={(event) =>
                            setEditor((current) =>
                              current
                                ? {
                                    ...current,
                                    draft: { ...current.draft, [field.key]: event.target.value },
                                  }
                                : current,
                            )
                          }
                          rows={5}
                          className="w-full rounded-[22px] border border-[var(--pf-border-soft)] bg-white px-4 py-3 text-sm text-[var(--pf-text)] outline-none transition placeholder:text-[var(--pf-muted)] focus:border-[var(--pf-primary)]"
                          readOnly={field.readonly}
                        />
                      </label>
                    );
                  }

                  if (field.kind === "template_rows") {
                    if (!editor.rowId) {
                      return null;
                    }

                    const templateRowMap = parseTemplateRowMap(value);
                    const templates = (() => {
                      const activeTemplates = (model.orderExcelTemplates ?? []).filter((template) => template.active);
                      const uniqueTemplates = new Map<string, (typeof activeTemplates)[number]>();

                      for (const template of activeTemplates) {
                        const stableKey = getTemplateRowMapKey(template);
                        if (!uniqueTemplates.has(stableKey)) {
                          uniqueTemplates.set(stableKey, template);
                        }
                      }

                      return [...uniqueTemplates.values()];
                    })();

                    return (
                      <div key={field.key} className="md:col-span-2">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                        </div>

                        {templates.length === 0 ? (
                          <div className="rounded-[22px] border border-dashed border-[var(--pf-border-soft)] bg-white px-4 py-4 text-sm text-[var(--pf-muted)]">
                            Todavía no hay templates Excel cargados.
                          </div>
                        ) : (
                          <div className="space-y-3 rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4">
                            <div className="grid gap-3 md:grid-cols-2">
                              {templates.map((template) => {
                                const stableKey = getTemplateRowMapKey(template);
                                const legacyKey = String(template.id);
                                const currentValue = templateRowMap[stableKey] ?? templateRowMap[legacyKey] ?? "";

                                return (
                                  <label
                                    key={stableKey}
                                    className="rounded-[18px] border border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.55)] p-4"
                                  >
                                    <div className="mb-2 flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-black uppercase tracking-[0.26em] text-[var(--pf-muted)]">
                                          {template.audience === "member" ? "Logueado" : "Público"} · v{template.version}
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-[var(--pf-text)]">{template.file_name}</p>
                                      </div>
                                      <span
                                        className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${
                                          template.active
                                            ? "bg-[rgba(168,109,69,0.12)] text-[var(--pf-primary-darker)]"
                                            : "bg-[rgba(122,102,82,0.08)] text-[var(--pf-muted)]"
                                        }`}
                                      >
                                        {template.active ? "Activo" : "Histórico"}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      <span className="text-xs font-semibold text-[var(--pf-muted)]">Fila exacta</span>
                                      <input
                                        type="number"
                                        min={1}
                                        placeholder="Ej: 49"
                                        value={currentValue}
                                        onChange={(event) => {
                                          const rawValue = event.target.value.trim();
                                          const nextTemplateRowMap = (() => {
                                            const nextMap = { ...templateRowMap };

                                            if (!rawValue) {
                                              delete nextMap[stableKey];
                                              delete nextMap[legacyKey];
                                              return nextMap;
                                            }

                                            const nextRowNumber = Math.floor(Number(rawValue));
                                            if (Number.isFinite(nextRowNumber) && nextRowNumber > 0) {
                                              nextMap[stableKey] = nextRowNumber;
                                              if (legacyKey !== stableKey) {
                                                delete nextMap[legacyKey];
                                              }
                                              return nextMap;
                                            }

                                            delete nextMap[stableKey];
                                            delete nextMap[legacyKey];
                                            return nextMap;
                                          })();

                                          setEditor((current) =>
                                            current
                                              ? {
                                                  ...current,
                                                  draft: {
                                                    ...current.draft,
                                                    [field.key]: serializeTemplateRowMap(nextTemplateRowMap),
                                                  },
                                                }
                                              : current,
                                          );
                                        }}
                                        className="min-w-0 flex-1 rounded-[18px] border border-[var(--pf-border-soft)] bg-white px-4 py-2.5 text-sm text-[var(--pf-text)] outline-none transition focus:border-[var(--pf-primary)]"
                                      />
                                    </div>
                                  </label>
                                );
                              })}
                            </div>

                            <div className="rounded-[18px] border border-dashed border-[rgba(168,109,69,0.18)] bg-[rgba(168,109,69,0.06)] px-4 py-3 text-sm text-[var(--pf-primary-darker)]">
                              Esta configuración sólo se usa para exportar el pedido Excel y marcar la fila exacta de este producto.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (field.kind === "password") {
                    return (
                      <label key={field.key} className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                        </div>
                        <input
                          type="password"
                          value={value == null ? "" : String(value)}
                          onChange={(event) =>
                            setEditor((current) =>
                              current
                                ? {
                                    ...current,
                                    draft: {
                                      ...current.draft,
                                      [field.key]: event.target.value,
                                    },
                                  }
                                : current,
                            )
                          }
                          className={`w-full rounded-[22px] border px-4 py-3 text-sm outline-none transition placeholder:text-[var(--pf-muted)] focus:border-[var(--pf-primary)] ${
                            field.readonly
                              ? "border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] text-[var(--pf-muted)]"
                              : "border-[var(--pf-border-soft)] bg-white text-[var(--pf-text)]"
                          }`}
                          readOnly={field.readonly}
                          disabled={field.readonly}
                          autoComplete="new-password"
                        />
                      </label>
                    );
                  }

                  if (field.kind === "file") {
                    const imageValue = typeof value === "string" ? value.trim() : "";
                    const selectedFileName = fileNames[field.key] ?? "";
                    const uploadState = uploadStates[field.key];

                    return (
                      <div key={field.key} className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                        </div>

                        <div className="space-y-3 rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                            <label className="flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-[18px] border border-dashed border-[rgba(168,109,69,0.24)] bg-[rgba(168,109,69,0.05)] px-4 py-4 transition hover:bg-[rgba(168,109,69,0.08)] lg:flex-1">
                              <div className="min-w-0">
                                <span className="block text-sm font-bold text-[var(--pf-primary-darker)]">
                                  Seleccionar imagen
                                </span>
                                <span className="mt-1 block text-xs text-[var(--pf-muted)]">
                                  Cargá un archivo para subirlo al sitio.
                                </span>
                                <span className="mt-2 block truncate text-xs font-semibold text-[var(--pf-primary-darker)]">
                                  {selectedFileName || "Ningún archivo seleccionado todavía"}
                                </span>
                              </div>

                              <div className="shrink-0 rounded-full bg-[linear-gradient(180deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] px-4 py-2 text-sm font-black text-[var(--pf-text)] shadow-[0_10px_24px_rgba(168,109,69,0.18)]">
                                Buscar archivo
                              </div>

                              <input
                                id={`admin-file-input-${selectedTable.key}-${field.key}`}
                                data-testid={`admin-file-input-${selectedTable.key}-${field.key}`}
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                disabled={Boolean(uploadState?.loading)}
                                onChange={async (event) => {
                                  const file = event.target.files?.[0];

                                  if (!file) {
                                    return;
                                  }

                                  const previousValue = typeof editor?.draft[field.key] === "string" ? editor.draft[field.key] : "";

                                  setFileNames((current) => ({
                                    ...current,
                                    [field.key]: file.name,
                                  }));
                                  setUploadStates((current) => ({
                                    ...current,
                                    [field.key]: {
                                      loading: true,
                                      fileName: file.name,
                                    },
                                  }));

                                  try {
                                    const fallbackName = [
                                      String(editor?.draft.title ?? "").trim(),
                                      String(editor?.draft.name ?? "").trim(),
                                      String(editor?.draft.sku ?? "").trim(),
                                      selectedTable.label,
                                      field.key,
                                    ]
                                      .filter(Boolean)
                                      .join("-");

                                    const publicUrl = await uploadAdminImage(file, selectedTable.key, fallbackName);

                                    setEditor((current) =>
                                      current
                                        ? {
                                            ...current,
                                            draft: { ...current.draft, [field.key]: publicUrl },
                                          }
                                        : current,
                                    );
                                    setUploadStates((current) => ({
                                      ...current,
                                      [field.key]: {
                                        loading: false,
                                        fileName: file.name,
                                      },
                                    }));
                                  } catch (error) {
                                    setEditor((current) =>
                                      current
                                        ? {
                                            ...current,
                                            draft: { ...current.draft, [field.key]: previousValue },
                                          }
                                        : current,
                                    );
                                    setUploadStates((current) => ({
                                      ...current,
                                      [field.key]: {
                                        loading: false,
                                        fileName: file.name,
                                        error: error instanceof Error ? error.message : "No se pudo subir la imagen.",
                                      },
                                    }));
                                  } finally {
                                    event.target.value = "";
                                  }
                                }}
                              />
                            </label>

                            {selectedTable.key === "products" && field.key === "image" && imageValue && imageValue !== CLEAR_IMAGE_VALUE ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditor((current) =>
                                    current
                                      ? {
                                          ...current,
                                          draft: {
                                            ...current.draft,
                                            [field.key]: CLEAR_IMAGE_VALUE,
                                          },
                                        }
                                      : current,
                                  );
                                  setFileNames((current) => ({
                                    ...current,
                                    [field.key]: "",
                                  }));
                                  setUploadStates((current) => ({
                                    ...current,
                                    [field.key]: {
                                      loading: false,
                                      fileName: "",
                                    },
                                  }));
                                }}
                                className="inline-flex min-h-20 items-center justify-center rounded-[18px] border border-[rgba(185,79,54,0.18)] bg-[rgba(185,79,54,0.06)] px-4 py-4 text-sm font-bold text-[var(--pf-wood-muted)] transition hover:bg-[rgba(185,79,54,0.1)] lg:w-[180px]"
                              >
                                Quitar imagen
                              </button>
                            ) : null}
                          </div>

                          {uploadState?.loading ? (
                            <div className="rounded-[18px] border border-[rgba(168,109,69,0.18)] bg-[rgba(168,109,69,0.08)] px-4 py-3 text-sm text-[var(--pf-primary-darker)]">
                              Subiendo imagen...
                            </div>
                          ) : null}

                          {uploadState?.error ? (
                            <div className="rounded-[18px] border border-[rgba(185,79,54,0.18)] bg-[rgba(185,79,54,0.08)] px-4 py-3 text-sm text-[var(--pf-wood-muted)]">
                              {uploadState.error}
                            </div>
                          ) : null}

                          {imageValue && imageValue !== CLEAR_IMAGE_VALUE ? (
                            <div className="overflow-hidden rounded-[18px] border border-[var(--pf-border-soft)] bg-[#f7f4ee]">
                              <div className="flex items-center justify-between border-b border-[var(--pf-border-soft)] px-4 py-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--pf-muted)]">
                                  Imagen actual
                                </span>
                                <span className="truncate text-xs text-[var(--pf-muted)]">{imageValue}</span>
                              </div>
                              <div className="flex justify-center p-4">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageValue}
                                  alt={field.label}
                                  className="max-h-48 w-auto rounded-[16px] object-contain"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] px-4 py-5 text-center text-sm text-[var(--pf-muted)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/assets/images/no-image.svg"
                                alt="Sin imagen"
                                className="h-16 w-16 opacity-75"
                              />
                              <span>
                                {imageValue === CLEAR_IMAGE_VALUE
                                  ? "La imagen fue quitada. Guardá los cambios para dejar el producto sin imagen."
                                  : "Todavía no se subió una imagen para esta promoción."}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <label key={field.key} className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">
                          {field.label}
                        </span>
                        {field.helper ? <span className="text-xs text-[var(--pf-muted)]">{field.helper}</span> : null}
                      </div>
                      <input
                        type={field.kind === "number" ? "number" : "text"}
                        value={value == null ? "" : String(value)}
                        onChange={(event) =>
                          setEditor((current) =>
                            current
                              ? {
                                  ...current,
                                  draft: {
                                    ...current.draft,
                                    [field.key]: field.kind === "number" ? event.target.value : event.target.value,
                                  },
                                }
                              : current,
                          )
                        }
                        className={`w-full rounded-[22px] border px-4 py-3 text-sm outline-none transition placeholder:text-[var(--pf-muted)] focus:border-[var(--pf-primary)] ${
                          field.readonly
                            ? "border-[var(--pf-border-soft)] bg-[rgba(248,242,232,0.6)] text-[var(--pf-muted)]"
                            : "border-[var(--pf-border-soft)] bg-white text-[var(--pf-text)]"
                        }`}
                        readOnly={field.readonly}
                        disabled={field.readonly}
                      />
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--pf-border-soft)] pt-5">
                <button
                  type="submit"
                  disabled={hasPendingUploads}
                  className="rounded-full bg-[linear-gradient(180deg,var(--pf-primary-soft)_0%,var(--pf-primary)_100%)] px-6 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(168,109,69,0.22)] transition hover:brightness-105"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRowId("");
                    setEditor((current) =>
                      current
                        ? {
                            ...current,
                            draft: emptyDraftFor(selectedTable),
                            rowId: "",
                          }
                        : current,
                    );
                  }}
                  className="rounded-full border border-[var(--pf-border-soft)] bg-white px-6 py-3 text-sm font-semibold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.6)]"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-full border border-transparent px-4 py-3 text-sm font-semibold text-[var(--pf-muted)] transition hover:text-[var(--pf-primary-darker)]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}



