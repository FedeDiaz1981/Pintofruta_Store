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
