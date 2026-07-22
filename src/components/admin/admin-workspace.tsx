"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { deleteAdminRecord, deleteAdminRecords, saveAdminRecord } from "@/app/admin/actions";
import { ExcelImportButton } from "@/components/admin/excel-import-button";
import type {
  AdminCrudViewModel,
  AdminFieldDefinition,
  AdminTableDefinition,
  AdminTableKey,
} from "@/application/admin-crud";
import type { ProductItem } from "@/domain/site-content";
import { formatCurrency } from "@/lib/catalog";

type DraftRecord = Record<string, string | number | boolean | null>;

type PackSelection = {
  productId: number;
  quantity: number;
  order: number;
};

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

const sidebarSections: { title: string; keys: AdminTableKey[] }[] = [
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

  if (field.kind === "file") {
    return value == null ? "" : String(value);
  }

  if (field.kind === "select") {
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
      draft[field.key] = ["active", "visible"].includes(field.key);
      continue;
    }

    if (field.kind === "pack_products" || field.kind === "multiselect") {
      draft[field.key] = "[]";
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
        <label className="flex h-12 flex-1 items-center rounded-full border border-[var(--pf-border-soft)] bg-slate-50 px-4 text-slate-500">
          <span className="text-sm">Buscar</span>
          <input
            type="text"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="ml-3 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="SKU, nombre, marca o categoría"
          />
        </label>

        <button
          type="button"
          onClick={() => updateSelections([])}
          className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
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
                  className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black"
                  onClick={() => updateSelections(selections.filter((item) => item.productId !== selection.productId))}
                >
                  Quitar
                </button>
              </span>
            );
          })
        ) : (
          <span className="text-sm text-slate-500">Todavía no seleccionaste productos para este pack.</span>
        )}
      </div>

      <div className="max-h-[320px] overflow-auto rounded-[20px] border border-slate-200">
        <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.7fr)_auto] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
          <span>Producto</span>
          <span>Cantidad</span>
          <span>Acción</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredProducts.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">
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
                  <p className="truncate font-semibold text-slate-900">{product.name}</p>
                  <p className="text-sm text-slate-500">
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
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none disabled:bg-slate-50"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => toggleProduct(product)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition ${
                    selected
                      ? "border border-[rgba(168,109,69,0.18)] bg-[rgba(168,109,69,0.12)] text-[var(--pf-primary-darker)]"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
  const initialTableKey = (tables.find((table) => table.key === "hero_slides")?.key ?? tables[0]?.key ?? "") as AdminTableKey;

  const [selectedTableKey, setSelectedTableKey] = useState<AdminTableKey>(initialTableKey);
  const [query, setQuery] = useState("");
  const [packSearch, setPackSearch] = useState("");
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({});
  const [selectedRowId, setSelectedRowId] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [bulkDeleteState, setBulkDeleteState] = useState<BulkDeleteState | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const selectedTable = useMemo(
    () => tables.find((table) => table.key === selectedTableKey) ?? tables[0],
    [selectedTableKey, tables],
  );

  const selectedRows = useMemo(() => (selectedTable?.rows as Record<string, unknown>[]) ?? [], [selectedTable]);
  const fieldMap = useMemo(() => new Map(selectedTable?.fields.map((field) => [field.key, field]) ?? []), [selectedTable]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const queryFilteredRows = !normalized
      ? selectedRows
      : selectedRows.filter((row) =>
          Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(normalized)),
      );

    return queryFilteredRows.filter((row) => isVisibleAdminRow(selectedTable.key, row));
  }, [query, selectedRows, selectedTable.key]);

  const visibleRowIds = useMemo(() => visibleRows.map((row) => getRowId(selectedTable, row)), [selectedTable, visibleRows]);
  const selectedRowIdSet = useMemo(() => new Set(selectedRowIds), [selectedRowIds]);
  const selectedVisibleCount = useMemo(
    () => visibleRowIds.filter((rowId) => selectedRowIdSet.has(rowId)).length,
    [selectedRowIdSet, visibleRowIds],
  );
  const allVisibleSelected = visibleRowIds.length > 0 && selectedVisibleCount === visibleRowIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const activeCount = getActiveCount(visibleRows as Record<string, unknown>[]);
  const maxOrder = getMaxOrder(visibleRows as Record<string, unknown>[]);
  const totalCount = visibleRows.length;
  const hasPendingUploads = useMemo(
    () => Object.values(uploadStates).some((uploadState) => uploadState.loading),
    [uploadStates],
  );

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected, visibleRowIds]);

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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(243,236,220,0.96)_42%,_rgba(233,222,198,0.98))] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col xl:flex-row">
        <aside className="border-b border-white/20 bg-[linear-gradient(180deg,#0d1524_0%,#111c2f_52%,#0b1220_100%)] px-4 py-5 text-slate-100 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] xl:w-[300px] xl:border-b-0 xl:border-r xl:px-5 xl:py-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.18)]">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(180deg,var(--pf-secondary-dark)_0%,var(--pf-primary)_100%)] text-lg font-black tracking-tight text-white">
                PF
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--pf-secondary-light)]">Pintofruta</p>
                <p className="text-sm text-slate-300">Panel de administracion</p>
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
                  <div className="mb-3 flex items-center justify-between text-[11px] font-black uppercase tracking-[0.34em] text-slate-400">
                    <span>{section.title}</span>
                    <span>▴</span>
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
                              ? "bg-[linear-gradient(90deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] text-slate-900 shadow-[0_14px_30px_rgba(168,109,69,0.24)]"
                              : "bg-transparent text-slate-300 hover:bg-white/5"
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

        </aside>

        <section className="flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="rounded-[30px] border border-white/70 bg-[rgba(250,246,239,0.92)] p-5 shadow-[0_24px_60px_rgba(58,44,25,0.12)] backdrop-blur">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-black uppercase tracking-[0.36em] text-[var(--pf-secondary)]">Administracion</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
                  {selectedTable.label}
                </h1>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[740px] xl:grid-cols-6">
                <div className="flex min-h-[94px] flex-col justify-between rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="text-[10px] font-black uppercase leading-none tracking-[0.26em] text-slate-400">Productos</p>
                  <p className="text-2xl font-black leading-none text-slate-900">{overview.counts.products}</p>
                </div>
                <div className="flex min-h-[94px] flex-col justify-between rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="text-[10px] font-black uppercase leading-none tracking-[0.26em] text-slate-400">Promociones</p>
                  <p className="text-2xl font-black leading-none text-slate-900">{overview.counts.packs}</p>
                </div>
                <div className="flex min-h-[94px] flex-col justify-between rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="text-[10px] font-black uppercase leading-none tracking-[0.26em] text-slate-400">Categorías</p>
                  <p className="text-2xl font-black leading-none text-slate-900">{overview.counts.categories}</p>
                </div>
                <div className="flex min-h-[94px] flex-col justify-between rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="text-[10px] font-black uppercase leading-none tracking-[0.26em] text-slate-400">Marcas</p>
                  <p className="text-2xl font-black leading-none text-slate-900">{overview.counts.brands}</p>
                </div>
                <div className="flex min-h-[94px] flex-col justify-between rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="text-[10px] font-black uppercase leading-none tracking-[0.26em] text-slate-400">Usuarios</p>
                  <p className="text-2xl font-black leading-none text-slate-900">{overview.counts.users}</p>
                </div>
                <div className="flex min-h-[94px] flex-col justify-between rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4 shadow-[0_10px_25px_rgba(58,44,25,0.06)]">
                  <p className="text-[10px] font-black uppercase leading-none tracking-[0.26em] text-slate-400">Registro</p>
                  <p className="text-2xl font-black leading-none text-slate-900">{totalCount}</p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="flex h-14 flex-1 items-center rounded-full border border-[var(--pf-border-soft)] bg-white px-5 text-slate-500 shadow-[0_8px_22px_rgba(58,44,25,0.06)]">
                <span className="text-sm">Buscar</span>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="ml-3 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  placeholder="Buscar por SKU, nombre, email o estado"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                {selectedRowIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="inline-flex h-14 items-center justify-center rounded-full border border-[rgba(185,79,54,0.24)] bg-[rgba(185,79,54,0.08)] px-6 text-sm font-black text-[var(--pf-wood-muted)] shadow-[0_10px_22px_rgba(58,44,25,0.06)] transition hover:bg-[rgba(185,79,54,0.12)]"
                  >
                    Borrar seleccionados ({selectedRowIds.length})
                  </button>
                ) : null}

                {selectedTable.key === "products" ? <ExcelImportButton /> : null}

                <button
                  type="button"
                  onClick={() => openNew(selectedTable)}
                  className="inline-flex h-14 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] px-6 text-sm font-black text-slate-900 shadow-[0_14px_30px_rgba(168,109,69,0.22)] transition hover:brightness-105"
                >
                  {getCreateLabel(selectedTable)}
                </button>
              </div>

              <Link
                href="/"
                className="inline-flex h-14 items-center justify-center rounded-full border border-transparent px-5 text-sm font-semibold text-slate-700 transition hover:bg-white/60"
              >
                Ir a la web
              </Link>
            </div>

            <div className="mt-6">
              <section className="rounded-[28px] border border-[var(--pf-border-soft)] bg-white/85 p-4 shadow-[0_16px_40px_rgba(58,44,25,0.08)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary)]">
                      Contenido / {selectedTable.label}
                    </p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Listado de registros</h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="min-w-[120px] rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Activos</p>
                      <p className="mt-1 text-xl font-black text-slate-900">{activeCount}</p>
                    </div>
                    <div className="min-w-[120px] rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Orden max</p>
                      <p className="mt-1 text-xl font-black text-slate-900">{maxOrder}</p>
                    </div>
                    <div className="min-w-[120px] rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Total</p>
                      <p className="mt-1 text-xl font-black text-slate-900">{totalCount}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-[960px] w-full border-collapse">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="border-b border-slate-200 px-4 py-4 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
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
                          {selectedTable.columns.map((column) => (
                            <th
                              key={column.key}
                              className="border-b border-slate-200 px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400"
                            >
                              {column.label}
                            </th>
                          ))}
                          <th className="border-b border-slate-200 px-5 py-4 text-left text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
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
                              className={`border-b border-slate-100 transition ${
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
                              {selectedTable.columns.map((column) => {
                                const field = fieldMap.get(column.key);

                                return (
                                  <td key={column.key} className="px-5 py-4 align-top text-sm text-slate-700">
                                    <div
                                      className={
                                        field?.kind === "boolean"
                                          ? "inline-flex rounded-full bg-[rgba(168,109,69,0.12)] px-3 py-1 text-[11px] font-bold text-[var(--pf-primary-darker)]"
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
                                  <button
                                    type="button"
                                    onClick={() => openEdit(selectedTable, row)}
                                    className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-xs font-bold text-[var(--pf-primary-darker)] transition hover:bg-[var(--pf-surface-warm)]"
                                  >
                                    Editar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleQuickDelete(selectedTable, row)}
                                    className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-xs font-bold text-[var(--pf-wood-muted)] transition hover:bg-[var(--pf-surface-warm)]"
                                  >
                                    Borrar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>

      {bulkDeleteState?.open ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
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
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                  {bulkDeleteState.loading
                    ? `Eliminando ${bulkDeleteState.count} elementos`
                    : bulkDeleteState.error
                      ? "No se pudo borrar"
                      : "Borrado completado"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {bulkDeleteState.loading
                    ? "Estamos aplicando los cambios y actualizando las relaciones para que no quede nada roto."
                    : bulkDeleteState.error ?? bulkDeleteState.message ?? "Los elementos ya no se muestran en la grilla."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setBulkDeleteState(null)}
                className="rounded-full border border-[var(--pf-border-soft)] bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {bulkDeleteState.loading ? "Procesando..." : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm"
          onClick={closeEditor}
        >
          <div
            className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[30px] border border-[var(--pf-border-soft)] bg-[#fbf8f1] shadow-[0_40px_120px_rgba(74,57,38,0.28)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.34em] text-[var(--pf-secondary)]">Edicion</p>
                <h3 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                  {editor.rowId ? "Editar registro" : "Nuevo registro"}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {selectedTable.label} / {editor.rowId || "creacion"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
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
              className="max-h-[calc(92vh-110px)] overflow-auto px-6 py-6"
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
                    field.kind === "boolean" ||
                    field.kind === "pack_products" ||
                    field.kind === "multiselect";

                  if (field.kind === "pack_products") {
                    return (
                      <div key={field.key} className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-slate-500">{field.helper}</span> : null}
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
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-slate-500">{field.helper}</span> : null}
                        </div>

                        {options.length === 0 ? (
                          <div className="rounded-[22px] border border-dashed border-[var(--pf-border-soft)] bg-white px-4 py-4 text-sm text-slate-500">
                            No hay categorias visibles para seleccionar.
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
                                      className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black"
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
                                        : "border-[var(--pf-border-soft)] bg-slate-50 hover:bg-white"
                                    }`}
                                  >
                                    <span className="text-sm font-semibold text-slate-700">{option.label}</span>
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
                        className={`flex items-center justify-between rounded-[22px] border border-slate-200 bg-white px-4 py-4 ${
                          fullWidth ? "md:col-span-2" : ""
                        }`}
                      >
                        <div className="pr-4">
                          <span className="block text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                            {field.label}
                          </span>
                          {field.helper ? <span className="mt-1 block text-xs text-slate-500">{field.helper}</span> : null}
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
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-slate-500">{field.helper}</span> : null}
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
                          className="w-full rounded-[22px] border border-[var(--pf-border-soft)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--pf-primary)]"
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
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-slate-500">{field.helper}</span> : null}
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
                          className="w-full rounded-[22px] border border-[var(--pf-border-soft)] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--pf-primary)]"
                          readOnly={field.readonly}
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
                          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                            {field.label}
                          </span>
                          {field.helper ? <span className="text-xs text-slate-500">{field.helper}</span> : null}
                        </div>

                        <div className="space-y-3 rounded-[22px] border border-[var(--pf-border-soft)] bg-white p-4">
                          <label className="flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-[18px] border border-dashed border-[rgba(168,109,69,0.24)] bg-[rgba(168,109,69,0.05)] px-4 py-4 transition hover:bg-[rgba(168,109,69,0.08)]">
                            <div className="min-w-0">
                              <span className="block text-sm font-bold text-[var(--pf-primary-darker)]">
                                Seleccionar imagen
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                Cargá un archivo para subirlo al sitio.
                              </span>
                              <span className="mt-2 block truncate text-xs font-semibold text-slate-600">
                                {selectedFileName || "Ningún archivo seleccionado todavía"}
                              </span>
                            </div>

                            <div className="shrink-0 rounded-full bg-[linear-gradient(180deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] px-4 py-2 text-sm font-black text-slate-900 shadow-[0_10px_24px_rgba(168,109,69,0.18)]">
                              Buscar archivo
                            </div>

                            <input
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

                          {imageValue ? (
                            <div className="overflow-hidden rounded-[18px] border border-[var(--pf-border-soft)] bg-[#f7f4ee]">
                              <div className="flex items-center justify-between border-b border-[var(--pf-border-soft)] px-4 py-2">
                                <span className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                                  Imagen actual
                                </span>
                                <span className="truncate text-xs text-slate-500">{imageValue}</span>
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
                            <div className="rounded-[18px] border border-dashed border-[var(--pf-border-soft)] bg-slate-50 px-4 py-5 text-sm text-slate-500">
                              Todavía no se subió una imagen para esta promoción.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <label key={field.key} className={`block ${fullWidth ? "md:col-span-2" : ""}`}>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">
                          {field.label}
                        </span>
                        {field.helper ? <span className="text-xs text-slate-500">{field.helper}</span> : null}
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
                        className={`w-full rounded-[22px] border px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--pf-primary)] ${
                          field.readonly
                            ? "border-slate-200 bg-slate-50 text-slate-500"
                            : "border-[var(--pf-border-soft)] bg-white text-slate-900"
                        }`}
                        readOnly={field.readonly}
                        disabled={field.readonly}
                      />
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
                <button
                  type="submit"
                  disabled={hasPendingUploads}
                  className="rounded-full bg-[linear-gradient(180deg,var(--pf-secondary-light)_0%,var(--pf-secondary)_100%)] px-6 py-3 text-sm font-black text-slate-900 shadow-[0_14px_30px_rgba(168,109,69,0.22)] transition hover:brightness-105"
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
                  className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-full border border-transparent px-4 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-800"
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
