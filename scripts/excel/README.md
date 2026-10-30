# Remito de Excel

La exportacion genera un `.xlsm` con una sola hoja `REMITO`. El enlace `X` de cada
producto dispara `Workbook_SheetFollowHyperlink`, elimina la fila y recalcula la
hoja. Los rangos `RemitoQuitar` y `RemitoTotal` identifican el encabezado y el total
sin depender de posiciones fijas en la plantilla.

La macro requiere Excel de escritorio y permiso para ejecutar las macros de ese
archivo. Las formulas y los filtros funcionan aunque las macros esten deshabilitadas.

La exportacion guarda los anchos y alturas ajustados al contenido. Al abrir el
archivo, `Workbook_Open` aplica AutoFit a las filas de productos para usar las
medidas de la fuente instalada en Excel.

## Pruebas

`npm run test:order-excel` genera archivos en memoria, verifica los calculos y el
empaquetado, y simula el envio y los errores SMTP sin enviar correos reales.

Opcionalmente, `REMITO_TEST_TEMPLATE` indica una plantilla local para la prueba de
regresion y `REMITO_TEST_OUTPUT_DIR` permite guardar los archivos de prueba.

## Modificar la macro

1. Editar `ThisWorkbook.cls`.
2. Instalar las herramientas de desarrollo con `python -m pip install -r scripts/excel/requirements.txt`.
3. Ejecutar `python scripts/build-remito-vba.py` desde la raiz del proyecto.
4. Ejecutar `npm run test:order-excel` y probar el clic en Excel de escritorio.

El generador verifica el codigo con un lector VBA independiente antes de escribir
`src/lib/remito-vba-project.ts`. Ese modulo generado se incluye en el bundle de
Next.js; el despliegue no requiere Python ni Microsoft Office.

## Planilla de pedidos del catalogo

La descarga de Administracion > Productos genera un `.xlsm` con `PEDIDO CLIENTE`
y `REMITO`. Cada X del remito limpia la cantidad de la fila original de
`PEDIDO CLIENTE` y recalcula las dos hojas. El remito se compacta conservando sus
formulas, por lo que el producto puede volver a seleccionarse desde la lista.
La correspondencia usa posiciones de origen, incluso si hay nombres repetidos.
El total usa `SUM` sobre todos los importes. No se usa `SUBTOTAL` dentro de las
formulas condicionales de los importes porque Excel las excluye al sumar otros
subtotales. Los eventos de apertura, cambio de cantidades/datos y eliminacion
recalculan las dos hojas, tambien si Excel estaba en modo de calculo manual.

La macro propia esta en `CustomerOrderWorkbook.cls`. Para regenerarla:

`python scripts/build-remito-vba.py --customer-order`

El resultado es `src/lib/customer-order-vba-project.ts`, con los modulos de
`ThisWorkbook`, `Sheet1` y `Sheet2`. La macro del remito enviado por correo es
independiente y conserva su implementacion existente.

`npm run test:customer-order` verifica formulas, las acciones, los enlaces y el
empaquetado. Para probar el evento real de clic se requiere Excel de escritorio
con macros habilitadas; Google Sheets y Excel web no ejecutan VBA.
