// Pantalla de artículos: tabla con búsqueda, filtros, ordenación, edición y acciones masivas.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { state, guardar, guardarVarios, borrar, porId } = App['db'];
  const { esc, eur, pct, fmtNum, fmtFecha, normalizar, collator, parseNum, uid, hoyISO } = App['format'];
  const { ESTADOS, PRIORIDADES, TIPOS_IVA, nombreEstado, nombrePrioridad, importesLinea, comprobarExceso, conEstado, nuevoArticulo, totalesLineas } = App['models'];
  const { abrirModal, confirmar, toast, idUnico, opciones, $, $$, punto, badgeEstado } = App['ui'];

  const FILTROS_VACIOS = { q: '', departamentoId: '', proveedorId: '', categoriaId: '', centroId: '', estado: '', prioridad: '', numeroPedido: '' };
  let filtros = { ...FILTROS_VACIOS };
  let orden = { campo: 'descripcion', dir: 1 };
  const seleccion = new Set();
  let raiz = null;

  const nombreDe = (store, id) => porId(store, id)?.nombre || '';
  const ordenAlfa = (lista) => [...lista].sort((a, b) => collator.compare(a.nombre, b.nombre));

  const COLUMNAS = [
    { campo: 'descripcion', titulo: 'Descripción', clave: (a) => a.descripcion },
    { campo: 'departamento', titulo: 'Departamento', clave: (a) => nombreDe('departamentos', a.departamentoId) },
    { campo: 'proveedor', titulo: 'Proveedor / centro', clave: (a) => nombreDe('proveedores', a.proveedorId) },
    { campo: 'cantidad', titulo: 'Cant.', num: true, clave: (a) => Number(a.cantidad) || 0 },
    { campo: 'precio', titulo: 'Precio unit.', num: true, clave: (a) => Number(a.precio) || 0 },
    { campo: 'iva', titulo: 'IVA', num: true, clave: (a) => Number(a.iva) || 0 },
    { campo: 'base', titulo: 'Base imponible', num: true, clave: (a) => importesLinea(a).base },
    { campo: 'total', titulo: 'Total con IVA', num: true, clave: (a) => importesLinea(a).total },
    { campo: 'prioridad', titulo: 'Prioridad', clave: (a) => ({ alta: 0, media: 1, baja: 2 }[a.prioridad] ?? 3) },
    { campo: 'estado', titulo: 'Estado', clave: (a) => ESTADOS.findIndex((e) => e.id === a.estado) },
  ];

  function filtrar() {
    const q = normalizar(filtros.q);
    return state.articulos.filter((a) => {
      for (const k of ['departamentoId', 'proveedorId', 'categoriaId', 'centroId', 'estado', 'prioridad', 'numeroPedido']) {
        if (filtros[k] && a[k] !== filtros[k]) return false;
      }
      if (q) {
        const texto = normalizar([a.descripcion, a.referencia, a.notas, a.numeroPedido, nombreDe('proveedores', a.proveedorId), nombreDe('departamentos', a.departamentoId)].join(' '));
        if (!q.split(' ').every((p) => texto.includes(p))) return false;
      }
      return true;
    });
  }

  function ordenar(lista) {
    const col = COLUMNAS.find((c) => c.campo === orden.campo) || COLUMNAS[0];
    return lista.sort((a, b) => {
      const va = col.clave(a), vb = col.clave(b);
      const r = typeof va === 'number' ? va - vb : collator.compare(String(va || ''), String(vb || ''));
      return (r || collator.compare(a.descripcion || '', b.descripcion || '')) * orden.dir;
    });
  }

  function render(main, { query = {} } = {}) {
    raiz = main;
    if (Object.keys(query).length) {
      filtros = { ...FILTROS_VACIOS };
      for (const k of Object.keys(FILTROS_VACIOS)) if (query[k]) filtros[k] = query[k];
    }
    seleccion.clear();
    const sel = (id, etiqueta, campo, lista, vacio = 'Todos') => `
      <div class="campo"><label for="${id}">${etiqueta}</label>
      <select id="${id}" data-filtro="${campo}">${opciones(lista, filtros[campo], { vacio })}</select></div>`;
    main.innerHTML = `
      <div class="cab-vista">
        <div><h1>Artículos</h1><p>Todo el material previsto, pedido y recibido. Los importes se calculan automáticamente por línea.</p></div>
        <div class="acciones">
          <a class="btn btn-secundario" href="#/importar">Importar</a>
          <button type="button" class="btn btn-primario" id="btn-nuevo">+ Nuevo artículo</button>
        </div>
      </div>
      <div class="filtros" role="search" aria-label="Filtrar artículos">
        <div class="campo campo-busqueda"><label for="f-q">Buscar</label>
          <input type="search" id="f-q" data-filtro="q" value="${esc(filtros.q)}" placeholder="Descripción, referencia, notas, nº de pedido…"></div>
        ${sel('f-dep', 'Departamento', 'departamentoId', ordenAlfa(state.departamentos))}
        ${sel('f-pro', 'Proveedor', 'proveedorId', ordenAlfa(state.proveedores))}
        ${sel('f-cat', 'Categoría', 'categoriaId', ordenAlfa(state.categorias), 'Todas')}
        ${sel('f-cen', 'Centro', 'centroId', ordenAlfa(state.centros))}
        ${sel('f-est', 'Estado', 'estado', ESTADOS)}
        ${sel('f-pri', 'Prioridad', 'prioridad', PRIORIDADES, 'Todas')}
        <button type="button" class="btn btn-secundario" id="btn-limpiar">Limpiar filtros</button>
      </div>
      <div id="chip-pedido"></div>
      <p class="resumen-filtro" id="resumen" aria-live="polite"></p>
      <div class="barra-masiva" id="barra-masiva" hidden>
        <strong id="n-sel"></strong>
        <label for="masivo-estado" class="oculto-visual">Nuevo estado</label>
        <select id="masivo-estado">${opciones(ESTADOS, '', { vacio: 'Cambiar estado a…' })}</select>
        <button type="button" class="btn btn-primario btn-peq" id="btn-aplicar-estado">Aplicar</button>
        <button type="button" class="btn btn-peligro btn-peq" id="btn-borrar-sel">Borrar seleccionados</button>
        <button type="button" class="btn btn-texto btn-peq" id="btn-quitar-sel">Quitar selección</button>
      </div>
      <div class="tabla-cont">
        <table id="tabla-articulos">
          <caption class="oculto-visual">Listado de artículos</caption>
          <thead><tr></tr></thead><tbody></tbody><tfoot></tfoot>
        </table>
      </div>`;

    $$('[data-filtro]', main).forEach((el) => el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', () => {
      filtros[el.dataset.filtro] = el.value;
      seleccion.clear();
      pintar();
    }));
    $('#btn-limpiar', main).addEventListener('click', () => {
      filtros = { ...FILTROS_VACIOS };
      $$('[data-filtro]', main).forEach((el) => (el.value = ''));
      seleccion.clear();
      pintar();
    });
    $('#btn-nuevo', main).addEventListener('click', () => editarArticulo(null, { alGuardar: pintar }));
    $('#btn-aplicar-estado', main).addEventListener('click', aplicarEstadoMasivo);
    $('#btn-borrar-sel', main).addEventListener('click', borrarSeleccion);
    $('#btn-quitar-sel', main).addEventListener('click', () => { seleccion.clear(); pintar(); });
    pintar();
  }

  function salir() { raiz = null; }

  function pintar() {
    if (!raiz) return;
    const lista = ordenar(filtrar());
    const ids = new Set(lista.map((a) => a.id));
    for (const id of [...seleccion]) if (!ids.has(id)) seleccion.delete(id);

    // Chip de pedido
    $('#chip-pedido', raiz).innerHTML = filtros.numeroPedido
      ? `<div class="aviso aviso-info aviso-discreto" style="margin-bottom:10px"><p>Mostrando las líneas del pedido <strong>${esc(filtros.numeroPedido)}</strong>.</p><div class="acciones"><button type="button" class="btn btn-texto btn-peq" id="quitar-pedido">Quitar este filtro</button></div></div>`
      : '';
    $('#quitar-pedido', raiz)?.addEventListener('click', () => { filtros.numeroPedido = ''; pintar(); });

    const t = totalesLineas(lista.filter((a) => a.estado !== 'cancelado'));
    $('#resumen', raiz).innerHTML = `<span><strong>${lista.length}</strong> de ${state.articulos.length} artículos</span>
      <span>Base imponible: <strong>${eur(t.base)}</strong></span><span>IVA: <strong>${eur(t.cuota)}</strong></span>
      <span>Total: <strong>${eur(t.total)}</strong></span><span>(sin contar cancelados)</span>`;

    // Cabecera
    const todosSel = lista.length > 0 && lista.every((a) => seleccion.has(a.id));
    $('thead tr', raiz).innerHTML = `<th scope="col"><input type="checkbox" id="sel-todos" ${todosSel ? 'checked' : ''} aria-label="Seleccionar todos los artículos mostrados"></th>` +
      COLUMNAS.map((c) => {
        const activo = orden.campo === c.campo;
        return `<th scope="col" class="${c.num ? 'num' : ''}" aria-sort="${activo ? (orden.dir > 0 ? 'ascending' : 'descending') : 'none'}">
          <button type="button" class="ordenar" data-campo="${c.campo}">${c.titulo} <span class="flecha" aria-hidden="true">${activo ? (orden.dir > 0 ? '▲' : '▼') : '↕'}</span></button></th>`;
      }).join('') + '<th scope="col" class="num">Acciones</th>';
    $('#sel-todos', raiz).addEventListener('change', (e) => {
      for (const a of lista) e.target.checked ? seleccion.add(a.id) : seleccion.delete(a.id);
      pintar();
      $('#sel-todos', raiz)?.focus();
    });
    $$('.ordenar', raiz).forEach((b) => b.addEventListener('click', () => {
      orden = { campo: b.dataset.campo, dir: orden.campo === b.dataset.campo ? -orden.dir : 1 };
      pintar();
      $(`.ordenar[data-campo="${b.dataset.campo}"]`, raiz)?.focus();
    }));

    // Cuerpo
    const tbody = $('tbody', raiz);
    if (!lista.length) {
      const sinDatos = !state.articulos.length;
      tbody.innerHTML = `<tr><td colspan="${COLUMNAS.length + 2}" class="vacio">${sinDatos
        ? 'Todavía no hay artículos. Cree el primero con «+ Nuevo artículo», impórtelos desde Excel o cargue los datos de ejemplo en Ajustes.'
        : 'Ningún artículo coincide con los filtros.'}</td></tr>`;
    } else {
      tbody.innerHTML = lista.map((a) => {
        const i = importesLinea(a);
        const dep = porId('departamentos', a.departamentoId);
        return `<tr class="${seleccion.has(a.id) ? 'sel' : ''}">
          <td><input type="checkbox" data-sel="${esc(a.id)}" ${seleccion.has(a.id) ? 'checked' : ''} aria-label="Seleccionar ${esc(a.descripcion)}"></td>
          <td class="desc">${esc(a.descripcion)}<span class="ref">${esc([a.referencia, nombreDe('categorias', a.categoriaId)].filter(Boolean).join(' · '))}</span>${a.notas ? `<small title="${esc(a.notas)}">Nota: ${esc(a.notas.length > 50 ? a.notas.slice(0, 50) + '…' : a.notas)}</small>` : ''}</td>
          <td><span class="celda-flex">${dep ? punto(dep.color) : ''}${esc(dep?.nombre || '—')}</span></td>
          <td>${esc(nombreDe('proveedores', a.proveedorId) || '—')}<br><small class="suave">${esc(nombreDe('centros', a.centroId) || 'Sin centro')}</small></td>
          <td class="num">${fmtNum(a.cantidad, Number.isInteger(Number(a.cantidad)) ? 0 : 2)}</td>
          <td class="num">${eur(a.precio)}</td>
          <td class="num">${fmtNum(a.iva, 0)} %</td>
          <td class="num">${eur(i.base)}</td>
          <td class="num"><strong>${eur(i.total)}</strong></td>
          <td class="prio-${esc(a.prioridad)}">${esc(nombrePrioridad(a.prioridad))}</td>
          <td>${badgeEstado(a.estado, nombreEstado(a.estado))}${a.numeroPedido ? `<br><small class="mono">${esc(a.numeroPedido)}</small>` : ''}</td>
          <td class="acc acc-art">
            <button type="button" class="btn btn-texto btn-peq" data-editar="${esc(a.id)}" aria-label="Editar ${esc(a.descripcion)}">Editar</button>
            <button type="button" class="btn btn-texto btn-peq" data-duplicar="${esc(a.id)}" aria-label="Duplicar ${esc(a.descripcion)}">Duplicar</button>
            ${a.estado === 'pedido' ? `<button type="button" class="btn btn-texto btn-peq" data-recibido="${esc(a.id)}" aria-label="Marcar como recibido ${esc(a.descripcion)}">Recibido</button>` : ''}
            <button type="button" class="btn btn-texto btn-peq" data-borrar="${esc(a.id)}" aria-label="Borrar ${esc(a.descripcion)}">Borrar</button>
          </td></tr>`;
      }).join('');
    }
    $('tfoot', raiz).innerHTML = lista.length ? `<tr><td></td><td colspan="6">Totales de los artículos mostrados (sin cancelados)</td>
        <td class="num">${eur(t.base)}</td><td class="num">${eur(t.total)}</td><td colspan="3"></td></tr>` : '';

    $$('[data-sel]', tbody).forEach((c) => c.addEventListener('change', () => {
      c.checked ? seleccion.add(c.dataset.sel) : seleccion.delete(c.dataset.sel);
      c.closest('tr').classList.toggle('sel', c.checked);
      actualizarBarraMasiva(lista);
    }));
    $$('[data-editar]', tbody).forEach((b) => b.addEventListener('click', () => editarArticulo(b.dataset.editar, { alGuardar: pintar })));
    $$('[data-duplicar]', tbody).forEach((b) => b.addEventListener('click', () => duplicar(b.dataset.duplicar)));
    $$('[data-recibido]', tbody).forEach((b) => b.addEventListener('click', async () => {
      const a = porId('articulos', b.dataset.recibido);
      await guardar('articulos', conEstado(a, 'recibido'));
      toast(`«${a.descripcion}» marcado como recibido.`, 'exito');
      pintar();
    }));
    $$('[data-borrar]', tbody).forEach((b) => b.addEventListener('click', async () => {
      const a = porId('articulos', b.dataset.borrar);
      if (await confirmar(`¿Borrar el artículo «${a.descripcion}»?`, { titulo: 'Borrar artículo', ok: 'Borrar', peligro: true })) {
        await borrar('articulos', a.id);
        await limpiarPedidos([a.id]);
        toast('Artículo borrado.', 'exito');
        pintar();
      }
    }));
    actualizarBarraMasiva(lista);
  }

  function actualizarBarraMasiva(lista) {
    const barra = $('#barra-masiva', raiz);
    barra.hidden = seleccion.size === 0;
    $('#n-sel', raiz).textContent = `${seleccion.size} seleccionado${seleccion.size === 1 ? '' : 's'}`;
    const todos = $('#sel-todos', raiz);
    if (todos) {
      todos.checked = lista.length > 0 && lista.every((a) => seleccion.has(a.id));
      todos.indeterminate = !todos.checked && lista.some((a) => seleccion.has(a.id));
    }
  }

  async function aplicarEstadoMasivo() {
    const estado = $('#masivo-estado', raiz).value;
    if (!estado) { toast('Elija primero el nuevo estado.', 'aviso'); $('#masivo-estado', raiz).focus(); return; }
    const arts = [...seleccion].map((id) => porId('articulos', id)).filter(Boolean);
    if (!(await confirmar(`¿Cambiar el estado de ${arts.length} artículo(s) a «${nombreEstado(estado)}»?`, { titulo: 'Cambiar estado' }))) return;
    await guardarVarios('articulos', arts.map((a) => conEstado(a, estado)));
    if (estado === 'pendiente') await limpiarPedidos(arts.map((a) => a.id));
    toast(`${arts.length} artículo(s) actualizados a «${nombreEstado(estado)}».`, 'exito');
    seleccion.clear();
    pintar();
  }

  async function borrarSeleccion() {
    const ids = [...seleccion];
    if (!(await confirmar(`¿Borrar ${ids.length} artículo(s)? Esta acción no se puede deshacer.`, { titulo: 'Borrar artículos', ok: 'Borrar', peligro: true }))) return;
    await borrar('articulos', ids);
    await limpiarPedidos(ids);
    toast(`${ids.length} artículo(s) borrados.`, 'exito');
    seleccion.clear();
    pintar();
  }

  /** Quita de los pedidos registrados los artículos borrados o devueltos a pendiente; borra pedidos vacíos. */
  async function limpiarPedidos(ids) {
    const set = new Set(ids);
    const afectados = state.pedidos.filter((p) => p.articuloIds?.some((id) => set.has(id)));
    if (!afectados.length) return;
    const vigentes = (p) => p.articuloIds.filter((id) => !set.has(id) && porId('articulos', id)?.numeroPedido === p.numero);
    const actualizar = afectados.filter((p) => vigentes(p).length).map((p) => ({ ...p, articuloIds: vigentes(p) }));
    const vacios = afectados.filter((p) => !vigentes(p).length).map((p) => p.id);
    if (actualizar.length) await guardarVarios('pedidos', actualizar);
    if (vacios.length) await borrar('pedidos', vacios);
  }

  async function duplicar(id) {
    const a = porId('articulos', id);
    const copia = { ...a, id: uid(), estado: 'pendiente', numeroPedido: '', fechas: { creado: hoyISO(), pendiente: hoyISO() } };
    delete copia.ejemplo;
    const exc = comprobarExceso(copia, state.articulos, state.departamentos, state.config);
    await guardar('articulos', copia);
    toast('Línea duplicada como pendiente. Puede editarla ahora.', 'exito');
    if (exc) toast(textoExceso(exc), 'aviso', 8000);
    pintar();
    editarArticulo(copia.id, { alGuardar: pintar });
  }

  function textoExceso(exc) {
    const base = `el departamento «${exc.departamento.nombre}»`;
    return exc.previoExcedido
      ? `Atención: ${base} ya superaba su presupuesto; con este artículo el exceso sería de ${eur(exc.exceso)} (${eur(exc.consumo)} de ${eur(exc.presupuesto)}, ${pct(exc.porcentaje)}).`
      : `Atención: con este artículo ${base} superaría su presupuesto en ${eur(exc.exceso)} (${eur(exc.consumo)} de ${eur(exc.presupuesto)}, ${pct(exc.porcentaje)}).`;
  }

  /** Formulario modal de alta / edición de un artículo. */
  function editarArticulo(id, { alGuardar, preset } = {}) {
    const existente = id ? porId('articulos', id) : null;
    const a = existente ? { ...existente } : nuevoArticulo(preset || {
      departamentoId: filtros.departamentoId, proveedorId: filtros.proveedorId, centroId: filtros.centroId, categoriaId: filtros.categoriaId,
    });
    const formId = idUnico('form-art');
    const sinMaestros = !state.departamentos.length || !state.proveedores.length;
    const criterio = state.config.presupuesto.base === 'total' ? 'total con IVA' : 'base imponible (sin IVA)';
    const fechas = a.fechas || {};
    const historial = ['creado', 'pedido', 'recibido', 'cancelado'].filter((k) => fechas[k])
      .map((k) => `${k === 'creado' ? 'Creado' : nombreEstado(k)}: ${fmtFecha(fechas[k])}`).join(' · ');

    const { cerrar } = abrirModal({
      titulo: existente ? 'Editar artículo' : 'Nuevo artículo',
      ancho: 'lg',
      contenido: `
        ${sinMaestros ? `<div class="aviso aviso-aviso" style="margin-bottom:14px"><p>Para crear artículos necesita al menos un <a href="#/departamentos">departamento</a> y un <a href="#/proveedores">proveedor</a>. También puede cargar los datos de ejemplo en <a href="#/ajustes">Ajustes</a>.</p></div>` : ''}
        <form id="${formId}" class="form-rejilla form-rejilla-3" novalidate>
          <div class="campo ancho"><label for="a-desc">Descripción <span class="obl" aria-hidden="true">*</span></label>
            <input id="a-desc" name="descripcion" required aria-required="true" value="${esc(a.descripcion)}" autofocus></div>
          <div class="campo"><label for="a-ref">Referencia del proveedor</label><input id="a-ref" name="referencia" value="${esc(a.referencia)}"></div>
          <div class="campo"><label for="a-cat">Categoría</label><select id="a-cat" name="categoriaId">${opciones(ordenAlfa(state.categorias), a.categoriaId, { vacio: '(sin categoría)' })}</select></div>
          <div class="campo"><label for="a-pri">Prioridad</label><select id="a-pri" name="prioridad">${opciones(PRIORIDADES, a.prioridad)}</select></div>
          <div class="campo"><label for="a-cant">Cantidad <span class="obl" aria-hidden="true">*</span></label>
            <input id="a-cant" name="cantidad" type="number" min="0" step="any" inputmode="decimal" required aria-required="true" value="${esc(a.cantidad)}"></div>
          <div class="campo"><label for="a-precio">Precio unitario sin IVA (€) <span class="obl" aria-hidden="true">*</span></label>
            <input id="a-precio" name="precio" type="number" min="0" step="0.0001" inputmode="decimal" required aria-required="true" value="${esc(a.precio)}"></div>
          <div class="campo"><label for="a-iva">% de IVA</label><select id="a-iva" name="iva">${TIPOS_IVA.map((t) => `<option value="${t}"${Number(a.iva) === t ? ' selected' : ''}>${t} %</option>`).join('')}</select></div>
          <div class="calc-linea ancho" aria-live="polite" id="a-calc"></div>
          <div class="campo"><label for="a-prov">Proveedor <span class="obl" aria-hidden="true">*</span></label>
            <select id="a-prov" name="proveedorId" required aria-required="true">${opciones(ordenAlfa(state.proveedores), a.proveedorId, { vacio: 'Seleccione…' })}</select></div>
          <div class="campo"><label for="a-dep">Departamento <span class="obl" aria-hidden="true">*</span></label>
            <select id="a-dep" name="departamentoId" required aria-required="true">${opciones(ordenAlfa(state.departamentos), a.departamentoId, { vacio: 'Seleccione…' })}</select></div>
          <div class="campo"><label for="a-cen">Centro de entrega</label>
            <select id="a-cen" name="centroId">${opciones(ordenAlfa(state.centros), a.centroId, { vacio: '(sin especificar)' })}</select></div>
          <div class="campo"><label for="a-est">Estado</label><select id="a-est" name="estado">${opciones(ESTADOS, a.estado)}</select></div>
          <div class="campo"><label for="a-nped">Nº de pedido</label><input id="a-nped" name="numeroPedido" value="${esc(a.numeroPedido || '')}" aria-describedby="a-nped-ayuda">
            <span class="ayuda" id="a-nped-ayuda">Se asigna automáticamente al generar el Excel del proveedor.</span></div>
          <div class="campo"></div>
          <div class="campo ancho"><label for="a-notas">Notas</label><textarea id="a-notas" name="notas" rows="2">${esc(a.notas || '')}</textarea></div>
          <div class="ancho" id="a-aviso" aria-live="polite"></div>
          ${historial ? `<p class="ancho suave" style="margin:0"><small>${esc(historial)}</small></p>` : ''}
          <p class="ancho suave" style="margin:0"><small>El presupuesto se controla sobre el ${criterio}. <span class="obl" aria-hidden="true">*</span> Campo obligatorio.</small></p>
        </form>`,
      acciones: [
        { texto: 'Cancelar' },
        { texto: existente ? 'Guardar cambios' : 'Crear artículo', clase: 'btn-primario', tipo: 'submit', form: formId },
      ],
    });

    const form = document.getElementById(formId);
    const leer = () => {
      const f = form.elements;
      return {
        ...a,
        descripcion: f.descripcion.value.trim(),
        referencia: f.referencia.value.trim(),
        categoriaId: f.categoriaId.value,
        prioridad: f.prioridad.value,
        cantidad: parseNum(f.cantidad.value),
        precio: parseNum(f.precio.value),
        iva: Number(f.iva.value),
        proveedorId: f.proveedorId.value,
        departamentoId: f.departamentoId.value,
        centroId: f.centroId.value,
        estado: f.estado.value,
        numeroPedido: f.numeroPedido.value.trim(),
        notas: f.notas.value.trim(),
      };
    };
    const actualizar = () => {
      const d = leer();
      const i = importesLinea({ cantidad: Number.isFinite(d.cantidad) ? d.cantidad : 0, precio: Number.isFinite(d.precio) ? d.precio : 0, iva: d.iva });
      $('#a-calc').innerHTML = `<div><span>Base imponible</span><strong>${eur(i.base)}</strong></div>
        <div><span>Cuota de IVA (${d.iva} %)</span><strong>${eur(i.cuota)}</strong></div>
        <div><span>Total con IVA</span><strong>${eur(i.total)}</strong></div>`;
      const exc = Number.isFinite(d.cantidad) && Number.isFinite(d.precio) ? comprobarExceso(d, state.articulos, state.departamentos, state.config) : null;
      $('#a-aviso').innerHTML = exc ? `<div class="aviso aviso-aviso" role="alert"><p>⚠ ${esc(textoExceso(exc))} Puede guardar igualmente.</p></div>` : '';
    };
    form.addEventListener('input', actualizar);
    form.addEventListener('change', actualizar);
    actualizar();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = leer();
      const cant = form.elements.cantidad, precio = form.elements.precio;
      cant.setCustomValidity(Number.isFinite(d.cantidad) && d.cantidad > 0 ? '' : 'Indique una cantidad mayor que cero.');
      precio.setCustomValidity(Number.isFinite(d.precio) && d.precio >= 0 ? '' : 'Indique un precio válido.');
      if (!form.checkValidity()) { form.reportValidity(); return; }
      let final = d;
      if (!existente || existente.estado !== d.estado) final = conEstado({ ...d, estado: existente?.estado }, d.estado, d.estado === 'pendiente' ? '' : d.numeroPedido);
      if (!final.fechas?.creado) final.fechas = { ...(final.fechas || {}), creado: hoyISO() };
      const exc = comprobarExceso(final, state.articulos, state.departamentos, state.config);
      const guardado = await guardar('articulos', final);
      if (existente && existente.estado !== guardado.estado && guardado.estado === 'pendiente') await limpiarPedidos([guardado.id]);
      cerrar(true);
      toast(existente ? 'Artículo actualizado.' : 'Artículo creado.', 'exito');
      if (exc) toast(textoExceso(exc), 'aviso', 9000);
      alGuardar?.(guardado);
    });
  }

  App['articulos'] = { render, salir, limpiarPedidos, textoExceso, editarArticulo };
})();
