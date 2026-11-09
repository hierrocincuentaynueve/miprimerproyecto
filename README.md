# Gestión de compras de material

Aplicación web para planificar las compras de material de una empresa de centros deportivos: artículos organizados por departamento, control del presupuesto anual de cada departamento con semáforo, y un Excel de pedido formal por proveedor.

Está hecha solo con HTML, CSS y JavaScript vanilla que el navegador carga directamente: no hay paso de build, ni servidor, ni backend, ni login.

## Puesta en marcha

Basta con **abrir `index.html` con doble clic** (o arrastrarlo al navegador). No hace falta ningún servidor. Funciona en Chrome, Edge y Firefox. Si lo prefiere, también puede subir la carpeta tal cual a un hosting interno.

Los datos se guardan en IndexedDB y van ligados a la forma de abrir la aplicación: no se comparten los de `index.html` abierto como archivo con los de la misma carpeta servida desde una dirección web. Si cambia de forma de abrirla, use una copia de seguridad para pasar los datos. En navegación privada, o si el navegador bloquea el almacenamiento para archivos locales, la aplicación avisa de que los datos solo duran mientras la pestaña esté abierta.

Por eso el código no usa módulos ES (`import`/`export`), que los navegadores bloquean al abrir una página como archivo. Cada archivo `js/*.js` es un script clásico que registra sus funciones en el objeto global `App` (por ejemplo `App.models`), y `index.html` los carga en orden de dependencias.

Las librerías se cargan desde jsDelivr con versión fija, así que el equipo necesita acceso a `cdn.jsdelivr.net`:

| Librería | Versión | Uso |
|---|---|---|
| ExcelJS | 4.4.0 | Generar los pedidos y las plantillas, y leer .xlsx |
| Papa Parse | 5.4.1 | Importar CSV |
| Chart.js | 4.4.1 | Gráficos del panel |

Si alguna no carga, la aplicación sigue funcionando y avisa de qué función queda deshabilitada. Para trabajar sin Internet, descargue esos tres archivos, déjelos en una carpeta `vendor/` y cambie las tres etiquetas `<script>` de `index.html`.

Para empezar, use **Panel → Cargar datos de ejemplo** o **Ajustes → Datos de ejemplo**. Se cargan 5 departamentos, 3 centros, 5 proveedores y 31 artículos ficticios, que luego se pueden borrar sin tocar sus propios datos.

## Modelo de datos (IndexedDB `gestion-compras-material`, esquema v1)

| Almacén | Campos |
|---|---|
| `departamentos` | id, nombre, responsable, presupuesto, ejercicio, color |
| `centros` | id, nombre, direccion |
| `proveedores` | id, nombre, cif, contacto, email, telefono, direccion, condicionesPago |
| `categorias` | id, nombre |
| `articulos` | id, descripcion, referencia, categoriaId, cantidad, precio (sin IVA), iva (21/10/4/0), proveedorId, departamentoId, centroId, prioridad, notas, estado, numeroPedido, fechas {creado, pendiente, pedido, recibido, cancelado} |
| `pedidos` | id, numero, proveedorId, fecha, articuloIds, total, observaciones |
| `config` | empresa, logo, presupuesto {base, ambar, rojo}, pedido {formato, siguiente, anio, reinicioAnual}, ultimaCopia, tema |

Los importes de cada línea se calculan así: **base = cantidad × precio**, **cuota = base × IVA**, **total = base + cuota**, redondeando a céntimos en cada línea, igual que las fórmulas del Excel.

### Control de presupuesto
- Por defecto se controla sobre la **base imponible** (sin IVA); en Ajustes se puede cambiar al total con IVA. El importe con IVA se muestra siempre como información.
- Cada departamento tiene: **previsto** (pendiente), **comprometido** (pedido), **ejecutado** (recibido), **consumo** (la suma de los tres) y **disponible**. Los artículos cancelados no cuentan.
- Semáforo: verde por debajo del 80 %, ámbar del 80 % al 100 % y rojo por encima del 100 %. Los umbrales se configuran en Ajustes.
- Si al crear, editar o duplicar un artículo el departamento supera su presupuesto, la aplicación avisa de cuánto se excede, pero deja guardar.

## Pantallas (rutas por hash)

| Ruta | Contenido |
|---|---|
| `#/panel` | Totales, tarjetas por departamento con barra y semáforo, y gráficos por departamento, proveedor y categoría, cada uno con su tabla de datos accesible |
| `#/articulos` | Búsqueda, filtros, ordenación, edición en ventana modal, duplicar, marcar como recibido y acciones masivas (cambiar estado, borrar) |
| `#/pedidos` | Proveedores con artículos pendientes y botón «Generar Excel»; pedidos emitidos con recepción parcial o completa, nueva descarga e impresión |
| `#/departamentos`, `#/proveedores`, `#/centros`, `#/categorias` | Alta, edición y borrado. Para borrar un elemento con artículos asociados hay que reasignarlos antes |
| `#/importar` | Asistente: archivo → mapeo de columnas → vista previa con validación → informe. Incluye plantillas .xlsx vacías |
| `#/imprimir/presupuesto`, `#/imprimir/proveedor/:id`, `#/imprimir/pedido/:numero` | Vistas A4 para imprimir o guardar como PDF |
| `#/ajustes` | Empresa y logotipo, criterio y umbrales del presupuesto, numeración de pedidos, copias de seguridad, datos de ejemplo |

## Excel de pedido

- Cada archivo se llama `PED-AAAA-NNN_NombreProveedor.xlsx`. El formato (`{AAAA}`, `{AA}`, `{NNN}`) y el siguiente número se configuran en Ajustes; el contador se guarda y, si se activa la opción, vuelve a 1 cada año.
- Contenido: cabecera con logotipo o razón social, número y fecha; datos del comprador y del proveedor; persona de contacto; líneas con centro y departamento; desglose de IVA por tipo; total; direcciones de entrega por centro; observaciones y condiciones de pago.
- Las fórmulas son reales: `ROUND(E*F,2)` por línea, `SUMIF` por tipo de IVA y `SUM` en los totales. Si se cambia una cantidad, todo se recalcula. Los importes llevan formato `#,##0.00 "€"`, y la hoja está preparada para A4 vertical (ajustada a una página de ancho, con la cabecera de la tabla repetida en cada página).
- Tras generar el Excel, la aplicación pregunta si se marcan esas líneas como **Pedido** con el número asignado.

## Copias de seguridad

Los datos se guardan solo en el navegador donde se usa la aplicación. **Ajustes → Exportar copia de seguridad** descarga un JSON con la versión del esquema y la fecha, y **Importar copia** lo restaura después de pedir confirmación. Si pasan más de 7 días sin exportar una copia, aparece un recordatorio.

## Estructura

```
index.html
css/styles.css     estilos (variables en :root, modo claro/oscuro, responsive)
css/print.css      impresión A4
js/app.js          arranque, enrutado hash, tema y avisos globales (se carga el último)
js/db.js           IndexedDB con caché en memoria y copias de seguridad
js/models.js       importes, IVA, presupuesto, semáforo y numeración
js/format.js       formato es-ES (1.234,56 €, dd/mm/aaaa) y utilidades puras
js/ui.js           modales, avisos y utilidades de interfaz
js/excel.js        pedido con ExcelJS
js/import.js       lectura xlsx/csv, mapeo, validación y plantillas
js/charts.js       gráficos con Chart.js
js/sample.js       datos de ejemplo
js/views/*.js      una vista por pantalla (crud.js es el generador común)
```

## Limitaciones conocidas
- No se admite el formato `.xls` antiguo: guarde el archivo como `.xlsx` o `.csv`.
- Los datos están en un solo navegador y un solo equipo. Para cambiar de equipo, exporte la copia y restáurela en el otro.
