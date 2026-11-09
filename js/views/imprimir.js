// Vistas imprimibles (A4): pedido por proveedor y resumen de presupuesto por departamento.
import { state, porId } from '../db.js';
import { esc, eur, pct, fmtNum, fmtFecha, collator } from '../format.js';
import { totalesLineas, importesLinea, resumenDepartamento, siguienteNumeroPedido, SEMAFORO_TEXTO, nombreEstado } from '../models.js';
import { $ } from '../ui.js';
import { prepararLineas } from '../excel.js';
import { pendientesDe, pedidosEmitidos } from './pedidos.js';

const br = (s) => esc(s || '').replace(/\n/g, '<br>');

export function render(main, { params = [], query = {} } = {}) {
  const [tipo, id] = params;
  if (tipo === 'proveedor') return vistaPedidoProveedor(main, id);
  if (tipo === 'pedido') return vistaPedidoEmitido(main, id);
  return vistaPresupuesto(main, query);
}

function marco(main, titulo, volver, contenido, opcionesHtml = '') {
  main.innerHTML = `
    <h1 class="oculto-visual">${esc(titulo)}</h1>
    <div class="barra-impresion no-imprimir">
      <a class="btn btn-secundario" href="${volver}">← Volver</a>
      <div class="acciones">${opcionesHtml}<button type="button" class="btn btn-primario" id="btn-imprimir">Imprimir o guardar como PDF</button></div>
    </div>
    <div class="hoja" id="hoja">${contenido}</div>`;
  $('#btn-imprimir', main).addEventListener('click', () => window.print());
}

function cabeceraEmpresa() {
  const e = state.config.empresa;
  const logo = state.config.logo?.dataURL ? `<img src="${esc(state.config.logo.dataURL)}" alt="Logotipo de ${esc(e.razonSocial || 'la empresa')}">` : `<strong style="font-size:13pt;color:#1e3a8a">${esc(e.razonSocial || '')}</strong>`;
  return logo;
}

/** HTML de un pedido (borrador o emitido). */
export function htmlPedido({ proveedor, lineas, numero, fecha, observaciones = '', borrador = false }) {
  const e = state.config.empresa;
  const filas = prepararLineas(lineas, state);
  const t = totalesLineas(filas);
  const centros = [...new Set(filas.map((l) => l.centroId))];
  return `
    <div class="cab-doc">
      <div>${cabeceraEmpresa()}</div>
      <div class="datos-doc">
        <h1>PEDIDO DE COMPRA${borrador ? ' (BORRADOR)' : ''}</h1>
        <div><strong>Nº de pedido:</strong> <span class="mono">${esc(numero)}</span></div>
        <div><strong>Fecha:</strong> ${fmtFecha(fecha)}</div>
      </div>
    </div>
    ${borrador ? '<p style="font-size:9pt;color:#8a4b00">Borrador: el número definitivo se asigna al generar el Excel desde la pantalla de pedidos.</p>' : ''}
    <div class="bloques">
      <div class="bloque"><strong>Datos del comprador (facturación)</strong>${esc(e.razonSocial)}${e.cif ? `\nCIF: ${esc(e.cif)}` : ''}\n${esc(e.direccion)}
Contacto: ${esc([e.contacto, e.telefono, e.email].filter(Boolean).join(' · '))}</div>
      <div class="bloque"><strong>Datos del proveedor</strong>${esc(proveedor.nombre)}${proveedor.cif ? `\nCIF: ${esc(proveedor.cif)}` : ''}\n${esc(proveedor.direccion || '')}
Contacto: ${esc([proveedor.contacto, proveedor.telefono, proveedor.email].filter(Boolean).join(' · '))}</div>
    </div>
    <h2>Líneas del pedido</h2>
    <table>
      <thead><tr><th>Referencia</th><th>Descripción</th><th>Centro de entrega</th><th>Departamento</th><th class="num">Cant.</th><th class="num">Precio unit.</th><th class="num">Base imp.</th><th class="num">IVA</th><th class="num">Cuota IVA</th><th class="num">Total</th></tr></thead>
      <tbody>${filas.map((l) => {
        const i = importesLinea(l);
        return `<tr><td class="mono">${esc(l.referencia)}</td><td>${esc(l.descripcion)}${l.notas ? `<br><small>${esc(l.notas)}</small>` : ''}</td><td>${esc(l.centro)}</td><td>${esc(l.departamento)}</td>
          <td class="num">${fmtNum(l.cantidad, Number.isInteger(l.cantidad) ? 0 : 2)}</td><td class="num">${eur(l.precio)}</td><td class="num">${eur(i.base)}</td>
          <td class="num">${fmtNum(l.iva, 0)} %</td><td class="num">${eur(i.cuota)}</td><td class="num"><strong>${eur(i.total)}</strong></td></tr>`;
      }).join('')}</tbody>
    </table>
    <table class="totales">
      <tbody>
        <tr><td>Base imponible</td><td class="num">${eur(t.base)}</td></tr>
        ${t.porTipo.map((p) => `<tr><td>IVA ${fmtNum(p.iva, 0)} % sobre ${eur(p.base)}</td><td class="num">${eur(p.cuota)}</td></tr>`).join('')}
        <tr><td>Total IVA</td><td class="num">${eur(t.cuota)}</td></tr>
        <tr class="total"><td>TOTAL DEL PEDIDO</td><td class="num">${eur(t.total)}</td></tr>
      </tbody>
    </table>
    <h2>Direcciones de entrega</h2>
    <div class="bloques">${centros.map((id) => {
      const c = porId('centros', id);
      const n = filas.filter((l) => l.centroId === id).length;
      return `<div class="bloque"><strong>${esc(c?.nombre || 'Sin centro asignado')} · ${n} ${n === 1 ? 'línea' : 'líneas'}</strong>${br(c?.direccion || 'Consultar con el comprador')}</div>`;
    }).join('')}</div>
    <h2>Observaciones</h2>
    <div class="bloque" style="min-height:50px">${br(observaciones) || '&nbsp;'}</div>
    <h2>Condiciones de pago</h2>
    <div class="bloque">${br(proveedor.condicionesPago || 'Según condiciones acordadas con el proveedor.')}</div>
    <p class="pie-doc">Rogamos indiquen el número de pedido ${esc(numero)} en el albarán de entrega y en la factura.</p>`;
}

function vistaPedidoProveedor(main, id) {
  const proveedor = porId('proveedores', id);
  if (!proveedor) { main.innerHTML = '<div class="aviso aviso-error"><p>Proveedor no encontrado.</p></div>'; return; }
  const lineas = pendientesDe(id);
  const { numero } = siguienteNumeroPedido(state.config.pedido);
  marco(main, `Pedido de ${proveedor.nombre}`, '#/pedidos', lineas.length
    ? htmlPedido({ proveedor, lineas, numero, fecha: new Date(), borrador: true })
    : '<p>Este proveedor no tiene artículos pendientes de pedir.</p>');
}

function vistaPedidoEmitido(main, numero) {
  const p = pedidosEmitidos().find((x) => x.numero === numero);
  if (!p) { main.innerHTML = '<div class="aviso aviso-error"><p>Pedido no encontrado.</p></div>'; return; }
  const proveedor = porId('proveedores', p.proveedorId) || { nombre: '—' };
  marco(main, `Pedido ${numero}`, '#/pedidos', htmlPedido({
    proveedor, lineas: p.lineas.filter((a) => a.estado !== 'cancelado'), numero, fecha: p.fecha ? new Date(p.fecha) : new Date(), observaciones: p.observaciones,
  }));
}

function vistaPresupuesto(main, query) {
  const anios = [...new Set(state.departamentos.map((d) => Number(d.ejercicio)).filter(Boolean))].sort((a, b) => b - a);
  const actual = new Date().getFullYear();
  const ejercicio = Number(query.ejercicio) || (anios.includes(actual) ? actual : anios[0]);
  const detalle = query.detalle === '1';
  const deps = state.departamentos.filter((d) => !ejercicio || Number(d.ejercicio) === ejercicio).sort((a, b) => collator.compare(a.nombre, b.nombre));
  const res = deps.map((d) => ({ d, r: resumenDepartamento(d, state.articulos, state.config) }));
  const tot = res.reduce((t, { r }) => {
    for (const k of ['presupuesto', 'previsto', 'comprometido', 'ejecutado', 'consumo', 'disponible']) t[k] += r[k];
    t.conIva += r.conIva.consumo;
    return t;
  }, { presupuesto: 0, previsto: 0, comprometido: 0, ejecutado: 0, consumo: 0, disponible: 0, conIva: 0 });
  const criterio = state.config.presupuesto.base === 'total' ? 'total con IVA' : 'base imponible (sin IVA)';
  const e = state.config.empresa;

  const contenido = `
    <div class="cab-doc">
      <div>${cabeceraEmpresa()}</div>
      <div class="datos-doc"><h1>Resumen de presupuesto</h1><div>Ejercicio ${ejercicio || '—'}</div><div>Fecha: ${fmtFecha(new Date())}</div></div>
    </div>
    <p style="font-size:9pt">Control sobre la ${criterio}. Umbrales: ámbar desde el ${state.config.presupuesto.ambar} %, rojo por encima del ${state.config.presupuesto.rojo} %. Los artículos cancelados no computan.</p>
    <table>
      <thead><tr><th>Departamento</th><th>Responsable</th><th class="num">Presupuesto</th><th class="num">Previsto</th><th class="num">Comprometido</th><th class="num">Ejecutado</th><th class="num">Consumo</th><th class="num">Disponible</th><th class="num">%</th><th>Estado</th></tr></thead>
      <tbody>${res.map(({ d, r }) => `<tr><td><span class="punto" style="--c:${esc(d.color)}"></span>${esc(d.nombre)}</td><td>${esc(d.responsable || '')}</td>
        <td class="num">${eur(r.presupuesto)}</td><td class="num">${eur(r.previsto)}</td><td class="num">${eur(r.comprometido)}</td><td class="num">${eur(r.ejecutado)}</td>
        <td class="num"><strong>${eur(r.consumo)}</strong></td><td class="num">${eur(r.disponible)}</td><td class="num">${pct(r.porcentaje)}</td>
        <td class="semaforo-${r.semaforo}">${SEMAFORO_TEXTO[r.semaforo]}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="num">${eur(tot.presupuesto)}</td><td class="num">${eur(tot.previsto)}</td><td class="num">${eur(tot.comprometido)}</td>
        <td class="num">${eur(tot.ejecutado)}</td><td class="num">${eur(tot.consumo)}</td><td class="num">${eur(tot.disponible)}</td>
        <td class="num">${pct(tot.presupuesto ? (tot.consumo / tot.presupuesto) * 100 : 0)}</td><td></td></tr></tfoot>
    </table>
    <p style="font-size:9pt;margin-top:6px">Consumo total con IVA (informativo): <strong>${eur(tot.conIva)}</strong>.</p>
    ${detalle ? res.map(({ d }) => {
      const arts = state.articulos.filter((a) => a.departamentoId === d.id && a.estado !== 'cancelado')
        .sort((a, b) => collator.compare(a.descripcion, b.descripcion));
      const t = totalesLineas(arts);
      return `<div class="dep-imp"><h2>${esc(d.nombre)}</h2>
        <table><thead><tr><th>Descripción</th><th>Proveedor</th><th>Centro</th><th>Estado</th><th class="num">Base imp.</th><th class="num">Total</th></tr></thead>
        <tbody>${arts.map((a) => { const i = importesLinea(a); return `<tr><td>${esc(a.descripcion)}</td><td>${esc(porId('proveedores', a.proveedorId)?.nombre || '')}</td><td>${esc(porId('centros', a.centroId)?.nombre || '')}</td><td>${esc(nombreEstado(a.estado))}${a.numeroPedido ? ' · ' + esc(a.numeroPedido) : ''}</td><td class="num">${eur(i.base)}</td><td class="num">${eur(i.total)}</td></tr>`; }).join('') || '<tr><td colspan="6">Sin artículos.</td></tr>'}</tbody>
        <tfoot><tr><td colspan="4">Total ${esc(d.nombre)}</td><td class="num">${eur(t.base)}</td><td class="num">${eur(t.total)}</td></tr></tfoot></table></div>`;
    }).join('') : ''}
    <p class="pie-doc">${esc(e.razonSocial || '')} · Informe generado el ${fmtFecha(new Date())}.</p>`;

  const opcionesHtml = `
    ${anios.length > 1 ? `<label for="imp-ej">Ejercicio</label><select id="imp-ej" style="width:auto">${anios.map((a) => `<option ${a === ejercicio ? 'selected' : ''}>${a}</option>`).join('')}</select>` : ''}
    <label class="check"><input type="checkbox" id="imp-det" ${detalle ? 'checked' : ''}> Incluir detalle de artículos</label>`;
  marco(main, 'Resumen de presupuesto', '#/panel', deps.length ? contenido : '<p>No hay departamentos que mostrar.</p>', opcionesHtml);
  const ir = () => {
    const ej = $('#imp-ej', main)?.value || ejercicio || '';
    location.hash = `#/imprimir/presupuesto?ejercicio=${ej}&detalle=${$('#imp-det', main).checked ? 1 : 0}`;
  };
  $('#imp-ej', main)?.addEventListener('change', ir);
  $('#imp-det', main).addEventListener('change', ir);
}
