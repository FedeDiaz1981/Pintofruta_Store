import type { AdminOverview } from "@/application/admin";
import type { ProductItem, SiteContentDocument } from "@/domain/site-content";

export type AdminTableKey =
  | "site_content_meta"
  | "header_search_scopes"
  | "header_sections"
  | "header_groups"
  | "header_group_items"
  | "hero_slides"
  | "banners"
  | "packs"
  | "categories"
  | "brands"
  | "users"
  | "products";

export type AdminFieldKind =
  | "text"
  | "number"
  | "boolean"
  | "textarea"
  | "pack_products"
  | "multiselect"
  | "file"
  | "select"
  | "password"
  | "template_rows";

export interface AdminFieldOption {
  value: string;
  label: string;
}

export interface AdminFieldDefinition {
  key: string;
  label: string;
  kind: AdminFieldKind;
  required?: boolean;
  readonly?: boolean;
  hidden?: boolean;
  helper?: string;
  options?: AdminFieldOption[];
}

export interface AdminTableDefinition {
  key: AdminTableKey;
  label: string;
  description: string;
  idField: string;
  rowLabelField: string;
  rows: unknown[];
  columns: {
    key: string;
    label: string;
  }[];
  fields: AdminFieldDefinition[];
}

export interface AdminCrudViewModel {
  overview: AdminOverview;
  tables: AdminTableDefinition[];
  productSelectionRows: ProductItem[];
  orderExcelTemplates: {
    id: number;
    template_key: string;
    audience: "guest" | "member";
    version: number;
    file_name: string;
    active: boolean;
    updated_at: string;
  }[];
}

const tableOrder: AdminTableKey[] = [
  "site_content_meta",
  "products",
  "packs",
  "brands",
  "categories",
  "users",
  "hero_slides",
  "banners",
];

function booleanField(key: string, label: string, helper?: string, hidden = false): AdminFieldDefinition {
  return { key, label, kind: "boolean", helper, hidden };
}

function textField(
  key: string,
  label: string,
  required = false,
  helper?: string,
  readonly = false,
  hidden = false,
): AdminFieldDefinition {
  return { key, label, kind: "text", required, helper, readonly, hidden };
}

function passwordField(
  key: string,
  label: string,
  required = false,
  helper?: string,
  readonly = false,
  hidden = false,
): AdminFieldDefinition {
  return { key, label, kind: "password", required, helper, readonly, hidden };
}

function numberField(
  key: string,
  label: string,
  required = false,
  helper?: string,
  readonly = false,
  hidden = false,
): AdminFieldDefinition {
  return { key, label, kind: "number", required, helper, readonly, hidden };
}

function textareaField(key: string, label: string, required = false, helper?: string, hidden = false): AdminFieldDefinition {
  return { key, label, kind: "textarea", required, helper, hidden };
}

function fileField(key: string, label: string, required = false, helper?: string, hidden = false): AdminFieldDefinition {
  return { key, label, kind: "file", required, helper, hidden };
}

function selectField(
  key: string,
  label: string,
  options: AdminFieldOption[],
  required = false,
  helper?: string,
  readonly = false,
  hidden = false,
): AdminFieldDefinition {
  return { key, label, kind: "select", required, helper, readonly, hidden, options };
}

function packProductsField(key: string, label: string, helper?: string): AdminFieldDefinition {
  return { key, label, kind: "pack_products", helper };
}

function templateRowsField(key: string, label: string, helper?: string): AdminFieldDefinition {
  return { key, label, kind: "template_rows", helper };
}

function multiselectField(
  key: string,
  label: string,
  options: AdminFieldOption[],
  helper?: string,
  hidden = false,
): AdminFieldDefinition {
  return { key, label, kind: "multiselect", helper, hidden, options };
}

export function getAdminTableDefinitions(content: SiteContentDocument): AdminTableDefinition[] {
  const siteMetaRow = {
    id: 1,
    order_notification_email: content.orderNotificationEmail ?? "",
  };
  const packRows = (content.packs ?? []).map((pack) => ({
    ...pack,
    items_count: pack.items.length,
    items_json: JSON.stringify(
      pack.items.map((item, index) => ({
        productId: item.productId,
        quantity: item.quantity,
        order: index + 1,
      })),
    ),
  }));
  const visibleCategoryOptions = (content.categories ?? [])
    .filter((category) => category.visible)
    .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
    .map((category) => ({
      value: String(category.id),
      label: category.name,
    }));
  const brandOptions = (content.brands ?? [])
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }))
    .map((brand) => ({
      value: brand.name,
      label: brand.name,
    }));

  return [
    {
      key: "site_content_meta",
      label: "Configuración",
      description: "Preferencias generales y correo de destino para pedidos.",
      idField: "id",
      rowLabelField: "order_notification_email",
      rows: [siteMetaRow],
      columns: [{ key: "order_notification_email", label: "Correo de destino" }],
      fields: [
        numberField("id", "ID", true, "Uso interno", true, true),
        textField(
          "order_notification_email",
          "Correo de destino",
          false,
          "Se usará para recibir por mail el Excel del pedido cuando el cliente lo confirme.",
        ),
      ],
    },
    {
      key: "products",
      label: "Productos",
      description: "Catálogo principal de productos y precios.",
      idField: "id",
      rowLabelField: "name",
      rows: (content.products ?? []).map((product) => ({
        ...product,
        active: String(product.status ?? "").toLowerCase() !== "inactive",
        soldOut: product.soldOut ?? false,
      })),
      columns: [
        { key: "id", label: "ID" },
        { key: "sku", label: "SKU" },
        { key: "name", label: "Nombre" },
        { key: "brand", label: "Marca" },
        { key: "soldOut", label: "Agotado" },
        { key: "publicPrice", label: "Precio" },
        { key: "featuredPriority", label: "Prioridad" },
        { key: "featured", label: "Destacado" },
        { key: "active", label: "Activo" },
        { key: "viewsCount", label: "Vistas" },
        { key: "salesCount", label: "Ventas" },
      ],
      fields: [
        numberField("id", "ID", true, "Uso interno", true, true),
        textField("sku", "SKU", true, "Uso interno", true, true),
        textField("name", "Nombre", true),
        textareaField("detail", "Detalle", true),
        multiselectField("categoryIds", "Categorías", visibleCategoryOptions, "Elegí una o más categorías visibles."),
        selectField("brand", "Marca", brandOptions, true, "Elegí una marca registrada."),
        numberField("publicPrice", "Precio público", true),
        numberField("memberPrice", "Precio miembro", true),
        fileField("image", "Imagen", false, "Subí una imagen de portada para la promoción."),
        textField("presentation", "Presentación", true, "Uso interno", true, true),
        textField("status", "Estado", true, "Uso interno", true, true),
        booleanField("soldOut", "Agotado"),
        booleanField("featured", "Destacado"),
        numberField("featuredPriority", "Prioridad destacada", false, "Más bajo = antes en el carrusel."),
        booleanField("active", "Activo"),
        numberField("categoryId", "ID de categoría", true, "Uso interno", true, true),
        textField("categoryName", "Nombre de categoría", true, "Uso interno", true, true),
        numberField("stock", "Stock", false, "Uso interno", true, true),
        numberField("viewsCount", "Vistas", false, "Uso interno", true, true),
        numberField("salesCount", "Ventas", false, "Uso interno", true, true),
        textareaField("description", "Descripción", false, "Uso interno", true),
        textField("sourceSection", "Sección origen", false, "Uso interno", true, true),
        templateRowsField(
          "templateRowMap",
          "Fila por template",
          "Uso interno. Completa la fila exacta a marcar por cada plantilla guardada.",
        ),
      ],
    },
    {
      key: "brands",
      label: "Marcas",
      description: "Identidad comercial y miniaturas.",
      idField: "id",
      rowLabelField: "name",
      rows: content.brands,
      columns: [
        { key: "id", label: "ID" },
        { key: "code", label: "Código" },
        { key: "name", label: "Nombre" },
        { key: "featured", label: "Destacada" },
        { key: "active", label: "Activa" },
      ],
      fields: [
        textField("id", "ID", true, "Se genera automáticamente.", true),
        textField("code", "Código", true, "Se genera automáticamente.", true, true),
        textField("name", "Nombre", true),
        fileField("image", "Imagen", false, "Subí el logo o imagen de la marca."),
        booleanField("featured", "Destacada"),
        booleanField("active", "Activa"),
      ],
    },
    {
      key: "categories",
      label: "Categorías",
      description: "Categorías visibles del catálogo.",
      idField: "id",
      rowLabelField: "name",
      rows: content.categories ?? [],
      columns: [
        { key: "id", label: "ID" },
        { key: "name", label: "Nombre" },
        { key: "slug", label: "Apodo" },
        { key: "visible", label: "Visible" },
        { key: "homeMenu", label: "Menú" },
      ],
      fields: [
        numberField("id", "ID", true, "Se genera automáticamente.", true),
        textField("name", "Nombre", true),
        textField("slug", "Apodo", true, "Se genera automáticamente.", true),
        booleanField("visible", "Visible"),
        booleanField("homeMenu", "Mostrar en menú"),
        textField("icon", "Ícono", false, "Se genera automáticamente.", true, true),
      ],
    },
    {
      key: "users",
      label: "Usuarios",
      description: "Acceso, roles y permisos de precios.",
      idField: "id",
      rowLabelField: "name",
      rows: content.users ?? [],
      columns: [
        { key: "id", label: "ID" },
        { key: "name", label: "Nombre" },
        { key: "email", label: "Correo" },
        { key: "role", label: "Rol" },
        { key: "active", label: "Activo" },
      ],
      fields: [
        numberField("id", "ID", true, "Se genera automáticamente.", true, true),
        textField("name", "Nombre", true),
        textField("email", "Correo", true),
        passwordField("password", "Contraseña", false, "Definila al crear la cuenta. En edición es opcional."),
        selectField(
          "role",
          "Rol",
          [
            { value: "Administrador", label: "Administrador" },
            { value: "Cliente", label: "Cliente" },
          ],
          true,
        ),
        booleanField("canSeePrices", "Ve precios"),
        booleanField("active", "Activo"),
      ],
    },
    {
      key: "hero_slides",
      label: "Carrusel principal",
      description: "Elementos del carrusel principal.",
      idField: "id",
      rowLabelField: "title",
      rows: content.heroSlides,
      columns: [
        { key: "id", label: "ID" },
        { key: "title", label: "Título" },
        { key: "badge", label: "Etiqueta" },
        { key: "active", label: "Activo" },
      ],
      fields: [
        numberField("id", "ID", true),
        numberField("order", "Orden", true),
        textField("title", "Título", true),
        textareaField("subtitle", "Subtítulo", true),
        textField("badge", "Etiqueta", true),
        fileField("image", "Imagen", true, "Subí la imagen principal del carrusel."),
        fileField("imageMobile", "Imagen móvil", false, "Subí la versión para mobile."),
        textField("link", "Enlace", true),
        booleanField("active", "Activo"),
        booleanField("homeSpotlight", "Destacado en inicio"),
      ],
    },
    {
      key: "banners",
      label: "Banners",
      description: "Mensajes destacados del inicio.",
      idField: "id",
      rowLabelField: "text",
      rows: content.banners,
      columns: [
        { key: "id", label: "ID" },
        { key: "text", label: "Texto" },
        { key: "order", label: "Orden" },
        { key: "active", label: "Activo" },
      ],
      fields: [
        numberField("id", "ID", true),
        textareaField("text", "Texto", true),
        numberField("order", "Orden", true),
        booleanField("active", "Activo"),
      ],
    },
    {
      key: "packs",
      label: "Promociones",
      description: "Paquetes de productos con precio propio.",
      idField: "id",
      rowLabelField: "title",
      rows: packRows,
      columns: [
        { key: "id", label: "ID" },
        { key: "apodo", label: "Apodo" },
        { key: "title", label: "Título" },
        { key: "category", label: "Categoría" },
        { key: "publicPrice", label: "Precio" },
        { key: "items_count", label: "Productos" },
        { key: "active", label: "Activo" },
      ],
      fields: [
        numberField("id", "ID", true, "Se usa al editar. En alta se calcula solo.", true, true),
        textField("apodo", "Apodo", true, "Identificador amigable para el equipo.", true, true),
        textField("title", "Título", true),
        textareaField("description", "Descripción", true),
        textField("category", "Categoría", true),
        numberField("publicPrice", "Precio final", true),
        fileField("image", "Imagen", false, "Subí una imagen de portada para la promoción."),
        booleanField("active", "Activo"),
        booleanField("featured", "Destacado"),
        numberField("order", "Orden"),
        packProductsField("items_json", "Productos del pack", "Buscá y seleccioná los productos que integran la promoción."),
      ],
    },
    {
      key: "header_search_scopes",
      label: "Búsquedas del encabezado",
      description: "Búsquedas del encabezado.",
      idField: "id",
      rowLabelField: "label",
      rows: content.headerNavigation?.searchScopes ?? [],
      columns: [
        { key: "id", label: "ID" },
        { key: "label", label: "Etiqueta" },
        { key: "href", label: "Enlace" },
      ],
      fields: [
        textField("id", "ID", true),
        textField("label", "Etiqueta", true),
        textField("href", "Enlace", true),
      ],
    },
    {
      key: "header_sections",
      label: "Secciones del encabezado",
      description: "Secciones principales de navegacion.",
      idField: "id",
      rowLabelField: "label",
      rows: content.headerNavigation?.sections ?? [],
      columns: [
        { key: "id", label: "ID" },
        { key: "label", label: "Etiqueta" },
        { key: "href", label: "Enlace" },
      ],
      fields: [
        textField("id", "ID", true),
        textField("label", "Etiqueta", true),
        textField("icon", "Icono", true),
        textField("href", "Enlace", true),
      ],
    },
    {
      key: "header_groups",
      label: "Grupos del encabezado",
      description: "Grupos por seccion del menu.",
      idField: "id",
      rowLabelField: "label",
      rows:
        content.headerNavigation?.sections.flatMap((section) =>
          section.groups.map((group) => ({
            id: `${section.id}:${group.id}`,
            section_id: section.id,
            label: group.label,
            href: group.href,
          })),
        ) ?? [],
      columns: [
        { key: "id", label: "ID" },
        { key: "section_id", label: "Seccion" },
        { key: "label", label: "Etiqueta" },
        { key: "href", label: "Enlace" },
      ],
      fields: [
        textField("id", "ID", true),
        textField("section_id", "Seccion", true),
        textField("label", "Etiqueta", true),
        textField("href", "Enlace", true),
      ],
    },
    {
      key: "header_group_items",
      label: "Items del encabezado",
      description: "Items dentro de cada grupo.",
      idField: "id",
      rowLabelField: "label",
      rows:
        content.headerNavigation?.sections.flatMap((section) =>
          section.groups.flatMap((group) =>
            group.items.map((item) => ({
              id: `${section.id}:${group.id}:${item.id}`,
              group_id: `${section.id}:${group.id}`,
              label: item.label,
              href: item.href,
            })),
          ),
        ) ?? [],
      columns: [
        { key: "id", label: "ID" },
        { key: "group_id", label: "Grupo" },
        { key: "label", label: "Etiqueta" },
        { key: "href", label: "Enlace" },
      ],
      fields: [
        textField("id", "ID", true),
        textField("group_id", "Grupo", true),
        textField("label", "Etiqueta", true),
        textField("href", "Enlace", true),
      ],
    },
  ];
}

export function getAdminTableDefinition(content: SiteContentDocument, key: AdminTableKey): AdminTableDefinition | null {
  return getAdminTableDefinitions(content).find((table) => table.key === key) ?? null;
}

export function buildAdminCrudViewModel(
  content: SiteContentDocument,
  overview: AdminOverview,
  orderExcelTemplates: AdminCrudViewModel["orderExcelTemplates"] = [],
): AdminCrudViewModel {
  const tables = getAdminTableDefinitions(content);
  const orderedTables = tableOrder
    .map((key) => tables.find((table) => table.key === key))
    .filter((table): table is AdminTableDefinition => Boolean(table));
  const productSelectionRows = [...(content.products ?? [])]
    .filter((product) => String(product.status ?? "").toLowerCase() !== "inactive")
    .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));

  return {
    overview,
    tables: orderedTables,
    productSelectionRows,
    orderExcelTemplates,
  };
}

