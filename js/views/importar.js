// Asistente de importación: archivo → mapeo de columnas → vista previa y validación → informe.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { esc } = App['format'];
  const { $, $$, toast, descargar, requiereLibreria } = App['ui'];
  const { ESQUEMAS, leerArchivo, autoMapear, validar, ejecutarImportacion, plantilla } = App['import'];

  const PASOS = ['Archivo', 'Columnas', 'Vista previa', 'Resultado'];
  let st = null;
  let raiz = null;

  function reiniciar() {
    st = { paso: 0, tipo: 'articulos', archivo: null, filas: [], hoja: null, cabecera: true, mapeo: {}, crear: false, validacion: null, informe: null };
  }

  function render(main) {
    raiz = main;
    if (!st) reiniciar();
    pintar();
  }
  function salir() { raiz = null; }

  const letraCol = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  function nombresColumnas() {
    const n = Math.max(0, ...st.filas.map((f) => f.length));
    return Array.from({ length: n }, (_, i) => {
      const cab = st.cabecera ? String(st.filas[0]?.[i] ?? '').trim() : '';
      return `${letraCol(i)}${cab ? ' · ' + cab : ''}`;
    });
  }

  function pintar() {
    if (!raiz) return;
    raiz.innerHTML = `
      <div class="cab-vista"><div><h1>Importar desde Excel o CSV</h1><p>Importe artículos, departamentos o proveedores. Podrá elegir qué columna corresponde a cada campo y revisar los datos antes de guardarlos.</p></div>
        ${st.paso > 0 ? '<div class="acciones"><button type="button" class="btn btn-secundario" id="btn-reiniciar">Empezar de nuevo</button></div>' : ''}</div>
      <ol class="pasos" aria-label="Pasos de la importación">${PASOS.map((p, i) => `<li class="${i < st.paso ? 'hecho' : ''}" ${i === st.paso ? 'aria-current="step"' : ''}>${p}</li>`).join('')}</ol>
      <div id="paso"></div>`;
    $('#btn-reiniciar', raiz)?.addEventListener('click', () => { reiniciar(); pintar(); });
    [paso1, paso2, paso3, paso4][st.paso]($('#paso', raiz));
  }

  function paso1(el) {
    el.innerHTML = `
      <div class="rejilla rejilla-2">
        <section class="tarjeta" aria-labelledby="h-arch">
          <h2 id="h-arch">1. Elija qué importar y el archivo</h2>
          <form id="f-arch" class="form-rejilla" style="grid-template-columns:1fr">
            <fieldset><legend>Tipo de datos</legend><div class="radios">
              ${Object.entries(ESQUEMAS).map(([k, e]) => `<label class="check"><input type="radio" name="tipo" value="${k}" ${st.tipo === k ? 'checked' : ''}> ${e.nombre}</label>`).join('')}
            </div></fieldset>
            <div class="campo"><label for="i-file">Archivo (.xlsx o .csv)</label>
              <input type="file" id="i-file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required aria-describedby="i-file-ayuda">
              <span class="ayuda" id="i-file-ayuda">Se lee la primera hoja con datos. En CSV se detecta el separador (coma o punto y coma).</span></div>
            <div class="acciones"><button type="submit" class="btn btn-primario">Leer archivo y continuar</button></div>
          </form>
        </section>
        <section class="tarjeta" aria-labelledby="h-plant">
          <h2 id="h-plant">Plantillas vacías</h2>
          <p>Descargue una plantilla con los encabezados correctos y una hoja de instrucciones.</p>
          <div class="acciones">${Object.entries(ESQUEMAS).map(([k, e]) => `<button type="button" class="btn btn-secundario" data-plantilla="${k}">Plantilla de ${e.nombre.toLowerCase()} (.xlsx)</button>`).join('')}</div>
          <h3 style="margin-top:18px">Campos de artículos</h3>
          <p class="suave"><small>Obligatorios: descripción, cantidad, precio unitario sin IVA, proveedor y departamento. El proveedor, departamento, categoría y centro se identifican por su nombre; si no existen, podrá crearlos durante la importación.</small></p>
        </section>
      </div>`;
    $$('[data-plantilla]', el).forEach((b) => b.addEventListener('click', async () => {
      if (!requiereLibreria('ExcelJS', 'ExcelJS')) return;
      const tipo = b.dataset.plantilla;
      descargar(await plantilla(tipo), `plantilla-importacion-${tipo}.xlsx`);
    }));
    $('#f-arch', el).addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = $('#i-file', el).files[0];
      if (!file) { $('#i-file', el).reportValidity(); return; }
      st.tipo = e.target.elements.tipo.value;
      try {
        const { filas, hoja } = await leerArchivo(file);
        if (!filas.length) throw new Error('El archivo está vacío.');
        Object.assign(st, { archivo: file.name, filas, hoja, cabecera: true, paso: 1, crear: false });
        st.mapeo = autoMapear(st.filas[0].map(String), st.tipo);
        pintar();
      } catch (err) {
        console.error(err);
        toast(err.message || String(err), 'error');
      }
    });
  }

  function paso2(el) {
    const esquema = ESQUEMAS[st.tipo];
    const cols = nombresColumnas();
    const muestra = st.filas.slice(st.cabecera ? 1 : 0, (st.cabecera ? 1 : 0) + 5);
    el.innerHTML = `
      <section class="tarjeta" aria-labelledby="h-map">
        <h2 id="h-map">2. Indique qué columna corresponde a cada campo</h2>
        <p>Archivo <strong>${esc(st.archivo)}</strong>${st.hoja ? `, hoja «${esc(st.hoja)}»` : ''}: ${st.filas.length} filas. Importando <strong>${esc(esquema.nombre.toLowerCase())}</strong>.</p>
        <p><label class="check"><input type="checkbox" id="m-cab" ${st.cabecera ? 'checked' : ''}> La primera fila contiene los encabezados</label></p>
        <form id="f-map">
          <div class="mapeo">${esquema.campos.map((c) => `
            <div class="campo"><label for="m-${c.clave}">${esc(c.etiqueta)}${c.obligatorio ? ' <span class="obl" aria-hidden="true">*</span>' : ''}</label>
            <select id="m-${c.clave}" name="${c.clave}" ${c.obligatorio ? 'required aria-required="true"' : ''}>
              <option value="-1">${c.obligatorio ? 'Seleccione una columna…' : '(no importar)'}</option>
              ${cols.map((n, i) => `<option value="${i}" ${st.mapeo[c.clave] === i ? 'selected' : ''}>${esc(n)}</option>`).join('')}
            </select></div>`).join('')}
          </div>
          <h3 style="margin-top:18px">Primeras filas del archivo</h3>
          <div class="tabla-cont"><table><thead><tr>${cols.map((n) => `<th scope="col">${esc(n)}</th>`).join('')}</tr></thead>
            <tbody>${muestra.map((f) => `<tr>${cols.map((_, i) => `<td>${esc(f[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
          <div class="acciones" style="margin-top:14px">
            <button type="button" class="btn btn-secundario" id="m-atras">Atrás</button>
            <button type="submit" class="btn btn-primario">Validar y ver vista previa</button>
          </div>
        </form>
      </section>`;
    $('#m-cab', el).addEventListener('change', (e) => {
      st.cabecera = e.target.checked;
      if (st.cabecera) st.mapeo = autoMapear(st.filas[0].map(String), st.tipo);
      pintar();
    });
    $('#m-atras', el).addEventListener('click', () => { st.paso = 0; pintar(); });
    const form = $('#f-map', el);
    form.addEventListener('change', () => { for (const c of esquema.campos) st.mapeo[c.clave] = Number(form.elements[c.clave].value); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      for (const c of esquema.campos) {
        const sel = form.elements[c.clave];
        sel.setCustomValidity(c.obligatorio && Number(sel.value) < 0 ? 'Elija la columna de este campo obligatorio.' : '');
        st.mapeo[c.clave] = Number(sel.value);
      }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      st.paso = 2;
      pintar();
    });
  }

  function paso3(el) {
    st.validacion = validar(st.tipo, st.filas, st.mapeo, { crearFaltantes: st.crear, primeraEsCabecera: st.cabecera });
    const v = st.validacion;
    const ok = v.filas.filter((f) => !f.errores.length);
    const mal = v.filas.filter((f) => f.errores.length);
    const esquema = ESQUEMAS[st.tipo];
    const visibles = esquema.campos.filter((c) => st.mapeo[c.clave] >= 0);
    const falt = Object.entries(v.faltantes).filter(([, m]) => m.size);
    const nombresStore = { proveedores: 'Proveedores', departamentos: 'Departamentos', categorias: 'Categorías', centros: 'Centros' };
    el.innerHTML = `
      <section class="tarjeta" aria-labelledby="h-prev">
        <h2 id="h-prev">3. Revise los datos antes de importar</h2>
        <div class="aviso ${mal.length ? 'aviso-aviso' : 'aviso-exito'}" role="status"><p><strong>${ok.length}</strong> filas válidas y <strong>${mal.length}</strong> con errores (no se importarán).</p></div>
        ${falt.length ? `<div class="aviso aviso-info" style="margin-top:10px;display:block">
          <p><strong>Hay valores que no existen todavía:</strong></p>
          <ul class="lista-simple">${falt.map(([s, m]) => `<li>${nombresStore[s]}: ${[...m.values()].map(esc).join(', ')}</li>`).join('')}</ul>
          <p style="margin-top:8px"><label class="check"><input type="checkbox" id="p-crear" ${st.crear ? 'checked' : ''}> Crear automáticamente los que falten (los departamentos nuevos se crean con presupuesto 0 €)</label></p>
        </div>` : ''}
        <div class="tabla-cont" style="margin-top:14px;max-height:520px;overflow:auto"><table>
          <thead><tr><th scope="col">Fila</th>${visibles.map((c) => `<th scope="col">${esc(c.etiqueta)}</th>`).join('')}<th scope="col">Resultado</th></tr></thead>
          <tbody>${v.filas.slice(0, 300).map((f) => `<tr class="${f.errores.length ? 'fila-error' : 'fila-ok'}"><td>${f.n}</td>
            ${visibles.map((c) => `<td>${esc(f.crudo[c.clave])}</td>`).join('')}
            <td>${f.errores.length ? `<span class="errores">✖ ${esc(f.errores.join('; '))}</span>` : '<span style="color:var(--exito)">✔ Válida</span>'}${f.avisos.length ? `<br><small>${esc(f.avisos.join('; '))}</small>` : ''}</td></tr>`).join('')}</tbody>
        </table></div>
        ${v.filas.length > 300 ? `<p class="suave"><small>Se muestran las 300 primeras filas de ${v.filas.length}.</small></p>` : ''}
        <div class="acciones" style="margin-top:14px">
          <button type="button" class="btn btn-secundario" id="p-atras">Atrás</button>
          <button type="button" class="btn btn-primario" id="p-importar" ${ok.length ? '' : 'disabled'}>Importar ${ok.length} fila(s)</button>
        </div>
      </section>`;
    $('#p-crear', el)?.addEventListener('change', (e) => { st.crear = e.target.checked; pintar(); $('#p-crear', raiz)?.focus(); });
    $('#p-atras', el).addEventListener('click', () => { st.paso = 1; pintar(); });
    $('#p-importar', el).addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        st.informe = await ejecutarImportacion(st.tipo, st.validacion, { crearFaltantes: st.crear });
        st.paso = 3;
        pintar();
      } catch (err) {
        console.error(err);
        toast('Error al importar: ' + (err.message || err), 'error');
        e.target.disabled = false;
      }
    });
  }

  function paso4(el) {
    const inf = st.informe;
    const creados = Object.entries(inf.creados).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`);
    const destino = { articulos: '#/articulos', departamentos: '#/departamentos', proveedores: '#/proveedores' }[st.tipo];
    el.innerHTML = `
      <section class="tarjeta" aria-labelledby="h-inf">
        <h2 id="h-inf">4. Informe de la importación</h2>
        <div class="aviso aviso-exito" role="status"><p><strong>${inf.importadas}</strong> fila(s) importadas correctamente${creados.length ? `; se han creado ${esc(creados.join(', '))}` : ''}.</p></div>
        ${inf.rechazadas.length ? `
          <div class="aviso aviso-aviso" style="margin-top:10px"><p><strong>${inf.rechazadas.length}</strong> fila(s) rechazadas.</p>
            <div class="acciones"><button type="button" class="btn btn-secundario btn-peq" id="inf-csv">Descargar filas rechazadas (CSV)</button></div></div>
          <div class="tabla-cont" style="margin-top:10px"><table><thead><tr><th scope="col">Fila</th><th scope="col">Motivo</th></tr></thead>
            <tbody>${inf.rechazadas.map((f) => `<tr><td>${f.n}</td><td>${esc(f.errores.join('; '))}</td></tr>`).join('')}</tbody></table></div>` : ''}
        <div class="acciones" style="margin-top:14px">
          <a class="btn btn-primario" href="${destino}">Ver ${esc(ESQUEMAS[st.tipo].nombre.toLowerCase())}</a>
          <button type="button" class="btn btn-secundario" id="inf-otra">Importar otro archivo</button>
        </div>
      </section>`;
    $('#inf-otra', el).addEventListener('click', () => { reiniciar(); pintar(); });
    $('#inf-csv', el)?.addEventListener('click', () => {
      const cab = st.cabecera ? st.filas[0] : null;
      const filas = inf.rechazadas.map((f) => [...(st.filas[f.n - 1] || []), f.errores.join('; ')]);
      const todas = cab ? [[...cab, 'Motivo del rechazo'], ...filas] : filas;
      const csv = globalThis.Papa ? globalThis.Papa.unparse(todas, { delimiter: ';' }) : todas.map((f) => f.join(';')).join('\n');
      descargar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'filas-rechazadas.csv');
    });
  }

  App['importar'] = { render, salir };
})();
