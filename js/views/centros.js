// Pantalla de centros deportivos (direcciones de entrega).
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { esc } = App['format'];
  const { crearVistaCrud, contarArticulos } = App['crud'];

  const vista = crearVistaCrud({
    store: 'centros',
    titulo: 'Centros',
    singular: 'centro',
    articuloNuevo: 'Nuevo',
    descripcion: 'Centros deportivos a los que se entrega el material. Su dirección aparece en los pedidos.',
    campoArticulo: 'centroId',
    reasignacionOpcional: true,
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre del centro', obligatorio: true },
      { nombre: 'direccion', etiqueta: 'Dirección de entrega', tipo: 'textarea', ancho: true, obligatorio: true, ayuda: 'Incluya calle, código postal, población y, si procede, horario de recepción de mercancía.' },
    ],
    columnas: [
      { titulo: 'Centro', html: (c) => `<strong>${esc(c.nombre)}</strong>` },
      { titulo: 'Dirección de entrega', html: (c) => esc(c.direccion || '').replace(/\n/g, '<br>'), clave: (c) => c.direccion || '' },
      { titulo: 'Artículos', num: true, html: (c) => contarArticulos('centroId', c.id), clave: (c) => contarArticulos('centroId', c.id) },
    ],
  });

  const render = vista.render;
  const salir = vista.salir;

  App['centros'] = { render, salir };
})();
