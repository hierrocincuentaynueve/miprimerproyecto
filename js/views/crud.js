// Generador de pantallas CRUD sencillas (departamentos, proveedores, centros, categorías).
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { state, guardar, guardarVarios, borrar } = App['db'];
  const { esc, normalizar, collator, parseNum } = App['format'];
  const { abrirModal, confirmar, toast, idUnico, opciones, datosFormulario, $ } = App['ui'];

  /**
   * cfg: {
   *   store, titulo, singular, articuloNuevo ('Nuevo'|'Nueva'), descripcion,
   *   campos: [{ nombre, etiqueta, tipo, obligatorio, ancho, ayuda, defecto, min, step, max }],
   *   columnas: [{ titulo, html(x), num, clave(x) }],
   *   campoArticulo, reasignacionOpcional, antesDeTabla(x) -> html, tras(main) -> void
   * }
   */
  function crearVistaCrud(cfg) {
    let busqueda = '';
    let orden = { col: 0, dir: 1 };
    let raiz = null;

    const articulosDe = (id) => state.articulos.filter((a) => a[cfg.campoArticulo] === id);

    function render(main) {
      raiz = main;
      main.innerHTML = `
        <div class="cab-vista">
          <div><h1>${esc(cfg.titulo)}</h1><p>${esc(cfg.descripcion || '')}</p></div>
          <div class="acciones"><button type="button" class="btn btn-primario" data-accion="nuevo">+ ${esc(cfg.articuloNuevo)} ${esc(cfg.singular)}</button></div>
        </div>
        ${cfg.antesDeTabla ? `<div data-antes></div>` : ''}
        <div class="filtros" style="grid-template-columns:minmax(220px,360px)">
          <div class="campo campo-busqueda"><label for="crud-buscar">Buscar</label>
            <input type="search" id="crud-buscar" placeholder="Escriba para filtrar…" value="${esc(busqueda)}"></div>
        </div>
        <div class="tabla-cont"><table>
          <caption class="oculto-visual">${esc(cfg.titulo)}</caption>
          <thead><tr></tr></thead><tbody></tbody></table></div>`;
      $('[data-accion="nuevo"]', main).addEventListener('click', () => editar(null));
      $('#crud-buscar', main).addEventListener('input', (e) => { busqueda = e.target.value; pintarTabla(); });
      pintarTabla();
    }

    function pintarTabla() {
      if (!raiz) return;
      const antes = $('[data-antes]', raiz);
      if (antes) antes.innerHTML = cfg.antesDeTabla();
      const thead = $('thead tr', raiz);
      thead.innerHTML = cfg.columnas.map((c, i) => {
        const sort = orden.col === i ? (orden.dir > 0 ? 'ascending' : 'descending') : 'none';
        const flecha = orden.col === i ? (orden.dir > 0 ? '▲' : '▼') : '↕';
        return `<th scope="col" class="${c.num ? 'num' : ''}" aria-sort="${sort}"><button type="button" class="ordenar" data-col="${i}">${esc(c.titulo)} <span class="flecha" aria-hidden="true">${flecha}</span></button></th>`;
      }).join('') + '<th scope="col" class="num">Acciones</th>';
      thead.querySelectorAll('.ordenar').forEach((b) => b.addEventListener('click', () => {
        const col = Number(b.dataset.col);
        orden = { col, dir: orden.col === col ? -orden.dir : 1 };
        pintarTabla();
        $(`.ordenar[data-col="${col}"]`, raiz)?.focus();
      }));

      const q = normalizar(busqueda);
      const col = cfg.columnas[orden.col];
      const filas = state[cfg.store]
        .filter((x) => !q || cfg.campos.some((c) => normalizar(x[c.nombre]).includes(q)))
        .sort((a, b) => {
          const va = col.clave ? col.clave(a) : a.nombre;
          const vb = col.clave ? col.clave(b) : b.nombre;
          const r = typeof va === 'number' && typeof vb === 'number' ? va - vb : collator.compare(String(va ?? ''), String(vb ?? ''));
          return r * orden.dir;
        });
      const tbody = $('tbody', raiz);
      if (!filas.length) {
        tbody.innerHTML = `<tr><td class="vacio" colspan="${cfg.columnas.length + 1}">${state[cfg.store].length ? 'Ningún resultado coincide con la búsqueda.' : `Todavía no hay ${esc(cfg.titulo.toLowerCase())}. Use el botón «${esc(cfg.articuloNuevo)} ${esc(cfg.singular)}» o cargue los datos de ejemplo desde Ajustes.`}</td></tr>`;
        return;
      }
      tbody.innerHTML = filas.map((x) => `<tr>
        ${cfg.columnas.map((c) => `<td class="${c.num ? 'num' : ''}">${c.html(x)}</td>`).join('')}
        <td class="acc">
          <button type="button" class="btn btn-texto btn-peq" data-editar="${esc(x.id)}" aria-label="Editar ${esc(x.nombre)}">Editar</button>
          <button type="button" class="btn btn-texto btn-peq" data-borrar="${esc(x.id)}" aria-label="Borrar ${esc(x.nombre)}">Borrar</button>
        </td></tr>`).join('');
      tbody.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => editar(b.dataset.editar)));
      tbody.querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', () => eliminar(b.dataset.borrar)));
    }

    function campoHtml(c, valor) {
      const id = `f-${cfg.store}-${c.nombre}`;
      const req = c.obligatorio ? ' required aria-required="true"' : '';
      const ayudaId = c.ayuda ? `${id}-ayuda` : '';
      const desc = ayudaId ? ` aria-describedby="${ayudaId}"` : '';
      let control;
      if (c.tipo === 'textarea') {
        control = `<textarea id="${id}" name="${c.nombre}" rows="3"${req}${desc}>${esc(valor ?? '')}</textarea>`;
      } else {
        const extra = [c.min !== undefined ? `min="${c.min}"` : '', c.max !== undefined ? `max="${c.max}"` : '', c.step ? `step="${c.step}"` : '', c.tipo === 'number' ? 'inputmode="decimal"' : ''].join(' ');
        control = `<input id="${id}" name="${c.nombre}" type="${c.tipo || 'text'}" value="${esc(valor ?? '')}"${req}${desc} ${extra}>`;
      }
      return `<div class="campo${c.ancho ? ' ancho' : ''}">
        <label for="${id}">${esc(c.etiqueta)}${c.obligatorio ? ' <span class="obl" aria-hidden="true">*</span>' : ''}</label>
        ${control}
        ${c.ayuda ? `<span class="ayuda" id="${ayudaId}">${esc(c.ayuda)}</span>` : ''}
      </div>`;
    }

    function editar(id) {
      const existente = id ? state[cfg.store].find((x) => x.id === id) : null;
      const formId = idUnico('form');
      const valores = existente || Object.fromEntries(cfg.campos.map((c) => [c.nombre, typeof c.defecto === 'function' ? c.defecto() : c.defecto ?? '']));
      const { cerrar } = abrirModal({
        titulo: existente ? `Editar ${cfg.singular}` : `${cfg.articuloNuevo} ${cfg.singular}`,
        ancho: cfg.campos.length > 4 ? 'lg' : 'md',
        contenido: `<form id="${formId}" class="form-rejilla" novalidate>${cfg.campos.map((c) => campoHtml(c, valores[c.nombre])).join('')}
          <p class="ancho suave" style="margin:0"><span class="obl" aria-hidden="true">*</span> Campo obligatorio</p></form>`,
        acciones: [
          { texto: 'Cancelar' },
          { texto: 'Guardar', clase: 'btn-primario', tipo: 'submit', form: formId },
        ],
      });
      const form = document.getElementById(formId);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const datos = datosFormulario(form);
        for (const c of cfg.campos) if (c.tipo === 'number') datos[c.nombre] = datos[c.nombre] === '' ? null : parseNum(datos[c.nombre]);
        const dup = state[cfg.store].find((x) => x.id !== id && normalizar(x.nombre) === normalizar(datos.nombre) && (cfg.store !== 'departamentos' || Number(x.ejercicio) === Number(datos.ejercicio)));
        if (dup) {
          const inp = form.elements.nombre;
          inp.setCustomValidity(`Ya existe ${cfg.articuloNuevo === 'Nueva' ? 'una' : 'un'} ${cfg.singular} con ese nombre.`);
          inp.reportValidity();
          inp.addEventListener('input', () => inp.setCustomValidity(''), { once: true });
          return;
        }
        const obj = { ...(existente || {}), ...datos };
        await guardar(cfg.store, obj);
        cerrar(true);
        toast(`${cfg.singular[0].toUpperCase() + cfg.singular.slice(1)} guardad${cfg.articuloNuevo === 'Nueva' ? 'a' : 'o'}.`, 'exito');
        pintarTabla();
      });
    }

    async function eliminar(id) {
      const x = state[cfg.store].find((y) => y.id === id);
      if (!x) return;
      const asociados = articulosDe(id);
      const pedidosAsoc = cfg.store === 'proveedores' ? state.pedidos.filter((p) => p.proveedorId === id) : [];
      if (!asociados.length && !pedidosAsoc.length) {
        if (await confirmar(`¿Borrar «${x.nombre}»? Esta acción no se puede deshacer.`, { titulo: `Borrar ${cfg.singular}`, ok: 'Borrar', peligro: true })) {
          await borrar(cfg.store, id);
          toast(`«${x.nombre}» borrado.`, 'exito');
          pintarTabla();
        }
        return;
      }
      const otros = state[cfg.store].filter((y) => y.id !== id).sort((a, b) => collator.compare(a.nombre, b.nombre));
      if (!otros.length && !cfg.reasignacionOpcional) {
        return abrirModal({
          titulo: `No se puede borrar «${x.nombre}»`, ancho: 'sm',
          contenido: `<p>Tiene ${asociados.length} artículo(s) asociado(s). Para borrarlo primero debe crear otro ${esc(cfg.singular)} al que reasignarlos.</p>`,
          acciones: [{ texto: 'Entendido', clase: 'btn-primario' }],
        });
      }
      const formId = idUnico('form');
      const selId = idUnico('sel');
      const { cerrar } = abrirModal({
        titulo: `Reasignar antes de borrar «${x.nombre}»`,
        contenido: `<form id="${formId}">
          <p>«${esc(x.nombre)}» tiene <strong>${asociados.length} artículo(s)</strong>${pedidosAsoc.length ? ` y <strong>${pedidosAsoc.length} pedido(s)</strong>` : ''} asociados.
          Para poder borrarlo, elija a qué ${esc(cfg.singular)} se reasignan.</p>
          <div class="campo"><label for="${selId}">Reasignar a</label>
          <select id="${selId}" name="destino" ${cfg.reasignacionOpcional ? '' : 'required'}>${opciones(otros, '', { vacio: cfg.reasignacionOpcional ? `(sin ${cfg.singular})` : 'Seleccione…' })}</select></div>
        </form>`,
        acciones: [
          { texto: 'Cancelar' },
          { texto: 'Reasignar y borrar', clase: 'btn-peligro', tipo: 'submit', form: formId },
        ],
      });
      const form = document.getElementById(formId);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const destino = form.elements.destino.value;
        await guardarVarios('articulos', asociados.map((a) => ({ ...a, [cfg.campoArticulo]: destino })));
        if (pedidosAsoc.length) await guardarVarios('pedidos', pedidosAsoc.map((p) => ({ ...p, proveedorId: destino })));
        await borrar(cfg.store, id);
        cerrar(true);
        toast(`Artículos reasignados y «${x.nombre}» borrado.`, 'exito');
        pintarTabla();
      });
    }

    return {
      render,
      salir() { raiz = null; },
    };
  }

  const contarArticulos = (campo, id) => state.articulos.filter((a) => a[campo] === id).length;

  App['crud'] = { crearVistaCrud, contarArticulos };
})();
