# Calendario de Adviento 3D · Diciembre 2026

Web estática con un **gimnasio navideño en 3D** (Three.js) con 24 regalos numerados alrededor de un árbol hecho de discos de pesas y mancuernas. Cada día del 1 al 24 de diciembre de 2026 (hora de España) se desbloquea un regalo con una promoción para socios, que se canjea **en la recepción del centro** con un código y su QR.

- Solo HTML + CSS + JavaScript que el navegador ejecuta directamente. Sin frameworks, sin bundler, sin paso de build y sin backend.
- **Funciona abriendo `index.html` con doble clic**, sin servidor (también se puede subir a cualquier hosting).
- Three.js `0.170.0` y `qrcode-generator 1.4.4` desde jsDelivr, con versión fija.
- Si el dispositivo no tiene WebGL o va lento, se activa una **vista sencilla 2D** con la misma lógica y la misma ventana de premio.

---

## Arquitectura

```
index.html            Estructura, importmap de Three.js, modal, cargador
css/styles.css        Estilos (móvil primero). Colores y fuentes en :root
js/main.js            Arranque, detección de capacidades, modo 3D/2D, lista accesible, orquestación
js/scene.js           Escena Three.js (sala, árbol, regalos, nieve, confeti, raycasting, cámara)
js/calendar.js        Fechas en Europe/Madrid, desbloqueo, estado y localStorage
js/modal.js           Ventana del premio: código, QR, copiar, foco atrapado, Escape
js/audio.js           Música y efectos con Web Audio API (silenciado por defecto)
js/prizes.js          Los 24 premios, textos de campaña y aviso legal  ← lo único que hay que editar
assets/svg/           Logo provisional, favicon, guirnalda, cuenta atrás, felicitación final
assets/svg/premios/   12 ilustraciones de premios (reutilizables)
```

Los archivos de `js/` son **scripts clásicos** (no módulos ES): cada uno se envuelve en una función y publica lo que necesitan los demás en `window.Adviento`. Se cargan con `<script defer>` en este orden: `prizes` → `calendar` → `modal` → `audio` → `scene` → `main`. Así el navegador los acepta también desde `file://`, donde bloquea los módulos ES locales.

Flujo: `main.js` crea el calendario → pinta la lista de 24 botones → `scene.js` descarga Three.js del CDN con `import()` dinámico (resuelto por el `importmap`; la barra de progreso avanza mientras tanto) → construye la escena → si algo falla o los FPS medidos son < 20, la destruye y pasa a 2D.

### Distribución de la escena

Vista cenital, el árbol en el centro:

- **Árbol**: 8 discos de pesas (perfil torneado con `LatheGeometry`) de mayor a menor sobre una barra cromada, con mancuernas hexagonales como ramas, una espiral de luces que parpadean y una estrella dorada extruida con luz propia.
- **Anillo interior** (≈3,2 m): casillas 1–10. **Anillo exterior** (≈5,1 m): casillas 11–24. La numeración avanza en el sentido de las agujas del reloj y empieza por el frente; el 24, el más grande, queda al frente junto al 11. Cada regalo tiene una ligera variación de tamaño, giro y radio para que no parezca una cuadrícula.
- **Sala** de 44 × 44 m: parqué, paredes de ladrillo con zócalo verde, 8 ventanales con paisaje nocturno y nieve cayendo, guirnaldas con bombillas, coronas, espalderas, estantería de mancuernas, kettlebells (una con gorro de Papá Noel), banco, balones medicinales y esterillas.
- **Cámara**: `OrbitControls` sin desplazamiento lateral, con distancia y ángulo vertical limitados (nunca atraviesa el suelo) y giro automático suave tras unos segundos de inactividad. Arranca mirando hacia el regalo del día.

Estados de cada regalo:

| Estado | En 3D | En la lista / 2D |
|---|---|---|
| Bloqueada | Tono apagado, candado en la cara frontal, etiqueta gris | Gris con candado, «Vuelve el X de diciembre» |
| Disponible hoy | Brilla, late, flota y tiene halo en el suelo; etiqueta «HOY» | Rojo con aro dorado que late |
| Disponible (días pasados sin abrir) | Brillo suave | Dorado |
| Abierta | Sin lazo, tapa apoyada al lado, interior dorado; etiqueta verde con ✓ | Verde con ✓ / ilustración del premio |

Al abrir: la caja se encoge, la tapa sale volando girando, estalla confeti dorado y la tapa cae junto a la caja; después se abre la ventana del premio.

---

## Probar en local

Abre **`index.html` con doble clic** (o arrástralo al navegador). No hace falta instalar nada ni arrancar un servidor. Solo se necesita conexión a internet para descargar Three.js, el generador de QR y las fuentes desde sus CDN; sin conexión, la web pasa sola a la vista 2D y el código del premio se sigue viendo, aunque sin QR.

Los parámetros de prueba se añaden al final de la dirección que muestra el navegador, por ejemplo:

```
file:///C:/Users/tu-usuario/Descargas/miprimerproyecto/index.html?fecha=2026-12-15
```

Si lo prefieres, también funciona con un servidor local (`python3 -m http.server 8080` o `npx serve .`).

> Nota: al abrirlo desde `file://`, algunos navegadores (Firefox, Safari) guardan las casillas abiertas por archivo o pueden no conservarlas entre sesiones. Publicado en un hosting se comporta de forma normal.

### Simular fechas: `?fecha=`

Para pruebas internas (no aparece en la interfaz):

| URL | Qué simula |
|---|---|
| `?fecha=2026-11-20` | Antes del Adviento: cuenta atrás |
| `?fecha=2026-11-30T23:59:50` | Ver el paso de medianoche al 1 de diciembre |
| `?fecha=2026-12-15` | Día 15: casillas 1–15 abiertas a elegir, 16–24 bloqueadas |
| `?fecha=2026-12-24` | Último día |
| `?fecha=2026-12-27` | Después del 24: modo consulta y «¡Felices fiestas!» |

- Formato `AAAA-MM-DD` u `AAAA-MM-DDTHH:MM[:SS]`, siempre en **hora de Madrid**. Sin hora se simulan las 12:00.
- El reloj sigue avanzando desde la fecha simulada (sirve para comprobar el cambio de día).
- Sin el parámetro se usa la hora real, convertida a `Europe/Madrid` con `Intl.DateTimeFormat`, aunque el dispositivo esté en otra zona horaria.

### Otros parámetros de prueba

- `?modo=2d` fuerza la vista sencilla; `?modo=3d` fuerza el 3D y desactiva el cambio automático a 2D por rendimiento.
- Se pueden combinar: `?fecha=2026-12-15&modo=2d`.

### Reiniciar las casillas abiertas

Se guardan en el `localStorage` del navegador con la clave `adviento-2026:abiertas` (y la preferencia de vista en `adviento-2026:vista`). Para empezar de cero, en la consola del navegador:

```js
localStorage.removeItem('adviento-2026:abiertas'); localStorage.removeItem('adviento-2026:vista'); location.reload();
```

O una ventana privada. Si el almacenamiento está bloqueado, el calendario funciona igual, solo que no recuerda las casillas al recargar.

---

## Editar los premios

Todo está en **`js/prizes.js`**. Cada premio:

```js
{
  dia: 7,                                   // 1–24
  titulo: 'Circuito termal de 90 minutos',
  descripcion: 'Relájate en nuestra zona de aguas…',
  codigo: 'ADV26-07-SP8H',                  // se muestra en grande y va dentro del QR
  condiciones: 'Válido en centros con spa…',
  caducidad: '2027-02-28',                  // AAAA-MM-DD → «28 de febrero de 2027»
  ilustracion: 'spa',                       // nombre de un SVG de assets/svg/premios/
}
```

- **Ilustraciones disponibles**: `mancuerna`, `ticket`, `entrenando`, `silbato`, `spa`, `botella`, `zapatilla`, `taza`, `regalo`, `estrella`, `etiqueta`, `kettlebell`. Para añadir otra, deja un SVG cuadrado (`viewBox="0 0 200 200"`) en `assets/svg/premios/` y usa su nombre.
- **Códigos**: usa solo mayúsculas, números y guiones (así el QR es más pequeño y fácil de leer). El QR contiene exactamente el texto del código.
- **Textos de campaña** (`CAMPANA`) y **aviso legal** (`AVISO_LEGAL`) están en el mismo archivo.

> **Importante sobre los códigos.** Al ser una web estática sin servidor, los 24 códigos están en `prizes.js` y cualquiera con conocimientos técnicos puede verlos antes de su fecha. El bloqueo por fechas es una experiencia, no una medida de seguridad. Lo recomendable es que recepción valide el canje (un uso por socio, comprobando que la fecha del premio ya ha llegado) y que los códigos no den ventajas que no se quieran conceder antes de tiempo.

---

## Cambiar colores, tipografías y logo

### Colores

En `css/styles.css`, bloque `:root`:

```css
--c-rojo: #b3122e;
--c-rojo-oscuro: #7d0c20;
--c-verde: #1f6b45;
--c-verde-oscuro: #0f3d27;
--c-dorado: #d9a93a;
--c-dorado-claro: #f3d27a;
--c-dorado-texto: #7a5512;
--c-nieve: #fffdf7;
--c-crema: #f7ecd9;
…
```

La escena 3D **lee estas mismas variables al arrancar** (papel de regalo, cintas, discos del árbol, estrella, alfombra, zócalo), así que cambiar la paleta en un único sitio adapta también el 3D. Al cambiarlos, comprueba el contraste (mínimo 4,5:1 para texto normal) con una herramienta como el comprobador de contraste de WebAIM. Las ilustraciones SVG usan la paleta por defecto: si la marca cambia mucho, se pueden editar con cualquier editor de texto (buscar y reemplazar los colores hexadecimales).

### Tipografías

Se cargan desde Google Fonts en `index.html` (Playfair Display para títulos, Nunito Sans para el cuerpo y Roboto Mono para los códigos). Para cambiarlas, sustituye el `<link>` de Google Fonts y las variables `--f-titulo`, `--f-texto` y `--f-codigo`. Los números de las etiquetas 3D usan la fuente de títulos.

### Logo

Sustituye `assets/svg/logo-placeholder.svg` por el logo corporativo (mejor en SVG, apaisado y en colores claros, porque va sobre fondo oscuro), o cambia la ruta en `index.html` (busca `LOGO CORPORATIVO`). Actualiza también el `alt` con el nombre de la empresa. El favicon está en `assets/svg/favicon.svg`.

---

## Publicar

Es un sitio estático: sube la carpeta tal cual. No hay que compilar nada.

- **GitHub Pages**: en el repositorio, *Settings → Pages → Build and deployment → Deploy from a branch*, elige la rama y la carpeta `/ (root)`. Estará en `https://USUARIO.github.io/REPOSITORIO/`.
- **Netlify**: arrastra la carpeta a *app.netlify.com/drop*, o conecta el repositorio con el comando de build vacío y el directorio de publicación `.`.
- **Servidor propio** (Apache, Nginx, IIS…): copia los archivos al directorio público. Asegúrate de que los `.js` se sirven como `text/javascript` y los `.svg` como `image/svg+xml` (lo habitual por defecto).

Recomendaciones:

- Publica con **HTTPS**: el botón «Copiar código» usa la API del portapapeles, que necesita un contexto seguro (hay un método alternativo, pero HTTPS es lo correcto).
- La web necesita acceso a `cdn.jsdelivr.net` y a Google Fonts. Si la red corporativa los bloquea, descarga `three@0.170.0` (`build/three.module.js` y `examples/jsm/`) y `qrcode-generator@1.4.4/qrcode.js`, súbelos al propio servidor y cambia las rutas del `importmap` y del `<script>` de `index.html`. Si Three.js no carga, la web pasa sola a la vista 2D; si el QR no carga, el código sigue visible.

---

## Rendimiento, móvil y accesibilidad

- **Calidad adaptativa**: en móviles, pantallas pequeñas o equipos modestos se usa calidad «baja» (sin sombras, menos nieve, confeti y luces, pixel ratio ≤ 1,5). En escritorio, pixel ratio ≤ 2 y sombras suaves.
- La animación **se detiene** cuando la pestaña no está visible o la escena sale de pantalla, y la música se pausa.
- **Respaldo 2D automático** si no hay WebGL, si Three.js no carga, si el dispositivo es muy limitado (≤ 2 núcleos y ≤ 2 GB) o si los FPS medidos tras el arranque son < 20. Se puede alternar a mano con el botón de vista de la cabecera (se recuerda la elección).
- **`prefers-reduced-motion`**: sin giro automático, sin pulsos ni flotación, nieve muy lenta, apertura breve con poco confeti y sin transiciones en la interfaz.
- **Teclado y lectores de pantalla**: la lista de 24 casillas son botones reales con `aria-label` («Casilla 18, bloqueada. Vuelve el 18 de diciembre»), navegables con Tab y con las flechas. Al enfocar una casilla, la cámara gira hacia su regalo. El lienzo 3D es decorativo (`aria-hidden`); toda la funcionalidad está en la lista.
- **Modal**: `role="dialog"` con `aria-modal`, el foco queda atrapado dentro, se cierra con Escape, el botón ✕, «Cerrar» o el fondo, y el foco vuelve a la casilla. El resto de la página queda `inert` mientras está abierto.
- **Contraste AA** en todos los textos de la paleta por defecto.

## Audio

Toda la música y los efectos se generan en el navegador con Web Audio API: una melodía original en Re mayor con timbre de campanas, acordes suaves y cascabeles, un efecto de apertura (soplo + arpegio) y un golpe de madera para las casillas bloqueadas. No hay archivos de audio. Está **silenciado por defecto** y se activa con el botón del altavoz de la cabecera.
