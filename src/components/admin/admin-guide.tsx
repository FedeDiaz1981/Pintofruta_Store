"use client";

import { createContext, useContext, useState } from "react";
import { BookOpen, ChevronRight, CircleAlert, FileSpreadsheet, Image as ImageIcon, PackagePlus, Tags, Users, X } from "lucide-react";

type GuideTopic = {
  id: string;
  title: string;
  summary: string;
  icon: typeof PackagePlus;
  steps: string[];
  tip?: string;
  screen: "product" | "prices" | "excel" | "catalog" | "tags" | "category" | "users" | "carousel" | "banners" | "images" | "out-of-stock" | "duplicates";
};

const guidePreviewSection = createContext<number | undefined>(undefined);

const excelSteps = [
  "Desde Listas → Productos, presioná Descargar sincronizador de precios. Se descarga Sincronizador de precios.xlsm.",
  "Abrí el archivo con Excel de escritorio y habilitá las macros si Excel lo solicita. La solapa principal es PRECIOS; las solapas internas quedan ocultas.",
  "Presioná ACTUALIZAR BASE para traer la información actual del sitio, incluidos los IDs, marcas, categorías, estados y precios.",
  "Editá ACTIVO, PUBLICO o DESCUENTO. No reemplaces el ID de una fila existente. Antes de cada actualización se guarda un backup oculto.",
  "Para agregar un producto, insertá una fila con el ID vacío, completá el detalle y los precios, y dejala activa. Las filas sin ID se crean como productos nuevos.",
  "Presioná ENVIAR CAMBIOS. Los productos existentes se actualizan por ID; los nuevos reciben un ID del sitio y luego se vuelve a descargar el catálogo actualizado.",
];

const topics: GuideTopic[] = [
  {
    id: "product",
    title: "Agregar un producto",
    summary: "Crear un producto nuevo con marca, categorías, precios e imagen.",
    icon: PackagePlus,
    screen: "product",
    steps: [
      "Datos básicos y categorías. Entrá en Listas → Productos → Nuevo producto, completá Nombre y Detalle, y seleccioná una o más categorías visibles. Las categorías se marcan con los casilleros disponibles.",
      "Marca, precios e imagen. Elegí una marca registrada, completá Precio público y Precio miembro, y subí la imagen con Buscar archivo. Un precio vacío equivale a $0.",
      "Estado y guardado. Revisá Agotado, Destacado y Activo. Para publicar el producto, dejá Activo marcado y presioná Guardar. Si ambos precios son $0, el producto no se mostrará.",
    ],
    tip: "Si Precio público es 0 y Precio miembro es mayor que 0, sólo lo verán los usuarios habilitados para precios de miembro.",
  },
  {
    id: "prices",
    title: "Editar precios y datos",
    summary: "Actualizar el nombre, detalle, precios, categorías o imagen de un producto existente.",
    icon: Tags,
    screen: "product",
    steps: [
      "Buscá el producto por ID, nombre, detalle o marca y presioná Editar. En esta sección podés corregir Nombre, Detalle y Categorías; los valores existentes aparecen cargados para que los revises.",
      "Podés cambiar Marca, Precio público, Precio miembro o Imagen. Un precio vacío se guarda como $0; si dejás un público en $0, el producto deja de mostrarse para visitantes.",
      "Revisá Agotado, Destacado y Activo y presioná Guardar. Los campos internos como ID, SKU, estado técnico y estadísticas no se modifican desde este formulario.",
    ],
    tip: "Al editar no se crea otro producto: se actualiza el registro existente y se conservan los datos que no cambies. Si ambos precios quedan en $0, no se mostrará para ningún público.",
  },
  {
    id: "availability",
    title: "Acciones rápidas en Productos",
    summary: "Usar las acciones disponibles directamente desde cada registro del listado.",
    icon: CircleAlert,
    screen: "catalog",
    steps: [
      "Casillero de selección. Marcá el casillero de la fila para seleccionar el producto y habilitar las acciones masivas disponibles en la parte superior del listado.",
      "Agotado. Cambia rápidamente la disponibilidad comercial del producto: queda publicado, pero se muestra como agotado y no se puede agregar normalmente al pedido. No borra ni desactiva el registro.",
      "Editar. Abre el formulario completo del producto para modificar nombre, detalle, categorías, marca, precios, imagen y estados. Los cambios se guardan sobre el mismo ID.",
      "Borrar. Elimina el registro después de pedir confirmación. Usalo sólo cuando el producto ya no deba conservarse en el catálogo administrativo.",
      "Para ocultar o volver a publicar un producto, usá el campo Activo dentro de Editar. Un producto con ambos precios en $0 tampoco se muestra aunque esté activo.",
    ],
    tip: "Agotado y Activo son acciones distintas: Agotado conserva el producto publicado; Activo controla si el producto se publica o queda inactivo.",
  },
  {
    id: "out-of-stock",
    title: "Usar Productos agotados",
    summary: "Consultar el stock visual y cambiar rápidamente los estados Agotado y Activo.",
    icon: CircleAlert,
    screen: "out-of-stock",
    steps: [
      "Abrí Productos agotados desde el menú de administración. El módulo muestra las tarjetas de los productos con su imagen, marca, ID y nombre.",
      "Usá el buscador para encontrar un producto por ID, nombre, descripción o marca. El selector Visibilidad permite limitar la consulta a activos u otros estados disponibles.",
      "Filtrá la grilla con Todos, Agotados o Con stock. Los contadores indican cuántos productos hay en cada estado y se actualizan después de guardar un cambio.",
      "Usá el interruptor Agotado para indicar si el producto no tiene disponibilidad. Al activarlo, el producto puede seguir publicado, pero se muestra como agotado.",
      "Usá el interruptor Activo para decidir si el producto se publica. Un producto puede estar Activo y Agotado al mismo tiempo, o inactivo y fuera de la publicación.",
      "Después de cambiar un interruptor, verificá la etiqueta de la tarjeta y los contadores del módulo. Si corresponde, buscá el producto nuevamente para confirmar su estado.",
    ],
    tip: "Agotado no es lo mismo que inactivo: Agotado informa disponibilidad, mientras que Activo controla si el producto aparece publicado. No desactives un producto sólo porque temporalmente no tiene stock.",
  },
  {
    id: "excel",
    title: "Usar el sincronizador de precios",
    summary: "Descargar el archivo con macros, actualizarlo desde el sitio y enviar cambios.",
    icon: FileSpreadsheet,
    screen: "excel",
    steps: excelSteps, /* [
      "Descargá la planilla actualizada desde Productos usando la opción de precios correspondiente.",
      "Completá o corregí los precios en las filas de productos. No cambies los IDs.",
      "Guardá el archivo como .xlsx y usá Importar Excel.",
      "Revisá la vista previa: productos coincidentes, cambios, productos a agregar y productos a desactivar.",
      "Seleccioná sólo los registros que quieras aplicar y confirmá la actualización.",
      "Volvé a comparar después de aplicar para verificar el estado real del sitio.",
    ], */
    tip: "No copies un ID de otra fila: la relación entre ID y producto determina qué registro se actualiza. El archivo acepta precios con hasta dos decimales.",
  },
  {
    id: "tags",
    title: "Crear / editar marca",
    summary: "Crear o actualizar una marca para que pueda seleccionarse en los productos.",
    icon: Tags,
    screen: "tags",
    steps: [
      "Entrá en Listas → Marcas y presioná Nuevo registro. Para modificar una marca existente, buscala en el listado y elegí Editar.",
      "Completá Nombre con el texto exacto que querés mostrar en el sitio.",
      "En Imagen, presioná Buscar archivo y subí el logo o imagen de la marca. El sitio guarda el archivo; no hace falta pegar una URL.",
      "Marcá Destacada sólo si querés darle ese tratamiento visual a la marca.",
      "Dejá Activa marcada para que la marca aparezca como opción en los productos. Si la desactivás, deja de estar disponible para nuevas selecciones.",
      "Presioná Guardar. Al editar, los cambios se aplican sobre la misma marca y sus productos conservan la relación existente.",
    ],
    tip: "Usá el mismo nombre y la misma imagen que querés mostrar públicamente; antes de crear una marca nueva, buscá si ya existe para evitar duplicados.",
  },
  {
    id: "category",
    title: "Crear / modificar categoría",
    summary: "Crear o actualizar categorías y controlar dónde se muestran en el sitio.",
    icon: Tags,
    screen: "category",
    steps: [
      "Entrá en Listas → Categorías y presioná Nuevo registro. Para modificar una existente, buscala en el listado y elegí Editar.",
      "Completá Nombre con el texto exacto que querés usar en el catálogo y en el formulario de productos.",
      "Dejá Visible marcada para que la categoría esté disponible y pueda mostrarse en el sitio. Si la desmarcás, la categoría queda oculta.",
      "Usá Mostrar en menú para decidir si aparece como una opción de navegación en el menú del sitio. Una categoría puede estar visible sin aparecer en el menú.",
      "Presioná Guardar. Limpiar borra lo que escribiste en el formulario y Cancelar cierra sin guardar cambios.",
      "Después de crear o modificar la categoría, revisá el formulario de productos para comprobar que aparezca como opción de selección.",
    ],
    tip: "Antes de crear una categoría, buscá si ya existe para evitar duplicados. Cambiar el nombre modifica cómo se presenta en el sitio, pero no reemplaza la selección de los productos asociados.",
  },
  {
    id: "users",
    title: "Crear / modificar usuario",
    summary: "Administrar cuentas, roles, acceso a precios y estado de cada usuario.",
    icon: Users,
    screen: "users",
    steps: [
      "Entrá en Listas → Usuarios y presioná Nuevo registro. Para modificar una cuenta existente, buscala en el listado y elegí Editar.",
      "Completá Nombre y Correo. Usá un correo válido y único, porque se utiliza para identificar la cuenta y el acceso.",
      "Al crear un usuario, definí una Contraseña. Al editarlo, la contraseña es opcional: dejala vacía si no querés cambiar la actual.",
      "Elegí el Rol correspondiente. El rol determina qué partes de la administración puede utilizar el usuario, por lo que conviene asignar sólo el nivel necesario.",
      "Marcá Ver precios si el usuario debe acceder a los precios destinados a clientes logueados. Si queda desmarcado, no tendrá ese acceso.",
      "Dejá Activo marcado para permitir el ingreso. Si lo desmarcás, la cuenta queda inactiva sin necesidad de borrarla.",
      "Presioná Guardar y verificá el registro en el listado. Para editar, los cambios se aplican sobre la misma cuenta.",
    ],
    tip: "No compartas contraseñas ni otorgues un rol administrativo si no es necesario. Para cambiar sólo el rol, el permiso de precios o el estado, no hace falta modificar la contraseña.",
  },
  {
    id: "carousel",
    title: "Crear / modificar slider",
    summary: "Administrar los sliders del carrusel principal y sus enlaces para desktop y móvil.",
    icon: ImageIcon,
    screen: "carousel",
    steps: [
      "Entrá en Contenido → Carrusel principal y presioná Nuevo registro. Para modificar un slider existente, buscá el registro y elegí Editar.",
      "Completá ID si corresponde y definí Orden. El orden determina la posición del slider dentro del carrusel; usá valores claros y evitá repetirlos.",
      "Completá Título, Subtítulo y Etiqueta. Revisá la ortografía y el texto final porque se muestran directamente sobre el carrusel.",
      "En Imagen, subí el archivo principal para desktop con Buscar archivo. Usá una imagen nítida y con la composición preparada para el espacio disponible.",
      "En Imagen móvil, subí una versión adaptada a pantallas angostas. No conviene reutilizar una imagen desktop si el texto o el producto pueden quedar recortados.",
      "Completá Enlace del botón si el slider debe llevar a otra sección. En Acción de la imagen elegí URL para usar un enlace o Producto para asociarlo a un producto del sitio.",
      "Dejá Activo marcado para publicarlo. Marcá Destacado en inicio sólo si debe tener el tratamiento destacado configurado en el sitio.",
      "Presioná Guardar y revisá el carrusel en desktop y móvil. Para corregirlo, editá el mismo registro; no crees otro slider duplicado.",
    ],
    tip: "Si un slider no aparece, revisá que esté Activo, que tenga imagen cargada y que su Orden no entre en conflicto con otro. Probá siempre ambos tamaños de pantalla y el enlace configurado.",
  },
  {
    id: "banners",
    title: "Agregar / modificar banner",
    summary: "Crear y ordenar banners de texto para mostrarlos en el sitio.",
    icon: ImageIcon,
    screen: "banners",
    steps: [
      "Entrá en Contenido → Banners y presioná Nuevo registro. Para modificar uno existente, buscá el banner y elegí Editar.",
      "Completá ID si corresponde. En un registro nuevo puede asignarse al guardar; al editar, conservá el ID para modificar el banner correcto.",
      "Escribí el Texto que querés mostrar. Revisá la ortografía, la longitud y los saltos de línea porque se verá en una franja visible del sitio.",
      "Definí Orden para indicar la posición del banner cuando haya más de uno. Usá valores claros y evitá repetir el mismo orden.",
      "Dejá Activo marcado para que el banner se publique. Si lo desmarcás, el registro se conserva pero deja de mostrarse.",
      "Presioná Guardar y revisá la franja del sitio. Para cambiar el mensaje, el orden o la visibilidad, editá el mismo banner en lugar de crear un duplicado.",
    ],
    tip: "El banner de la captura es una franja de texto ubicada en la parte superior del sitio. Si no aparece, revisá que esté Activo y que su Orden no lo deje detrás de otro banner.",
  },
  {
    id: "duplicates",
    title: "Usar Productos duplicados",
    summary: "Detectar grupos de productos repetidos y decidir cuál registro conservar.",
    icon: Tags,
    screen: "duplicates",
    steps: [
      "Abrí Productos duplicados desde el menú de administración. El encabezado indica cuántos productos y grupos duplicados fueron detectados.",
      "Usá el buscador para filtrar por ID, nombre, descripción o marca. Si no hay duplicados, el módulo muestra el mensaje Sin productos duplicados.",
      "Cuando aparezca un grupo, compará todos sus registros antes de tomar una decisión: ID, nombre, detalle, marca, precios, imagen, estado Activo y estado Agotado.",
      "Elegí como registro principal el producto que tenga el ID correcto, la información más completa y el historial que quieras conservar.",
      "Sobre los registros repetidos, decidí si corresponde corregirlos, desactivarlos o eliminarlos desde el listado de Productos. No borres un registro sólo por tener un nombre parecido.",
      "Si el duplicado representa una variante distinta, conservá ambos productos y diferenciá sus nombres, detalles, marcas o presentaciones antes de modificar nada.",
      "Volvé a abrir o actualizar el módulo para comprobar que el grupo ya no aparezca como duplicado y verificá el producto resultante en el catálogo.",
    ],
    tip: "El módulo sirve para detectar coincidencias, no para borrar automáticamente. Confirmá siempre que los productos sean realmente el mismo y respaldá la información antes de eliminar un registro.",
  },
  {
    id: "images",
    title: "Administrar imágenes",
    summary: "Revisar, reemplazar o borrar las imágenes de los productos desde una sola pantalla.",
    icon: ImageIcon,
    screen: "images",
    steps: [
      "Abrí Imágenes de productos desde el menú lateral. El módulo muestra el total de productos, cuántos tienen imagen y cuántos todavía no.",
      "Usá el buscador para encontrar un producto por ID, nombre, descripción o marca.",
      "Filtrá la grilla con Todos, Sin imagen o Con imagen para concentrarte en los registros que necesitás revisar.",
      "Cada tarjeta muestra la imagen actual, el nombre del producto y las acciones disponibles. Revisá que la imagen corresponda al producto.",
      "Presioná Reemplazar para subir un nuevo archivo. Elegí una imagen clara, preferentemente con buena resolución y una composición adecuada para el catálogo.",
      "Presioná Borrar sólo cuando quieras quitar la imagen actual. El producto no se elimina: queda sin imagen y aparecerá en el filtro Sin imagen.",
      "Después de reemplazar o borrar, verificá el contador y la tarjeta del producto para confirmar el resultado.",
    ],
    tip: "La imagen se carga como archivo desde el módulo. No pegues una URL; antes de borrar, comprobá que estés trabajando sobre el producto correcto porque la acción elimina su imagen actual.",
  },
];

function Field({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]">{label}</div>
      <div className={`truncate rounded-lg border px-2.5 py-2 text-[10px] font-semibold ${accent ? "border-[#b06f46] bg-[#fff4e8] text-[#754324]" : "border-[#eadbca] bg-white text-[#5f4b3c]"}`}>{value}</div>
    </div>
  );
}

function ScreenPreview({ type, section }: { type: GuideTopic["screen"]; section?: number }) {
  const contextualSection = useContext(guidePreviewSection);
  const activeSection = section ?? contextualSection;
  if (type === "duplicates") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="flex items-center justify-between border-b border-[#eadbca] px-4 py-3"><div><div className="text-[9px] font-semibold text-[#8b7560]">Administración</div><div className="mt-1 text-lg font-black text-[#704526]">Productos duplicados</div><div className="text-[9px] text-[#8b7560]">0 productos en 0 grupos</div></div><span className="rounded-lg border border-[#eadbca] bg-white px-3 py-2 text-[10px] font-bold text-[#704526]">×</span></div><div className="space-y-3 p-4"><div className="rounded-lg border border-[#eadbca] bg-white px-3 py-2 text-[9px] text-[#8b7560]">Buscar · ID, nombre, descripción o marca</div><div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl bg-[#fafcfb] text-center"><Tags size={24} className="text-[#6f7d76]" /><div className="text-[10px] font-black text-[#704526]">Sin productos duplicados</div><div className="text-[8px] text-[#8b7560]">Cuando se detecten grupos, aparecerán aquí para revisarlos.</div></div><div className="flex justify-between text-[8px] text-[#8b7560]"><span>0 productos en 0 grupos</span><span>Página 1 de 1</span></div></div></div>;
  }

  if (type === "out-of-stock") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="flex items-center justify-between border-b border-[#eadbca] px-4 py-3"><div><div className="text-[9px] font-semibold text-[#8b7560]">Administración</div><div className="mt-1 text-lg font-black text-[#704526]">Productos agotados</div></div><span className="rounded-lg border border-[#eadbca] bg-white px-3 py-2 text-[10px] font-bold text-[#704526]">×</span></div><div className="space-y-3 p-4"><div className="flex gap-2"><div className="flex-1 rounded-lg border border-[#eadbca] bg-white px-3 py-2 text-[9px] text-[#8b7560]">Buscar · ID, nombre, descripción o marca</div><div className="w-24 rounded-lg border border-[#eadbca] bg-white px-3 py-2 text-[9px] text-[#8b7560]">Activos⌄</div></div><div className="flex gap-1 text-[9px] font-bold"><span className="rounded bg-[#3d7564] px-3 py-2 text-white">Todos 445</span><span className="rounded bg-white px-3 py-2 text-[#795f4b]">Agotados 20</span><span className="rounded bg-white px-3 py-2 text-[#795f4b]">Con stock 425</span></div><div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-[#eadbca] bg-white p-2"><div className="flex h-20 items-center justify-center rounded-lg bg-[#f1e8dc] text-[#b06f46]"><ImageIcon size={25} /></div><div className="mt-2 text-[8px] text-[#8b7560]">AL NATURAL · ID 1149</div><div className="text-[9px] font-black text-[#704526]">AL NATURAL EXTRACTO JUGO GRAVIOLA 500cc</div><div className="mt-2 space-y-1 border-t border-[#eadbca] pt-2 text-[8px] text-[#634c39]"><div className="flex justify-between">Agotado <span className="h-4 w-7 rounded-full bg-[#d8dfd9]" /></div><div className="flex justify-between">Activo <span className="h-4 w-7 rounded-full bg-[#3d7564]" /></div></div></div><div className="rounded-xl border border-[#eadbca] bg-white p-2"><div className="flex h-20 items-center justify-center rounded-lg bg-[#f1e8dc] text-[#b06f46]"><ImageIcon size={25} /></div><div className="mt-2 text-[8px] text-[#8b7560]">AL NATURAL · ID 1420</div><div className="text-[9px] font-black text-[#704526]">AL NATURAL EXTRACTO JUGO NONI 500cc</div><div className="mt-2 space-y-1 border-t border-[#eadbca] pt-2 text-[8px] text-[#634c39]"><div className="flex justify-between">Agotado <span className="h-4 w-7 rounded-full bg-[#c84d43]" /></div><div className="flex justify-between">Activo <span className="h-4 w-7 rounded-full bg-[#3d7564]" /></div></div></div></div><div className="text-[8px] text-[#8b7560]">445 de 445 productos · Página 1 de 19</div></div></div>;
  }

  if (type === "excel") {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#c9b5a2] bg-[#f8f4ed] shadow-[0_16px_35px_rgba(91,64,38,0.12)]">
        <div className="border-b border-[#c9b5a2] bg-[#f8f4ed] px-3 py-2 text-[9px] font-bold text-[#6f4b32]">Sincronizador de precios.xlsm</div>
        <div className="grid grid-cols-3 gap-1 bg-[#f8f4ed] p-3">
          <span className="rounded border border-[#2d5146] bg-[#3d7564] px-2 py-2 text-center text-[8px] font-black text-white">ACTUALIZAR BASE</span>
          <span className="rounded border border-[#895638] bg-[#a86d45] px-2 py-2 text-center text-[8px] font-black text-white">ENVIAR CAMBIOS</span>
          <span className="rounded border border-[#466276] bg-[#5b7891] px-2 py-2 text-center text-[8px] font-black text-white">ORDENAR POR MARCA</span>
        </div>
        <div className="mx-3 mb-3 overflow-hidden rounded-xl border border-[#c9b5a2] bg-white text-[9px]">
          <div className="grid grid-cols-[38px_42px_1fr_70px_70px] bg-[#d9e2f3] px-2 py-2 font-black"><span>SI</span><span>ID</span><span>DETALLE</span><span>PUBLICO</span><span>DESCUENTO</span></div>
          <div className="grid grid-cols-[38px_42px_1fr_70px_70px] border-t px-2 py-3"><span>SI</span><span>551</span><span className="truncate">EXTRACTO JUGO YACON 500cc</span><span>$ 13.800</span><span>$ 11.000</span></div>
        </div>
      </div>
    );
  }
  if (false) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#f8f4ed] shadow-[0_16px_35px_rgba(91,64,38,0.12)]">
        <div className="flex items-center gap-2 bg-[#3d7564] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-white"><FileSpreadsheet size={14} /> Comparador de precios</div>
        <div className="grid grid-cols-2 gap-2 p-4"><Field label="Excel público" value="I 04.11.26.xlsx" /><Field label="Excel logueado" value="D 04.11.26.xlsx" /></div>
        <div className="mx-4 mb-4 overflow-hidden rounded-xl border border-[#dfd0bd] bg-white text-[10px]"><div className="grid grid-cols-4 bg-[#dfe8f6] px-3 py-2 font-black"><span>Marca</span><span>Producto</span><span>Estado</span><span>Precio</span></div><div className="grid grid-cols-4 border-t px-3 py-3"><span>BENOT</span><span className="truncate">BARRITA CHOCOLATE</span><span className="font-bold text-[#3d7564]">COINCIDE</span><span>$ 26.300</span></div></div>
      </div>
    );
  }

  if (type === "product" && activeSection === 1) {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="space-y-3 p-4"><Field label="Nombre *" value="" accent /><div><div className="mb-1 text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]">Detalle *</div><div className="h-20 rounded-xl border border-[#c9b5a2] bg-white" /></div><div><div className="mb-2 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Categorías *</span><span className="normal-case font-semibold tracking-normal">Elegí una o más categorías visibles.</span></div><div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#eadbca] bg-white p-3">{["Crudo", "Keto", "Kosher", "Natural", "Orgánico", "Proteico", "Sin azúcar", "Sin categoría", "Sin gluten", "Sin modificar genéticamente", "Vegano"].map((label) => <div key={label} className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-[#fbf7f1] px-2.5 py-2 text-[9px] font-semibold text-[#634c39]"><span>{label}</span><span className="h-3 w-3 rounded-sm border border-[#9f9388] bg-white" /></div>)}</div></div></div></div>;
  }

  if (type === "product" && activeSection === 2) {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="space-y-3 p-4"><Field label="Marca *" value="Seleccionar..." accent /><div className="grid grid-cols-2 gap-3"><Field label="Precio público" value="" /><Field label="Precio miembro" value="" /></div><div><div className="mb-2 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Imagen</span><span className="normal-case font-semibold tracking-normal">Subí una imagen de portada para la promoción.</span></div><div className="rounded-2xl border border-[#eadbca] bg-white p-3"><div className="rounded-xl border border-dashed border-[#c9b5a2] bg-[#fffaf4] px-3 py-3 text-[9px] font-bold text-[#795f4b]">Seleccionar imagen <span className="float-right rounded-full bg-[#d8b98c] px-2 py-1">Buscar archivo</span><small className="mt-1 block font-normal">Cargá un archivo para subirlo al sitio.</small><small className="mt-1 block font-normal">Ningún archivo seleccionado todavía</small></div><div className="mt-2 flex h-20 items-center justify-center rounded-xl bg-[#faf5ed] text-[9px] text-[#8b7560]">Todavía no se subió una imagen para esta promoción.</div></div></div></div></div>;
  }

  if (type === "product" && activeSection === 3) {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="space-y-2 p-4">{[["Agotado", false], ["Destacado", false], ["Activo", true]].map(([label, checked]) => <div key={String(label)} className="flex items-center justify-between rounded-2xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.2em] text-[#8b7560]"><span>{label}</span><span className={`flex h-4 w-4 items-center justify-center rounded-sm border ${checked ? "border-[#b06f46] bg-[#b06f46] text-white" : "border-[#9f9388] bg-white"}`}>{checked ? "✓" : ""}</span></div>)}<div className="my-4 border-t border-[#eadbca]" /><div className="flex gap-2"><span className="rounded-full bg-[#d8b98c] px-4 py-2 text-[9px] font-black text-white">Guardar</span><span className="rounded-full bg-white px-4 py-2 text-[9px] font-bold text-[#795f4b]">Limpiar</span><span className="px-2 py-2 text-[9px] text-[#795f4b]">Cancelar</span></div></div></div>;
  }

  if (type === "product" || type === "prices") {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#f8f4ed] shadow-[0_16px_35px_rgba(91,64,38,0.12)]">
        <div className="flex items-center justify-between bg-[#86532e] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-white"><span>{type === "product" ? "Nuevo registro" : "Editar registro"}</span><span className="rounded-full bg-white/20 px-2 py-1">Productos / {type === "product" ? "creación" : "edición"}</span></div>
        <div className="max-h-[430px] space-y-3 overflow-y-auto p-4"><div className="grid gap-3 sm:grid-cols-2"><Field label="Nombre *" value="BOMBÓN CHOCOLATE" accent={type === "product"} /><Field label="Marca *" value="BENOT" /><div className="sm:col-span-2"><Field label="Detalle *" value="Chocolate semiamargo caja 24u" /></div><div className="sm:col-span-2"><Field label="Categorías *" value="Orgánico · Vegano" /></div><Field label="Precio público" value="$ 26.300" accent /><Field label="Precio miembro" value="$ 21.400" accent /><div className="sm:col-span-2"><div className="rounded-xl border border-dashed border-[#c9b5a2] bg-[#fffaf4] px-3 py-3 text-[10px] font-bold text-[#795f4b]">Imagen · Seleccionar archivo</div></div><div className="sm:col-span-2"><Field label="Descripción" value="Chocolate semiamargo para compartir." /></div></div><div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-[#c9b5a2] bg-white px-3 py-2 text-[10px] font-bold text-[#5f4b3c]">✓ Activo</div><div className="rounded-xl border border-[#ddcbb8] bg-white px-3 py-2 text-[10px] font-bold text-[#5f4b3c]">□ Agotado</div><div className="rounded-xl border border-[#ddcbb8] bg-white px-3 py-2 text-[10px] font-bold text-[#5f4b3c]">□ Destacado</div></div></div>
        <div className="flex justify-end gap-2 border-t border-[#eadbca] px-4 py-3"><span className="rounded-full border border-[#ddcbb8] px-3 py-1.5 text-[10px] font-bold text-[#795f4b]">Cancelar</span><span className="rounded-full bg-[#3d7564] px-3 py-1.5 text-[10px] font-bold text-white">Guardar</span></div>
      </div>
    );
  }

  if (type === "carousel") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="flex items-center justify-between bg-[#fbf8f1] px-4 py-3"><div><div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8b7560]">Edición</div><div className="mt-1 text-lg font-black text-[#704526]">Nuevo registro</div><div className="text-[9px] text-[#8b7560]">Carrusel principal / creación</div></div><span className="rounded-full border border-[#eadbca] bg-white px-3 py-2 text-[9px] font-semibold text-[#704526]">Cerrar</span></div><div className="space-y-3 border-t border-[#eadbca] p-4"><div className="grid grid-cols-2 gap-3"><Field label="ID" value="" /><Field label="Orden" value="" /></div><Field label="Título" value="" accent /><div><div className="mb-1 text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]">Subtítulo</div><div className="h-14 rounded-xl border border-[#c9b5a2] bg-white" /></div><Field label="Etiqueta" value="" /><div className="rounded-2xl border border-[#eadbca] bg-white p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Imagen</span><span className="normal-case font-semibold tracking-normal">Subí la imagen principal del carrusel.</span></div><div className="rounded-xl border border-dashed border-[#c9b5a2] bg-[#fffaf4] px-3 py-3 text-[9px] font-bold text-[#795f4b]">Seleccionar imagen <span className="float-right rounded-full bg-[#d8b98c] px-2 py-1">Buscar archivo</span><small className="mt-1 block font-normal">Ningún archivo seleccionado todavía</small></div><div className="mt-2 flex h-12 items-center justify-center rounded-xl bg-[#faf5ed] text-[9px] text-[#8b7560]">Vista previa de imagen</div></div><div className="rounded-2xl border border-[#eadbca] bg-white p-3"><div className="mb-2 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Imagen móvil</span><span className="normal-case font-semibold tracking-normal">Subí la versión para móvil.</span></div><div className="rounded-xl border border-dashed border-[#c9b5a2] bg-[#fffaf4] px-3 py-3 text-[9px] font-bold text-[#795f4b]">Seleccionar imagen <span className="float-right rounded-full bg-[#d8b98c] px-2 py-1">Buscar archivo</span></div></div><Field label="Enlace del botón" value="" /><div className="flex gap-1 text-[9px] font-bold"><span className="rounded bg-[#b06f46] px-3 py-2 text-white">URL</span><span className="rounded bg-white px-3 py-2 text-[#795f4b]">Producto</span></div><Field label="Enlace de la imagen" value="" /><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Activo</span><span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#b06f46] text-[10px] font-black text-white">✓</span></div><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Destacado en inicio</span><span className="h-4 w-4 rounded-sm border border-[#9f9388] bg-white" /></div><div className="flex justify-start gap-2 border-t border-[#eadbca] pt-3"><span className="rounded-full bg-[#b06f46] px-3 py-1.5 text-[9px] font-bold text-white">Guardar</span><span className="rounded-full border border-[#ddcbb8] px-3 py-1.5 text-[9px] font-bold text-[#795f4b]">Limpiar</span><span className="px-2 py-1.5 text-[9px] font-bold text-[#795f4b]">Cancelar</span></div></div></div>;
  }

  if (type === "users") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="flex items-center justify-between bg-[#fbf8f1] px-4 py-3"><div><div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8b7560]">Edición</div><div className="mt-1 text-lg font-black text-[#704526]">Nuevo registro</div><div className="text-[9px] text-[#8b7560]">Usuarios / creación</div></div><span className="rounded-full border border-[#eadbca] bg-white px-3 py-2 text-[9px] font-semibold text-[#704526]">Cerrar</span></div><div className="space-y-3 border-t border-[#eadbca] p-4"><div className="grid grid-cols-2 gap-3"><Field label="Nombre" value="" accent /><Field label="Correo" value="" /></div><div><div className="mb-1 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Contraseña</span><span className="normal-case font-semibold tracking-normal">Definila al crear la cuenta. En edición es opcional.</span></div><div className="h-9 rounded-full border border-[#c9b5a2] bg-white" /></div><Field label="Rol" value="Seleccionar..." /><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Ver precios</span><span className="h-4 w-4 rounded-sm border border-[#9f9388] bg-white" /></div><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Activo</span><span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#b06f46] text-[10px] font-black text-white">✓</span></div><div className="flex justify-start gap-2 border-t border-[#eadbca] pt-3"><span className="rounded-full bg-[#b06f46] px-3 py-1.5 text-[9px] font-bold text-white">Guardar</span><span className="rounded-full border border-[#ddcbb8] px-3 py-1.5 text-[9px] font-bold text-[#795f4b]">Limpiar</span><span className="px-2 py-1.5 text-[9px] font-bold text-[#795f4b]">Cancelar</span></div></div></div>;
  }

  if (type === "category") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="flex items-center justify-between bg-[#fbf8f1] px-4 py-3"><div><div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8b7560]">Edición</div><div className="mt-1 text-lg font-black text-[#704526]">Nuevo registro</div><div className="text-[9px] text-[#8b7560]">Categorías / creación</div></div><span className="rounded-full border border-[#eadbca] bg-white px-3 py-2 text-[9px] font-semibold text-[#704526]">Cerrar</span></div><div className="space-y-3 border-t border-[#eadbca] p-4"><Field label="Nombre" value="" accent /><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Visible</span><span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#b06f46] text-[10px] font-black text-white">✓</span></div><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Mostrar en menú</span><span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#b06f46] text-[10px] font-black text-white">✓</span></div><div className="flex justify-end gap-2 border-t border-[#eadbca] pt-3"><span className="rounded-full bg-[#b06f46] px-3 py-1.5 text-[9px] font-bold text-white">Guardar</span><span className="rounded-full border border-[#ddcbb8] px-3 py-1.5 text-[9px] font-bold text-[#795f4b]">Limpiar</span><span className="px-2 py-1.5 text-[9px] font-bold text-[#795f4b]">Cancelar</span></div></div></div>;
  }

  if (type === "tags") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="flex items-center justify-between bg-[#fbf8f1] px-4 py-3"><div><div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8b7560]">Edición</div><div className="mt-1 text-lg font-black text-[#704526]">Nuevo registro</div><div className="text-[9px] text-[#8b7560]">Marcas / creación</div></div><span className="rounded-full border border-[#eadbca] bg-white px-3 py-2 text-[9px] font-semibold text-[#704526]">Cerrar</span></div><div className="space-y-3 border-t border-[#eadbca] p-4"><Field label="Nombre" value="" accent /><div><div className="mb-2 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Imagen</span><span className="normal-case font-semibold tracking-normal">Subí el logo o imagen de la marca.</span></div><div className="rounded-2xl border border-[#eadbca] bg-white p-3"><div className="rounded-xl border border-dashed border-[#c9b5a2] bg-[#fffaf4] px-3 py-3 text-[9px] font-bold text-[#795f4b]">Seleccionar imagen <span className="float-right rounded-full bg-[#d8b98c] px-2 py-1">Buscar archivo</span><small className="mt-1 block font-normal">Cargá un archivo para subirlo al sitio.</small><small className="mt-1 block font-normal">Ningún archivo seleccionado todavía</small></div><div className="mt-2 flex h-16 items-center justify-center rounded-xl bg-[#faf5ed] text-[9px] text-[#8b7560]">Todavía no se subió una imagen para esta promoción.</div></div></div><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Destacada</span><span className="h-4 w-4 rounded-sm border border-[#9f9388] bg-white" /></div><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Activa</span><span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#b06f46] text-[10px] font-black text-white">✓</span></div></div></div>;
  }

  if (type === "catalog") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-white shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="bg-[#dfe8f6] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#4d5b6d]">Listas / Productos</div><div className="grid grid-cols-[28px_55px_1fr_105px] gap-2 border-b border-[#eadbca] px-3 py-3 text-[9px] font-black uppercase text-[#8b7560]"><span>✓</span><span>ID</span><span>Producto</span><span>Marca</span></div><div className="grid grid-cols-[28px_55px_1fr_105px] gap-2 border-b border-[#eadbca] px-3 py-4 text-[10px] font-semibold text-[#5f4b3c]"><span className="h-4 w-4 rounded border border-[#9f9388]" /><span>551</span><span>AL NATURAL EXTRACTO JUGO YACÓN 500cc</span><span>AL NATURAL</span></div><div className="flex flex-wrap justify-end gap-2 bg-[#fffaf4] px-3 py-3"><span className="rounded-full bg-[#d84b39] px-3 py-2 text-[9px] font-black text-white">● Agotado</span><span className="rounded-full bg-[#b06f46] px-3 py-2 text-[9px] font-black text-white">Editar</span><span className="rounded-full bg-[#754324] px-3 py-2 text-[9px] font-black text-white">Borrar</span></div></div>;
  }

  if (type === "banners") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="flex items-center justify-between bg-[#fbf8f1] px-4 py-3"><div><div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8b7560]">Edición</div><div className="mt-1 text-lg font-black text-[#704526]">Nuevo registro</div><div className="text-[9px] text-[#8b7560]">Banners / creación</div></div><span className="rounded-full border border-[#eadbca] bg-white px-3 py-2 text-[9px] font-semibold text-[#704526]">Cerrar</span></div><div className="space-y-3 border-t border-[#eadbca] p-4"><div className="grid grid-cols-2 gap-3"><Field label="ID" value="" /><Field label="Orden" value="" /></div><div><div className="mb-1 text-[8px] font-black uppercase tracking-[0.18em] text-[#8b7560]">Texto</div><div className="h-20 rounded-xl border border-[#c9b5a2] bg-white" /></div><div className="flex items-center justify-between rounded-xl border border-[#eadbca] bg-white px-3 py-3 text-[9px] font-black uppercase tracking-[0.18em] text-[#8b7560]"><span>Activo</span><span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#b06f46] text-[10px] font-black text-white">✓</span></div><div className="flex justify-start gap-2 border-t border-[#eadbca] pt-3"><span className="rounded-full bg-[#b06f46] px-3 py-1.5 text-[9px] font-bold text-white">Guardar</span><span className="rounded-full border border-[#ddcbb8] px-3 py-1.5 text-[9px] font-bold text-[#795f4b]">Limpiar</span><span className="px-2 py-1.5 text-[9px] font-bold text-[#795f4b]">Cancelar</span></div><div className="rounded-xl border border-[#eadbca] bg-[#f3e8d8] px-3 py-3 text-[9px] font-semibold text-[#795f4b]">Vista en el sitio: <span className="font-black">Conectamos marcas, productos y personas.</span></div></div></div>;
  }

  if (type === "images") {
    return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-[#fbf8f1] shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="flex items-center justify-between border-b border-[#eadbca] px-4 py-3"><div><div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8b7560]">Catálogo visual</div><div className="mt-1 text-lg font-black text-[#704526]">Imágenes de productos</div><div className="text-[9px] text-[#8b7560]">Revisá y actualizá imágenes desde una sola pantalla.</div></div><span className="rounded-full border border-[#eadbca] bg-white px-3 py-2 text-[9px] font-semibold text-[#704526]">Cerrar</span></div><div className="space-y-3 p-4"><div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-white p-3"><div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#8b7560]">Productos</div><div className="mt-1 text-lg font-black text-[#704526]">445</div></div><div className="rounded-xl bg-white p-3"><div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#8b7560]">Con imagen</div><div className="mt-1 text-lg font-black text-[#704526]">445</div></div><div className="rounded-xl bg-white p-3"><div className="text-[8px] font-black uppercase tracking-[0.16em] text-[#8b7560]">Sin imagen</div><div className="mt-1 text-lg font-black text-[#704526]">0</div></div></div><div className="rounded-full border border-[#eadbca] bg-white px-4 py-2 text-[9px] text-[#8b7560]">Buscar · ID, nombre, descripción o marca</div><div className="flex gap-2 text-[9px] font-bold"><span className="rounded-full bg-[#b06f46] px-3 py-2 text-white">Todos</span><span className="rounded-full bg-white px-3 py-2 text-[#795f4b]">Sin imagen</span><span className="rounded-full bg-white px-3 py-2 text-[#795f4b]">Con imagen</span></div><div className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-[#eadbca] bg-white p-2"><div className="flex h-20 items-center justify-center rounded-lg bg-[#f1e8dc] text-[#b06f46]"><ImageIcon size={25} /></div><div className="mt-2 text-[9px] font-black text-[#704526]">AL NATURAL EXTRACTO JUGO GRAVIOLA 500cc</div><div className="mt-2 flex gap-1"><span className="rounded-full bg-[#b06f46] px-2 py-1 text-[8px] font-bold text-white">Reemplazar</span><span className="rounded-full border border-[#ddcbb8] px-2 py-1 text-[8px] font-bold text-[#795f4b]">Borrar</span></div></div><div className="rounded-xl border border-[#eadbca] bg-white p-2"><div className="flex h-20 items-center justify-center rounded-lg bg-[#f1e8dc] text-[#b06f46]"><ImageIcon size={25} /></div><div className="mt-2 text-[9px] font-black text-[#704526]">BAMBOO POCHOCLOS ORGÁNICOS</div><div className="mt-2 flex gap-1"><span className="rounded-full bg-[#b06f46] px-2 py-1 text-[8px] font-bold text-white">Reemplazar</span><span className="rounded-full border border-[#ddcbb8] px-2 py-1 text-[8px] font-bold text-[#795f4b]">Borrar</span></div></div></div></div></div>;
  }

  return <div className="overflow-hidden rounded-2xl border border-[#d8c4ae] bg-white shadow-[0_16px_35px_rgba(91,64,38,0.12)]"><div className="bg-[#dfe8f6] px-4 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-[#4d5b6d]">Listas / Productos</div><div className="p-4"><div className="mb-3 flex gap-2"><div className="h-7 flex-1 rounded-lg border border-[#eadbca] bg-[#faf7f2]" /><div className="h-7 w-20 rounded-lg bg-[#b06f46]" /></div><div className="grid grid-cols-[55px_1fr_75px] gap-2 border-b border-[#eadbca] px-2 py-2 text-[9px] font-black uppercase text-[#8b7560]"><span>ID</span><span>Producto</span><span>Estado</span></div><div className="grid grid-cols-[55px_1fr_75px] gap-2 px-2 py-3 text-[10px] font-semibold text-[#5f4b3c]"><span>1569</span><span>BOMBÓN FRUTOS ROJOS</span><span className="text-[#3d7564]">Activo</span></div></div></div>;
}

export function AdminGuide({ onClose }: { onClose: () => void }) {
  const [selectedId, setSelectedId] = useState(topics[0].id);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const topic = topics.find((item) => item.id === selectedId) ?? topics[0];
  const Icon = topic.icon;

  return (
    <guidePreviewSection.Provider value={dialogOpen && (topic.id === "product" || topic.id === "prices") ? stepIndex + 1 : undefined}>
    <div className="rounded-[30px] border border-[var(--pf-border)] bg-[rgba(250,246,239,0.96)] p-5 shadow-[0_24px_60px_rgba(58,44,25,0.12)] backdrop-blur sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--pf-border-soft)] pb-6">
        <div className="flex items-start gap-4"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--pf-secondary)] text-white shadow-lg"><BookOpen size={27} /></div><div><p className="text-[11px] font-black uppercase tracking-[0.36em] text-[var(--pf-secondary)]">Centro de ayuda</p><h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--pf-text)] sm:text-4xl">Guía de administración</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--pf-muted)]">Una referencia rápida para gestionar el catálogo, los precios, las imágenes y las planillas sin perderse en el panel.</p></div></div>
        <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-sm font-bold text-[var(--pf-primary-darker)] transition hover:bg-[rgba(248,242,232,0.7)]"><X size={16} /> Cerrar guía</button>
      </div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <nav className="contents" aria-label="Temas de la guía">{topics.map((item) => { const ItemIcon = item.icon; return <button key={item.id} type="button" onClick={() => { setSelectedId(item.id); setStepIndex(0); setDialogOpen(true); }} className="group flex min-h-[142px] w-full items-start gap-3 rounded-2xl border border-[var(--pf-border-soft)] bg-white/75 p-5 text-left transition hover:-translate-y-0.5 hover:border-[var(--pf-secondary)] hover:bg-white hover:shadow-[0_12px_28px_rgba(58,44,25,0.1)]"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(176,111,70,0.14)] text-[var(--pf-primary)]"><ItemIcon size={19} /></span><span className="min-w-0 flex-1"><span className="block text-base font-black text-[var(--pf-text)]">{item.title}</span><span className="mt-2 block text-sm leading-5 text-[var(--pf-muted)]">{item.summary}</span><span className="mt-3 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.16em] text-[var(--pf-secondary)]">Abrir guía <ChevronRight size={14} className="transition group-hover:translate-x-1" /></span></span></button>; })}</nav>
        <article className="hidden"><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(290px,0.8fr)] xl:items-start"><div><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--pf-primary)] text-white"><Icon size={21} /></div><div><p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">Paso a paso</p><h2 className="mt-1 text-2xl font-black text-[var(--pf-text)]">{topic.title}</h2></div></div><ol className="mt-6 space-y-3">{topic.steps.map((step, index) => <li key={step} className="flex gap-3 rounded-2xl border border-[var(--pf-border-soft)] bg-white/75 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--pf-secondary)] text-xs font-black text-white">{index + 1}</span><span className="pt-1 text-sm leading-6 text-[var(--pf-text)]">{step}</span></li>)}</ol>{topic.tip ? <div className="mt-5 flex gap-3 rounded-2xl border border-[#e9c58a] bg-[#fff8e8] p-4 text-sm leading-6 text-[#76572f]"><CircleAlert size={19} className="mt-1 shrink-0" /><span><strong>Consejo:</strong> {topic.tip}</span></div> : null}</div><div><div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]"><ImageIcon size={15} /> Vista de referencia</div><ScreenPreview type={topic.screen} /></div></div></article>
       </div>

       {dialogOpen ? (
         <div className="fixed inset-0 z-[13000] flex items-center justify-center bg-[#2d1f1480] px-4 py-6 backdrop-blur-sm" onClick={() => setDialogOpen(false)}>
           <section role="dialog" aria-modal="true" aria-labelledby="admin-guide-dialog-title" className="flex max-h-[calc(100svh-3rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[30px] border border-[var(--pf-border)] bg-[#fbf8f1] shadow-[0_40px_120px_rgba(45,31,20,0.34)]" onClick={(event) => event.stopPropagation()}>
             <header className="flex items-start justify-between gap-4 border-b border-[var(--pf-border-soft)] px-6 py-5 sm:px-8"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--pf-primary)] text-white"><Icon size={21} /></div><div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]">Guía paso a paso</p><h2 id="admin-guide-dialog-title" className="mt-1 text-2xl font-black text-[var(--pf-text)]">{topic.title}</h2></div></div><button type="button" onClick={() => setDialogOpen(false)} className="rounded-full border border-[var(--pf-border-soft)] bg-white px-4 py-2 text-sm font-bold text-[var(--pf-primary-darker)]">Cerrar</button></header>
             <div className="flex items-center gap-3 px-6 pt-5 sm:px-8"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#eadcca]"><div className="h-full rounded-full bg-[var(--pf-secondary)] transition-all" style={{ width: `${((stepIndex + 1) / topic.steps.length) * 100}%` }} /></div><span className="shrink-0 text-xs font-black text-[var(--pf-muted)]">{stepIndex + 1} / {topic.steps.length}</span></div>
             <div className="grid min-h-0 gap-6 overflow-y-auto px-6 py-6 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1fr)] lg:items-start"><div><p className="text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-secondary)]">Sección {stepIndex + 1}</p><div className="mt-4 flex gap-4 rounded-2xl border border-[var(--pf-border-soft)] bg-white p-5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--pf-secondary)] text-sm font-black text-white">{stepIndex + 1}</span><p className="text-base leading-7 text-[var(--pf-text)]">{topic.steps[stepIndex]}</p></div>{stepIndex === topic.steps.length - 1 && topic.tip ? <div className="mt-5 flex gap-3 rounded-2xl border border-[#e9c58a] bg-[#fff8e8] p-4 text-sm leading-6 text-[#76572f]"><CircleAlert size={19} className="mt-1 shrink-0" /><span><strong>Consejo:</strong> {topic.tip}</span></div> : null}</div><div><div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-[var(--pf-muted)]"><ImageIcon size={15} /> Referencia visual</div><ScreenPreview type={topic.screen} /></div></div>
             <footer className="flex items-center justify-between gap-3 border-t border-[var(--pf-border-soft)] px-6 py-4 sm:px-8"><button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))} className="rounded-full border border-[var(--pf-border-soft)] bg-white px-5 py-2.5 text-sm font-bold text-[var(--pf-primary-darker)] disabled:cursor-not-allowed disabled:opacity-40">Anterior</button><button type="button" onClick={() => stepIndex < topic.steps.length - 1 ? setStepIndex((current) => current + 1) : setDialogOpen(false)} className="rounded-full bg-[var(--pf-primary)] px-5 py-2.5 text-sm font-black text-white">{stepIndex < topic.steps.length - 1 ? "Siguiente" : "Finalizar"}</button></footer>
           </section>
         </div>
       ) : null}
    </div>
    </guidePreviewSection.Provider>
  );
}
