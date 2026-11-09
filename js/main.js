/**
 * Arranque y orquestación:
 * - Detecta capacidades (WebGL, rendimiento, movimiento reducido, táctil).
 * - Carga la escena 3D (o el modo 2D de respaldo) con pantalla de carga.
 * - Sincroniza la lista accesible de casillas, la escena, el estado y el modal.
 */
(function (A) {
  'use strict';
  const { PREMIOS, CAMPANA, premioDelDia, crearCalendario, desfaseSimulado, textoDia, crearModal, crearAudio } = A;

  const $ = (id) => document.getElementById(id);
  const raiz = document.documentElement;

  // ---------- Parámetros y capacidades ----------
  const parametros = new URLSearchParams(location.search);
  const modoForzado = ['2d', '3d'].includes(parametros.get('modo')) ? parametros.get('modo') : null;
  const consultaMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  const movimientoReducido = consultaMovimiento.matches;
  const tactil = window.matchMedia('(pointer: coarse)').matches;
  const nucleos = navigator.hardwareConcurrency || 4;
  const memoria = navigator.deviceMemory || 4;
  const muyLento = nucleos <= 2 && memoria <= 2;
  const calidad = tactil || window.innerWidth < 760 || nucleos < 4 || memoria < 4 ? 'baja' : 'alta';

  const CLAVE_VISTA = 'adviento-2026:vista';
  const leerPreferencia = () => { try { return localStorage.getItem(CLAVE_VISTA); } catch { return null; } };
  const guardarPreferencia = (v) => { try { localStorage.setItem(CLAVE_VISTA, v); } catch { /* sin almacenamiento */ } };

  function soportaWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch {
      return false;
    }
  }
  const hayWebGL = soportaWebGL();

  // ---------- Estado ----------
  const cal = crearCalendario({ desfaseMs: desfaseSimulado() });
  const audio = crearAudio();
  let escena = null;
  let modo = null; // '3d' | '2d'
  let ocupado = false;
  const avisosCerrados = new Set();

  const lista = $('casillas');
  const botones = new Map();

  const modal = crearModal({
    raiz: $('modal'),
    fondoInerte: [$('app')],
    alCerrar: () => escena?.pausarAutoGiro(false),
  });

  $('pie-texto').textContent = CAMPANA.pie;

  // ---------- Avisos flotantes ----------
  const avisador = $('avisador');
  let tAviso = null;
  function avisar(texto, ms = 3800) {
    avisador.textContent = '';
    // Pequeño retardo para que los lectores de pantalla anuncien el cambio.
    requestAnimationFrame(() => {
      avisador.textContent = texto;
      avisador.classList.add('is-visible');
    });
    clearTimeout(tAviso);
    tAviso = setTimeout(() => avisador.classList.remove('is-visible'), ms);
  }

  // ---------- Lista accesible de casillas (y cuadrícula del modo 2D) ----------
  const ICONO_CANDADO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1.5A1.5 1.5 0 0 1 20 11.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20.5v-9A1.5 1.5 0 0 1 5.5 10H7Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>';
  const ICONO_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4-9.6 9.6Z"/></svg>';

  function crearCasillas() {
    lista.textContent = '';
    for (const p of PREMIOS) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'casilla';
      b.dataset.dia = String(p.dia);
      b.dataset.patron = String((p.dia * 3) % 5);
      b.innerHTML = `
        <span class="casilla__papel" aria-hidden="true"><span class="casilla__cinta"></span><span class="casilla__lazo"></span></span>
        <img class="casilla__premio" alt="" aria-hidden="true" width="96" height="96" decoding="async">
        <span class="casilla__numero" aria-hidden="true">${p.dia}</span>
        <span class="casilla__icono casilla__icono--candado" aria-hidden="true">${ICONO_CANDADO}</span>
        <span class="casilla__icono casilla__icono--check" aria-hidden="true">${ICONO_CHECK}</span>
        <span class="casilla__pista" aria-hidden="true"></span>`;
      b.addEventListener('click', () => abrirCasilla(p.dia, 'lista', b));
      b.addEventListener('focus', () => {
        if (modo === '3d' && escena) escena.resaltar(p.dia, { girar: b.matches(':focus-visible') });
      });
      b.addEventListener('blur', () => escena?.resaltar(null));
      b.addEventListener('pointerenter', () => { if (modo === '3d') escena?.resaltar(p.dia); });
      b.addEventListener('pointerleave', () => { if (document.activeElement !== b) escena?.resaltar(null); });
      li.appendChild(b);
      lista.appendChild(li);
      botones.set(p.dia, b);
    }

    // Flechas del teclado para moverse por la cuadrícula
    lista.addEventListener('keydown', (e) => {
      const actual = e.target.closest('.casilla');
      if (!actual) return;
      const dia = Number(actual.dataset.dia);
      const columnas = getComputedStyle(lista).gridTemplateColumns.split(' ').length || 6;
      const mapa = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columnas, ArrowUp: -columnas, Home: -99, End: 99 };
      if (!(e.key in mapa)) return;
      e.preventDefault();
      const destino = Math.min(24, Math.max(1, e.key === 'Home' ? 1 : e.key === 'End' ? 24 : dia + mapa[e.key]));
      botones.get(destino)?.focus();
    });
  }

  function etiquetaAria(dia, estado) {
    const premio = premioDelDia(dia);
    switch (estado) {
      case 'bloqueada': return `Casilla ${dia}, bloqueada. Vuelve el ${textoDia(dia)}`;
      case 'hoy': return `Casilla ${dia}, disponible hoy. Abrir regalo`;
      case 'disponible': return `Casilla ${dia}, disponible. Abrir regalo`;
      default: return `Casilla ${dia}, abierta. Ver premio: ${premio.titulo}`;
    }
  }

  const PISTAS = { bloqueada: (d) => `El ${d}`, hoy: () => '¡Hoy!', disponible: () => 'Abrir', abierta: () => 'Ver premio' };

  function refrescar() {
    for (const [dia, b] of botones) {
      const estado = cal.estado(dia);
      b.dataset.estado = estado;
      b.setAttribute('aria-label', etiquetaAria(dia, estado));
      b.setAttribute('aria-disabled', estado === 'bloqueada' ? 'true' : 'false');
      b.querySelector('.casilla__pista').textContent = PISTAS[estado](dia);
      const img = b.querySelector('.casilla__premio');
      if (estado === 'abierta' && !img.getAttribute('src')) {
        img.src = `assets/svg/premios/${premioDelDia(dia).ilustracion}.svg`;
      }
    }
    escena?.actualizar();
    $('progreso-texto').textContent = `Has abierto ${cal.totalAbiertas()} de 24`;
    pintarEstado();
  }

  // ---------- Banda de estado, cuenta atrás y mensaje final ----------
  let tCuenta = null;
  function pintarEstado() {
    const fase = cal.fase();
    const texto = $('estado-texto');
    const accion = $('estado-accion');
    accion.hidden = true;
    raiz.dataset.fase = fase;

    if (fase === 'antes') {
      texto.innerHTML = 'La primera casilla se abre el <strong>1 de diciembre</strong>. ¡Ya queda muy poco!';
    } else if (fase === 'activa') {
      const hoy = cal.diaDeHoy();
      if (cal.abierta(hoy)) {
        texto.innerHTML = hoy === 24
          ? 'Has abierto el último regalo. <strong>¡Felices fiestas!</strong>'
          : `Ya has abierto la casilla de hoy. Vuelve mañana, <strong>${textoDia(hoy + 1)}</strong>, a por la siguiente.`;
      } else {
        texto.innerHTML = `Hoy es <strong>${textoDia(hoy)}</strong>: ¡tu casilla ${hoy} te espera!`;
        accion.hidden = false;
        accion.textContent = `Abrir la casilla ${hoy}`;
        accion.onclick = () => abrirCasilla(hoy, 'lista', botones.get(hoy));
      }
    } else {
      texto.innerHTML = 'El Adviento ha terminado: <strong>consulta tus premios</strong> y canjéalos antes de que caduquen.';
    }

    mostrarAviso('cuenta-atras', fase === 'antes');
    mostrarAviso('final', fase === 'despues');
    clearInterval(tCuenta);
    if (fase === 'antes') {
      actualizarCuenta();
      tCuenta = setInterval(actualizarCuenta, 1000);
    }
  }

  function mostrarAviso(id, visible) {
    const el = $(id);
    el.hidden = !visible || avisosCerrados.has(id);
  }

  document.querySelectorAll('[data-cerrar-aviso]').forEach((b) => {
    b.addEventListener('click', () => {
      const aviso = b.closest('.aviso');
      avisosCerrados.add(aviso.id);
      aviso.hidden = true;
      (botones.get(cal.diaDeHoy() || 1) || lista).focus({ preventScroll: modo === '3d' });
    });
  });

  let ultimoResumen = '';
  function actualizarCuenta() {
    const ms = cal.msHastaInicio();
    const s = Math.floor(ms / 1000);
    const dias = Math.floor(s / 86400);
    const horas = Math.floor((s % 86400) / 3600);
    const min = Math.floor((s % 3600) / 60);
    const seg = s % 60;
    const dos = (n) => String(n).padStart(2, '0');
    $('ca-dias').textContent = dos(dias);
    $('ca-horas').textContent = dos(horas);
    $('ca-min').textContent = dos(min);
    $('ca-seg').textContent = dos(seg);
    const resumen = `Faltan ${dias} días, ${horas} horas y ${min} minutos para el 1 de diciembre.`;
    if (resumen !== ultimoResumen) {
      ultimoResumen = resumen;
      $('ca-resumen').textContent = resumen;
    }
  }

  // ---------- Apertura de casillas ----------
  async function abrirCasilla(dia, origen, boton) {
    if (ocupado || modal.abierto) return;
    const estado = cal.estado(dia);
    const premio = premioDelDia(dia);
    const devolverFoco = boton || botones.get(dia);

    if (estado === 'bloqueada') {
      avisar(`La casilla ${dia} aún está cerrada. ¡Vuelve el ${textoDia(dia)}!`);
      audio.bloqueada();
      escena?.sacudir(dia);
      const b = botones.get(dia);
      b.classList.remove('is-sacudida');
      void b.offsetWidth;
      b.classList.add('is-sacudida');
      return;
    }

    if (estado === 'abierta') {
      escena?.pausarAutoGiro(true);
      modal.abrir(premio, devolverFoco);
      return;
    }

    ocupado = true;
    audio.abrir();
    try {
      if (modo === '3d' && escena) {
        await escena.abrirRegalo(dia, { desdeLista: origen === 'lista' });
      } else {
        await animarCasilla2D(botones.get(dia));
      }
    } catch (err) {
      console.warn(err);
    } finally {
      ocupado = false;
    }
    cal.marcarAbierta(dia);
    escena?.pausarAutoGiro(true);
    modal.abrir(premio, devolverFoco);
  }

  function animarCasilla2D(boton) {
    return new Promise((resolve) => {
      if (!boton) return resolve();
      boton.classList.add('is-abriendo');
      const ms = movimientoReducido ? 150 : 750;
      setTimeout(() => {
        boton.classList.remove('is-abriendo');
        resolve();
      }, ms);
    });
  }

  // ---------- Tooltip sobre la escena (ratón) ----------
  const tooltip = $('tooltip');
  function alHoverEscena(dia, pos) {
    for (const [d, b] of botones) b.classList.toggle('is-resaltada', d === dia);
    if (!dia || !pos) {
      tooltip.hidden = true;
      return;
    }
    const estado = cal.estado(dia);
    const textos = {
      bloqueada: `Casilla ${dia} · Vuelve el ${textoDia(dia)}`,
      hoy: `Casilla ${dia} · ¡Disponible hoy! Pulsa para abrir`,
      disponible: `Casilla ${dia} · Pulsa para abrir`,
      abierta: `Casilla ${dia} · Ver tu premio`,
    };
    tooltip.textContent = textos[estado];
    tooltip.dataset.estado = estado;
    tooltip.style.transform = `translate(${Math.round(pos.x)}px, ${Math.round(pos.y)}px) translate(-50%, -135%)`;
    tooltip.hidden = false;
  }

  // ---------- Pantalla de carga ----------
  const cargador = $('cargador');
  const relleno = $('cargador-relleno');
  const barra = cargador.querySelector('[role="progressbar"]');
  let progresoActual = 0;
  function fijarProgreso(p) {
    progresoActual = Math.max(progresoActual, Math.min(1, p));
    relleno.style.transform = `scaleX(${progresoActual})`;
    barra.setAttribute('aria-valuenow', String(Math.round(progresoActual * 100)));
  }
  function ocultarCargador() {
    fijarProgreso(1);
    setTimeout(() => {
      cargador.classList.add('is-oculto');
      setTimeout(() => { cargador.hidden = true; }, 500);
    }, 200);
  }
  function mostrarCargador() {
    progresoActual = 0;
    fijarProgreso(0.02);
    cargador.hidden = false;
    cargador.classList.remove('is-oculto');
  }

  // ---------- Modos 3D / 2D ----------
  function fijarModo(nuevo) {
    modo = nuevo;
    raiz.classList.toggle('modo-3d', nuevo === '3d');
    raiz.classList.toggle('modo-2d', nuevo === '2d');
    const boton = $('btn-vista');
    const texto = nuevo === '3d' ? 'Cambiar a vista sencilla' : 'Cambiar a vista 3D';
    boton.title = texto;
    $('btn-vista-texto').textContent = texto;
    boton.setAttribute('aria-pressed', nuevo === '2d' ? 'true' : 'false');
    boton.hidden = !hayWebGL;
  }

  function activar2D() {
    if (escena) {
      escena.destruir();
      escena = null;
    }
    tooltip.hidden = true;
    fijarModo('2d');
    refrescar();
  }

  async function activar3D({ vigilar = true } = {}) {
    mostrarCargador();
    // Avance suave mientras se descarga Three.js desde el CDN.
    let simulado = 0.02;
    const tDescarga = setInterval(() => {
      simulado += (0.3 - simulado) * 0.08;
      fijarProgreso(simulado);
    }, 120);
    try {
      await A.cargarThree();
      clearInterval(tDescarga);
      fijarProgreso(0.32);
      fijarModo('3d');
      escena = await A.crearEscena($('escena'), {
        premios: PREMIOS,
        estadoDe: (dia) => cal.estado(dia),
        calidad,
        movimientoReducido,
        diaInicial: cal.diaDeHoy() || (cal.fase() === 'antes' ? 1 : 24),
        alProgreso: (p) => fijarProgreso(0.32 + p * 0.68),
        alSeleccionar: (dia) => abrirCasilla(dia, 'escena'),
        alHover: alHoverEscena,
      });
      refrescar();
      ocultarCargador();
      if (vigilar && !modoForzado) vigilarRendimiento();
    } catch (err) {
      clearInterval(tDescarga);
      console.warn('No se ha podido iniciar la escena 3D. Se usa la vista sencilla.', err);
      if (escena) { try { escena.destruir(); } catch { /* nada */ } escena = null; }
      $('escena').textContent = '';
      activar2D();
      ocultarCargador();
      avisar('Hemos activado la vista sencilla para que el calendario funcione en tu dispositivo.');
    }
  }

  async function vigilarRendimiento() {
    if (!escena) return;
    const instancia = escena;
    const fps = await escena.medirRendimiento();
    if (escena !== instancia || modo !== '3d') return;
    if (fps < 20) {
      activar2D();
      avisar('Tu dispositivo iba un poco justo: hemos activado la vista sencilla. Puedes volver al 3D con el botón de arriba.', 6000);
    }
  }

  $('btn-vista').addEventListener('click', () => {
    if (modal.abierto || ocupado) return;
    if (modo === '3d') {
      guardarPreferencia('2d');
      activar2D();
      avisar('Vista sencilla activada.');
    } else {
      guardarPreferencia('3d');
      activar3D({ vigilar: false });
    }
  });

  // ---------- Sonido ----------
  $('btn-sonido').addEventListener('click', async (e) => {
    const boton = e.currentTarget;
    const activo = await audio.alternar();
    boton.setAttribute('aria-pressed', activo ? 'true' : 'false');
    const texto = activo ? 'Desactivar sonido' : 'Activar sonido';
    boton.title = texto;
    $('btn-sonido-texto').textContent = texto;
  });

  // ---------- Arranque ----------
  crearCasillas();
  refrescar();
  let ultimoDia = `${cal.fase()}-${cal.diaDeHoy()}`;
  cal.alCambiar(() => {
    refrescar();
    const clave = `${cal.fase()}-${cal.diaDeHoy()}`;
    if (clave === ultimoDia) return; // solo ha cambiado una casilla abierta
    ultimoDia = clave;
    if (cal.fase() === 'activa') avisar(`¡Ya puedes abrir la casilla ${cal.diaDeHoy()}!`);
    else if (cal.fase() === 'despues') avisar('¡Felices fiestas! El calendario queda en modo consulta.');
  });
  cal.iniciarReloj();

  const preferencia = leerPreferencia();
  let modoInicial;
  if (modoForzado) modoInicial = modoForzado === '3d' && hayWebGL ? '3d' : '2d';
  else if (!hayWebGL || muyLento || preferencia === '2d') modoInicial = '2d';
  else modoInicial = '3d';

  if (modoInicial === '3d') {
    activar3D();
  } else {
    fijarModo('2d');
    refrescar();
    ocultarCargador();
  }
})(window.Adviento = window.Adviento || {});
