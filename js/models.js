// Cálculos de importes, IVA, presupuesto y numeración de pedidos (funciones puras).
import { round2, num, hoyISO } from './format.js';

export const ESTADOS = [
  { id: 'pendiente', nombre: 'Pendiente' },
  { id: 'pedido', nombre: 'Pedido' },
  { id: 'recibido', nombre: 'Recibido' },
  { id: 'cancelado', nombre: 'Cancelado' },
];
export const PRIORIDADES = [
  { id: 'alta', nombre: 'Alta' },
  { id: 'media', nombre: 'Media' },
  { id: 'baja', nombre: 'Baja' },
];
export const TIPOS_IVA = [21, 10, 4, 0];
export const nombreEstado = (id) => ESTADOS.find((e) => e.id === id)?.nombre || id || '';
export const nombrePrioridad = (id) => PRIORIDADES.find((e) => e.id === id)?.nombre || id || '';

export const SEMAFORO_TEXTO = {
  verde: 'Dentro de presupuesto',
  ambar: 'Cerca del límite',
  rojo: 'Presupuesto superado',
};

/** Importes de una línea: base imponible, cuota de IVA y total (redondeados a céntimos). */
export function importesLinea(a) {
  const base = round2(num(a.cantidad) * num(a.precio));
  const cuota = round2((base * num(a.iva)) / 100);
  return { base, cuota, total: round2(base + cuota) };
}

/** Importe que computa para el presupuesto según el criterio configurado. */
export function importeControl(a, cfg) {
  const i = importesLinea(a);
  return cfg?.presupuesto?.base === 'total' ? i.total : i.base;
}

export function semaforo(porcentaje, cfg) {
  const { ambar = 80, rojo = 100 } = cfg?.presupuesto || {};
  if (porcentaje > rojo) return 'rojo';
  if (porcentaje >= ambar) return 'ambar';
  return 'verde';
}

/** Resumen de consumo presupuestario de un departamento. Los cancelados no computan. */
export function resumenDepartamento(dep, articulos, cfg) {
  const r = {
    presupuesto: num(dep.presupuesto),
    previsto: 0,
    comprometido: 0,
    ejecutado: 0,
    conIva: { previsto: 0, comprometido: 0, ejecutado: 0, consumo: 0 },
    sinIva: { previsto: 0, comprometido: 0, ejecutado: 0, consumo: 0 },
    lineas: 0,
  };
  const clave = { pendiente: 'previsto', pedido: 'comprometido', recibido: 'ejecutado' };
  for (const a of articulos) {
    if (a.departamentoId !== dep.id) continue;
    const k = clave[a.estado];
    if (!k) continue;
    const i = importesLinea(a);
    r[k] += cfg?.presupuesto?.base === 'total' ? i.total : i.base;
    r.conIva[k] += i.total;
    r.sinIva[k] += i.base;
    r.lineas++;
  }
  for (const k of ['previsto', 'comprometido', 'ejecutado']) {
    r[k] = round2(r[k]);
    r.conIva[k] = round2(r.conIva[k]);
    r.sinIva[k] = round2(r.sinIva[k]);
  }
  r.consumo = round2(r.previsto + r.comprometido + r.ejecutado);
  r.conIva.consumo = round2(r.conIva.previsto + r.conIva.comprometido + r.conIva.ejecutado);
  r.sinIva.consumo = round2(r.sinIva.previsto + r.sinIva.comprometido + r.sinIva.ejecutado);
  r.disponible = round2(r.presupuesto - r.consumo);
  r.porcentaje = r.presupuesto > 0 ? (r.consumo / r.presupuesto) * 100 : r.consumo > 0 ? Infinity : 0;
  r.semaforo = semaforo(r.porcentaje, cfg);
  return r;
}

/**
 * Comprueba si guardar `articulo` haría superar el presupuesto de su departamento.
 * Devuelve null si no hay exceso, o { exceso, consumo, presupuesto, previoExcedido }.
 */
export function comprobarExceso(articulo, articulos, departamentos, cfg) {
  if (!articulo || articulo.estado === 'cancelado') return null;
  const dep = departamentos.find((d) => d.id === articulo.departamentoId);
  if (!dep) return null;
  const otros = articulos.filter((x) => x.id !== articulo.id);
  const despues = resumenDepartamento(dep, [...otros, articulo], cfg);
  if (despues.consumo <= despues.presupuesto) return null;
  const antes = resumenDepartamento(dep, otros, cfg);
  return {
    departamento: dep,
    exceso: round2(despues.consumo - despues.presupuesto),
    consumo: despues.consumo,
    presupuesto: despues.presupuesto,
    porcentaje: despues.porcentaje,
    previoExcedido: antes.consumo > antes.presupuesto,
  };
}

/** Totales de un conjunto de líneas con desglose de IVA por tipo. */
export function totalesLineas(lineas) {
  const porTipo = new Map();
  let base = 0, cuota = 0, total = 0;
  for (const a of lineas) {
    const i = importesLinea(a);
    base += i.base; cuota += i.cuota; total += i.total;
    const t = num(a.iva);
    const p = porTipo.get(t) || { iva: t, base: 0, cuota: 0 };
    p.base += i.base; p.cuota += i.cuota;
    porTipo.set(t, p);
  }
  return {
    base: round2(base),
    cuota: round2(cuota),
    total: round2(total),
    porTipo: [...porTipo.values()]
      .map((p) => ({ iva: p.iva, base: round2(p.base), cuota: round2(p.cuota) }))
      .sort((a, b) => b.iva - a.iva),
  };
}

/** Aplica el formato de número de pedido: {AAAA}, {AA} y {N…} (relleno con ceros según el nº de N). */
export function formatearNumeroPedido(formato, n, fecha = new Date()) {
  const y = fecha.getFullYear();
  return String(formato || 'PED-{AAAA}-{NNN}')
    .replace(/\{AAAA\}/g, String(y))
    .replace(/\{AA\}/g, String(y).slice(-2))
    .replace(/\{(N+)\}/g, (_, ns) => String(n).padStart(ns.length, '0'));
}

/** Siguiente número de pedido teniendo en cuenta el reinicio anual. No modifica la configuración. */
export function siguienteNumeroPedido(cfgPedido, fecha = new Date()) {
  const y = fecha.getFullYear();
  let n = Math.max(1, parseInt(cfgPedido.siguiente, 10) || 1);
  if (cfgPedido.reinicioAnual && cfgPedido.anio && cfgPedido.anio !== y) n = 1;
  return { n, anio: y, numero: formatearNumeroPedido(cfgPedido.formato, n, fecha) };
}

/** Devuelve una copia del artículo con el nuevo estado y la fecha del cambio registrada. */
export function conEstado(a, estado, numeroPedido) {
  const c = { ...a, fechas: { ...(a.fechas || {}) } };
  if (c.estado === estado && numeroPedido === undefined) return c;
  c.estado = estado;
  c.fechas[estado] = hoyISO();
  if (numeroPedido !== undefined) c.numeroPedido = numeroPedido;
  if (estado === 'pedido' && a.estado === 'recibido') {
    // Deshacer una recepción: se conserva la fecha original del pedido
    delete c.fechas.recibido;
    if (a.fechas?.pedido) c.fechas.pedido = a.fechas.pedido;
  }
  if (estado === 'pendiente') {
    c.numeroPedido = '';
    delete c.fechas.pedido;
    delete c.fechas.recibido;
  }
  return c;
}

export function nuevoArticulo(parcial = {}) {
  return {
    id: undefined,
    descripcion: '',
    referencia: '',
    categoriaId: '',
    cantidad: 1,
    precio: 0,
    iva: 21,
    proveedorId: '',
    departamentoId: '',
    centroId: '',
    prioridad: 'media',
    notas: '',
    estado: 'pendiente',
    numeroPedido: '',
    fechas: { creado: hoyISO(), pendiente: hoyISO() },
    ...parcial,
  };
}
