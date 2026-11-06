# Sincronización de catálogo desde Excel

La API puede usar una clave fija exclusiva para Excel. Debe configurarse como `EXCEL_SYNC_FIXED_TOKEN` en el servidor y copiarse una sola vez en `CONFIGURACION!B2`. No es una clave de Supabase y solo permite sincronizar el catálogo.

## Crear un token

Con una sesión de administrador abierta, enviar:

```http
POST /api/admin/excel-sync-token
Content-Type: application/json

{"label":"Planilla de productos","expiresAt":null}
```

La respuesta contiene `token`. No se debe usar una clave de Supabase dentro del Excel.

## Configurar la planilla

Guardar estas dos celdas en la hoja `CONFIGURACION`:

- `B1`: `https://tu-dominio.com/api/integrations/excel/sync`
- `B2`: el token generado

La hoja debe quedar oculta (`xlVeryHidden`) y el archivo debe guardarse como `.xlsm`. La macro `Workbook_Open` llama a `GET ?format=tsv`; los botones `ActualizarCatalogo` y `SincronizarCambios` permiten repetir la operación manualmente.

La API nunca elimina filas. Las actualizaciones de productos se hacen por ID, y las marcas y categorías nuevas se crean dentro de una transacción. El token puede revocarse con `DELETE /api/admin/excel-sync-token?id=...`.
