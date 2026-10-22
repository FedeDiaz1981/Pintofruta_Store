# Lista de precios e importacion

Desde Administracion > Productos, descargar la lista actualizada y editar el archivo `.xlsx`.
Las columnas son ID, Nombre, Marca, Precio publico y Precio logueado. Ambos precios se importan juntos, como importes enteros no negativos.

- La columna ID y los encabezados estan protegidos contra cambios accidentales. Las columnas B:E estan desbloqueadas, incluso en las filas vacias para altas. La proteccion de Excel no es una barrera de seguridad ni garantiza impedir la copia.
- Un ID existente identifica al producto aunque cambien su nombre, marca, precio o posicion en el archivo.
- Una fila sin ID propone un alta. Si hay productos similares, se debe elegir uno de los candidatos o confirmar que es un producto nuevo.
- Un ID inexistente, repetido, dos filas dirigidas al mismo producto, formulas o valores invalidos bloquean la confirmacion.
- Las filas omitidas no eliminan productos. Excel no permite eliminar filas protegidas; si se modifica el archivo con otra herramienta, la omision tampoco implica una baja.
- Las actualizaciones solo escriben nombre, marca y ambos precios. Conservan SKU, descripcion, detalle, presentacion, categorias, imagen, activo, agotado y demas campos. No se interpreta SIN STOCK ni se altera stock.
- Las altas reciben un ID y SKU nuevos en el servidor, categoria Sin categoria, estado activo, agotado falso y stock nulo. Las marcas que no existen se crean, sin reactivar marcas existentes. Una secuencia de PostgreSQL compartida con el alta manual evita reutilizar IDs eliminados; se inicializa automaticamente antes de la primera alta o baja de productos.
- No se aplican cambios antes de resolver los casos dudosos y confirmar la vista previa. Las escrituras se realizan en una transaccion y se bloquea el catalogo durante la asignacion de IDs. Si cambia el archivo, las decisiones o el catalogo desde la vista previa, se exige volver a previsualizar.
- Los endpoints de descarga e importacion requieren una sesion de administrador.

El importador anterior por nombres y lista de precios individual fue reemplazado; su formato ya no se acepta. La plantilla de remitos existente no cambia con esta importacion.

## Pruebas

`npm run test:price-list` verifica lectura, exportacion protegida, decisiones, conflictos, permisos y persistencia con una base simulada.

Para ejecutar tambien las consultas reales, definir `PRICE_LIST_TEST_DATABASE_URL` con una conexion PostgreSQL local. La prueba usa tablas temporales de la sesion basadas en el esquema real y una secuencia en un esquema aislado que se elimina al terminar; no escribe en las tablas de la aplicacion.

`npm run test:order-excel` verifica que los remitos sigan funcionando.
