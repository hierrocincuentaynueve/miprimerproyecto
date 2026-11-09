// Pantalla de proveedores.
import { state } from '../db.js';
import { esc, eur } from '../format.js';
import { importesLinea } from '../models.js';
import { crearVistaCrud, contarArticulos } from './crud.js';

const pendiente = (p) => state.articulos.filter((a) => a.proveedorId === p.id && a.estado === 'pendiente').reduce((s, a) => s + importesLinea(a).total, 0);

const vista = crearVistaCrud({
  store: 'proveedores',
  titulo: 'Proveedores',
  singular: 'proveedor',
  articuloNuevo: 'Nuevo',
  descripcion: 'Datos de contacto y condiciones de pago que aparecen en los pedidos.',
  campoArticulo: 'proveedorId',
  campos: [
    { nombre: 'nombre', etiqueta: 'Nombre o razón social', obligatorio: true },
    { nombre: 'cif', etiqueta: 'CIF / NIF' },
    { nombre: 'contacto', etiqueta: 'Persona de contacto' },
    { nombre: 'email', etiqueta: 'Correo electrónico', tipo: 'email' },
    { nombre: 'telefono', etiqueta: 'Teléfono', tipo: 'tel' },
    { nombre: 'condicionesPago', etiqueta: 'Condiciones de pago', ayuda: 'Ej.: transferencia a 30 días fecha factura' },
    { nombre: 'direccion', etiqueta: 'Dirección', tipo: 'textarea', ancho: true },
  ],
  columnas: [
    { titulo: 'Proveedor', html: (p) => `<strong>${esc(p.nombre)}</strong>${p.cif ? `<br><small class="mono">${esc(p.cif)}</small>` : ''}` },
    { titulo: 'Contacto', html: (p) => `${esc(p.contacto || '')}${p.email ? `<br><a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ''}${p.telefono ? `<br><small>${esc(p.telefono)}</small>` : ''}`, clave: (p) => p.contacto || '' },
    { titulo: 'Condiciones de pago', html: (p) => esc(p.condicionesPago || ''), clave: (p) => p.condicionesPago || '' },
    { titulo: 'Artículos', num: true, html: (p) => contarArticulos('proveedorId', p.id), clave: (p) => contarArticulos('proveedorId', p.id) },
    { titulo: 'Pendiente de pedir (IVA incl.)', num: true, html: (p) => eur(pendiente(p)), clave: pendiente },
  ],
});

export const render = vista.render;
export const salir = vista.salir;
