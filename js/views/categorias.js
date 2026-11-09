// Pantalla de categorías de artículos.
import { state } from '../db.js';
import { esc, eur } from '../format.js';
import { importesLinea } from '../models.js';
import { crearVistaCrud, contarArticulos } from './crud.js';

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

export const render = vista.render;
export const salir = vista.salir;
