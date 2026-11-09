// Panel de inicio: indicadores, tarjetas de presupuesto por departamento y gráficos.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { state } = App['db'];
  const { esc, eur, pct, collator } = App['format'];
  const { resumenDepartamento, importesLinea, SEMAFORO_TEXTO } = App['models'];
  const { $, punto, badgeSemaforo } = App['ui'];
  const { graficoDepartamentos, graficoBarrasH, destruirGraficos } = App['charts'];
  const { cargarDatosEjemplo } = App['sample'];

  let ejercicio = null;
  let raiz = null;
  const alCambiarTema = () => raiz && pintarGraficos();

  function ejercicios() {
    return [...new Set(state.departamentos.map((d) => Number(d.ejercicio)).filter(Boolean))].sort((a, b) => b - a);
  }

  function datos() {
    const deps = state.departamentos
      .filter((d) => !ejercicio || Number(d.ejercicio) === ejercicio)
      .sort((a, b) => collator.compare(a.nombre, b.nombre));
    const idsDep = new Set(deps.map((d) => d.id));
    const articulos = state.articulos.filter((a) => idsDep.has(a.departamentoId));
    const resumenes = deps.map((d) => ({ dep: d, r: resumenDepartamento(d, articulos, state.config) }));
    return { deps, articulos, resumenes };
  }

  function render(main) {
    raiz = main;
    const anios = ejercicios();
    if (ejercicio === null || (anios.length && !anios.includes(ejercicio))) {
      const actual = new Date().getFullYear();
      ejercicio = anios.includes(actual) ? actual : anios[0] || null;
    }
    if (!state.departamentos.length) {
      main.innerHTML = `<div class="cab-vista"><div><h1>Panel</h1><p>Resumen del presupuesto y del gasto en material.</p></div></div>
        <div class="tarjeta vacio-grande"><h2>Empiece por crear sus departamentos</h2>
        <p>Cree los departamentos con su presupuesto anual, los centros, los proveedores y después los artículos a comprar.<br>
        Si prefiere ver la aplicación funcionando, cargue los datos de ejemplo (podrá borrarlos después desde Ajustes).</p>
        <div class="acciones"><button type="button" class="btn btn-primario" id="btn-ejemplo">Cargar datos de ejemplo</button>
        <a class="btn btn-secundario" href="#/departamentos">Crear departamentos</a>
        <a class="btn btn-secundario" href="#/importar">Importar desde Excel</a></div></div>`;
      $('#btn-ejemplo', main).addEventListener('click', async (e) => {
        e.target.disabled = true;
        await cargarDatosEjemplo();
        render(main);
      });
      return;
    }

    const { resumenes, articulos } = datos();
    const tot = resumenes.reduce((t, { r }) => {
      for (const k of ['presupuesto', 'previsto', 'comprometido', 'ejecutado', 'consumo', 'disponible']) t[k] += r[k];
      t.conIva += r.conIva.consumo;
      return t;
    }, { presupuesto: 0, previsto: 0, comprometido: 0, ejecutado: 0, consumo: 0, disponible: 0, conIva: 0 });
    const pctTotal = tot.presupuesto ? (tot.consumo / tot.presupuesto) * 100 : 0;
    const criterio = state.config.presupuesto.base === 'total' ? 'con IVA' : 'sin IVA';
    const enRojo = resumenes.filter(({ r }) => r.semaforo === 'rojo').length;
    const enAmbar = resumenes.filter(({ r }) => r.semaforo === 'ambar').length;
    const pendientesPedir = articulos.filter((a) => a.estado === 'pendiente').length;

    main.innerHTML = `
      <div class="cab-vista">
        <div><h1>Panel</h1><p>Importes de presupuesto calculados ${criterio === 'sin IVA' ? 'sobre la base imponible (sin IVA)' : 'sobre el total con IVA'}. Los artículos cancelados no computan.</p></div>
        <div class="acciones">
          ${anios.length > 1 ? `<label for="sel-ejercicio">Ejercicio</label><select id="sel-ejercicio" style="width:auto">${anios.map((a) => `<option ${a === ejercicio ? 'selected' : ''}>${a}</option>`).join('')}</select>` : `<span class="suave">Ejercicio ${ejercicio ?? ''}</span>`}
          <a class="btn btn-secundario" href="#/imprimir/presupuesto${ejercicio ? '?ejercicio=' + ejercicio : ''}">Informe imprimible</a>
        </div>
      </div>
      <section class="rejilla rejilla-kpi" aria-label="Totales generales">
        <div class="tarjeta kpi"><div class="etq">Presupuesto total</div><div class="valor">${eur(tot.presupuesto)}</div><div class="sub">${resumenes.length} departamentos</div></div>
        <div class="tarjeta kpi"><div class="etq">Consumo total</div><div class="valor">${eur(tot.consumo)}</div><div class="sub">${pct(pctTotal)} del presupuesto · ${eur(tot.conIva)} con IVA</div></div>
        <div class="tarjeta kpi"><div class="etq">Disponible</div><div class="valor" style="color:${tot.disponible < 0 ? 'var(--sem-rojo)' : 'inherit'}">${eur(tot.disponible)}</div><div class="sub">${enRojo} en rojo · ${enAmbar} en ámbar</div></div>
        <div class="tarjeta kpi"><div class="etq">Previsto (pendiente)</div><div class="valor">${eur(tot.previsto)}</div><div class="sub"><a href="#/pedidos">${pendientesPedir} líneas por pedir</a></div></div>
        <div class="tarjeta kpi"><div class="etq">Comprometido (pedido)</div><div class="valor">${eur(tot.comprometido)}</div><div class="sub">Pendiente de recibir</div></div>
        <div class="tarjeta kpi"><div class="etq">Ejecutado (recibido)</div><div class="valor">${eur(tot.ejecutado)}</div><div class="sub">Material ya entregado</div></div>
      </section>
      <h2>Presupuesto por departamento</h2>
      <section class="rejilla rejilla-dep" aria-label="Departamentos">
        ${resumenes.map(({ dep, r }) => tarjetaDepartamento(dep, r)).join('')}
      </section>
      <h2>Gráficos</h2>
      <section class="rejilla rejilla-graf">
        <div class="tarjeta"><h3>Gasto por departamento frente a presupuesto</h3>
          <div class="graf-cont alto"><canvas id="g-dep" role="img" aria-label="Gráfico de barras: presupuesto y consumo por departamento"></canvas></div>
          ${tablaDatos(['Departamento', 'Presupuesto', 'Ejecutado', 'Comprometido', 'Previsto'], resumenes.map(({ dep, r }) => [dep.nombre, r.presupuesto, r.ejecutado, r.comprometido, r.previsto]))}</div>
        <div class="tarjeta"><h3>Gasto por proveedor</h3>
          <div class="graf-cont alto"><canvas id="g-prov" role="img" aria-label="Gráfico de barras: gasto por proveedor"></canvas></div><div id="t-prov"></div></div>
        <div class="tarjeta"><h3>Gasto por categoría</h3>
          <div class="graf-cont alto"><canvas id="g-cat" role="img" aria-label="Gráfico de barras: gasto por categoría"></canvas></div><div id="t-cat"></div></div>
      </section>
      ${globalThis.Chart ? '' : '<p class="aviso aviso-aviso">No se ha podido cargar Chart.js (vendor/chart-4.4.1.umd.js); los gráficos no están disponibles, pero puede consultar los datos en las tablas.</p>'}`;

    $('#sel-ejercicio', main)?.addEventListener('change', (e) => { ejercicio = Number(e.target.value); render(main); });
    window.addEventListener('cambio-tema', alCambiarTema);
    pintarGraficos();
  }

  function salir() {
    destruirGraficos();
    window.removeEventListener('cambio-tema', alCambiarTema);
    raiz = null;
  }

  function tarjetaDepartamento(dep, r) {
    const ancho = (v) => (r.presupuesto > 0 ? Math.min(100, (v / Math.max(r.presupuesto, r.consumo)) * 100) : r.consumo > 0 ? (v / r.consumo) * 100 : 0);
    return `<article class="tarjeta dep-card" style="--c:${esc(dep.color || '#2563eb')}" aria-labelledby="dep-${esc(dep.id)}">
      <h3 id="dep-${esc(dep.id)}"><span class="celda-flex">${punto(dep.color)}${esc(dep.nombre)}</span>${badgeSemaforo(r.semaforo, r.presupuesto > 0 ? pct(r.porcentaje, 0) : 'Sin presupuesto')}</h3>
      <div class="resp">${esc(dep.responsable || 'Sin responsable')} · ${r.lineas} líneas · <span class="semaforo-${r.semaforo}">${SEMAFORO_TEXTO[r.semaforo]}</span></div>
      <div class="barra" role="progressbar" aria-label="Consumo del presupuesto de ${esc(dep.nombre)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Number.isFinite(r.porcentaje) ? r.porcentaje : 100)}" aria-valuetext="${pct(r.porcentaje)} consumido">
        <span class="ejecutado" style="width:${ancho(r.ejecutado)}%"></span><span class="comprometido" style="width:${ancho(r.comprometido)}%"></span><span class="previsto" style="width:${ancho(r.previsto)}%"></span>
      </div>
      <div class="leyenda-barra" aria-hidden="true"><span><i style="background:var(--estado-recibido)"></i>Ejecutado</span><span><i style="background:var(--estado-pedido)"></i>Comprometido</span><span><i style="background:var(--borde-fuerte)"></i>Previsto</span></div>
      <dl>
        <dt>Presupuesto anual</dt><dd>${eur(r.presupuesto)}</dd>
        <dt>Previsto (pendiente)</dt><dd>${eur(r.previsto)}</dd>
        <dt>Comprometido (pedido)</dt><dd>${eur(r.comprometido)}</dd>
        <dt>Ejecutado (recibido)</dt><dd>${eur(r.ejecutado)}</dd>
        <dt class="fuerte">Consumo total</dt><dd class="fuerte">${eur(r.consumo)}</dd>
        <dt class="fuerte">Disponible</dt><dd class="fuerte" style="color:${r.disponible < 0 ? 'var(--sem-rojo)' : 'inherit'}">${eur(r.disponible)}</dd>
      </dl>
      <div class="iva-info">${state.config.presupuesto.base === 'total'
        ? `Sin IVA: ${eur(r.sinIva.consumo)}`
        : `Con IVA (informativo): ${eur(r.conIva.consumo)}`} · <a href="#/articulos?departamentoId=${encodeURIComponent(dep.id)}">Ver artículos</a></div>
    </article>`;
  }

  function tablaDatos(cabeceras, filas) {
    return `<details><summary>Ver datos en tabla</summary><div class="tabla-cont" style="margin-top:8px"><table>
      <thead><tr>${cabeceras.map((c, i) => `<th scope="col" class="${i ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map((f) => `<tr>${f.map((v, i) => (i ? `<td class="num">${eur(v)}</td>` : `<th scope="row">${esc(v)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div></details>`;
  }

  function agrupar(articulos, campo, store) {
    const m = new Map();
    const total = state.config.presupuesto.base === 'total';
    for (const a of articulos) {
      if (a.estado === 'cancelado') continue;
      const i = importesLinea(a);
      m.set(a[campo] || '', (m.get(a[campo] || '') || 0) + (total ? i.total : i.base));
    }
    return [...m.entries()]
      .map(([id, v]) => ({ nombre: state[store].find((x) => x.id === id)?.nombre || '(sin asignar)', valor: Math.round(v * 100) / 100 }))
      .sort((a, b) => b.valor - a.valor);
  }

  function pintarGraficos() {
    if (!raiz) return;
    destruirGraficos();
    const { resumenes, articulos } = datos();
    const serie = state.config.presupuesto.base === 'total' ? 'Importe con IVA' : 'Base imponible';
    graficoDepartamentos($('#g-dep', raiz), resumenes.map(({ dep, r }) => ({ nombre: dep.nombre, ...r })));
    const prov = agrupar(articulos, 'proveedorId', 'proveedores');
    const cat = agrupar(articulos, 'categoriaId', 'categorias');
    graficoBarrasH($('#g-prov', raiz), prov.map((p) => p.nombre), prov.map((p) => p.valor), serie);
    graficoBarrasH($('#g-cat', raiz), cat.map((p) => p.nombre), cat.map((p) => p.valor), serie);
    $('#t-prov', raiz).innerHTML = tablaDatos(['Proveedor', serie], prov.map((p) => [p.nombre, p.valor]));
    $('#t-cat', raiz).innerHTML = tablaDatos(['Categoría', serie], cat.map((p) => [p.nombre, p.valor]));
  }

  App['panel'] = { render, salir };
})();
