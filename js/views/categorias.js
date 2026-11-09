// Pantalla de categorías de artículos.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { state } = App['db'];
  const { esc, eur } = App['format'];
  const { importesLinea } = App['models'];
  const { crearVistaCrud, contarArticulos } = App['crud'];

  const importe = (c) => state.articulos.filter((a) => a.categoriaId === c.id && a.estado !== 'cancelado').reduce((s, a) => s + importesLinea(a).base, 0);

  const vista = crearVistaCrud({
    store: 'categorias',
    titulo: 'Categorías',
    singular: 'categoría',
    articuloNuevo: 'Nueva',
    descripcion: 'Lista editable de categorías para clasificar los artículos.',
    campoArticulo: 'categoriaId',
    reasignacionOpcional: true,
    campos: [{ nombre: 'nombre', etiqueta: 'Nombre de la categoría', obligatorio: true }],
    columnas: [
      { titulo: 'Categoría', html: (c) => `<strong>${esc(c.nombre)}</strong>` },
      { titulo: 'Artículos', num: true, html: (c) => contarArticulos('categoriaId', c.id), clave: (c) => contarArticulos('categoriaId', c.id) },
      { titulo: 'Importe (base, sin cancelados)', num: true, html: (c) => eur(importe(c)), clave: importe },
    ],
  });

  const render = vista.render;
  const salir = vista.salir;

  App['categorias'] = { render, salir };
})();
