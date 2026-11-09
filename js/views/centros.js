// Pantalla de centros deportivos (direcciones de entrega).
import { esc } from '../format.js';
import { crearVistaCrud, contarArticulos } from './crud.js';

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

export const render = vista.render;
export const salir = vista.salir;
