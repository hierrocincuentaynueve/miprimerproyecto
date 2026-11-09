/**
 * Ventana del premio: ilustración, título, código grande, QR, condiciones,
 * caducidad y aviso legal. Atrapa el foco, se cierra con Escape y devuelve
 * el foco al elemento que la abrió.
 */
import { textoFechaISO, textoDia } from './calendar.js';
import { AVISO_LEGAL } from './prizes.js';

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function crearModal({ raiz, fondoInerte, alCerrar } = {}) {
  const $ = (sel) => raiz.querySelector(sel);
  const panel = $('.modal__panel');
  const ilustracion = $('#premio-ilustracion');
  const etiqueta = $('#premio-dia');
  const titulo = $('#premio-titulo');
  const descripcion = $('#premio-descripcion');
  const codigo = $('#premio-codigo');
  const qr = $('#premio-qr');
  const condiciones = $('#premio-condiciones');
  const caducidad = $('#premio-caducidad');
  const legal = $('#premio-legal');
  const botonCopiar = $('#premio-copiar');
  const avisoCopia = $('#premio-copiado');

  legal.textContent = AVISO_LEGAL;

  let devolverFoco = null;
  let abierto = false;
  let premioActual = null;

  raiz.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar]')) cerrar();
  });

  document.addEventListener('keydown', (e) => {
    if (!abierto) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrar();
      return;
    }
    if (e.key === 'Tab') {
      const nodos = [...panel.querySelectorAll(ENFOCABLES)].filter((n) => n.offsetParent !== null);
      if (!nodos.length) return;
      const primero = nodos[0];
      const ultimo = nodos[nodos.length - 1];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  });

  botonCopiar.addEventListener('click', async () => {
    if (!premioActual) return;
    const ok = await copiarTexto(premioActual.codigo);
    avisoCopia.textContent = ok
      ? '¡Código copiado!'
      : 'No se ha podido copiar. Selecciona el código y cópialo manualmente.';
    botonCopiar.classList.toggle('is-copiado', ok);
    clearTimeout(botonCopiar._t);
    botonCopiar._t = setTimeout(() => {
      avisoCopia.textContent = '';
      botonCopiar.classList.remove('is-copiado');
    }, 3000);
  });

  function pintarQR(texto) {
    qr.textContent = '';
    if (typeof window.qrcode !== 'function') {
      qr.innerHTML = '<p class="qr__error">Código QR no disponible. Indica el código en recepción.</p>';
      return;
    }
    try {
      const q = window.qrcode(0, 'M');
      q.addData(texto, 'Alphanumeric');
      q.make();
      qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      const svg = qr.querySelector('svg');
      if (svg) {
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', `Código QR del código ${texto}`);
      }
    } catch (err) {
      console.warn('No se pudo generar el QR', err);
      qr.innerHTML = '<p class="qr__error">Código QR no disponible. Indica el código en recepción.</p>';
    }
  }

  function abrir(premio, origen) {
    premioActual = premio;
    devolverFoco = origen || document.activeElement;
    ilustracion.src = `assets/svg/premios/${premio.ilustracion}.svg`;
    ilustracion.alt = '';
    etiqueta.textContent = `Casilla ${premio.dia} · ${textoDia(premio.dia)}`;
    titulo.textContent = premio.titulo;
    descripcion.textContent = premio.descripcion;
    codigo.textContent = premio.codigo;
    condiciones.textContent = premio.condiciones;
    caducidad.textContent = textoFechaISO(premio.caducidad);
    avisoCopia.textContent = '';
    botonCopiar.classList.remove('is-copiado');
    pintarQR(premio.codigo);

    raiz.hidden = false;
    // Forzamos un reflow para que la transición de entrada se ejecute.
    void raiz.offsetWidth;
    raiz.classList.add('is-abierto');
    document.documentElement.classList.add('sin-scroll');
    if (fondoInerte) fondoInerte.forEach((n) => n.setAttribute('inert', ''));
    abierto = true;
    panel.scrollTop = 0;
    requestAnimationFrame(() => $('.modal__cerrar').focus());
  }

  function cerrar() {
    if (!abierto) return;
    abierto = false;
    raiz.classList.remove('is-abierto');
    document.documentElement.classList.remove('sin-scroll');
    if (fondoInerte) fondoInerte.forEach((n) => n.removeAttribute('inert'));
    const fin = () => { if (!abierto) raiz.hidden = true; };
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducido) fin(); else setTimeout(fin, 250);
    if (devolverFoco && typeof devolverFoco.focus === 'function' && document.contains(devolverFoco)) {
      devolverFoco.focus({ preventScroll: true });
    }
    alCerrar?.(premioActual);
  }

  return { abrir, cerrar, get abierto() { return abierto; } };
}

async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch { /* probamos el método antiguo */ }
  try {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}
