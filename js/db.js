// Capa de persistencia: IndexedDB con caché en memoria, copias de seguridad y avisos.
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { uid, hoyISO } = App['format'];

  const SCHEMA_VERSION = 1;
  const APP_ID = 'gestion-compras-material';
  const DB_NAME = 'gestion-compras-material';

  const STORES = ['departamentos', 'centros', 'proveedores', 'categorias', 'articulos', 'pedidos'];

  const CATEGORIAS_INICIALES = [
    'Hardware',
    'Software y licencias',
    'Consumibles',
    'Mobiliario',
    'Material deportivo',
    'Limpieza',
    'Mantenimiento e instalaciones',
    'Material de oficina',
  ];

  function configPorDefecto() {
    return {
      empresa: { razonSocial: '', cif: '', direccion: '', contacto: '', email: '', telefono: '' },
      logo: null, // dataURL
      presupuesto: { base: 'base', ambar: 80, rojo: 100 }, // base: 'base' (sin IVA) | 'total' (con IVA)
      pedido: { formato: 'PED-{AAAA}-{NNN}', siguiente: 1, anio: new Date().getFullYear(), reinicioAnual: true },
      ultimaCopia: null,
      tema: 'auto',
    };
  }

  /** Estado en memoria; las vistas leen de aquí y escriben a través de las funciones exportadas. */
  const state = {
    departamentos: [],
    centros: [],
    proveedores: [],
    categorias: [],
    articulos: [],
    pedidos: [],
    config: configPorDefecto(),
  };

  let db = null;
  const almacen = { persistente: false, error: null };

  const oyentes = new Set();
  function alCambiar(fn) {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
  }
  function emitir(tipo) {
    for (const fn of oyentes) {
      try { fn(tipo); } catch (e) { console.error(e); }
    }
  }

  let manejadorError = (e) => console.error(e);
  function setManejadorError(fn) { manejadorError = fn; }

  function abrir() {
    return new Promise((resolve, reject) => {
      let req;
      try {
        if (!('indexedDB' in globalThis) || !globalThis.indexedDB) throw new Error('Este navegador no ofrece IndexedDB.');
        req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
        if (!d.objectStoreNames.contains('config')) d.createObjectStore('config', { keyPath: 'clave' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('No se pudo abrir la base de datos.'));
      req.onblocked = () => reject(new Error('La base de datos está bloqueada por otra pestaña. Ciérrela y recargue.'));
    });
  }

  function transaccion(stores, modo, trabajo) {
    return new Promise((resolve, reject) => {
      try {
        const t = db.transaction(stores, modo);
        const resultado = trabajo(t);
        t.oncomplete = () => resolve(resultado);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error || new Error('Transacción cancelada'));
      } catch (e) {
        reject(e);
      }
    });
  }

  function leerTodo(store) {
    return new Promise((resolve, reject) => {
      try {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      } catch (e) {
        reject(e);
      }
    });
  }

  function mezclarConfig(clave, valor) {
    const def = configPorDefecto()[clave];
    if (def && typeof def === 'object' && !Array.isArray(def) && valor && typeof valor === 'object') {
      return { ...def, ...valor };
    }
    return valor;
  }

  async function iniciar() {
    try {
      db = await abrir();
      for (const s of STORES) state[s] = await leerTodo(s);
      const cfg = await leerTodo('config');
      state.config = configPorDefecto();
      for (const { clave, valor } of cfg) state.config[clave] = mezclarConfig(clave, valor);
      almacen.persistente = true;
    } catch (e) {
      console.error(e);
      db = null;
      almacen.persistente = false;
      almacen.error = e;
    }
    if (!state.categorias.length) {
      await guardarVarios('categorias', CATEGORIAS_INICIALES.map((nombre) => ({ id: uid(), nombre })), { silencioso: true });
    }
  }

  async function persistir(store, objetos, borrarIds = []) {
    if (!db) return;
    try {
      await transaccion([store], 'readwrite', (t) => {
        const os = t.objectStore(store);
        for (const o of objetos) os.put(o);
        for (const id of borrarIds) os.delete(id);
      });
    } catch (e) {
      manejadorError(new Error('No se pudieron guardar los cambios: ' + (e?.message || e)));
    }
  }

  const clonar = (o) => JSON.parse(JSON.stringify(o));

  async function guardar(store, obj) {
    const [r] = await guardarVarios(store, [obj]);
    return r;
  }

  async function guardarVarios(store, objetos, { silencioso = false } = {}) {
    const lista = state[store];
    const guardados = objetos.map((o) => {
      const copia = clonar(o);
      if (!copia.id) copia.id = uid();
      const i = lista.findIndex((x) => x.id === copia.id);
      if (i >= 0) lista[i] = copia; else lista.push(copia);
      return copia;
    });
    await persistir(store, guardados);
    if (!silencioso) emitir(store);
    return guardados;
  }

  async function borrar(store, ids) {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    state[store] = state[store].filter((x) => !set.has(x.id));
    await persistir(store, [], [...set]);
    emitir(store);
  }

  async function guardarConfig(clave, valor) {
    state.config[clave] = clonar(valor);
    if (db) {
      try {
        await transaccion(['config'], 'readwrite', (t) => t.objectStore('config').put({ clave, valor: state.config[clave] }));
      } catch (e) {
        manejadorError(new Error('No se pudo guardar la configuración: ' + (e?.message || e)));
      }
    }
    emitir('config');
  }

  const porId = (store, id) => state[store].find((x) => x.id === id);

  // ---------- Copias de seguridad ----------

  function exportarCopia() {
    const datos = {};
    for (const s of STORES) datos[s] = clonar(state[s]);
    datos.config = clonar(state.config);
    return { app: APP_ID, schemaVersion: SCHEMA_VERSION, exportadoEl: hoyISO(), datos };
  }

  function validarCopia(json) {
    if (!json || typeof json !== 'object') throw new Error('El archivo no contiene un JSON válido.');
    if (json.app !== APP_ID || !json.datos) throw new Error('El archivo no es una copia de seguridad de esta aplicación.');
    if (typeof json.schemaVersion !== 'number' || json.schemaVersion > SCHEMA_VERSION) {
      throw new Error(`La copia es de una versión de esquema no compatible (${json.schemaVersion}).`);
    }
    for (const s of STORES) {
      if (json.datos[s] !== undefined && !Array.isArray(json.datos[s])) throw new Error(`La sección "${s}" de la copia no es válida.`);
    }
    return true;
  }

  async function importarCopia(json) {
    validarCopia(json);
    const cfgNueva = configPorDefecto();
    for (const [k, v] of Object.entries(json.datos.config || {})) cfgNueva[k] = mezclarConfig(k, v);
    for (const s of STORES) state[s] = clonar(json.datos[s] || []);
    state.config = cfgNueva;
    if (db) {
      try {
        await transaccion([...STORES, 'config'], 'readwrite', (t) => {
          for (const s of STORES) {
            const os = t.objectStore(s);
            os.clear();
            for (const o of state[s]) os.put(o);
          }
          const oc = t.objectStore('config');
          oc.clear();
          for (const [clave, valor] of Object.entries(state.config)) oc.put({ clave, valor });
        });
      } catch (e) {
        manejadorError(new Error('No se pudo restaurar la copia en el almacenamiento: ' + (e?.message || e)));
      }
    }
    emitir('*');
  }

  async function borrarTodo() {
    for (const s of STORES) state[s] = [];
    const ultimaCopia = state.config.ultimaCopia;
    state.config = configPorDefecto();
    state.config.ultimaCopia = ultimaCopia;
    if (db) {
      try {
        await transaccion([...STORES, 'config'], 'readwrite', (t) => {
          for (const s of [...STORES, 'config']) t.objectStore(s).clear();
          t.objectStore('config').put({ clave: 'ultimaCopia', valor: ultimaCopia });
        });
      } catch (e) {
        manejadorError(e);
      }
    }
    await guardarVarios('categorias', CATEGORIAS_INICIALES.map((nombre) => ({ id: uid(), nombre })), { silencioso: true });
    emitir('*');
  }

  /** Días desde la última copia exportada (null si nunca). */
  function diasDesdeUltimaCopia() {
    const u = state.config.ultimaCopia;
    if (!u) return null;
    return Math.floor((Date.now() - new Date(u).getTime()) / 86400000);
  }

  function hayDatos() {
    return state.articulos.length + state.departamentos.length + state.proveedores.length > 0;
  }

  App['db'] = { SCHEMA_VERSION, APP_ID, STORES, CATEGORIAS_INICIALES, configPorDefecto, state, almacen, alCambiar, setManejadorError, iniciar, guardar, guardarVarios, borrar, guardarConfig, porId, exportarCopia, validarCopia, importarCopia, borrarTodo, diasDesdeUltimaCopia, hayDatos };
})();
