// Datos de ejemplo (ficticios). Todos llevan ejemplo: true para poder borrarlos después.
import { state, guardarVarios, borrar, guardarConfig, CATEGORIAS_INICIALES } from './db.js';
import { normalizar, uid } from './format.js';
import { importesLinea } from './models.js';

const ANIO = new Date().getFullYear();
const fecha = (mes, dia) => new Date(ANIO, mes - 1, dia, 10, 0).toISOString();

const DEPARTAMENTOS = [
  { id: 'ej-dep-inf', nombre: 'Informática', responsable: 'Laura Méndez Ruiz', presupuesto: 35000, color: '#2563eb' },
  { id: 'ej-dep-man', nombre: 'Mantenimiento', responsable: 'Javier Ortega Sanz', presupuesto: 15000, color: '#d97706' },
  { id: 'ej-dep-rec', nombre: 'Recepción', responsable: 'Marta Gil Herrero', presupuesto: 9000, color: '#059669' },
  { id: 'ej-dep-act', nombre: 'Actividades deportivas', responsable: 'Daniel Prieto Lozano', presupuesto: 16000, color: '#db2777' },
  { id: 'ej-dep-adm', nombre: 'Administración', responsable: 'Elena Navarro Castro', presupuesto: 5000, color: '#7c3aed' },
];

const CENTROS = [
  { id: 'ej-cen-norte', nombre: 'Centro Deportivo Norte', direccion: 'Avenida de la Ilustración, 120\n28029 Madrid' },
  { id: 'ej-cen-sur', nombre: 'Centro Deportivo Sur', direccion: 'Calle del Ejemplo Sur, 45\n28019 Madrid' },
  { id: 'ej-cen-este', nombre: 'Centro Deportivo Este', direccion: 'Calle Ficticia del Este, 8\n28022 Madrid' },
];

const PROVEEDORES = [
  { id: 'ej-pro-inf', nombre: 'Suministros Informáticos Meseta S.L.', cif: 'B00000001', contacto: 'Raúl Benítez', email: 'pedidos@meseta-informatica.example', telefono: '910 000 101', direccion: 'Polígono Industrial Las Arenas, nave 12\n28108 Alcobendas (Madrid)', condicionesPago: 'Transferencia bancaria a 30 días fecha factura' },
  { id: 'ej-pro-dep', nombre: 'Equipamiento Deportivo Atlas S.A.', cif: 'A00000002', contacto: 'Cristina Vidal', email: 'comercial@atlas-deporte.example', telefono: '930 000 202', direccion: 'Carrer de la Indústria, 33\n08940 Cornellà de Llobregat (Barcelona)', condicionesPago: 'Pago a 60 días fecha factura' },
  { id: 'ej-pro-lim', nombre: 'Limpiezas y Químicos del Centro S.L.', cif: 'B00000003', contacto: 'Andrés Molina', email: 'ventas@quimicos-centro.example', telefono: '925 000 303', direccion: 'Calle Hornos, 4\n45006 Toledo', condicionesPago: 'Confirming a 90 días' },
  { id: 'ej-pro-ofi', nombre: 'Ofimática Castellana S.L.', cif: 'B00000004', contacto: 'Nuria Pascual', email: 'pedidos@ofimatica-castellana.example', telefono: '983 000 404', direccion: 'Avenida de Burgos, 70\n47009 Valladolid', condicionesPago: 'Transferencia a 30 días' },
  { id: 'ej-pro-fer', nombre: 'Ferretería Industrial Hermanos Ruiz S.L.', cif: 'B00000005', contacto: 'Tomás Ruiz', email: 'tomas@ferreteria-ruiz.example', telefono: '916 000 505', direccion: 'Calle del Hierro, 21\n28914 Leganés (Madrid)', condicionesPago: 'Recibo domiciliado a 30 días' },
];

// [descripción, ref, categoría, cantidad, precio, iva, proveedor, departamento, centro, prioridad, estado, nº pedido, notas]
const ARTICULOS = [
  ['Portátil 14" Core i5, 16 GB RAM, SSD 512 GB', 'NB-14I5-512', 'Hardware', 10, 849, 21, 'inf', 'inf', 'norte', 'alta', 'recibido', 1, 'Para personal de coordinación'],
  ['Monitor 24" Full HD IPS con altavoces', 'MON-24FHD', 'Hardware', 20, 139.9, 21, 'inf', 'inf', 'norte', 'media', 'recibido', 1, ''],
  ['Switch gestionable 48 puertos PoE+', 'SW-48POE', 'Hardware', 2, 1450, 21, 'inf', 'inf', 'sur', 'alta', 'pedido', 3, 'Sustituye a los switches del rack 2'],
  ['SAI 1500 VA en rack', 'SAI-1500R', 'Hardware', 3, 320, 21, 'inf', 'inf', 'este', 'media', 'pendiente', 0, ''],
  ['Licencia anual ofimática en la nube (usuario)', 'LIC-OFI-ANUAL', 'Software y licencias', 60, 126, 21, 'inf', 'inf', 'norte', 'alta', 'pendiente', 0, 'Renovación enero'],
  ['Lector de códigos de barras USB para control de accesos', 'LEC-CB-USB', 'Hardware', 6, 89, 21, 'inf', 'rec', 'sur', 'media', 'pendiente', 0, ''],
  ['Impresora térmica de tickets', 'IMP-TER-80', 'Hardware', 4, 210, 21, 'inf', 'rec', 'este', 'media', 'pendiente', 0, ''],
  ['Tarjeta de acceso RFID personalizada', 'RFID-MF1K', 'Consumibles', 3000, 0.85, 21, 'ofi', 'rec', 'norte', 'alta', 'pedido', 6, 'Con logotipo a dos caras'],
  ['Rollo de papel térmico 80 mm', 'PT-80-80', 'Consumibles', 200, 2.1, 21, 'ofi', 'rec', 'sur', 'baja', 'pendiente', 0, ''],
  ['Silla de oficina ergonómica con reposabrazos', 'SIL-ERG-01', 'Mobiliario', 6, 189, 21, 'ofi', 'rec', 'este', 'media', 'pendiente', 0, 'Mostrador de recepción'],
  ['Botella de agua mineral 50 cl (pack 24)', 'AGUA-50-24', 'Consumibles', 60, 6.5, 10, 'ofi', 'rec', 'norte', 'baja', 'pendiente', 0, 'Atención a clientes'],
  ['Bicicleta de ciclo indoor con pantalla', 'BIKE-IND-PRO', 'Material deportivo', 8, 1290, 21, 'dep', 'act', 'norte', 'alta', 'pedido', 2, 'Sala de ciclo'],
  ['Set de mancuernas hexagonales 2-30 kg con soporte', 'MAN-HEX-SET', 'Material deportivo', 2, 1650, 21, 'dep', 'act', 'sur', 'alta', 'pendiente', 0, ''],
  ['Esterilla de yoga 6 mm antideslizante', 'EST-YOGA-6', 'Material deportivo', 60, 19.9, 21, 'dep', 'act', 'este', 'media', 'pendiente', 0, ''],
  ['Balón de baloncesto talla 7', 'BAL-BK-7', 'Material deportivo', 30, 34.5, 21, 'dep', 'act', 'sur', 'media', 'recibido', 2, ''],
  ['Kettlebell de hierro fundido 16 kg', 'KB-16', 'Material deportivo', 20, 42, 21, 'dep', 'act', 'norte', 'media', 'pendiente', 0, ''],
  ['Red de pádel reglamentaria', 'RED-PAD-REG', 'Material deportivo', 6, 95, 21, 'dep', 'act', 'este', 'baja', 'pendiente', 0, ''],
  ['Manual de primeros auxilios en instalaciones deportivas', 'LIB-PA-2026', 'Material de oficina', 15, 24, 4, 'ofi', 'act', 'norte', 'baja', 'pendiente', 0, 'Formación de monitores'],
  ['Hipoclorito sódico para piscina (garrafa 25 kg)', 'HIP-25', 'Limpieza', 80, 28.5, 21, 'lim', 'man', 'norte', 'alta', 'recibido', 4, ''],
  ['Detergente desinfectante multisuperficie 5 L', 'DET-MS-5', 'Limpieza', 120, 9.8, 21, 'lim', 'man', 'sur', 'media', 'pendiente', 0, ''],
  ['Papel secamanos zigzag (caja 20 paquetes)', 'PAP-ZZ-20', 'Limpieza', 90, 21.4, 21, 'lim', 'man', 'este', 'media', 'pendiente', 0, ''],
  ['Panel LED 60x60 40 W', 'LED-6060-40', 'Mantenimiento e instalaciones', 80, 18.5, 21, 'fer', 'man', 'sur', 'media', 'pendiente', 0, 'Sustitución de fluorescentes'],
  ['Filtro de climatización G4 592x592', 'FIL-G4-592', 'Mantenimiento e instalaciones', 48, 46, 21, 'fer', 'man', 'norte', 'alta', 'pedido', 5, ''],
  ['Pintura plástica blanca mate 15 L', 'PIN-BL-15', 'Mantenimiento e instalaciones', 40, 32, 21, 'fer', 'man', 'este', 'baja', 'pendiente', 0, ''],
  ['Taladro percutor inalámbrico 18 V con 2 baterías', 'TAL-18V', 'Mantenimiento e instalaciones', 3, 189, 21, 'fer', 'man', 'sur', 'media', 'pendiente', 0, ''],
  ['Escalera de aluminio de tijera 7 peldaños', 'ESC-AL-7', 'Mantenimiento e instalaciones', 2, 245, 21, 'fer', 'man', 'norte', 'baja', 'cancelado', 0, 'Se reutilizan las existentes'],
  ['Papel A4 80 g (caja de 5 paquetes)', 'A4-80-5', 'Material de oficina', 100, 22.5, 21, 'ofi', 'adm', 'norte', 'media', 'pendiente', 0, ''],
  ['Tóner compatible impresora láser', 'TON-LJ-59', 'Consumibles', 12, 79, 21, 'ofi', 'adm', 'norte', 'media', 'pendiente', 0, ''],
  ['Destructora de papel nivel P-4', 'DES-P4', 'Mobiliario', 1, 340, 21, 'ofi', 'adm', 'norte', 'baja', 'pendiente', 0, ''],
  ['Archivador de palanca A4 lomo ancho', 'ARC-A4-L', 'Material de oficina', 100, 3.2, 21, 'ofi', 'adm', 'sur', 'baja', 'pendiente', 0, ''],
  ['Silla ergonómica de dirección', 'SIL-DIR-02', 'Mobiliario', 4, 229, 21, 'ofi', 'adm', 'norte', 'media', 'pendiente', 0, 'Despachos de administración'],
];

const PEDIDOS = [
  { n: 1, prov: 'inf', mes: 2, dia: 10 },
  { n: 2, prov: 'dep', mes: 3, dia: 4 },
  { n: 3, prov: 'inf', mes: 9, dia: 15 },
  { n: 4, prov: 'lim', mes: 4, dia: 22 },
  { n: 5, prov: 'fer', mes: 10, dia: 2 },
  { n: 6, prov: 'ofi', mes: 6, dia: 12 },
];
const numPedido = (n) => `PED-${ANIO}-${String(n).padStart(3, '0')}`;

export function hayDatosEjemplo() {
  return ['departamentos', 'centros', 'proveedores', 'articulos', 'pedidos'].some((s) => state[s].some((x) => x.ejemplo));
}

export async function cargarDatosEjemplo() {
  // Categorías: reutiliza las existentes por nombre o crea las que falten
  const catPorNombre = new Map(state.categorias.map((c) => [normalizar(c.nombre), c.id]));
  const nuevasCat = [];
  for (const nombre of new Set([...CATEGORIAS_INICIALES, ...ARTICULOS.map((a) => a[2])])) {
    if (!catPorNombre.has(normalizar(nombre))) {
      const c = { id: uid(), nombre };
      nuevasCat.push(c);
      catPorNombre.set(normalizar(nombre), c.id);
    }
  }
  if (nuevasCat.length) await guardarVarios('categorias', nuevasCat, { silencioso: true });

  await guardarVarios('departamentos', DEPARTAMENTOS.map((d) => ({ ...d, ejercicio: ANIO, ejemplo: true })), { silencioso: true });
  await guardarVarios('centros', CENTROS.map((c) => ({ ...c, ejemplo: true })), { silencioso: true });
  await guardarVarios('proveedores', PROVEEDORES.map((p) => ({ ...p, ejemplo: true })), { silencioso: true });

  const articulos = ARTICULOS.map((r, i) => {
    const [descripcion, referencia, cat, cantidad, precio, iva, prov, dep, cen, prioridad, estado, nPed, notas] = r;
    const ped = PEDIDOS.find((p) => p.n === nPed);
    const fechas = { creado: fecha(1, 15), pendiente: fecha(1, 15) };
    if (ped && (estado === 'pedido' || estado === 'recibido')) fechas.pedido = fecha(ped.mes, ped.dia);
    if (ped && estado === 'recibido') fechas.recibido = fecha(ped.mes, Math.min(ped.dia + 12, 28));
    if (estado === 'cancelado') fechas.cancelado = fecha(5, 6);
    return {
      id: `ej-art-${String(i + 1).padStart(2, '0')}`,
      descripcion, referencia, categoriaId: catPorNombre.get(normalizar(cat)) || '',
      cantidad, precio, iva,
      proveedorId: `ej-pro-${prov}`, departamentoId: `ej-dep-${dep}`, centroId: `ej-cen-${cen}`,
      prioridad, notas, estado,
      numeroPedido: ped && (estado === 'pedido' || estado === 'recibido') ? numPedido(nPed) : '',
      fechas, ejemplo: true,
    };
  });
  await guardarVarios('articulos', articulos, { silencioso: true });

  const pedidos = [];
  for (const p of PEDIDOS) {
    const numero = numPedido(p.n);
    const lineas = articulos.filter((a) => a.numeroPedido === numero);
    if (!lineas.length) continue;
    const total = lineas.reduce((s, a) => s + importesLinea(a).total, 0);
    pedidos.push({
      id: `ej-ped-${p.n}`, numero, proveedorId: `ej-pro-${p.prov}`, fecha: fecha(p.mes, p.dia),
      articuloIds: lineas.map((a) => a.id), total: Math.round(total * 100) / 100, observaciones: '', ejemplo: true,
    });
  }
  await guardarVarios('pedidos', pedidos, { silencioso: true });

  // Ajusta el contador de pedidos para no repetir números de ejemplo
  const cfgP = { ...state.config.pedido };
  if (cfgP.anio !== ANIO || cfgP.siguiente <= 6) {
    cfgP.siguiente = cfgP.anio === ANIO ? Math.max(7, cfgP.siguiente) : 7;
    cfgP.anio = ANIO;
    await guardarConfig('pedido', cfgP);
  }
  // Datos de empresa de ejemplo solo si están vacíos
  if (!state.config.empresa.razonSocial) {
    await guardarConfig('empresa', {
      razonSocial: 'Centros Deportivos Ejemplo S.L.',
      cif: 'B00000000',
      direccion: 'Calle Mayor de Ejemplo, 1, 3.ª planta\n28013 Madrid',
      contacto: 'Responsable de Compras',
      email: 'compras@empresa.example',
      telefono: '910 000 000',
      ejemplo: true,
    });
  } else {
    await guardarConfig('empresa', state.config.empresa); // fuerza refresco
  }
}

/**
 * Borra los datos de ejemplo. Los departamentos, proveedores y centros de ejemplo que tengan
 * artículos propios del usuario asociados se conservan (y se informa de ello).
 */
export async function borrarDatosEjemplo() {
  const propios = state.articulos.filter((a) => !a.ejemplo);
  const conservados = [];
  const usado = (campo, id) => propios.some((a) => a[campo] === id);
  await borrar('articulos', state.articulos.filter((a) => a.ejemplo).map((a) => a.id));
  await borrar('pedidos', state.pedidos.filter((p) => p.ejemplo).map((p) => p.id));
  for (const [store, campo] of [['departamentos', 'departamentoId'], ['proveedores', 'proveedorId'], ['centros', 'centroId']]) {
    const ids = [];
    for (const x of state[store].filter((x) => x.ejemplo)) {
      if (usado(campo, x.id)) conservados.push(x.nombre); else ids.push(x.id);
    }
    if (ids.length) await borrar(store, ids);
  }
  if (state.config.empresa?.ejemplo) {
    await guardarConfig('empresa', { razonSocial: '', cif: '', direccion: '', contacto: '', email: '', telefono: '' });
  }
  return conservados;
}
