// Arranque de la aplicación y enrutado por hash entre pantallas.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { iniciar, state, almacen, alCambiar, setManejadorError, diasDesdeUltimaCopia, hayDatos, guardarConfig } = App['db'];
  const { toast, $, $$ } = App['ui'];
  const panel = App['panel'];
  const articulos = App['articulos'];
  const pedidos = App['pedidos'];
  const departamentos = App['departamentos'];
  const proveedores = App['proveedores'];
  const centros = App['centros'];
  const categorias = App['categorias'];
  const importar = App['importar'];
  const ajustes = App['ajustes'];
  const imprimir = App['imprimir'];

  const RUTAS = { panel, articulos, pedidos, departamentos, proveedores, centros, categorias, importar, ajustes, imprimir };
  let vistaActual = null;
  let primeraCarga = true;

  function leerRuta() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [ruta, qs = ''] = hash.split('?');
    const partes = ruta.split('/').filter(Boolean).map(decodeURIComponent);
    const nombre = partes[0] || 'panel';
    return { nombre, params: partes.slice(1), query: Object.fromEntries(new URLSearchParams(qs)) };
  }

  async function renderizar() {
    const { nombre, params, query } = leerRuta();
    const clave = RUTAS[nombre] ? nombre : 'panel';
    const vista = RUTAS[clave];
    const main = $('#vista');
    try { vistaActual?.salir?.(); } catch (e) { console.error(e); }
    vistaActual = vista;
    for (const a of $$('.menu a')) {
      if (a.dataset.ruta === clave) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    cerrarMenu();
    main.innerHTML = '';
    try {
      await vista.render(main, { params, query });
    } catch (e) {
      console.error(e);
      main.innerHTML = `<div class="aviso aviso-error"><p>Se ha producido un error al mostrar esta pantalla: ${String(e.message || e)}</p></div>`;
    }
    const h1 = main.querySelector('h1');
    document.title = (h1 ? h1.textContent + ' · ' : '') + 'Gestión de compras de material';
    if (!primeraCarga) main.focus({ preventScroll: true });
    primeraCarga = false;
    window.scrollTo(0, 0);
  }

  // ---------- Avisos globales ----------
  function actualizarAvisos() {
    const cont = $('#avisos-globales');
    let html = '';
    if (!almacen.persistente) {
      html += `<div class="aviso aviso-error" role="alert"><p><strong>El almacenamiento local no está disponible.</strong>
        Los datos solo se mantendrán mientras esta pestaña siga abierta (motivo: ${String(almacen.error?.message || 'desconocido')}).
        Salga de la navegación privada o use Chrome, Edge o Firefox, y exporte una copia de seguridad antes de cerrar.</p></div>`;
    }
    const dias = diasDesdeUltimaCopia();
    if (hayDatos() && (dias === null || dias > 7)) {
      const texto = dias === null ? 'Todavía no ha exportado ninguna copia de seguridad.' : `Han pasado ${dias} días desde la última copia de seguridad.`;
      html += `<div class="aviso aviso-aviso aviso-discreto"><p>${texto}</p><div class="acciones"><button type="button" class="btn btn-secundario btn-peq" id="btn-copia-rapida">Exportar copia ahora</button></div></div>`;
    }
    cont.innerHTML = html;
    $('#btn-copia-rapida')?.addEventListener('click', ajustes.descargarCopia);
    const provs = new Set(state.articulos.filter((a) => a.estado === 'pendiente').map((a) => a.proveedorId)).size;
    const c = $('#contador-pedidos');
    c.hidden = !provs;
    c.textContent = provs;
    c.title = `${provs} proveedores con artículos pendientes de pedir`;
  }

  // ---------- Tema ----------
  function aplicarTema(tema) {
    if (tema === 'light' || tema === 'dark') document.documentElement.dataset.theme = tema;
    else delete document.documentElement.dataset.theme;
    const sel = $('#selector-tema');
    if (sel) sel.value = tema || 'auto';
    window.dispatchEvent(new CustomEvent('cambio-tema'));
  }

  // ---------- Menú en tablet ----------
  function cerrarMenu() {
    $('#lateral').classList.remove('abierta');
    $('#btn-menu').setAttribute('aria-expanded', 'false');
  }

  async function arrancar() {
    setManejadorError((e) => toast(e.message || String(e), 'error'));
    await iniciar();
    aplicarTema(state.config.tema);
    $('#selector-tema').addEventListener('change', (e) => {
      aplicarTema(e.target.value);
      guardarConfig('tema', e.target.value);
    });
    $('#btn-menu').addEventListener('click', () => {
      const l = $('#lateral');
      const abierta = l.classList.toggle('abierta');
      $('#btn-menu').setAttribute('aria-expanded', String(abierta));
      if (abierta) l.querySelector('a')?.focus();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#lateral').classList.contains('abierta')) { cerrarMenu(); $('#btn-menu').focus(); }
    });
    $('#saltar').addEventListener('click', (e) => { e.preventDefault(); $('#vista').focus(); });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => window.dispatchEvent(new CustomEvent('cambio-tema')));

    alCambiar((tipo) => {
      actualizarAvisos();
      if (tipo === '*') { aplicarTema(state.config.tema); renderizar(); }
    });
    actualizarAvisos();
    window.addEventListener('hashchange', renderizar);
    if (!location.hash) history.replaceState(null, '', '#/panel');
    await renderizar();
  }

  arrancar().catch((e) => {
    console.error(e);
    document.getElementById('vista').innerHTML = `<div class="aviso aviso-error"><p>No se pudo iniciar la aplicación: ${String(e.message || e)}</p></div>`;
  });

  App['app'] = { aplicarTema };
})();
