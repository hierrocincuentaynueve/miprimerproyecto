/**
 * Lógica de fechas, desbloqueo y estado del calendario.
 *
 * - Todas las fechas se evalúan en la hora peninsular de España
 *   (Europe/Madrid) mediante Intl.DateTimeFormat, sea cual sea la zona
 *   horaria configurada en el dispositivo.
 * - Para pruebas internas se admite ?fecha=AAAA-MM-DD (opcionalmente
 *   ?fecha=AAAA-MM-DDTHH:MM) en la URL: simula esa fecha/hora de Madrid
 *   y el reloj sigue avanzando desde ahí.
 */

export const ZONA = 'Europe/Madrid';
export const ANIO = 2026;
export const MES = 12; // diciembre
export const TOTAL_DIAS = 24;

const CLAVE_ABIERTAS = 'adviento-2026:abiertas';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

const fmtPartes = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

/** Descompone un instante en año/mes/día/hora… según la hora de Madrid. */
export function partesMadrid(fecha) {
  const p = {};
  for (const { type, value } of fmtPartes.formatToParts(fecha)) p[type] = value;
  return {
    anio: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour) % 24,
    minuto: Number(p.minute),
    segundo: Number(p.second),
  };
}

function desfaseMadridMs(fecha) {
  const p = partesMadrid(fecha);
  const comoUTC = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return comoUTC - Math.floor(fecha.getTime() / 1000) * 1000;
}

/** Instante real que corresponde a una hora "de pared" de Madrid. */
export function instanteMadrid(anio, mes, dia, hora = 0, minuto = 0, segundo = 0) {
  const supuesto = Date.UTC(anio, mes - 1, dia, hora, minuto, segundo);
  const d1 = desfaseMadridMs(new Date(supuesto));
  let t = supuesto - d1;
  const d2 = desfaseMadridMs(new Date(t));
  if (d2 !== d1) t = supuesto - d2;
  return new Date(t);
}

/** "15 de diciembre" */
export function textoDia(dia) {
  return `${dia} de diciembre`;
}

/** "31 de enero de 2027" a partir de "2027-01-31" */
export function textoFechaISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${Number(m[3])} de ${MESES[Number(m[2]) - 1]} de ${m[1]}`;
}

/** Lee ?fecha= de la URL. Devuelve el desfase (ms) a aplicar al reloj o 0. */
export function desfaseSimulado(search = location.search) {
  let valor = null;
  try {
    valor = new URLSearchParams(search).get('fecha');
  } catch { /* sin URLSearchParams */ }
  if (!valor) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(valor.trim());
  if (!m) return 0;
  const [, a, me, d, h, mi, s] = m;
  // Sin hora explícita simulamos las 12:00 de ese día en Madrid.
  const simulado = instanteMadrid(+a, +me, +d, h ? +h : 12, mi ? +mi : 0, s ? +s : 0);
  if (Number.isNaN(simulado.getTime())) return 0;
  return simulado.getTime() - Date.now();
}

function leerAbiertas() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_ABIERTAS);
    if (!crudo) return new Set();
    const lista = JSON.parse(crudo);
    if (!Array.isArray(lista)) return new Set();
    return new Set(lista.filter((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_DIAS));
  } catch {
    return new Set();
  }
}

function guardarAbiertas(set) {
  try {
    window.localStorage.setItem(CLAVE_ABIERTAS, JSON.stringify([...set].sort((a, b) => a - b)));
  } catch { /* almacenamiento no disponible (modo privado, bloqueado…): seguimos en memoria */ }
}

/**
 * Crea el estado del calendario.
 * Estados de una casilla: 'bloqueada' | 'hoy' | 'disponible' | 'abierta'
 * Fases de la campaña: 'antes' | 'activa' | 'despues'
 */
export function crearCalendario({ desfaseMs = 0 } = {}) {
  const abiertas = leerAbiertas();
  const oyentes = new Set();
  let ultimaClave = null;
  let temporizador = null;

  const ahora = () => new Date(Date.now() + desfaseMs);
  const hoyMadrid = () => partesMadrid(ahora());
  const claveHoy = () => {
    const p = hoyMadrid();
    return p.anio * 10000 + p.mes * 100 + p.dia;
  };
  const claveDia = (dia) => ANIO * 10000 + MES * 100 + dia;

  const inicio = instanteMadrid(ANIO, MES, 1, 0, 0, 0);

  const api = {
    ahora,
    inicio,
    simulado: desfaseMs !== 0,

    fase() {
      const k = claveHoy();
      if (k < claveDia(1)) return 'antes';
      if (k <= claveDia(TOTAL_DIAS)) return 'activa';
      return 'despues';
    },

    /** Día de diciembre de hoy (1–24) durante la campaña, o null. */
    diaDeHoy() {
      return api.fase() === 'activa' ? hoyMadrid().dia : null;
    },

    desbloqueada(dia) {
      return claveHoy() >= claveDia(dia);
    },

    abierta(dia) {
      return abiertas.has(dia);
    },

    estado(dia) {
      if (!api.desbloqueada(dia)) return 'bloqueada';
      if (abiertas.has(dia)) return 'abierta';
      if (api.diaDeHoy() === dia) return 'hoy';
      return 'disponible';
    },

    marcarAbierta(dia) {
      if (!api.desbloqueada(dia) || abiertas.has(dia)) return;
      abiertas.add(dia);
      guardarAbiertas(abiertas);
      emitir();
    },

    totalAbiertas() {
      return abiertas.size;
    },

    /** Milisegundos que faltan para el 1 de diciembre a las 00:00 (Madrid). */
    msHastaInicio() {
      return Math.max(0, inicio.getTime() - ahora().getTime());
    },

    alCambiar(fn) {
      oyentes.add(fn);
      return () => oyentes.delete(fn);
    },

    /** Vigila el cambio de día (medianoche en Madrid) y avisa a los oyentes. */
    iniciarReloj() {
      ultimaClave = claveHoy();
      clearInterval(temporizador);
      temporizador = setInterval(() => {
        const k = claveHoy();
        if (k !== ultimaClave) {
          ultimaClave = k;
          emitir();
        }
      }, 1000);
    },
  };

  function emitir() {
    for (const fn of oyentes) {
      try { fn(api); } catch (e) { console.error(e); }
    }
  }

  return api;
}
