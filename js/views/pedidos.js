// Pantalla de pedidos: proveedores con artículos pendientes, generación del Excel y pedidos emitidos.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { state, guardarVarios, guardar, guardarConfig, porId } = App['db'];
  const { esc, eur, fmtFecha, collator, uid } = App['format'];
  const { totalesLineas, siguienteNumeroPedido, conEstado, nombreEstado, importesLinea } = App['models'];
  const { abrirModal, confirmar, toast, idUnico, descargar, requiereLibreria, $, $$, badgeEstado } = App['ui'];
  const { prepararLineas, descargarPedidoExcel } = App['excel'];

  let raiz = null;

  const pendientesDe = (proveedorId) => state.articulos.filter((a) => a.proveedorId === proveedorId && a.estado === 'pendiente');

  /** Pedidos emitidos: unión de los registros guardados y de los nº de pedido presentes en los artículos. */
  function pedidosEmitidos() {
    const mapa = new Map();
    for (const p of state.pedidos) mapa.set(p.numero, { ...p, lineas: [] });
    for (const a of state.articulos) {
      if (!a.numeroPedido) continue;
      if (!mapa.has(a.numeroPedido)) {
        mapa.set(a.numeroPedido, { id: null, numero: a.numeroPedido, proveedorId: a.proveedorId, fecha: a.fechas?.pedido || null, observaciones: '', lineas: [] });
      }
      mapa.get(a.numeroPedido).lineas.push(a);
    }
    return [...mapa.values()]
      .filter((p) => p.lineas.length)
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || collator.compare(b.numero, a.numero));
  }

  function render(main) {
    raiz = main;
    pintar();
  }
  function salir() { raiz = null; }

  function pintar() {
    if (!raiz) return;
    const proveedores = state.proveedores
      .map((p) => ({ p, lineas: pendientesDe(p.id) }))
      .filter((x) => x.lineas.length)
      .sort((a, b) => collator.compare(a.p.nombre, b.p.nombre));
    const huerfanos = state.articulos.filter((a) => a.estado === 'pendiente' && !porId('proveedores', a.proveedorId)).length;
    const emitidos = pedidosEmitidos();
    const sig = siguienteNumeroPedido(state.config.pedido);

    raiz.innerHTML = `
      <div class="cab-vista">
        <div><h1>Pedidos</h1><p>Genere un Excel de pedido por proveedor con sus artículos pendientes. Próximo número: <strong class="mono">${esc(sig.numero)}</strong></p></div>
        <div class="acciones"><a class="btn btn-secundario" href="#/ajustes">Configurar numeración</a></div>
      </div>
      ${huerfanos ? `<div class="aviso aviso-aviso" style="margin-bottom:14px"><p>${huerfanos} artículo(s) pendientes no tienen proveedor válido y no aparecen aquí.</p></div>` : ''}
      <section class="tarjeta" aria-labelledby="h-pend">
        <h2 id="h-pend">Pendientes de pedir</h2>
        <div class="tabla-cont"><table>
          <thead><tr><th scope="col">Proveedor</th><th scope="col" class="num">Líneas</th><th scope="col" class="num">Base imponible</th><th scope="col" class="num">IVA</th><th scope="col" class="num">Total con IVA</th><th scope="col">Prioridad alta</th><th scope="col" class="num">Acciones</th></tr></thead>
          <tbody>${proveedores.length ? proveedores.map(({ p, lineas }) => {
            const t = totalesLineas(lineas);
            const altas = lineas.filter((a) => a.prioridad === 'alta').length;
            return `<tr>
              <td><strong>${esc(p.nombre)}</strong><br><small>${esc(p.condicionesPago || '')}</small></td>
              <td class="num">${lineas.length}</td>
              <td class="num">${eur(t.base)}</td>
              <td class="num">${eur(t.cuota)}</td>
              <td class="num"><strong>${eur(t.total)}</strong></td>
              <td>${altas ? `<span class="prio-alta">${altas} línea(s)</span>` : '—'}</td>
              <td class="acc">
                <a class="btn btn-texto btn-peq" href="#/articulos?proveedorId=${encodeURIComponent(p.id)}&estado=pendiente">Ver artículos</a>
                <a class="btn btn-texto btn-peq" href="#/imprimir/proveedor/${encodeURIComponent(p.id)}">Vista imprimible</a>
                <button type="button" class="btn btn-primario btn-peq" data-generar="${esc(p.id)}">Generar Excel</button>
              </td></tr>`;
          }).join('') : `<tr><td colspan="7" class="vacio">No hay artículos pendientes de pedir.</td></tr>`}</tbody>
        </table></div>
      </section>
      <section class="tarjeta" aria-labelledby="h-emit">
        <h2 id="h-emit">Pedidos emitidos</h2>
        <div class="tabla-cont"><table>
          <thead><tr><th scope="col">Nº de pedido</th><th scope="col">Fecha</th><th scope="col">Proveedor</th><th scope="col" class="num">Líneas</th><th scope="col">Recepción</th><th scope="col" class="num">Total con IVA</th><th scope="col" class="num">Acciones</th></tr></thead>
          <tbody>${emitidos.length ? emitidos.map((p) => {
            const activas = p.lineas.filter((a) => a.estado !== 'cancelado');
            const recibidas = activas.filter((a) => a.estado === 'recibido').length;
            const t = totalesLineas(activas);
            const completo = activas.length > 0 && recibidas === activas.length;
            return `<tr>
              <td class="mono"><strong>${esc(p.numero)}</strong></td>
              <td>${fmtFecha(p.fecha)}</td>
              <td>${esc(porId('proveedores', p.proveedorId)?.nombre || '—')}</td>
              <td class="num">${p.lineas.length}</td>
              <td>${completo ? badgeEstado('recibido', 'Recibido completo') : recibidas ? badgeEstado('pedido', `Parcial: ${recibidas} de ${activas.length}`) : badgeEstado('pedido', 'Pendiente de recibir')}</td>
              <td class="num">${eur(t.total)}</td>
              <td class="acc">
                <a class="btn btn-texto btn-peq" href="#/articulos?numeroPedido=${encodeURIComponent(p.numero)}">Ver líneas</a>
                <a class="btn btn-texto btn-peq" href="#/imprimir/pedido/${encodeURIComponent(p.numero)}">Imprimir</a>
                <button type="button" class="btn btn-texto btn-peq" data-redescargar="${esc(p.numero)}">Excel</button>
                ${completo ? '' : `<button type="button" class="btn btn-secundario btn-peq" data-recibir="${esc(p.numero)}">Recibir…</button>`}
              </td></tr>`;
          }).join('') : `<tr><td colspan="7" class="vacio">Todavía no se ha emitido ningún pedido.</td></tr>`}</tbody>
        </table></div>
      </section>`;

    $$('[data-generar]', raiz).forEach((b) => b.addEventListener('click', () => dialogoGenerar(b.dataset.generar)));
    $$('[data-redescargar]', raiz).forEach((b) => b.addEventListener('click', () => redescargar(b.dataset.redescargar)));
    $$('[data-recibir]', raiz).forEach((b) => b.addEventListener('click', () => dialogoRecibir(b.dataset.recibir)));
  }

  function datosExcel({ proveedor, lineas, numero, fecha, observaciones }) {
    return {
      empresa: state.config.empresa,
      logo: state.config.logo,
      proveedor,
      lineas: prepararLineas(lineas, state),
      centros: state.centros,
      numero,
      fecha,
      observaciones,
    };
  }

  function dialogoGenerar(proveedorId) {
    if (!requiereLibreria('ExcelJS', 'ExcelJS')) return;
    const proveedor = porId('proveedores', proveedorId);
    const lineas = pendientesDe(proveedorId);
    const sig = siguienteNumeroPedido(state.config.pedido);
    const formId = idUnico('form-ped');
    const hoy = new Date();
    const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const empresaIncompleta = !state.config.empresa.razonSocial || !state.config.empresa.cif;

    const { cerrar } = abrirModal({
      titulo: `Generar pedido para ${proveedor.nombre}`,
      ancho: 'lg',
      contenido: `<form id="${formId}" class="form-rejilla" novalidate>
        ${empresaIncompleta ? `<div class="aviso aviso-aviso ancho"><p>Los datos de la empresa están incompletos; la cabecera del pedido saldrá sin ellos. Puede completarlos en <a href="#/ajustes">Ajustes</a>.</p></div>` : ''}
        <div class="campo"><label for="p-num">Número de pedido</label><input id="p-num" value="${esc(sig.numero)}" readonly aria-describedby="p-num-ayuda">
          <span class="ayuda" id="p-num-ayuda">Correlativo automático; el formato se cambia en Ajustes.</span></div>
        <div class="campo"><label for="p-fecha">Fecha del pedido</label><input id="p-fecha" name="fecha" type="date" value="${hoyStr}" required></div>
        <fieldset class="ancho"><legend>Líneas incluidas (${lineas.length})</legend>
          <p style="margin:0 0 8px"><button type="button" class="btn btn-texto btn-peq" id="p-todas">Marcar todas</button><button type="button" class="btn btn-texto btn-peq" id="p-ninguna">Desmarcar todas</button></p>
          <div class="tabla-cont" style="max-height:260px;overflow:auto"><table>
            <thead><tr><th scope="col"><span class="oculto-visual">Incluir</span></th><th scope="col">Descripción</th><th scope="col">Centro</th><th scope="col" class="num">Cant.</th><th scope="col" class="num">Total</th></tr></thead>
            <tbody>${lineas.map((a) => `<tr><td><input type="checkbox" name="linea" value="${esc(a.id)}" checked id="pl-${esc(a.id)}"></td>
              <td><label for="pl-${esc(a.id)}" style="font-weight:400">${esc(a.descripcion)}</label></td><td>${esc(porId('centros', a.centroId)?.nombre || '—')}</td>
              <td class="num">${a.cantidad}</td><td class="num">${eur(importesLinea(a).total)}</td></tr>`).join('')}</tbody>
          </table></div>
          <p id="p-total" class="suave" style="margin:8px 0 0" aria-live="polite"></p>
        </fieldset>
        <div class="campo ancho"><label for="p-obs">Observaciones (aparecen en el pedido)</label>
          <textarea id="p-obs" name="observaciones" rows="3" placeholder="Horario de entrega, persona que recibe, plazos…"></textarea></div>
      </form>`,
      acciones: [
        { texto: 'Cancelar' },
        { texto: 'Generar y descargar Excel', clase: 'btn-primario', tipo: 'submit', form: formId },
      ],
    });
    const form = document.getElementById(formId);
    const seleccionadas = () => $$('input[name="linea"]:checked', form).map((c) => porId('articulos', c.value));
    const actualizarTotal = () => {
      const t = totalesLineas(seleccionadas());
      $('#p-total', form).textContent = `${seleccionadas().length} líneas · Base ${eur(t.base)} · IVA ${eur(t.cuota)} · Total ${eur(t.total)}`;
    };
    form.addEventListener('change', actualizarTotal);
    $('#p-todas', form).addEventListener('click', () => { $$('input[name="linea"]', form).forEach((c) => (c.checked = true)); actualizarTotal(); });
    $('#p-ninguna', form).addEventListener('click', () => { $$('input[name="linea"]', form).forEach((c) => (c.checked = false)); actualizarTotal(); });
    actualizarTotal();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const elegidas = seleccionadas();
      if (!elegidas.length) { toast('Seleccione al menos una línea.', 'aviso'); return; }
      const [y, m, d] = form.elements.fecha.value.split('-').map(Number);
      const fecha = y ? new Date(y, m - 1, d, 12) : new Date();
      const observaciones = form.elements.observaciones.value.trim();
      // Se recalcula por si ha cambiado algo mientras el diálogo estaba abierto
      const { n, anio, numero } = siguienteNumeroPedido(state.config.pedido, fecha);
      try {
        const { nombre, totales } = await descargarPedidoExcel(datosExcel({ proveedor, lineas: elegidas, numero, fecha, observaciones }), descargar);
        await guardarConfig('pedido', { ...state.config.pedido, siguiente: n + 1, anio });
        cerrar(true);
        toast(`Descargado ${nombre} (total ${eur(totales.total)}).`, 'exito');
        const marcar = await confirmar(
          `<p>Se ha generado el pedido <strong>${esc(numero)}</strong> con ${elegidas.length} línea(s) por un total de <strong>${eur(totales.total)}</strong>.</p>
           <p>¿Quiere marcar estos artículos como <strong>Pedido</strong> y asignarles el número ${esc(numero)}?</p>`,
          { titulo: 'Marcar artículos como pedidos', ok: 'Sí, marcar como pedido', cancelar: 'No, dejarlos pendientes', html: true },
        );
        if (marcar) {
          await guardarVarios('articulos', elegidas.map((a) => conEstado(a, 'pedido', numero)));
          await guardar('pedidos', {
            id: uid(), numero, proveedorId, fecha: fecha.toISOString(), articuloIds: elegidas.map((a) => a.id),
            total: totales.total, observaciones,
          });
          toast(`${elegidas.length} artículo(s) marcados como pedidos con el nº ${numero}.`, 'exito');
        } else {
          toast(`Los artículos siguen pendientes. El número ${numero} ya se ha consumido.`, 'info');
        }
        pintar();
      } catch (err) {
        console.error(err);
        toast('No se pudo generar el Excel: ' + (err.message || err), 'error');
      }
    });
  }

  async function redescargar(numero) {
    if (!requiereLibreria('ExcelJS', 'ExcelJS')) return;
    const p = pedidosEmitidos().find((x) => x.numero === numero);
    if (!p) return;
    const proveedor = porId('proveedores', p.proveedorId) || { nombre: 'Proveedor' };
    const lineas = p.lineas.filter((a) => a.estado !== 'cancelado');
    try {
      const { nombre } = await descargarPedidoExcel(
        datosExcel({ proveedor, lineas, numero, fecha: p.fecha ? new Date(p.fecha) : new Date(), observaciones: p.observaciones || '' }),
        descargar,
      );
      toast(`Descargado de nuevo ${nombre}.`, 'exito');
    } catch (err) {
      toast('No se pudo generar el Excel: ' + (err.message || err), 'error');
    }
  }

  function dialogoRecibir(numero) {
    const p = pedidosEmitidos().find((x) => x.numero === numero);
    if (!p) return;
    const lineas = p.lineas.filter((a) => a.estado !== 'cancelado');
    const formId = idUnico('form-rec');
    const { cerrar } = abrirModal({
      titulo: `Recepción del pedido ${numero}`,
      ancho: 'lg',
      contenido: `<form id="${formId}">
        <p>Marque las líneas que se han recibido. Las ya recibidas aparecen marcadas.</p>
        <p><button type="button" class="btn btn-secundario btn-peq" id="r-todas">Marcar el pedido completo</button></p>
        <div class="tabla-cont"><table>
          <thead><tr><th scope="col"><span class="oculto-visual">Recibido</span></th><th scope="col">Descripción</th><th scope="col">Centro</th><th scope="col" class="num">Cant.</th><th scope="col">Estado actual</th></tr></thead>
          <tbody>${lineas.map((a) => `<tr><td><input type="checkbox" name="rec" value="${esc(a.id)}" id="r-${esc(a.id)}" ${a.estado === 'recibido' ? 'checked' : ''}></td>
            <td><label for="r-${esc(a.id)}" style="font-weight:400">${esc(a.descripcion)}</label></td><td>${esc(porId('centros', a.centroId)?.nombre || '—')}</td><td class="num">${a.cantidad}</td>
            <td>${badgeEstado(a.estado, nombreEstado(a.estado))}</td></tr>`).join('')}</tbody>
        </table></div></form>`,
      acciones: [
        { texto: 'Cancelar' },
        { texto: 'Guardar recepción', clase: 'btn-primario', tipo: 'submit', form: formId },
      ],
    });
    const form = document.getElementById(formId);
    $('#r-todas', form).addEventListener('click', () => $$('input[name="rec"]', form).forEach((c) => (c.checked = true)));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const marcadas = new Set($$('input[name="rec"]:checked', form).map((c) => c.value));
      const cambios = lineas.filter((a) => (marcadas.has(a.id) ? a.estado !== 'recibido' : a.estado === 'recibido'))
        .map((a) => conEstado(a, marcadas.has(a.id) ? 'recibido' : 'pedido'));
      if (cambios.length) await guardarVarios('articulos', cambios);
      cerrar(true);
      toast(cambios.length ? `Recepción actualizada (${cambios.length} línea(s)).` : 'Sin cambios.', cambios.length ? 'exito' : 'info');
      pintar();
    });
  }

  App['pedidos'] = { pendientesDe, pedidosEmitidos, render, salir };
})();
