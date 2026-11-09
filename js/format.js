// Utilidades puras de formato y conversión (sin DOM). Formato es-ES.

export function round2(n) {
  const v = Number(n) || 0;
  return Math.round((v + (v >= 0 ? Number.EPSILON : -Number.EPSILON)) * 100) / 100;
}

export function num(v) {
  const n = typeof v === 'number' ? v : parseNum(v);
  return Number.isFinite(n) ? n : 0;
}

/** Número con separador de miles "." y decimal "," (1.234,56). */
export function fmtNum(n, dec = 2) {
  const v = Number(n) || 0;
  const neg = v < 0;
  const [ent, frac] = Math.abs(v).toFixed(dec).split('.');
  const conMiles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const s = conMiles + (dec > 0 ? ',' + frac : '');
  return neg && Number(s.replace(/\./g, '').replace(',', '.')) !== 0 ? '-' + s : s;
}

export const eur = (n) => fmtNum(n, 2) + ' €';
export const pct = (n, dec = 1) => (Number.isFinite(n) ? fmtNum(n, dec) : '—') + ' %';

const pad = (n) => String(n).padStart(2, '0');

/** Fecha en formato dd/mm/aaaa. Acepta ISO, Date o timestamp. */
export function fmtFecha(v) {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d)) return '';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function fmtFechaHora(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return '';
  return `${fmtFecha(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Interpreta números escritos en español o inglés: "1.234,56", "1234.56", "21 %", "12,5 €". */
export function parseNum(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return NaN;
  let s = String(v).trim().replace(/[€%\s ]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // "2.500" en España son dos mil quinientos
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

/** Minúsculas sin tildes ni espacios sobrantes, para comparar nombres. */
export function normalizar(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto apto para nombre de archivo. */
export function nombreArchivo(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'Proveedor';
}

export function hoyISO() {
  return new Date().toISOString();
}

/** Comparador para ordenar con criterios en español. */
export const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
