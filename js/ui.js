// Utilidades de interfaz: avisos, ventanas modales, confirmaciones y descargas.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { esc } = App['format'];

  const $ = (sel, raiz = document) => raiz.querySelector(sel);
  const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

  let contadorId = 0;
  const idUnico = (pref = 'id') => `${pref}-${++contadorId}`;

  /** Aviso flotante. tipo: info | exito | aviso | error */
  function toast(mensaje, tipo = 'info', ms = 4500) {
    const cont = document.getElementById('toasts');
    if (!cont) { alert(mensaje); return; }
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML = `<span>${esc(mensaje)}</span><button type="button" class="btn-icono" aria-label="Cerrar aviso">×</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    cont.appendChild(el);
    if (ms) setTimeout(() => el.remove(), tipo === 'error' ? ms * 2 : ms);
  }

  /**
   * Abre un diálogo modal accesible (<dialog>).
   * acciones: [{ texto, clase, tipo: 'button'|'submit', form, valor, alPulsar(dlg) }]
   * Devuelve { dlg, cerrar(valor), resultado: Promise }.
   */
  function abrirModal({ titulo, contenido, acciones = [], ancho = 'md', alAbrir } = {}) {
    const previo = document.activeElement;
    const dlg = document.createElement('dialog');
    const idTitulo = idUnico('modal-titulo');
    dlg.className = `modal modal-${ancho}`;
    dlg.setAttribute('aria-labelledby', idTitulo);
    dlg.innerHTML = `
      <div class="modal-cab">
        <h2 id="${idTitulo}">${esc(titulo)}</h2>
        <button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">×</button>
      </div>
      <div class="modal-cuerpo">${contenido || ''}</div>
      <div class="modal-pie"></div>`;
    const pie = dlg.querySelector('.modal-pie');
    let resolver;
    const resultado = new Promise((r) => (resolver = r));
    let valorCierre;
    const cerrar = (valor) => {
      valorCierre = valor;
      if (dlg.open) dlg.close();
    };
    for (const a of acciones) {
      const b = document.createElement('button');
      b.type = a.tipo || 'button';
      b.className = `btn ${a.clase || 'btn-secundario'}`;
      b.textContent = a.texto;
      if (a.form) b.setAttribute('form', a.form);
      if (b.type === 'button') {
        b.addEventListener('click', async () => {
          if (a.alPulsar) {
            const r = await a.alPulsar(dlg);
            if (r === false) return;
          }
          cerrar(a.valor);
        });
      }
      pie.appendChild(b);
    }
    if (!acciones.length) pie.remove();
    dlg.querySelector('[data-cerrar]').addEventListener('click', () => cerrar(undefined));
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolver(valorCierre);
      if (previo && document.contains(previo)) previo.focus();
    });
    document.body.appendChild(dlg);
    dlg.showModal();
    if (alAbrir) alAbrir(dlg);
    const foco = dlg.querySelector('[autofocus]') || dlg.querySelector('.modal-cuerpo input, .modal-cuerpo select, .modal-cuerpo textarea') || pie.querySelector('.btn-primario') || dlg.querySelector('[data-cerrar]');
    foco?.focus();
    return { dlg, cerrar, resultado };
  }

  /** Confirmación sí/no. Devuelve Promise<boolean>. */
  function confirmar(mensaje, { titulo = 'Confirmar', ok = 'Aceptar', cancelar = 'Cancelar', peligro = false, html = false } = {}) {
    const { resultado } = abrirModal({
      titulo,
      ancho: 'sm',
      contenido: html ? mensaje : `<p>${esc(mensaje)}</p>`,
      acciones: [
        { texto: cancelar, clase: 'btn-secundario', valor: false },
        { texto: ok, clase: peligro ? 'btn-peligro' : 'btn-primario', valor: true },
      ],
    });
    return resultado.then((v) => v === true);
  }

  function alerta(mensaje, titulo = 'Aviso') {
    return abrirModal({ titulo, ancho: 'sm', contenido: `<p>${esc(mensaje)}</p>`, acciones: [{ texto: 'Entendido', clase: 'btn-primario' }] }).resultado;
  }

  function descargar(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /** <option> para un <select> a partir de una lista de {id, nombre}. */
  function opciones(lista, seleccionado, { vacio } = {}) {
    let html = vacio !== undefined ? `<option value="">${esc(vacio)}</option>` : '';
    for (const x of lista) html += `<option value="${esc(x.id)}"${x.id === seleccionado ? ' selected' : ''}>${esc(x.nombre)}</option>`;
    return html;
  }

  /** Lee los campos de un formulario como objeto (valores de texto). */
  function datosFormulario(form) {
    const fd = new FormData(form);
    const o = {};
    for (const [k, v] of fd.entries()) o[k] = typeof v === 'string' ? v.trim() : v;
    return o;
  }

  function leerArchivoTexto(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsText(file, 'utf-8');
    });
  }

  function leerArchivoDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
  }

  function requiereLibreria(nombre, global) {
    if (!globalThis[global]) {
      toast(`No se ha podido cargar la librería ${nombre}. Compruebe que la carpeta vendor/ está junto a index.html y recargue la página.`, 'error');
      return false;
    }
    return true;
  }

  /** Punto de color de departamento (decorativo). */
  const punto = (color) => `<span class="punto" style="--c:${esc(color || '#888')}" aria-hidden="true"></span>`;

  function badgeEstado(estado, nombre) {
    return `<span class="badge estado-${esc(estado)}">${esc(nombre)}</span>`;
  }

  function badgeSemaforo(s, texto) {
    const icono = { verde: '●', ambar: '▲', rojo: '■' }[s] || '●';
    return `<span class="semaforo semaforo-${s}"><span aria-hidden="true">${icono}</span> ${esc(texto)}</span>`;
  }

  App['ui'] = { $, $$, idUnico, toast, abrirModal, confirmar, alerta, descargar, opciones, datosFormulario, leerArchivoTexto, leerArchivoDataURL, requiereLibreria, punto, badgeEstado, badgeSemaforo };
})();
