// Ajustes: datos de la empresa, logo, control de presupuesto, numeración de pedidos, copias de seguridad.
import { state, guardarConfig, exportarCopia, importarCopia, validarCopia, borrarTodo, almacen, SCHEMA_VERSION } from '../db.js';
import { esc, fmtFecha, fmtFechaHora, parseNum } from '../format.js';
import { formatearNumeroPedido, siguienteNumeroPedido } from '../models.js';
import { $, toast, confirmar, descargar, datosFormulario, leerArchivoTexto, leerArchivoDataURL } from '../ui.js';
import { cargarDatosEjemplo, borrarDatosEjemplo, hayDatosEjemplo } from '../sample.js';

/** Descarga la copia de seguridad JSON y registra la fecha. */
export async function descargarCopia() {
  const copia = exportarCopia();
  const d = new Date();
  const nombre = `copia-compras-material_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
  descargar(new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }), nombre);
  await guardarConfig('ultimaCopia', copia.exportadoEl);
  toast(`Copia de seguridad exportada: ${nombre}`, 'exito');
}

export function render(main) {
  const c = state.config;
  const e = c.empresa;
  const sig = siguienteNumeroPedido(c.pedido);
  main.innerHTML = `
    <div class="cab-vista"><div><h1>Ajustes</h1><p>Configuración general, copias de seguridad y datos de ejemplo.</p></div></div>

    <section class="tarjeta" aria-labelledby="h-emp">
      <h2 id="h-emp">Datos de la empresa</h2>
      <p class="suave">Aparecen en la cabecera de los pedidos y de los informes.</p>
      <form id="f-empresa" class="form-rejilla">
        <div class="campo"><label for="e-rs">Razón social</label><input id="e-rs" name="razonSocial" value="${esc(e.razonSocial)}"></div>
        <div class="campo"><label for="e-cif">CIF</label><input id="e-cif" name="cif" value="${esc(e.cif)}"></div>
        <div class="campo"><label for="e-con">Persona de contacto</label><input id="e-con" name="contacto" value="${esc(e.contacto)}"></div>
        <div class="campo"><label for="e-mail">Correo electrónico</label><input id="e-mail" name="email" type="email" value="${esc(e.email)}"></div>
        <div class="campo"><label for="e-tel">Teléfono</label><input id="e-tel" name="telefono" type="tel" value="${esc(e.telefono)}"></div>
        <div class="campo ancho"><label for="e-dir">Dirección de facturación</label><textarea id="e-dir" name="direccion" rows="2">${esc(e.direccion)}</textarea></div>
        <div class="ancho acciones"><button type="submit" class="btn btn-primario">Guardar datos de la empresa</button></div>
      </form>
      <hr style="border:0;border-top:1px solid var(--borde);margin:18px 0">
      <h3>Logotipo (opcional)</h3>
      <div class="acciones">
        <div id="logo-prev">${c.logo?.dataURL ? `<img class="logo-prev" src="${esc(c.logo.dataURL)}" alt="Logotipo actual">` : '<span class="suave">Sin logotipo.</span>'}</div>
        <label class="btn btn-secundario" for="logo-file">Subir imagen PNG o JPG…</label>
        <input type="file" id="logo-file" accept="image/png,image/jpeg" class="oculto-visual">
        ${c.logo ? '<button type="button" class="btn btn-texto" id="logo-quitar">Quitar logotipo</button>' : ''}
      </div>
      <p class="suave" style="margin-top:6px"><small>Se recomienda una imagen horizontal de menos de 500 KB. Se inserta en la esquina superior izquierda del pedido.</small></p>
    </section>

    <div class="rejilla rejilla-2 seccion">
      <section class="tarjeta" aria-labelledby="h-pres">
        <h2 id="h-pres">Control de presupuesto</h2>
        <form id="f-pres" class="form-rejilla">
          <fieldset class="ancho"><legend>El presupuesto se controla sobre…</legend>
            <div class="radios">
              <label class="check"><input type="radio" name="base" value="base" ${c.presupuesto.base !== 'total' ? 'checked' : ''}> La base imponible (sin IVA) — recomendado</label>
              <label class="check"><input type="radio" name="base" value="total" ${c.presupuesto.base === 'total' ? 'checked' : ''}> El total con IVA</label>
            </div>
          </fieldset>
          <div class="campo"><label for="u-ambar">Umbral ámbar (%)</label><input id="u-ambar" name="ambar" type="number" min="1" max="1000" step="1" value="${c.presupuesto.ambar}" required></div>
          <div class="campo"><label for="u-rojo">Umbral rojo (%)</label><input id="u-rojo" name="rojo" type="number" min="1" max="1000" step="1" value="${c.presupuesto.rojo}" required aria-describedby="u-ayuda"></div>
          <p class="ancho suave" id="u-ayuda" style="margin:0"><small>Verde por debajo del umbral ámbar; ámbar entre ambos; rojo por encima del umbral rojo.</small></p>
          <div class="ancho acciones"><button type="submit" class="btn btn-primario">Guardar</button></div>
        </form>
      </section>

      <section class="tarjeta" aria-labelledby="h-num">
        <h2 id="h-num">Numeración de pedidos</h2>
        <form id="f-num" class="form-rejilla">
          <div class="campo ancho"><label for="n-fmt">Formato</label><input id="n-fmt" name="formato" value="${esc(c.pedido.formato)}" required aria-describedby="n-fmt-ayuda">
            <span class="ayuda" id="n-fmt-ayuda">{AAAA} = año, {AA} = año con 2 cifras, {NNN} = número con ceros a la izquierda (tantas cifras como N).</span></div>
          <div class="campo"><label for="n-sig">Siguiente número</label><input id="n-sig" name="siguiente" type="number" min="1" step="1" value="${sig.n}" required></div>
          <div class="campo" style="align-content:end"><label class="check"><input type="checkbox" name="reinicioAnual" ${c.pedido.reinicioAnual ? 'checked' : ''}> Reiniciar a 1 cada año</label></div>
          <p class="ancho" style="margin:0">Vista previa: <strong class="mono" id="n-prev">${esc(sig.numero)}</strong></p>
          <div class="ancho acciones"><button type="submit" class="btn btn-primario">Guardar</button></div>
        </form>
      </section>
    </div>

    <section class="tarjeta seccion" aria-labelledby="h-copia">
      <h2 id="h-copia">Copias de seguridad</h2>
      <p>Los datos se guardan solo en este navegador (${almacen.persistente ? 'IndexedDB' : '<strong>sin almacenamiento persistente</strong>'}). Exporte una copia con regularidad y guárdela en una carpeta segura de la red.
      Última copia exportada: <strong>${c.ultimaCopia ? fmtFechaHora(c.ultimaCopia) : 'nunca'}</strong>. Versión del esquema: ${SCHEMA_VERSION}.</p>
      <div class="acciones">
        <button type="button" class="btn btn-primario" id="btn-exportar">Exportar copia de seguridad</button>
        <label class="btn btn-secundario" for="copia-file">Importar copia…</label>
        <input type="file" id="copia-file" accept="application/json,.json" class="oculto-visual">
      </div>
    </section>

    <section class="tarjeta seccion" aria-labelledby="h-ej">
      <h2 id="h-ej">Datos de ejemplo</h2>
      <p>Cinco departamentos, tres centros deportivos, cinco proveedores y treinta y un artículos ficticios para probar la aplicación. Se pueden borrar después sin afectar a sus propios datos.</p>
      <div class="acciones">
        <button type="button" class="btn btn-secundario" id="btn-cargar-ej" ${hayDatosEjemplo() ? 'disabled' : ''}>Cargar datos de ejemplo</button>
        <button type="button" class="btn btn-secundario" id="btn-borrar-ej" ${hayDatosEjemplo() ? '' : 'disabled'}>Borrar datos de ejemplo</button>
      </div>
    </section>

    <section class="tarjeta seccion" aria-labelledby="h-peligro" style="border-color:var(--peligro)">
      <h2 id="h-peligro">Borrar todos los datos</h2>
      <p>Elimina departamentos, centros, proveedores, artículos, pedidos y ajustes de este navegador. Exporte antes una copia de seguridad.</p>
      <button type="button" class="btn btn-peligro" id="btn-borrar-todo">Borrar todos los datos…</button>
    </section>`;

  $('#f-empresa', main).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    if (!f.checkValidity()) { f.reportValidity(); return; }
    await guardarConfig('empresa', datosFormulario(f));
    toast('Datos de la empresa guardados.', 'exito');
  });

  $('#logo-file', main).addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { toast('El logotipo debe ser PNG o JPG.', 'error'); return; }
    if (file.size > 1024 * 1024) { toast('La imagen supera 1 MB; use una más ligera.', 'error'); return; }
    const dataURL = await leerArchivoDataURL(file);
    const img = new Image();
    img.onload = async () => {
      await guardarConfig('logo', { dataURL, ancho: img.naturalWidth, alto: img.naturalHeight });
      toast('Logotipo guardado.', 'exito');
      render(main);
    };
    img.onerror = () => toast('No se pudo leer la imagen.', 'error');
    img.src = dataURL;
  });
  $('#logo-quitar', main)?.addEventListener('click', async () => {
    await guardarConfig('logo', null);
    toast('Logotipo eliminado.', 'exito');
    render(main);
  });

  $('#f-pres', main).addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.target;
    const ambar = parseNum(f.elements.ambar.value), rojo = parseNum(f.elements.rojo.value);
    f.elements.rojo.setCustomValidity(rojo >= ambar ? '' : 'El umbral rojo debe ser mayor o igual que el ámbar.');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    await guardarConfig('presupuesto', { base: f.elements.base.value, ambar, rojo });
    toast('Criterio de presupuesto guardado.', 'exito');
  });

  const fNum = $('#f-num', main);
  const previa = () => {
    $('#n-prev', main).textContent = formatearNumeroPedido(fNum.elements.formato.value, parseInt(fNum.elements.siguiente.value, 10) || 1);
  };
  fNum.addEventListener('input', previa);
  fNum.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fmt = fNum.elements.formato;
    fmt.setCustomValidity(/\{N+\}/.test(fmt.value) ? '' : 'El formato debe incluir {NNN} para el número correlativo.');
    if (!fNum.checkValidity()) { fNum.reportValidity(); return; }
    await guardarConfig('pedido', {
      formato: fmt.value.trim(),
      siguiente: parseInt(fNum.elements.siguiente.value, 10),
      anio: new Date().getFullYear(),
      reinicioAnual: fNum.elements.reinicioAnual.checked,
    });
    toast('Numeración de pedidos guardada.', 'exito');
  });

  $('#btn-exportar', main).addEventListener('click', async () => { await descargarCopia(); render(main); });
  $('#copia-file', main).addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    let json;
    try {
      json = JSON.parse(await leerArchivoTexto(file));
      validarCopia(json);
    } catch (err) {
      toast('No se puede importar: ' + (err.message || err), 'error');
      return;
    }
    const d = json.datos;
    const ok = await confirmar(
      `<p>La copia es del <strong>${fmtFecha(json.exportadoEl)}</strong> y contiene ${d.articulos?.length || 0} artículos, ${d.departamentos?.length || 0} departamentos, ${d.proveedores?.length || 0} proveedores y ${d.centros?.length || 0} centros.</p>
       <p><strong>Se sustituirán todos los datos actuales</strong> por los de la copia. ¿Continuar?</p>`,
      { titulo: 'Restaurar copia de seguridad', ok: 'Sí, sustituir mis datos', peligro: true, html: true },
    );
    if (!ok) return;
    await importarCopia(json);
    toast('Copia restaurada correctamente.', 'exito');
  });

  $('#btn-cargar-ej', main).addEventListener('click', async () => {
    await cargarDatosEjemplo();
    toast('Datos de ejemplo cargados.', 'exito');
    render(main);
  });
  $('#btn-borrar-ej', main).addEventListener('click', async () => {
    if (!(await confirmar('¿Borrar todos los datos de ejemplo? Sus propios datos no se tocarán.', { titulo: 'Borrar datos de ejemplo', ok: 'Borrar', peligro: true }))) return;
    const conservados = await borrarDatosEjemplo();
    toast(conservados.length ? `Datos de ejemplo borrados. Se han conservado por tener artículos suyos: ${conservados.join(', ')}.` : 'Datos de ejemplo borrados.', 'exito', 8000);
    render(main);
  });
  $('#btn-borrar-todo', main).addEventListener('click', async () => {
    if (!(await confirmar('Se borrarán TODOS los datos de este navegador. ¿Está seguro? Esta acción no se puede deshacer.', { titulo: 'Borrar todos los datos', ok: 'Borrar todo', peligro: true }))) return;
    await borrarTodo();
    toast('Todos los datos han sido borrados.', 'exito');
  });
}
