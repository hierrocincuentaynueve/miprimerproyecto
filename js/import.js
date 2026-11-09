// Importación de artículos, departamentos y proveedores desde .xlsx o .csv con mapeo de columnas.
import { state, guardarVarios } from './db.js';
import { normalizar, parseNum, fmtFecha, uid, hoyISO } from './format.js';
import { TIPOS_IVA, ESTADOS, PRIORIDADES } from './models.js';

const COLORES = ['#2563eb', '#d97706', '#059669', '#db2777', '#7c3aed', '#0891b2', '#65a30d', '#dc2626'];

export const ESQUEMAS = {
  articulos: {
    nombre: 'Artículos',
    campos: [
      { clave: 'descripcion', etiqueta: 'Descripción', obligatorio: true, alias: ['descripcion', 'articulo', 'producto', 'concepto', 'material', 'nombre'] },
      { clave: 'referencia', etiqueta: 'Referencia proveedor', alias: ['referencia', 'ref', 'codigo', 'referencia proveedor', 'cod'] },
      { clave: 'categoria', etiqueta: 'Categoría', alias: ['categoria', 'familia', 'tipo'] },
      { clave: 'cantidad', etiqueta: 'Cantidad', obligatorio: true, alias: ['cantidad', 'unidades', 'uds', 'cant', 'ud'] },
      { clave: 'precio', etiqueta: 'Precio unitario sin IVA', obligatorio: true, alias: ['precio unitario sin iva', 'precio', 'precio unitario', 'precio sin iva', 'importe unitario', 'pu'] },
      { clave: 'iva', etiqueta: '% IVA', alias: ['% iva', 'iva', 'tipo iva', 'iva %', 'porcentaje iva'] },
      { clave: 'proveedor', etiqueta: 'Proveedor', obligatorio: true, alias: ['proveedor', 'suministrador'] },
      { clave: 'departamento', etiqueta: 'Departamento', obligatorio: true, alias: ['departamento', 'dpto', 'depto', 'area'] },
      { clave: 'centro', etiqueta: 'Centro de entrega', alias: ['centro de entrega', 'centro', 'destino', 'instalacion'] },
      { clave: 'prioridad', etiqueta: 'Prioridad', alias: ['prioridad', 'urgencia'] },
      { clave: 'estado', etiqueta: 'Estado', alias: ['estado', 'situacion'] },
      { clave: 'notas', etiqueta: 'Notas', alias: ['notas', 'observaciones', 'comentarios', 'nota'] },
    ],
  },
  departamentos: {
    nombre: 'Departamentos',
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', obligatorio: true, alias: ['nombre', 'departamento', 'dpto'] },
      { clave: 'responsable', etiqueta: 'Responsable', alias: ['responsable', 'jefe', 'director'] },
      { clave: 'presupuesto', etiqueta: 'Presupuesto anual', obligatorio: true, alias: ['presupuesto anual', 'presupuesto', 'importe'] },
      { clave: 'ejercicio', etiqueta: 'Año del ejercicio', alias: ['ano del ejercicio', 'ejercicio', 'ano', 'anio'] },
      { clave: 'color', etiqueta: 'Color', alias: ['color'] },
    ],
  },
  proveedores: {
    nombre: 'Proveedores',
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', obligatorio: true, alias: ['nombre', 'proveedor', 'razon social'] },
      { clave: 'cif', etiqueta: 'CIF', alias: ['cif', 'nif', 'cif/nif'] },
      { clave: 'contacto', etiqueta: 'Persona de contacto', alias: ['persona de contacto', 'contacto'] },
      { clave: 'email', etiqueta: 'Email', alias: ['email', 'correo', 'correo electronico', 'e-mail'] },
      { clave: 'telefono', etiqueta: 'Teléfono', alias: ['telefono', 'tlf', 'tel', 'movil'] },
      { clave: 'direccion', etiqueta: 'Dirección', alias: ['direccion', 'domicilio'] },
      { clave: 'condicionesPago', etiqueta: 'Condiciones de pago', alias: ['condiciones de pago', 'forma de pago', 'pago', 'condiciones'] },
    ],
  },
};

// ---------- Lectura de archivos ----------

function valorCelda(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return fmtFecha(v);
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if ('result' in v) return valorCelda(v.result);
    if ('text' in v) return v.text;
    if ('error' in v) return '';
    return String(v);
  }
  return v;
}

function decodificar(buffer) {
  let bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, '');
  } catch {
    // Los CSV exportados por Excel en español suelen venir en Windows-1252
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** Lee un archivo y devuelve { filas: any[][], hoja } con todas las filas no vacías. */
export async function leerArchivo(file) {
  const nombre = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (nombre.endsWith('.csv') || nombre.endsWith('.txt') || file.type === 'text/csv') {
    if (!globalThis.Papa) throw new Error('No se ha podido cargar Papa Parse (CDN).');
    const r = globalThis.Papa.parse(decodificar(buffer), { skipEmptyLines: 'greedy' });
    if (r.errors?.length && !r.data.length) throw new Error('El CSV no se puede leer: ' + r.errors[0].message);
    return { filas: r.data.map((f) => f.map((c) => String(c ?? '').trim())), hoja: null };
  }
  if (nombre.endsWith('.xlsx')) {
    if (!globalThis.ExcelJS) throw new Error('No se ha podido cargar ExcelJS (CDN).');
    const wb = new globalThis.ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets.find((w) => w.actualRowCount > 0) || wb.worksheets[0];
    if (!ws) throw new Error('El libro no contiene hojas.');
    const filas = [];
    const nCol = ws.columnCount;
    ws.eachRow({ includeEmpty: false }, (row) => {
      const f = [];
      for (let c = 1; c <= nCol; c++) {
        const v = valorCelda(row.getCell(c).value);
        f.push(typeof v === 'string' ? v.trim() : v);
      }
      if (f.some((v) => v !== '')) filas.push(f);
    });
    return { filas, hoja: ws.name };
  }
  throw new Error('Formato no admitido. Use un archivo .xlsx o .csv (el formato .xls antiguo no está soportado: guárdelo como .xlsx).');
}

/** Propone el mapeo campo → índice de columna comparando las cabeceras con los alias. */
export function autoMapear(cabeceras, tipo) {
  const norm = cabeceras.map((c) => normalizar(c).replace(/[()*:]/g, '').replace(/\s+/g, ' ').trim());
  const usados = new Set();
  const mapeo = {};
  for (const campo of ESQUEMAS[tipo].campos) {
    const candidatos = [normalizar(campo.etiqueta), ...campo.alias];
    let idx = -1;
    for (const a of candidatos) {
      idx = norm.findIndex((h, i) => !usados.has(i) && h === a);
      if (idx >= 0) break;
    }
    if (idx < 0) {
      for (const a of candidatos) {
        idx = norm.findIndex((h, i) => !usados.has(i) && h && (h.startsWith(a) || a.startsWith(h)) && Math.min(h.length, a.length) >= 3);
        if (idx >= 0) break;
      }
    }
    if (idx >= 0) usados.add(idx);
    mapeo[campo.clave] = idx;
  }
  return mapeo;
}

// ---------- Validación ----------

const buscarPorNombre = (lista, nombre) => {
  const n = normalizar(nombre);
  return n ? lista.find((x) => normalizar(x.nombre) === n) : null;
};

function valorIva(v) {
  if (v === '' || v === null || v === undefined) return { iva: 21 };
  let n = parseNum(v);
  if (!Number.isFinite(n)) return { error: `IVA «${v}» no es un número` };
  if (n > 0 && n < 1) n = Math.round(n * 100); // 0,21 → 21
  if (!TIPOS_IVA.includes(n)) return { error: `IVA ${v} no válido (use 21, 10, 4 o 0)` };
  return { iva: n };
}

function mapearLista(v, lista, defecto) {
  if (v === '' || v === null || v === undefined) return { valor: defecto };
  const n = normalizar(v);
  const e = lista.find((x) => normalizar(x.nombre) === n || x.id === n);
  return e ? { valor: e.id } : { valor: defecto, aviso: `«${v}» no reconocido, se usa «${lista.find((x) => x.id === defecto).nombre}»` };
}

/**
 * Valida las filas según el tipo y el mapeo.
 * Devuelve { filas: [{ n, obj, errores, avisos, faltan }], faltantes: { proveedores, departamentos, categorias, centros } }
 */
export function validar(tipo, filas, mapeo, { crearFaltantes = false, primeraEsCabecera = true } = {}) {
  const esquema = ESQUEMAS[tipo];
  const datos = primeraEsCabecera ? filas.slice(1) : filas;
  const offset = primeraEsCabecera ? 2 : 1;
  const faltantes = { proveedores: new Map(), departamentos: new Map(), categorias: new Map(), centros: new Map() };
  const vistos = new Set();
  const resultado = datos.map((f, i) => {
    const crudo = {};
    for (const c of esquema.campos) {
      const idx = mapeo[c.clave];
      crudo[c.clave] = idx >= 0 ? f[idx] ?? '' : '';
      if (typeof crudo[c.clave] === 'string') crudo[c.clave] = crudo[c.clave].trim();
    }
    const errores = [];
    const avisos = [];
    const faltan = [];
    for (const c of esquema.campos) if (c.obligatorio && (crudo[c.clave] === '' || crudo[c.clave] === null)) errores.push(`Falta «${c.etiqueta}»`);
    let obj = null;

    if (tipo === 'articulos') {
      const cantidad = parseNum(crudo.cantidad);
      const precio = parseNum(crudo.precio);
      if (crudo.cantidad !== '' && !(Number.isFinite(cantidad) && cantidad > 0)) errores.push(`Cantidad «${crudo.cantidad}» no válida`);
      if (crudo.precio !== '' && !(Number.isFinite(precio) && precio >= 0)) errores.push(`Precio «${crudo.precio}» no válido`);
      const iva = valorIva(crudo.iva);
      if (iva.error) errores.push(iva.error);
      const ref = (store, clave, obligatorio) => {
        const nombre = String(crudo[clave] ?? '').trim();
        if (!nombre) return '';
        const e = buscarPorNombre(state[store], nombre);
        if (e) return e.id;
        const k = normalizar(nombre);
        if (!faltantes[store].has(k)) faltantes[store].set(k, nombre);
        if (crearFaltantes) { faltan.push([store, k]); return `nuevo:${store}:${k}`; }
        if (obligatorio) errores.push(`No existe ${store === 'proveedores' ? 'el proveedor' : 'el departamento'} «${nombre}»`);
        else avisos.push(`${store === 'categorias' ? 'Categoría' : 'Centro'} «${nombre}» no existe: se deja vacío`);
        return '';
      };
      const proveedorId = ref('proveedores', 'proveedor', true);
      const departamentoId = ref('departamentos', 'departamento', true);
      const categoriaId = ref('categorias', 'categoria', false);
      const centroId = ref('centros', 'centro', false);
      const prio = mapearLista(crudo.prioridad, PRIORIDADES, 'media');
      const est = mapearLista(crudo.estado, ESTADOS, 'pendiente');
      if (prio.aviso) avisos.push('Prioridad ' + prio.aviso);
      if (est.aviso) avisos.push('Estado ' + est.aviso);
      obj = {
        descripcion: String(crudo.descripcion), referencia: String(crudo.referencia), cantidad, precio, iva: iva.iva,
        proveedorId, departamentoId, categoriaId, centroId, prioridad: prio.valor, estado: est.valor, notas: String(crudo.notas),
      };
    } else if (tipo === 'departamentos') {
      const presupuesto = parseNum(crudo.presupuesto);
      if (crudo.presupuesto !== '' && !(Number.isFinite(presupuesto) && presupuesto >= 0)) errores.push(`Presupuesto «${crudo.presupuesto}» no válido`);
      let ejercicio = crudo.ejercicio === '' ? new Date().getFullYear() : parseInt(parseNum(crudo.ejercicio), 10);
      if (!(ejercicio >= 2000 && ejercicio <= 2100)) { errores.push(`Ejercicio «${crudo.ejercicio}» no válido`); ejercicio = null; }
      let color = String(crudo.color || '').trim();
      if (color && !/^#[0-9a-f]{6}$/i.test(color)) { avisos.push(`Color «${color}» no válido: se asigna uno automático`); color = ''; }
      obj = { nombre: String(crudo.nombre), responsable: String(crudo.responsable), presupuesto, ejercicio, color };
      const clave = normalizar(crudo.nombre) + '|' + ejercicio;
      if (crudo.nombre && state.departamentos.some((d) => normalizar(d.nombre) === normalizar(crudo.nombre) && Number(d.ejercicio) === ejercicio)) errores.push('Ya existe un departamento con ese nombre y ejercicio');
      else if (crudo.nombre && vistos.has(clave)) errores.push('Repetido en el archivo');
      vistos.add(clave);
    } else {
      const email = String(crudo.email || '').trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores.push(`Email «${email}» no válido`);
      obj = {};
      for (const c of esquema.campos) obj[c.clave] = String(crudo[c.clave] ?? '');
      const clave = normalizar(crudo.nombre);
      if (clave && state.proveedores.some((p) => normalizar(p.nombre) === clave)) errores.push('Ya existe un proveedor con ese nombre');
      else if (clave && vistos.has(clave)) errores.push('Repetido en el archivo');
      vistos.add(clave);
    }
    return { n: i + offset, crudo, obj, errores, avisos, faltan };
  });
  return { filas: resultado, faltantes };
}

/** Guarda las filas válidas. Crea antes los maestros que falten si se ha pedido. */
export async function ejecutarImportacion(tipo, validacion, { crearFaltantes = false } = {}) {
  const validas = validacion.filas.filter((f) => !f.errores.length);
  const creados = { proveedores: 0, departamentos: 0, categorias: 0, centros: 0 };
  const ids = {};
  if (tipo === 'articulos' && crearFaltantes) {
    const anio = new Date().getFullYear();
    for (const store of Object.keys(creados)) {
      const usados = new Set(validas.flatMap((f) => f.faltan.filter(([s]) => s === store).map(([, k]) => k)));
      const nuevos = [...usados].map((k, i) => {
        const nombre = validacion.faltantes[store].get(k);
        const base = { id: uid(), nombre };
        if (store === 'departamentos') Object.assign(base, { responsable: '', presupuesto: 0, ejercicio: anio, color: COLORES[(state.departamentos.length + i) % COLORES.length] });
        if (store === 'centros') base.direccion = '';
        ids[`nuevo:${store}:${k}`] = base.id;
        return base;
      });
      if (nuevos.length) await guardarVarios(store, nuevos);
      creados[store] = nuevos.length;
    }
  }
  const ahora = hoyISO();
  let objetos;
  if (tipo === 'articulos') {
    objetos = validas.map(({ obj }) => {
      const o = { ...obj, id: uid(), numeroPedido: '', fechas: { creado: ahora, [obj.estado]: ahora } };
      for (const k of ['proveedorId', 'departamentoId', 'categoriaId', 'centroId']) if (String(o[k]).startsWith('nuevo:')) o[k] = ids[o[k]] || '';
      return o;
    });
  } else if (tipo === 'departamentos') {
    objetos = validas.map(({ obj }, i) => ({ ...obj, id: uid(), color: obj.color || COLORES[(state.departamentos.length + i) % COLORES.length] }));
  } else {
    objetos = validas.map(({ obj }) => ({ ...obj, id: uid() }));
  }
  if (objetos.length) await guardarVarios(tipo, objetos);
  return {
    importadas: objetos.length,
    rechazadas: validacion.filas.filter((f) => f.errores.length),
    creados,
  };
}

// ---------- Plantillas ----------

export async function plantilla(tipo) {
  const ExcelJS = globalThis.ExcelJS;
  const esquema = ESQUEMAS[tipo];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Gestión de compras de material';
  const ws = wb.addWorksheet(esquema.nombre, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = esquema.campos.map((c) => ({ header: c.etiqueta + (c.obligatorio ? ' *' : ''), key: c.clave, width: Math.max(14, c.etiqueta.length + 6) }));
  const cab = ws.getRow(1);
  cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  cab.height = 22;
  cab.alignment = { vertical: 'middle' };
  if (tipo === 'articulos') {
    ws.getColumn('descripcion').width = 45;
    ws.getColumn('precio').numFmt = '#,##0.00 "€"';
    // Listas desplegables para los campos con valores cerrados
    const listas = { iva: '"21,10,4,0"', prioridad: '"alta,media,baja"', estado: '"pendiente,pedido,recibido,cancelado"' };
    for (const [clave, formula] of Object.entries(listas)) {
      const col = ws.getColumn(clave).letter;
      for (let r = 2; r <= 500; r++) ws.getCell(`${col}${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [formula] };
    }
  }
  if (tipo === 'departamentos') ws.getColumn('presupuesto').numFmt = '#,##0.00 "€"';
  const ins = wb.addWorksheet('Instrucciones');
  ins.columns = [{ header: 'Campo', width: 28 }, { header: 'Obligatorio', width: 12 }, { header: 'Indicaciones', width: 80 }];
  ins.getRow(1).font = { bold: true };
  const notas = {
    cantidad: 'Número mayor que cero.',
    precio: 'Precio unitario sin IVA en euros. Admite 1234,56 o 1234.56.',
    iva: '21, 10, 4 o 0. Si se deja vacío se aplica el 21 %.',
    proveedor: 'Nombre exacto de un proveedor existente (o marque «crear los que falten» al importar).',
    departamento: 'Nombre exacto de un departamento existente (o marque «crear los que falten» al importar).',
    categoria: 'Nombre de una categoría existente; opcional.',
    centro: 'Nombre de un centro existente; opcional.',
    prioridad: 'alta, media o baja (por defecto media).',
    estado: 'pendiente, pedido, recibido o cancelado (por defecto pendiente).',
    presupuesto: 'Importe anual en euros.',
    ejercicio: 'Año, por ejemplo 2026. Si se deja vacío, el año actual.',
    color: 'Código hexadecimal, por ejemplo #2563eb. Opcional.',
  };
  for (const c of esquema.campos) ins.addRow([c.etiqueta, c.obligatorio ? 'Sí' : 'No', notas[c.clave] || '']);
  ins.addRow([]);
  ins.addRow(['La primera fila de la hoja de datos debe contener los encabezados. Se pueden reordenar columnas: en la importación se elige qué columna corresponde a cada campo.']);
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
