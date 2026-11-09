// Pantalla de departamentos: CRUD con resumen de presupuesto.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { state } = App['db'];
  const { esc, eur, pct } = App['format'];
  const { resumenDepartamento, SEMAFORO_TEXTO } = App['models'];
  const { punto, badgeSemaforo } = App['ui'];
  const { crearVistaCrud, contarArticulos } = App['crud'];

  const resumen = (d) => resumenDepartamento(d, state.articulos, state.config);

  const vista = crearVistaCrud({
    store: 'departamentos',
    titulo: 'Departamentos',
    singular: 'departamento',
    articuloNuevo: 'Nuevo',
    descripcion: 'Presupuesto anual y responsable de cada departamento. El consumo incluye artículos pendientes, pedidos y recibidos.',
    campoArticulo: 'departamentoId',
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', obligatorio: true },
      { nombre: 'responsable', etiqueta: 'Responsable' },
      { nombre: 'presupuesto', etiqueta: 'Presupuesto anual (€)', tipo: 'number', obligatorio: true, min: 0, step: '0.01', defecto: 0 },
      { nombre: 'ejercicio', etiqueta: 'Año del ejercicio', tipo: 'number', obligatorio: true, min: 2000, max: 2100, step: '1', defecto: () => new Date().getFullYear() },
      { nombre: 'color', etiqueta: 'Color identificativo', tipo: 'color', defecto: '#2563eb' },
    ],
    columnas: [
      { titulo: 'Departamento', html: (d) => `<span class="celda-flex">${punto(d.color)}<strong>${esc(d.nombre)}</strong></span>` },
      { titulo: 'Responsable', html: (d) => esc(d.responsable || '') , clave: (d) => d.responsable || '' },
      { titulo: 'Ejercicio', html: (d) => esc(d.ejercicio || ''), clave: (d) => Number(d.ejercicio) || 0 },
      { titulo: 'Presupuesto', num: true, html: (d) => eur(d.presupuesto), clave: (d) => Number(d.presupuesto) || 0 },
      { titulo: 'Consumo', num: true, html: (d) => eur(resumen(d).consumo), clave: (d) => resumen(d).consumo },
      { titulo: 'Disponible', num: true, html: (d) => eur(resumen(d).disponible), clave: (d) => resumen(d).disponible },
      { titulo: '% consumido', num: true, html: (d) => { const r = resumen(d); return `${pct(r.porcentaje)}<br>${badgeSemaforo(r.semaforo, SEMAFORO_TEXTO[r.semaforo])}`; }, clave: (d) => { const p = resumen(d).porcentaje; return Number.isFinite(p) ? p : 1e9; } },
      { titulo: 'Artículos', num: true, html: (d) => contarArticulos('departamentoId', d.id), clave: (d) => contarArticulos('departamentoId', d.id) },
    ],
  });

  const render = vista.render;
  const salir = vista.salir;

  App['departamentos'] = { render, salir };
})();
