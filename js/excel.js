// Generación del pedido formal por proveedor con ExcelJS (global `ExcelJS` cargado desde vendor/).
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { fmtFecha, nombreArchivo, round2, num, collator } = App['format'];
  const { importesLinea, totalesLineas } = App['models'];

  const COLOR = {
    marca: 'FF1E3A8A',
    cabTabla: 'FF1E3A8A',
    seccion: 'FFE3E9F5',
    zebra: 'FFF6F8FB',
    borde: 'FFB9C0CB',
    texto: 'FF111827',
    suave: 'FF4B5563',
  };
  const FMT_EUR = '#,##0.00 "€"';
  const FMT_PCT = '0%';
  const COLS = 10; // A..J
  const L = (n) => String.fromCharCode(64 + n); // 1 -> A

  const borde = { style: 'thin', color: { argb: COLOR.borde } };
  const bordes = { top: borde, left: borde, bottom: borde, right: borde };

  /**
   * Prepara las líneas del pedido con nombres de centro y departamento, ordenadas por centro.
   * lineas: artículos; maestros: { centros, departamentos }
   */
  function prepararLineas(lineas, { centros = [], departamentos = [] } = {}) {
    const nombre = (lista, id) => lista.find((x) => x.id === id)?.nombre || '';
    return lineas
      .map((a) => ({
        id: a.id,
        referencia: a.referencia || '',
        descripcion: a.descripcion || '',
        centroId: a.centroId || '',
        centro: nombre(centros, a.centroId) || 'Sin centro asignado',
        departamento: nombre(departamentos, a.departamentoId),
        cantidad: num(a.cantidad),
        precio: num(a.precio),
        iva: num(a.iva),
        notas: a.notas || '',
      }))
      .sort((x, y) => collator.compare(x.centro, y.centro) || collator.compare(x.departamento, y.departamento) || collator.compare(x.descripcion, y.descripcion));
  }

  function nombreArchivoPedido(numero, proveedor) {
    const n = String(numero).replace(/[\\/:*?"<>|\s]+/g, '-');
    return `${n}_${nombreArchivo(proveedor?.nombre)}.xlsx`;
  }

  function seccion(ws, fila, desde, hasta, texto) {
    ws.mergeCells(fila, desde, fila, hasta);
    const c = ws.getCell(fila, desde);
    c.value = texto;
    c.font = { bold: true, size: 10, color: { argb: COLOR.marca } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.seccion } };
    c.alignment = { vertical: 'middle' };
    for (let col = desde; col <= hasta; col++) ws.getCell(fila, col).border = bordes;
  }

  function parDato(ws, fila, colEtq, colDesde, colHasta, etiqueta, valor) {
    const e = ws.getCell(fila, colEtq);
    e.value = etiqueta;
    e.font = { bold: true, size: 9, color: { argb: COLOR.suave } };
    e.alignment = { vertical: 'top' };
    ws.mergeCells(fila, colDesde, fila, colHasta);
    const v = ws.getCell(fila, colDesde);
    v.value = valor || '';
    v.font = { size: 10, color: { argb: COLOR.texto } };
    v.alignment = { vertical: 'top', wrapText: true };
  }

  const lineasTexto = (s) => String(s || '').split('\n').length;

  /**
   * Construye el libro de un pedido.
   * datos: { empresa, logo:{dataURL,ancho,alto}|null, proveedor, lineas (prepararLineas), centros, numero, fecha (Date), observaciones }
   */
  function construirLibroPedido(datos, ExcelJS = globalThis.ExcelJS) {
    const { empresa = {}, logo, proveedor = {}, lineas, centros = [], numero, fecha = new Date(), observaciones = '' } = datos;
    const wb = new ExcelJS.Workbook();
    wb.creator = empresa.razonSocial || 'Gestión de compras de material';
    wb.created = fecha;
    wb.title = `Pedido ${numero}`;
    const ws = wb.addWorksheet('Pedido', {
      properties: { defaultRowHeight: 16 },
      views: [{ showGridLines: false }],
    });
    ws.columns = [
      { key: 'ref', width: 14 },
      { key: 'desc', width: 40 },
      { key: 'centro', width: 18 },
      { key: 'dep', width: 17 },
      { key: 'cant', width: 9 },
      { key: 'precio', width: 12 },
      { key: 'base', width: 13 },
      { key: 'iva', width: 7 },
      { key: 'cuota', width: 12 },
      { key: 'total', width: 14 },
    ];

    // ---- Cabecera ----
    ws.mergeCells('A1:D3');
    if (logo?.dataURL && /^data:image\/(png|jpe?g)/i.test(logo.dataURL)) {
      const ext = /png/i.test(logo.dataURL.slice(0, 20)) ? 'png' : 'jpeg';
      const id = wb.addImage({ base64: logo.dataURL, extension: ext });
      const maxW = 210, maxH = 58;
      const r = Math.min(maxW / (logo.ancho || maxW), maxH / (logo.alto || maxH), 1);
      ws.addImage(id, { tl: { col: 0.1, row: 0.15 }, ext: { width: Math.round((logo.ancho || maxW) * r), height: Math.round((logo.alto || maxH) * r) }, editAs: 'oneCell' });
    } else {
      const c = ws.getCell('A1');
      c.value = empresa.razonSocial || '';
      c.font = { bold: true, size: 14, color: { argb: COLOR.marca } };
      c.alignment = { vertical: 'middle' };
    }
    ws.mergeCells('E1:J1');
    ws.getCell('E1').value = 'PEDIDO DE COMPRA';
    ws.getCell('E1').font = { bold: true, size: 18, color: { argb: COLOR.marca } };
    ws.getCell('E1').alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(1).height = 26;
    ws.mergeCells('E2:J2');
    ws.getCell('E2').value = `Nº de pedido: ${numero}`;
    ws.getCell('E2').font = { bold: true, size: 12 };
    ws.getCell('E2').alignment = { horizontal: 'right' };
    ws.mergeCells('E3:J3');
    ws.getCell('E3').value = `Fecha: ${fmtFecha(fecha)}`;
    ws.getCell('E3').font = { size: 11 };
    ws.getCell('E3').alignment = { horizontal: 'right' };
    ws.getRow(4).height = 8;
    for (let c = 1; c <= COLS; c++) ws.getCell(4, c).border = { bottom: { style: 'medium', color: { argb: COLOR.marca } } };

    // ---- Comprador y proveedor ----
    let f = 6;
    seccion(ws, f, 1, 4, 'DATOS DEL COMPRADOR (FACTURACIÓN)');
    seccion(ws, f, 6, 10, 'DATOS DEL PROVEEDOR');
    const comprador = [
      ['Razón social', empresa.razonSocial],
      ['CIF', empresa.cif],
      ['Dirección', empresa.direccion],
      ['Contacto', empresa.contacto],
      ['Email', empresa.email],
      ['Teléfono', empresa.telefono],
    ];
    const prov = [
      ['Proveedor', proveedor.nombre],
      ['CIF', proveedor.cif],
      ['Dirección', proveedor.direccion],
      ['Contacto', proveedor.contacto],
      ['Email', proveedor.email],
      ['Teléfono', proveedor.telefono],
    ];
    for (let i = 0; i < comprador.length; i++) {
      f++;
      parDato(ws, f, 1, 2, 4, comprador[i][0], comprador[i][1]);
      parDato(ws, f, 6, 7, 10, prov[i][0], prov[i][1]);
      const lineasMax = Math.max(lineasTexto(comprador[i][1]), lineasTexto(prov[i][1]));
      if (lineasMax > 1) ws.getRow(f).height = 14 * lineasMax + 2;
    }
    f += 2;
    ws.getCell(f, 1).value = 'Persona de contacto para este pedido:';
    ws.getCell(f, 1).font = { bold: true, size: 9, color: { argb: COLOR.suave } };
    ws.mergeCells(f, 1, f, 2);
    ws.mergeCells(f, 3, f, 10);
    ws.getCell(f, 3).value = [empresa.contacto, empresa.telefono, empresa.email].filter(Boolean).join(' · ');
    ws.getCell(f, 3).font = { size: 10 };

    // ---- Tabla de líneas ----
    f += 2;
    const filaCab = f;
    const cabeceras = ['Referencia', 'Descripción', 'Centro de entrega', 'Departamento', 'Cantidad', 'Precio unit.', 'Base imponible', '% IVA', 'Cuota IVA', 'Total'];
    cabeceras.forEach((t, i) => {
      const c = ws.getCell(f, i + 1);
      c.value = t;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.cabTabla } };
      c.alignment = { vertical: 'middle', horizontal: i >= 4 ? 'right' : 'left', wrapText: true };
      c.border = bordes;
    });
    ws.getRow(f).height = 30;

    const primera = f + 1;
    lineas.forEach((l, idx) => {
      f++;
      const imp = importesLinea(l);
      const fila = ws.getRow(f);
      fila.getCell(1).value = l.referencia;
      fila.getCell(2).value = l.notas ? `${l.descripcion}\n(${l.notas})` : l.descripcion;
      fila.getCell(3).value = l.centro;
      fila.getCell(4).value = l.departamento;
      fila.getCell(5).value = l.cantidad;
      fila.getCell(5).numFmt = Number.isInteger(l.cantidad) ? '#,##0' : '#,##0.00';
      fila.getCell(6).value = l.precio;
      fila.getCell(6).numFmt = FMT_EUR;
      fila.getCell(7).value = { formula: `ROUND(E${f}*F${f},2)`, result: imp.base };
      fila.getCell(7).numFmt = FMT_EUR;
      fila.getCell(8).value = round2(l.iva) / 100;
      fila.getCell(8).numFmt = FMT_PCT;
      fila.getCell(9).value = { formula: `ROUND(G${f}*H${f},2)`, result: imp.cuota };
      fila.getCell(9).numFmt = FMT_EUR;
      fila.getCell(10).value = { formula: `G${f}+I${f}`, result: imp.total };
      fila.getCell(10).numFmt = FMT_EUR;
      for (let c = 1; c <= COLS; c++) {
        const cell = fila.getCell(c);
        cell.border = bordes;
        cell.font = { size: 10, bold: c === 10 };
        cell.alignment = { vertical: 'top', wrapText: c <= 4, horizontal: c >= 5 ? 'right' : 'left' };
        if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
      }
      const largo = Math.max(Math.ceil((l.descripcion.length + (l.notas ? l.notas.length + 3 : 0)) / 42) + (l.notas ? 1 : 0), Math.ceil(l.centro.length / 18), Math.ceil(l.departamento.length / 17), 1);
      if (largo > 1) fila.height = 14 * largo + 2;
    });
    const ultima = f;

    // ---- Totales con fórmulas ----
    const tot = totalesLineas(lineas);
    f += 2;
    const rango = (col) => `$${col}$${primera}:$${col}$${ultima}`;
    ws.mergeCells(f, 1, f, 6);
    ws.getCell(f, 1).value = 'Desglose por tipo de IVA';
    ws.getCell(f, 1).alignment = { horizontal: 'right' };
    ws.getCell(f, 1).font = { bold: true, size: 10, color: { argb: COLOR.marca } };
    [['G', 'Base imponible'], ['H', '% IVA'], ['I', 'Cuota IVA'], ['J', 'Total']].forEach(([col, t]) => {
      const c = ws.getCell(`${col}${f}`);
      c.value = t;
      c.font = { bold: true, size: 9 };
      c.alignment = { horizontal: 'right' };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.seccion } };
      c.border = bordes;
    });
    for (const t of tot.porTipo) {
      f++;
      ws.mergeCells(f, 1, f, 6);
      ws.getCell(f, 1).value = `IVA ${String(t.iva).replace('.', ',')} %`;
      ws.getCell(f, 1).alignment = { horizontal: 'right' };
      ws.getCell(f, 1).font = { size: 10 };
      ws.getCell(`H${f}`).value = round2(t.iva) / 100;
      ws.getCell(`H${f}`).numFmt = FMT_PCT;
      ws.getCell(`G${f}`).value = { formula: `SUMIF(${rango('H')},H${f},${rango('G')})`, result: t.base };
      ws.getCell(`I${f}`).value = { formula: `SUMIF(${rango('H')},H${f},${rango('I')})`, result: t.cuota };
      ws.getCell(`J${f}`).value = { formula: `G${f}+I${f}`, result: round2(t.base + t.cuota) };
      for (const col of ['G', 'H', 'I', 'J']) {
        const c = ws.getCell(`${col}${f}`);
        if (col !== 'H') c.numFmt = FMT_EUR;
        c.border = bordes;
        c.font = { size: 10 };
        c.alignment = { horizontal: 'right' };
      }
    }
    f++;
    const filaTotal = f;
    ws.mergeCells(f, 1, f, 6);
    ws.getCell(f, 1).value = 'TOTAL DEL PEDIDO';
    ws.getCell(f, 1).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getCell(f, 1).font = { bold: true, size: 12, color: { argb: COLOR.marca } };
    ws.getCell(`G${f}`).value = { formula: `SUM(${rango('G')})`, result: tot.base };
    ws.getCell(`I${f}`).value = { formula: `SUM(${rango('I')})`, result: tot.cuota };
    ws.getCell(`J${f}`).value = { formula: `SUM(${rango('J')})`, result: tot.total };
    for (const col of ['G', 'H', 'I', 'J']) {
      const c = ws.getCell(`${col}${f}`);
      if (col !== 'H') c.numFmt = FMT_EUR;
      c.font = { bold: true, size: col === 'J' ? 12 : 10, color: { argb: col === 'J' ? 'FFFFFFFF' : COLOR.texto } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col === 'J' ? COLOR.marca : COLOR.seccion } };
      c.border = { ...bordes, top: { style: 'double', color: { argb: COLOR.marca } } };
      c.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    ws.getRow(f).height = 22;
    ws.mergeCells(f + 1, 7, f + 1, 10);
    ws.getCell(f + 1, 7).value = 'Importes en euros. Total = base imponible + IVA.';
    ws.getCell(f + 1, 7).font = { italic: true, size: 8, color: { argb: COLOR.suave } };
    ws.getCell(f + 1, 7).alignment = { horizontal: 'right' };
    f += 1;

    // ---- Direcciones de entrega ----
    f += 2;
    seccion(ws, f, 1, COLS, 'DIRECCIONES DE ENTREGA');
    const idsCentro = [...new Set(lineas.map((l) => l.centroId))];
    for (const id of idsCentro) {
      f++;
      const centro = centros.find((c) => c.id === id);
      const nLineas = lineas.filter((l) => l.centroId === id).length;
      ws.mergeCells(f, 1, f, 2);
      ws.getCell(f, 1).value = `${centro?.nombre || 'Sin centro asignado'} (${nLineas} ${nLineas === 1 ? 'línea' : 'líneas'})`;
      ws.getCell(f, 1).font = { bold: true, size: 10 };
      ws.getCell(f, 1).alignment = { vertical: 'top', wrapText: true };
      ws.mergeCells(f, 3, f, COLS);
      ws.getCell(f, 3).value = centro?.direccion || 'Consultar con el comprador';
      ws.getCell(f, 3).alignment = { vertical: 'top', wrapText: true };
      ws.getCell(f, 3).font = { size: 10 };
      for (let c = 1; c <= COLS; c++) ws.getCell(f, c).border = bordes;
      ws.getRow(f).height = Math.max(18, 14 * lineasTexto(centro?.direccion) + 4);
    }

    // ---- Observaciones y condiciones de pago ----
    f += 2;
    seccion(ws, f, 1, COLS, 'OBSERVACIONES');
    f++;
    ws.mergeCells(f, 1, f + 2, COLS);
    ws.getCell(f, 1).value = observaciones || '';
    ws.getCell(f, 1).alignment = { vertical: 'top', wrapText: true };
    ws.getCell(f, 1).font = { size: 10 };
    for (let r = f; r <= f + 2; r++) for (let c = 1; c <= COLS; c++) ws.getCell(r, c).border = bordes;
    for (let r = f; r <= f + 2; r++) ws.getRow(r).height = Math.max(18, Math.ceil((lineasTexto(observaciones) * 14) / 3) + 4);
    f += 4;
    seccion(ws, f, 1, COLS, 'CONDICIONES DE PAGO');
    f++;
    ws.mergeCells(f, 1, f, COLS);
    ws.getCell(f, 1).value = proveedor.condicionesPago || 'Según condiciones acordadas con el proveedor.';
    ws.getCell(f, 1).alignment = { vertical: 'top', wrapText: true };
    ws.getCell(f, 1).font = { size: 10 };
    for (let c = 1; c <= COLS; c++) ws.getCell(f, c).border = bordes;
    ws.getRow(f).height = Math.max(18, 14 * lineasTexto(proveedor.condicionesPago) + 4);
    f += 2;
    ws.mergeCells(f, 1, f, COLS);
    ws.getCell(f, 1).value = `Rogamos indiquen el número de pedido ${numero} en el albarán de entrega y en la factura. Entregar en la dirección del centro indicado en cada línea.`;
    ws.getCell(f, 1).font = { italic: true, size: 9, color: { argb: COLOR.suave } };
    ws.getCell(f, 1).alignment = { wrapText: true };
    ws.getRow(f).height = 26;

    // ---- Impresión: A4 vertical ajustado a una página de ancho ----
    ws.pageSetup = {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.25, footer: 0.3 },
      printArea: `A1:${L(COLS)}${f}`,
      printTitlesRow: `${filaCab}:${filaCab}`,
    };
    ws.headerFooter = { oddFooter: `&L&8${numero} · ${(proveedor.nombre || '').replace(/&/g, '&&')}&R&8Página &P de &N` };

    return { wb, ws, filas: { cabecera: filaCab, primera, ultima, total: filaTotal }, totales: tot };
  }

  /** Genera el archivo y lo descarga. Devuelve { nombre, totales }. */
  async function descargarPedidoExcel(datos, descargar) {
    const { wb, totales } = construirLibroPedido(datos);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const nombre = nombreArchivoPedido(datos.numero, datos.proveedor);
    descargar(blob, nombre);
    return { nombre, totales };
  }

  App['excel'] = { prepararLineas, nombreArchivoPedido, construirLibroPedido, descargarPedidoExcel };
})();
