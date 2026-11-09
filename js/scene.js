/**
 * Escena Three.js: "Gimnasio navideño".
 * Todo se modela de forma procedural (sin modelos externos).
 *
 * Distribución (vista cenital, el centro es el árbol):
 *   - Árbol de discos de pesas en (0, 0, 0), ~5,4 m de alto con la estrella.
 *   - Anillo interior: casillas 1–10 a ~3,2 m del árbol.
 *   - Anillo exterior: casillas 11–24 a ~5,1 m. La 24 (la más grande) queda
 *     al frente, junto a la 11. La numeración avanza en el sentido de las
 *     agujas del reloj vista desde arriba, empezando por el frente.
 *   - Sala de 44 × 44 m y 18 m de alto: suelo de parqué, paredes de ladrillo
 *     con zócalo verde, 8 ventanales con nieve, guirnaldas, coronas y material
 *     de gimnasio repartido junto a las paredes.
 */
(function (A) {
  'use strict';
  // Three.js se carga desde el CDN con import() dinámico (resuelto por el
  // importmap de index.html). Funciona también abriendo index.html con
  // doble clic (file://), porque solo los módulos locales están bloqueados.
  let THREE;
  let OrbitControls;
  let RoomEnvironment;
  let promesaThree = null;
  function cargarThree() {
    if (!promesaThree) {
      promesaThree = Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        import('three/addons/environments/RoomEnvironment.js'),
      ]).then(([t, o, r]) => ({ THREE: t, OrbitControls: o.OrbitControls, RoomEnvironment: r.RoomEnvironment }));
      promesaThree.catch(() => { promesaThree = null; });
    }
    return promesaThree;
  }

  const SALA = { mitad: 22, alto: 18 };

  const respiro = () => new Promise((r) => setTimeout(r, 0));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const suave = (t) => t * t * (3 - 2 * t);
  const salidaCubica = (t) => 1 - Math.pow(1 - t, 3);
  const entradaSalida = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function aleatorio(semilla) {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * @param {HTMLElement} contenedor
   * @param {object} op
   * @param {Array} op.premios
   * @param {(dia:number)=>string} op.estadoDe  'bloqueada' | 'hoy' | 'disponible' | 'abierta'
   * @param {'alta'|'baja'} op.calidad
   * @param {boolean} op.movimientoReducido
   * @param {(p:number)=>void} [op.alProgreso]
   * @param {(dia:number)=>void} [op.alSeleccionar]
   * @param {(dia:number|null, pos:{x:number,y:number}|null)=>void} [op.alHover]
   */
  async function crearEscena(contenedor, op) {
    ({ THREE, OrbitControls, RoomEnvironment } = await cargarThree());
    const OBJETIVO = new THREE.Vector3(0, 1.4, 0);
    const EJE_Y = new THREE.Vector3(0, 1, 0);
    const { premios, estadoDe, calidad, movimientoReducido } = op;
    const alta = calidad === 'alta';
    const progreso = (p) => op.alProgreso?.(p);

    // ---------- Colores desde las variables CSS (así se adaptan a la marca) ----------
    const css = getComputedStyle(document.documentElement);
    const leer = (n, d) => (css.getPropertyValue(n) || '').trim() || d;
    const HEX = {
      rojo: leer('--c-rojo', '#b3122e'),
      rojoOscuro: leer('--c-rojo-oscuro', '#7d0c20'),
      verde: leer('--c-verde', '#1f6b45'),
      verdeOscuro: leer('--c-verde-oscuro', '#0f3d27'),
      dorado: leer('--c-dorado', '#d9a93a'),
      doradoClaro: leer('--c-dorado-claro', '#f3d27a'),
      nieve: leer('--c-nieve', '#fffdf7'),
      crema: leer('--c-crema', '#f7ecd9'),
    };
    const col = (h) => new THREE.Color(h);

    // ---------- Renderizador ----------
    const renderer = new THREE.WebGLRenderer({
      antialias: alta || (window.devicePixelRatio || 1) < 2,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, alta ? 2 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.shadowMap.enabled = alta;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const lienzo = renderer.domElement;
    lienzo.className = 'escena__lienzo';
    lienzo.setAttribute('aria-hidden', 'true');
    lienzo.tabIndex = -1;
    contenedor.appendChild(lienzo);
    const anisotropia = Math.min(4, renderer.capabilities.getMaxAnisotropy());

    const escena = new THREE.Scene();
    escena.background = new THREE.Color('#1c100c');
    escena.fog = new THREE.Fog('#26150f', 24, 62);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const entorno = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    escena.environment = entorno;
    escena.environmentIntensity = 0.35;
    pmrem.dispose();

    const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 140);
    const controles = new OrbitControls(camara, lienzo);
    controles.target.copy(OBJETIVO);
    controles.enableDamping = true;
    controles.dampingFactor = 0.08;
    controles.enablePan = false;
    controles.minDistance = 7;
    controles.maxDistance = 18.5;
    controles.minPolarAngle = 0.8;
    controles.maxPolarAngle = 1.36; // nunca por debajo del suelo
    controles.rotateSpeed = 0.6;
    controles.zoomSpeed = 0.7;
    controles.autoRotate = !movimientoReducido;
    controles.autoRotateSpeed = 0.45;
    controles.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

    progreso(0.05);

    // Esperamos (como mucho 1,5 s) a la fuente de los números de las etiquetas.
    try {
      await Promise.race([
        document.fonts?.load('700 120px "Playfair Display"'),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    } catch { /* sin Font Loading API */ }

    // ---------- Utilidades de texturas ----------
    function texturaCanvas(ancho, alto, dibujar, repetir) {
      const c = document.createElement('canvas');
      c.width = ancho;
      c.height = alto;
      dibujar(c.getContext('2d'), ancho, alto);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = anisotropia;
      if (repetir) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(repetir[0], repetir[1]);
      }
      return t;
    }

    const texBrillo = texturaCanvas(128, 128, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,240,200,1)');
      gr.addColorStop(0.25, 'rgba(255,210,120,0.55)');
      gr.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    });

    const texCopo = texturaCanvas(64, 64, (g, w) => {
      const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.5, 'rgba(255,255,255,0.6)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, w);
    });

    // ---------- Luces ----------
    escena.add(new THREE.HemisphereLight('#ffe6c4', '#3a2016', 0.75));
    const sol = new THREE.DirectionalLight('#ffd7a3', 1.9);
    sol.position.set(6, 15, 9);
    sol.target.position.set(0, 0, 0);
    if (alta) {
      sol.castShadow = true;
      sol.shadow.mapSize.set(2048, 2048);
      Object.assign(sol.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 2, far: 40 });
      sol.shadow.bias = -0.0004;
      sol.shadow.normalBias = 0.03;
    }
    escena.add(sol, sol.target);

    const esquinas = alta
      ? [[-15, 9, -15], [15, 9, -15], [-15, 9, 15], [15, 9, 15]]
      : [[-14, 9, -14], [14, 9, 14]];
    for (const [x, y, z] of esquinas) {
      const l = new THREE.PointLight('#ffb35c', alta ? 70 : 110, 0, 2);
      l.position.set(x, y, z);
      escena.add(l);
    }
    const luzEstrella = new THREE.PointLight(HEX.doradoClaro, 18, 0, 2);
    escena.add(luzEstrella);
    const luzDestello = new THREE.PointLight('#ffd27a', 0, 0, 2);
    escena.add(luzDestello);

    progreso(0.12);
    await respiro();

    // ---------- Sala ----------
    const S = SALA.mitad;
    const texParque = texturaCanvas(512, 512, (g, w, h) => {
      const filas = 8;
      const altoFila = h / filas;
      const rnd = aleatorio(7);
      for (let f = 0; f < filas; f++) {
        let x = -rnd() * 200;
        while (x < w) {
          const largo = 160 + rnd() * 220;
          const tono = 0.85 + rnd() * 0.3;
          g.fillStyle = `rgb(${Math.round(118 * tono)},${Math.round(78 * tono)},${Math.round(50 * tono)})`;
          g.fillRect(x, f * altoFila, largo, altoFila);
          g.strokeStyle = 'rgba(70,40,20,0.25)';
          g.lineWidth = 1;
          for (let k = 0; k < 5; k++) {
            const yy = f * altoFila + 6 + rnd() * (altoFila - 12);
            g.beginPath();
            g.moveTo(x, yy);
            g.bezierCurveTo(x + largo * 0.3, yy + rnd() * 6 - 3, x + largo * 0.6, yy + rnd() * 6 - 3, x + largo, yy);
            g.stroke();
          }
          g.fillStyle = 'rgba(40,22,10,0.8)';
          g.fillRect(x, f * altoFila, 2, altoFila);
          x += largo;
        }
        g.fillStyle = 'rgba(40,22,10,0.85)';
        g.fillRect(0, f * altoFila, w, 2);
      }
    }, [9, 9]);
    const suelo = new THREE.Mesh(
      new THREE.PlaneGeometry(S * 2, S * 2),
      new THREE.MeshStandardMaterial({ map: texParque, roughness: 0.55, metalness: 0.05 }),
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = alta;
    escena.add(suelo);

    // Alfombra circular bajo el árbol
    const texAlfombra = texturaCanvas(512, 512, (g, w) => {
      const c = w / 2;
      g.fillStyle = HEX.rojoOscuro;
      g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
      g.fillStyle = HEX.rojo;
      g.beginPath(); g.arc(c, c, c * 0.9, 0, Math.PI * 2); g.fill();
      g.strokeStyle = HEX.dorado;
      g.lineWidth = 10;
      g.beginPath(); g.arc(c, c, c * 0.84, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 3;
      g.beginPath(); g.arc(c, c, c * 0.79, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,253,247,0.85)';
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        g.beginPath();
        g.arc(c + Math.cos(a) * c * 0.95, c + Math.sin(a) * c * 0.95, 5, 0, Math.PI * 2);
        g.fill();
      }
    });
    const alfombra = new THREE.Mesh(
      new THREE.CircleGeometry(2.45, 64),
      new THREE.MeshStandardMaterial({ map: texAlfombra, roughness: 0.95 }),
    );
    alfombra.rotation.x = -Math.PI / 2;
    alfombra.position.y = 0.012;
    alfombra.receiveShadow = alta;
    escena.add(alfombra);

    const texLadrillo = texturaCanvas(512, 512, (g, w, h) => {
      g.fillStyle = '#4a2d22';
      g.fillRect(0, 0, w, h);
      const filas = 16;
      const altoF = h / filas;
      const anchoL = w / 4;
      const rnd = aleatorio(3);
      for (let f = 0; f < filas; f++) {
        const desplaz = f % 2 ? anchoL / 2 : 0;
        for (let x = -desplaz; x < w; x += anchoL) {
          const t = 0.8 + rnd() * 0.35;
          g.fillStyle = `rgb(${Math.round(132 * t)},${Math.round(66 * t)},${Math.round(46 * t)})`;
          g.fillRect(x + 3, f * altoF + 3, anchoL - 6, altoF - 6);
        }
      }
    }, [11, 4.5]);
    const matPared = new THREE.MeshStandardMaterial({ map: texLadrillo, roughness: 0.92, side: THREE.BackSide });
    const matTecho = new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.95, side: THREE.BackSide });
    const sala = new THREE.Mesh(
      new THREE.BoxGeometry(S * 2, SALA.alto, S * 2),
      [matPared, matPared, matTecho, matTecho, matPared, matPared],
    );
    sala.position.y = SALA.alto / 2 - 0.01;
    escena.add(sala);

    const matMadera = new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.85 });
    for (let x = -18; x <= 18; x += 6) {
      const viga = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, S * 2), matMadera);
      viga.position.set(x, SALA.alto - 0.45, 0);
      escena.add(viga);
    }

    // Paredes: [posición, rotación Y] con la normal mirando hacia el interior.
    const paredes = [
      { pos: new THREE.Vector3(0, 0, -S), rot: 0 },
      { pos: new THREE.Vector3(S, 0, 0), rot: -Math.PI / 2 },
      { pos: new THREE.Vector3(0, 0, S), rot: Math.PI },
      { pos: new THREE.Vector3(-S, 0, 0), rot: Math.PI / 2 },
    ];
    const grupoPared = (p) => {
      const g = new THREE.Group();
      g.position.copy(p.pos);
      g.rotation.y = p.rot;
      escena.add(g);
      return g;
    };

    const matZocalo = new THREE.MeshStandardMaterial({ color: HEX.verdeOscuro, roughness: 0.7 });
    const matMoldura = new THREE.MeshStandardMaterial({ color: HEX.dorado, roughness: 0.35, metalness: 0.7 });
    const matMarco = new THREE.MeshStandardMaterial({ color: HEX.crema, roughness: 0.6 });

    const texNoche = texturaCanvas(320, 448, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#0a1530');
      gr.addColorStop(0.6, '#253463');
      gr.addColorStop(1, '#4b4c7c');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      const rnd = aleatorio(11);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 70; i++) g.fillRect(rnd() * w, rnd() * h * 0.6, 1.5, 1.5);
      const luna = g.createRadialGradient(w * 0.72, h * 0.2, 4, w * 0.72, h * 0.2, 60);
      luna.addColorStop(0, 'rgba(255,248,220,1)');
      luna.addColorStop(0.35, 'rgba(255,248,220,0.9)');
      luna.addColorStop(0.4, 'rgba(255,240,200,0.25)');
      luna.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = luna;
      g.fillRect(0, 0, w, h);
      // Colinas nevadas
      g.fillStyle = '#c9d6ef';
      g.beginPath();
      g.moveTo(0, h * 0.78);
      g.quadraticCurveTo(w * 0.3, h * 0.66, w * 0.6, h * 0.76);
      g.quadraticCurveTo(w * 0.85, h * 0.83, w, h * 0.72);
      g.lineTo(w, h); g.lineTo(0, h); g.fill();
      g.fillStyle = '#eef3fb';
      g.beginPath();
      g.moveTo(0, h * 0.88);
      g.quadraticCurveTo(w * 0.5, h * 0.8, w, h * 0.9);
      g.lineTo(w, h); g.lineTo(0, h); g.fill();
      // Abetos
      const abeto = (x, y, s) => {
        g.fillStyle = '#16264a';
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.moveTo(x, y - s * (1.1 - k * 0.3));
          g.lineTo(x - s * (0.35 + k * 0.08), y - s * (0.45 - k * 0.25));
          g.lineTo(x + s * (0.35 + k * 0.08), y - s * (0.45 - k * 0.25));
          g.fill();
        }
        g.fillStyle = 'rgba(240,245,255,0.9)';
        g.beginPath();
        g.moveTo(x, y - s * 1.1);
        g.lineTo(x - s * 0.12, y - s * 0.9);
        g.lineTo(x + s * 0.12, y - s * 0.9);
        g.fill();
      };
      abeto(w * 0.15, h * 0.82, 90);
      abeto(w * 0.3, h * 0.84, 60);
      abeto(w * 0.82, h * 0.86, 110);
      abeto(w * 0.62, h * 0.82, 50);
    });

    const VENT = { ancho: 5, alto: 7, base: 3 };
    const copos = [];
    const numCopos = alta ? 90 : 35;
    const matNieve = new THREE.PointsMaterial({
      map: texCopo, size: 0.12, transparent: true, depthWrite: false, color: '#ffffff', sizeAttenuation: true,
    });
    const matVidrio = new THREE.MeshStandardMaterial({
      color: '#bcd3ff', transparent: true, opacity: 0.08, roughness: 0.05, metalness: 0.2, depthWrite: false,
    });
    const matMonticulo = new THREE.MeshStandardMaterial({ color: '#f2f6ff', roughness: 0.9, emissive: '#3a4f7a', emissiveIntensity: 0.25 });

    function crearVentana(pared, x) {
      const g = new THREE.Group();
      g.position.set(x, VENT.base + VENT.alto / 2, 0);
      pared.add(g);
      const { ancho: w, alto: h } = VENT;
      const fondo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texNoche, fog: false }));
      fondo.position.z = 0.03;
      g.add(fondo);

      const montic = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, w, 12, 1, false, 0, Math.PI), matMonticulo);
      montic.rotation.z = Math.PI / 2;
      montic.rotation.y = Math.PI / 2;
      montic.scale.set(1, 1, 0.6);
      montic.position.set(0, -h / 2 + 0.02, 0.12);
      g.add(montic);

      // Copos que caen "fuera" (entre el paisaje y el cristal)
      const pos = new Float32Array(numCopos * 3);
      const vel = new Float32Array(numCopos);
      const fase = new Float32Array(numCopos);
      for (let i = 0; i < numCopos; i++) {
        pos[i * 3] = (Math.random() - 0.5) * w;
        pos[i * 3 + 1] = (Math.random() - 0.5) * h;
        pos[i * 3 + 2] = 0.08 + Math.random() * 0.22;
        vel[i] = 0.35 + Math.random() * 0.5;
        fase[i] = Math.random() * Math.PI * 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const puntos = new THREE.Points(geo, matNieve);
      puntos.frustumCulled = false;
      g.add(puntos);
      copos.push({ pos, vel, fase, geo, w, h });

      // Marco, parteluces y alféizar
      const marco = (mw, mh, mx, my, prof = 0.35) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, prof), matMarco);
        m.position.set(mx, my, prof / 2);
        g.add(m);
      };
      const e = 0.28;
      marco(w + e * 2, e, 0, h / 2 + e / 2);
      marco(w + e * 2, e, 0, -h / 2 - e / 2);
      marco(e, h, -w / 2 - e / 2, 0);
      marco(e, h, w / 2 + e / 2, 0);
      marco(0.12, h, 0, 0, 0.3);
      marco(w, 0.12, 0, h / 6, 0.3);
      const alfeizar = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.16, 0.7), matMarco);
      alfeizar.position.set(0, -h / 2 - e - 0.08, 0.35);
      g.add(alfeizar);
      if (alta) {
        const vidrio = new THREE.Mesh(new THREE.PlaneGeometry(w, h), matVidrio);
        vidrio.position.z = 0.33;
        g.add(vidrio);
      }
    }

    // Lazo reutilizable (regalos, guirnaldas y coronas)
    const geoLazada = new THREE.TorusGeometry(0.13, 0.042, 8, 20);
    const geoNudo = new THREE.SphereGeometry(0.06, 12, 10);
    const geoCola = new THREE.BoxGeometry(0.06, 0.2, 0.02);
    function crearLazo(material, escala = 1) {
      const g = new THREE.Group();
      for (const lado of [-1, 1]) {
        const l = new THREE.Mesh(geoLazada, material);
        l.position.set(0.12 * lado, 0.07, 0);
        l.rotation.set(0, 0, -0.45 * lado);
        l.scale.set(1.05, 0.75, 0.55);
        l.castShadow = alta;
        g.add(l);
        const c = new THREE.Mesh(geoCola, material);
        c.position.set(0.06 * lado, -0.05, 0.03);
        c.rotation.z = 0.5 * lado;
        g.add(c);
      }
      const n = new THREE.Mesh(geoNudo, material);
      n.position.y = 0.06;
      g.add(n);
      g.scale.setScalar(escala);
      return g;
    }

    const matGuirnalda = new THREE.MeshStandardMaterial({ color: '#174d2c', roughness: 1, flatShading: true });
    const matLazoRojo = new THREE.MeshStandardMaterial({ color: HEX.rojo, roughness: 0.45 });
    const geoBombilla = new THREE.SphereGeometry(alta ? 0.11 : 0.13, 8, 6);
    const coloresBombilla = [col('#ffcf7a'), col(HEX.rojo).multiplyScalar(1.6), col('#fff2d0'), col(HEX.doradoClaro)];
    const bombillasPared = [];

    for (const p of paredes) {
      const pared = grupoPared(p);
      // Zócalo verde con moldura dorada
      const zoc = new THREE.Mesh(new THREE.BoxGeometry(S * 2, 2.4, 0.14), matZocalo);
      zoc.position.set(0, 1.2, 0.07);
      pared.add(zoc);
      const mold = new THREE.Mesh(new THREE.BoxGeometry(S * 2, 0.1, 0.2), matMoldura);
      mold.position.set(0, 2.45, 0.1);
      pared.add(mold);

      crearVentana(pared, -8);
      crearVentana(pared, 8);

      // Corona central
      const corona = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.3, 10, 32), matGuirnalda);
      corona.position.set(0, 8.2, 0.35);
      pared.add(corona);
      const lazoCorona = crearLazo(matLazoRojo, 3.2);
      lazoCorona.position.set(0, 7.25, 0.7);
      pared.add(lazoCorona);

      // Guirnalda en "festones" sobre los ventanales
      const ganchos = [-20, -13, -3, 3, 13, 20];
      const pts = [];
      for (let i = 0; i < ganchos.length - 1; i++) {
        const a = ganchos[i];
        const b = ganchos[i + 1];
        const caida = (b - a) * 0.13;
        for (let k = 0; k <= 12; k++) {
          const t = k / 12;
          if (i > 0 && k === 0) continue;
          pts.push(new THREE.Vector3(lerp(a, b, t), 12 - Math.sin(t * Math.PI) * caida, 0.45));
        }
      }
      const curva = new THREE.CatmullRomCurve3(pts);
      const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, alta ? 260 : 140, 0.22, 6), matGuirnalda);
      pared.add(tubo);
      for (const x of ganchos.slice(1, -1)) {
        const l = crearLazo(matLazoRojo, 2.4);
        l.position.set(x, 12.05, 0.75);
        pared.add(l);
      }
      const n = alta ? 46 : 26;
      for (let i = 0; i < n; i++) {
        const v = curva.getPointAt((i + 0.5) / n);
        v.y -= 0.18;
        v.z += 0.1;
        bombillasPared.push(pared.localToWorld(v.clone()));
      }
    }

    const matBombilla = new THREE.MeshBasicMaterial({ toneMapped: false });
    const bombillas = new THREE.InstancedMesh(geoBombilla, matBombilla, bombillasPared.length);
    const aux = new THREE.Object3D();
    bombillasPared.forEach((v, i) => {
      aux.position.copy(v);
      aux.updateMatrix();
      bombillas.setMatrixAt(i, aux.matrix);
      bombillas.setColorAt(i, coloresBombilla[i % coloresBombilla.length]);
    });
    escena.add(bombillas);

    progreso(0.3);
    await respiro();

    // ---------- Material de gimnasio decorativo ----------
    const matHierro = new THREE.MeshStandardMaterial({ color: '#2a2b30', roughness: 0.45, metalness: 0.7 });
    const matCromo = new THREE.MeshStandardMaterial({ color: '#d9dde3', roughness: 0.22, metalness: 1 });
    const matRojoGoma = new THREE.MeshStandardMaterial({ color: HEX.rojo, roughness: 0.6 });
    const matVerdeGoma = new THREE.MeshStandardMaterial({ color: HEX.verde, roughness: 0.65 });
    const matCuero = new THREE.MeshStandardMaterial({ color: HEX.rojoOscuro, roughness: 0.55 });
    const matNieveSolida = new THREE.MeshStandardMaterial({ color: HEX.nieve, roughness: 0.9 });
    const proyectar = (m) => { m.castShadow = alta; m.receiveShadow = alta; return m; };

    function mancuernaSuelta(largo = 0.45, radio = 0.11, mat = matHierro) {
      const g = new THREE.Group();
      const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, largo, 8), matCromo);
      mango.rotation.z = Math.PI / 2;
      g.add(mango);
      for (const s of [-1, 1]) {
        const c = proyectar(new THREE.Mesh(new THREE.CylinderGeometry(radio, radio, 0.13, 6), mat));
        c.rotation.z = Math.PI / 2;
        c.position.x = (largo / 2) * s;
        g.add(c);
      }
      return g;
    }

    // Estantería de mancuernas
    {
      const rack = new THREE.Group();
      rack.position.set(-9.5, 0, -12.5);
      rack.rotation.y = 0.35;
      const barra = (w, h, d, x, y, z, mat = matHierro) => {
        const b = proyectar(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
        b.position.set(x, y, z);
        rack.add(b);
      };
      for (const x of [-1.6, 1.6]) barra(0.1, 1.1, 0.8, x, 0.55, 0);
      barra(3.3, 0.06, 0.35, 0, 0.55, 0.15);
      barra(3.3, 0.06, 0.35, 0, 0.95, -0.15);
      const mats = [matHierro, matRojoGoma, matVerdeGoma];
      for (let i = 0; i < 6; i++) {
        const m1 = mancuernaSuelta(0.4, 0.09 + i * 0.012, mats[i % 3]);
        m1.rotation.y = Math.PI / 2;
        m1.position.set(-1.35 + i * 0.54, 0.68, 0.15);
        rack.add(m1);
        const m2 = mancuernaSuelta(0.4, 0.08 + i * 0.01, mats[(i + 1) % 3]);
        m2.rotation.y = Math.PI / 2;
        m2.position.set(-1.35 + i * 0.54, 1.06, -0.15);
        rack.add(m2);
      }
      escena.add(rack);
    }

    // Kettlebells, una con gorro de Papá Noel
    {
      const geoBola = new THREE.SphereGeometry(0.28, 18, 14);
      const geoAsa = new THREE.TorusGeometry(0.17, 0.045, 8, 18, Math.PI);
      for (let i = 0; i < 5; i++) {
        const k = new THREE.Group();
        const bola = proyectar(new THREE.Mesh(geoBola, i % 2 ? matHierro : matVerdeGoma));
        bola.position.y = 0.28;
        bola.scale.y = 0.92;
        const asa = proyectar(new THREE.Mesh(geoAsa, matHierro));
        asa.position.y = 0.48;
        k.add(bola, asa);
        k.position.set(9 + i * 0.85, 0, -11.5 + i * 0.25);
        k.rotation.y = -0.3;
        if (i === 2) {
          const gorro = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 16), matRojoGoma);
          gorro.position.set(0.04, 0.82, 0);
          gorro.rotation.z = -0.35;
          const ribete = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 8, 20), matNieveSolida);
          ribete.rotation.x = Math.PI / 2;
          ribete.position.y = 0.63;
          const borla = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), matNieveSolida);
          borla.position.set(0.14, 1.0, 0);
          k.add(gorro, ribete, borla);
        }
        escena.add(k);
      }
    }

    // Banco de press
    {
      const banco = new THREE.Group();
      banco.position.set(13, 0, -5);
      banco.rotation.y = -0.9;
      const asiento = proyectar(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 1.9), matCuero));
      asiento.position.y = 0.5;
      banco.add(asiento);
      for (const z of [-0.7, 0.7]) {
        const pata = proyectar(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.08), matHierro));
        pata.position.set(0, 0.22, z);
        banco.add(pata);
      }
      escena.add(banco);
    }

    // Balones medicinales y esterillas enrolladas
    {
      const geoBalon = new THREE.SphereGeometry(0.3, 18, 14);
      [[-10.5, 8.5, matRojoGoma], [-11.1, 9.2, matVerdeGoma], [-10.2, 9.4, matHierro]].forEach(([x, z, m]) => {
        const b = proyectar(new THREE.Mesh(geoBalon, m));
        b.position.set(x, 0.3, z);
        escena.add(b);
      });
      const geoEsterilla = new THREE.CylinderGeometry(0.16, 0.16, 1.4, 16);
      const matsEst = [matVerdeGoma, matRojoGoma, matCuero, matVerdeGoma, matRojoGoma, matHierro];
      let k = 0;
      for (let fila = 0; fila < 3; fila++) {
        for (let i = 0; i < 3 - fila; i++) {
          const e = proyectar(new THREE.Mesh(geoEsterilla, matsEst[k++ % matsEst.length]));
          e.rotation.z = Math.PI / 2;
          e.position.set(-13, 0.16 + fila * 0.29, -2 + i * 0.33 + fila * 0.165);
          escena.add(e);
        }
      }
    }

    // Espalderas en las paredes laterales
    for (const p of [paredes[1], paredes[3]]) {
      const pared = grupoPared(p);
      for (const x of [-1.6, 1.6]) {
        const poste = new THREE.Mesh(new THREE.BoxGeometry(0.14, 5, 0.14), matMadera);
        poste.position.set(x, 2.5, 0.3);
        pared.add(poste);
      }
      const geoTravesano = new THREE.CylinderGeometry(0.035, 0.035, 3.2, 8);
      const matPeldano = new THREE.MeshStandardMaterial({ color: '#a8743f', roughness: 0.6 });
      for (let i = 0; i < 14; i++) {
        const t = new THREE.Mesh(geoTravesano, matPeldano);
        t.rotation.z = Math.PI / 2;
        t.position.set(0, 0.35 + i * 0.33, 0.3);
        pared.add(t);
      }
    }

    progreso(0.42);
    await respiro();

    // ---------- Árbol de discos de pesas ----------
    const arbol = new THREE.Group();
    escena.add(arbol);
    const NIVELES = 8;
    const segmentos = alta ? 56 : 36;

    function geoDisco(R, T) {
      const rh = 0.07;
      const perfil = [
        [rh, -T / 2], [R * 0.3, -T / 2], [R * 0.34, -T * 0.28], [R * 0.8, -T * 0.28], [R * 0.86, -T / 2],
        [R * 0.97, -T / 2], [R, -T * 0.32], [R, T * 0.32], [R * 0.97, T / 2],
        [R * 0.86, T / 2], [R * 0.8, T * 0.28], [R * 0.34, T * 0.28], [R * 0.3, T / 2], [rh, T / 2], [rh, -T / 2],
      ].map(([x, y]) => new THREE.Vector2(x, y));
      return new THREE.LatheGeometry(perfil, segmentos);
    }

    const matDisco = [
      new THREE.MeshStandardMaterial({ color: HEX.verde, roughness: 0.62, metalness: 0.05 }),
      new THREE.MeshStandardMaterial({ color: HEX.verdeOscuro, roughness: 0.62, metalness: 0.05 }),
    ];
    const matOro = new THREE.MeshStandardMaterial({
      color: HEX.dorado, roughness: 0.28, metalness: 0.9, emissive: HEX.dorado, emissiveIntensity: 0.08,
    });

    const barraCentral = proyectar(new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 4.75, 16), matCromo));
    barraCentral.position.y = 2.375;
    arbol.add(barraCentral);

    // Datos de las mancuernas-rama (instanciadas)
    const ramas = [];
    for (let i = 0; i < NIVELES; i++) {
      const t = i / (NIVELES - 1);
      const R = lerp(1.55, 0.38, t);
      const T = lerp(0.22, 0.12, t);
      const y = T / 2 + 0.02 + i * 0.56;
      const disco = proyectar(new THREE.Mesh(geoDisco(R, T), matDisco[i % 2]));
      disco.position.y = y;
      arbol.add(disco);
      const aro = new THREE.Mesh(new THREE.TorusGeometry(R * 0.985, T * 0.12, 6, segmentos), matOro);
      aro.rotation.x = Math.PI / 2;
      aro.position.y = y;
      arbol.add(aro);
      const collarin = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.09, 16), matCromo);
      collarin.position.y = y + T / 2 + 0.045;
      arbol.add(collarin);

      const n = Math.max(3, Math.round(R * 5.2));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + i * 0.55;
        const largo = 0.42 + R * 0.2;
        const dir = new THREE.Vector3(Math.cos(a), -0.32, Math.sin(a)).normalize();
        const centro = new THREE.Vector3(Math.cos(a) * R * 0.92, y + T / 2 + 0.02, Math.sin(a) * R * 0.92);
        ramas.push({ dir, centro, largo, color: (i + k) % 3 });
      }
    }

    const geoMango = new THREE.CylinderGeometry(0.026, 0.026, 1, 8);
    const geoCabeza = new THREE.CylinderGeometry(0.12, 0.12, 0.13, 6);
    const mangos = new THREE.InstancedMesh(geoMango, matCromo, ramas.length);
    const cabezas = new THREE.InstancedMesh(
      geoCabeza,
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.32, metalness: 0.55 }),
      ramas.length * 2,
    );
    mangos.castShadow = cabezas.castShadow = alta;
    const coloresCabeza = [col(HEX.rojo), col(HEX.dorado), col(HEX.rojoOscuro)];
    ramas.forEach((r, i) => {
      aux.position.copy(r.centro);
      aux.quaternion.setFromUnitVectors(EJE_Y, r.dir);
      aux.scale.set(1, r.largo, 1);
      aux.updateMatrix();
      mangos.setMatrixAt(i, aux.matrix);
      for (const s of [-1, 1]) {
        aux.position.copy(r.centro).addScaledVector(r.dir, (r.largo / 2) * s);
        aux.scale.set(1, 1, 1);
        aux.updateMatrix();
        const idx = i * 2 + (s > 0 ? 1 : 0);
        cabezas.setMatrixAt(idx, aux.matrix);
        cabezas.setColorAt(idx, coloresCabeza[(r.color + (s > 0 ? 0 : 1)) % 3]);
      }
    });
    arbol.add(mangos, cabezas);

    // Luces en espiral alrededor del árbol
    const numLuces = alta ? 84 : 52;
    const lucesArbol = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), numLuces);
    const baseLuces = [];
    for (let i = 0; i < numLuces; i++) {
      const s = i / (numLuces - 1);
      const ang = s * Math.PI * 2 * 5;
      const r = lerp(1.68, 0.5, s);
      aux.position.set(Math.cos(ang) * r, 0.32 + s * 3.75, Math.sin(ang) * r);
      aux.quaternion.identity();
      aux.scale.setScalar(1);
      aux.updateMatrix();
      lucesArbol.setMatrixAt(i, aux.matrix);
      const c = coloresBombilla[i % coloresBombilla.length].clone().multiplyScalar(1.4);
      baseLuces.push({ c, fase: Math.random() * Math.PI * 2 });
      lucesArbol.setColorAt(i, c);
    }
    arbol.add(lucesArbol);

    // Estrella dorada
    const formaEstrella = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.21 : 0.5;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) formaEstrella.moveTo(x, y); else formaEstrella.lineTo(x, y);
    }
    formaEstrella.closePath();
    const geoEstrella = new THREE.ExtrudeGeometry(formaEstrella, {
      depth: 0.1, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 2,
    });
    geoEstrella.center();
    const estrella = new THREE.Mesh(geoEstrella, new THREE.MeshStandardMaterial({
      color: HEX.dorado, metalness: 0.85, roughness: 0.22, emissive: HEX.doradoClaro, emissiveIntensity: 0.55,
    }));
    estrella.position.y = 5.05;
    estrella.castShadow = alta;
    arbol.add(estrella);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texBrillo, color: '#ffd98a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.scale.setScalar(2.6);
    halo.position.y = 5.05;
    arbol.add(halo);
    luzEstrella.position.set(0, 5.2, 0);

    progreso(0.58);
    await respiro();

    // ---------- Regalos ----------
    const patrones = [
      { fondo: HEX.rojo, motivo: HEX.doradoClaro, cinta: HEX.dorado, tipo: 'lunares' },
      { fondo: HEX.verde, motivo: HEX.nieve, cinta: HEX.rojo, tipo: 'rayas' },
      { fondo: HEX.nieve, motivo: HEX.rojo, cinta: HEX.verde, tipo: 'estrellas' },
      { fondo: HEX.dorado, motivo: HEX.rojoOscuro, cinta: HEX.rojo, tipo: 'rombos' },
      { fondo: HEX.rojoOscuro, motivo: HEX.nieve, cinta: HEX.nieve, tipo: 'copos' },
    ];
    const texturasPapel = patrones.map((p) => texturaCanvas(256, 256, (g, w) => {
      g.fillStyle = p.fondo;
      g.fillRect(0, 0, w, w);
      g.fillStyle = p.motivo;
      g.strokeStyle = p.motivo;
      if (p.tipo === 'lunares') {
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
          g.beginPath();
          g.arc(x * 32 + (y % 2 ? 16 : 0) + 8, y * 32 + 16, 5, 0, Math.PI * 2);
          g.fill();
        }
      } else if (p.tipo === 'rayas') {
        g.lineWidth = 9;
        for (let i = -w; i < w * 2; i += 42) {
          g.beginPath(); g.moveTo(i, 0); g.lineTo(i + w, w); g.stroke();
        }
      } else if (p.tipo === 'estrellas') {
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
          const cx = x * 52 + (y % 2 ? 26 : 0) + 13;
          const cy = y * 52 + 26;
          g.beginPath();
          for (let i = 0; i < 10; i++) {
            const r = i % 2 ? 4.5 : 11;
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          }
          g.fill();
        }
      } else if (p.tipo === 'rombos') {
        g.lineWidth = 4;
        for (let i = -w; i < w * 2; i += 48) {
          g.beginPath(); g.moveTo(i, 0); g.lineTo(i + w, w); g.stroke();
          g.beginPath(); g.moveTo(i, w); g.lineTo(i + w, 0); g.stroke();
        }
      } else {
        g.lineWidth = 3;
        for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
          const cx = x * 64 + (y % 2 ? 32 : 0) + 16;
          const cy = y * 64 + 32;
          for (let k = 0; k < 3; k++) {
            const a = (k / 3) * Math.PI;
            g.beginPath();
            g.moveTo(cx - Math.cos(a) * 11, cy - Math.sin(a) * 11);
            g.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11);
            g.stroke();
          }
        }
      }
    }));

    // Etiquetas numeradas (sprites que siempre miran a la cámara)
    const cacheEtiquetas = new Map();
    function texturaEtiqueta(dia, estado) {
      const clave = `${dia}-${estado}`;
      if (cacheEtiquetas.has(clave)) return cacheEtiquetas.get(clave);
      const t = texturaCanvas(256, 256, (g, w) => {
        const c = w / 2;
        const bloq = estado === 'bloqueada';
        const abierta = estado === 'abierta';
        g.shadowColor = 'rgba(0,0,0,0.45)';
        g.shadowBlur = 14;
        g.shadowOffsetY = 4;
        const gr = g.createRadialGradient(c - 30, c - 40, 10, c, c, c);
        if (bloq) {
          gr.addColorStop(0, '#f1ebe1'); gr.addColorStop(1, '#bdb2a3');
        } else if (abierta) {
          gr.addColorStop(0, '#3d8c5f'); gr.addColorStop(1, HEX.verdeOscuro);
        } else {
          gr.addColorStop(0, '#fff2c4'); gr.addColorStop(0.6, HEX.doradoClaro); gr.addColorStop(1, HEX.dorado);
        }
        g.fillStyle = gr;
        g.beginPath(); g.arc(c, c, c - 14, 0, Math.PI * 2); g.fill();
        g.shadowColor = 'transparent';
        g.lineWidth = 9;
        g.strokeStyle = bloq ? '#6e655a' : abierta ? HEX.doradoClaro : HEX.rojoOscuro;
        g.beginPath(); g.arc(c, c, c - 20, 0, Math.PI * 2); g.stroke();
        g.fillStyle = bloq ? '#4a423a' : abierta ? '#ffffff' : HEX.rojoOscuro;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const tam = dia > 9 ? 112 : 128;
        g.font = `700 ${tam}px "Playfair Display", Georgia, serif`;
        g.fillText(String(dia), c, c - (estado === 'hoy' || bloq || abierta ? 14 : 2));
        if (estado === 'hoy') {
          g.font = '800 34px "Nunito Sans", system-ui, sans-serif';
          g.fillStyle = HEX.rojo;
          g.fillText('HOY', c, c + 66);
        } else if (bloq) {
          // Candado
          g.fillStyle = '#4a423a';
          g.fillRect(c - 19, c + 52, 38, 28);
          g.lineWidth = 7;
          g.strokeStyle = '#4a423a';
          g.beginPath(); g.arc(c, c + 52, 12, Math.PI, 0); g.stroke();
        } else if (abierta) {
          g.lineWidth = 10;
          g.lineCap = 'round';
          g.strokeStyle = HEX.doradoClaro;
          g.beginPath(); g.moveTo(c - 20, c + 62); g.lineTo(c - 4, c + 76); g.lineTo(c + 24, c + 46); g.stroke();
        }
      });
      cacheEtiquetas.set(clave, t);
      return t;
    }

    const matCandado = new THREE.MeshStandardMaterial({ color: '#b8923a', metalness: 0.9, roughness: 0.3 });
    const geoCuerpoCandado = new THREE.BoxGeometry(0.22, 0.18, 0.07);
    const geoArcoCandado = new THREE.TorusGeometry(0.075, 0.02, 8, 16, Math.PI);
    const geoHalo = new THREE.CircleGeometry(1, 40);
    const geoInterior = new THREE.PlaneGeometry(1, 1);

    const regalos = [];
    const cajasClic = [];
    const N_INTERIOR = 10;

    for (const premio of premios) {
      const dia = premio.dia;
      const rnd = aleatorio(dia * 97 + 13);
      const interior = dia <= N_INTERIOR;
      const idx = interior ? dia - 1 : dia - 1 - N_INTERIOR;
      const total = interior ? N_INTERIOR : premios.length - N_INTERIOR;
      const radio = (interior ? 3.2 : 5.15) + (rnd() - 0.5) * 0.35;
      const desfase = interior ? 0 : 0.5 / total;
      // Ángulo 0 = frente (+Z). Avanza en sentido horario visto desde arriba.
      const ang = -((idx / total) + desfase) * Math.PI * 2 + (rnd() - 0.5) * 0.1;
      const x = Math.sin(ang) * radio;
      const z = Math.cos(ang) * radio;

      const grande = dia === 24;
      const s = grande ? 1.25 : 0.72 + rnd() * 0.28;
      const w = s * (0.95 + rnd() * 0.2);
      const h = s * (grande ? 1.0 : 0.7 + rnd() * 0.45);
      const d = s * (0.95 + rnd() * 0.2);

      const pat = patrones[(dia * 3 + (interior ? 0 : 1)) % patrones.length];
      const texPapel = texturasPapel[patrones.indexOf(pat)];

      const raiz = new THREE.Group();
      raiz.position.set(x, 0, z);
      raiz.rotation.y = ang + (rnd() - 0.5) * 0.5;
      escena.add(raiz);
      const elevador = new THREE.Group();
      raiz.add(elevador);

      const matPapel = new THREE.MeshStandardMaterial({
        map: texPapel, roughness: 0.5, metalness: 0.05, emissive: col(HEX.doradoClaro), emissiveIntensity: 0,
      });
      const matCinta = new THREE.MeshStandardMaterial({
        color: pat.cinta, roughness: 0.32, metalness: 0.35, emissive: col(HEX.doradoClaro), emissiveIntensity: 0,
      });

      const cuerpo = proyectar(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matPapel));
      cuerpo.position.y = h / 2;
      elevador.add(cuerpo);
      const cintaA = new THREE.Mesh(new THREE.BoxGeometry(w + 0.012, h + 0.004, 0.13 * s), matCinta);
      cintaA.position.y = h / 2;
      const cintaB = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, h + 0.004, d + 0.012), matCinta);
      cintaB.position.y = h / 2;
      elevador.add(cintaA, cintaB);

      // Tapa (pivote en la parte superior de la caja)
      const tapa = new THREE.Group();
      tapa.position.y = h;
      elevador.add(tapa);
      const altoTapa = 0.14 * s + 0.03;
      const tapaCaja = proyectar(new THREE.Mesh(new THREE.BoxGeometry(w + 0.07, altoTapa, d + 0.07), matPapel));
      tapaCaja.position.y = altoTapa / 2 - 0.02;
      tapa.add(tapaCaja);
      const tcA = new THREE.Mesh(new THREE.BoxGeometry(w + 0.085, altoTapa + 0.006, 0.13 * s), matCinta);
      tcA.position.y = tapaCaja.position.y;
      const tcB = new THREE.Mesh(new THREE.BoxGeometry(0.13 * s, altoTapa + 0.006, d + 0.085), matCinta);
      tcB.position.y = tapaCaja.position.y;
      tapa.add(tcA, tcB);
      const lazo = crearLazo(matCinta, s * 1.15);
      lazo.position.y = altoTapa - 0.02;
      tapa.add(lazo);

      // Brillo interior (visible al abrir)
      const interiorBrillo = new THREE.Mesh(geoInterior, new THREE.MeshBasicMaterial({
        map: texBrillo, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      interiorBrillo.rotation.x = -Math.PI / 2;
      interiorBrillo.scale.set(w * 1.6, d * 1.6, 1);
      interiorBrillo.position.y = h + 0.01;
      elevador.add(interiorBrillo);

      // Candado en la cara frontal
      const candado = new THREE.Group();
      const cc = new THREE.Mesh(geoCuerpoCandado, matCandado);
      const ca = new THREE.Mesh(geoArcoCandado, matCandado);
      ca.position.y = 0.09;
      candado.add(cc, ca);
      candado.scale.setScalar(s * 1.2);
      candado.position.set(0, h * 0.5, d / 2 + 0.05);
      elevador.add(candado);

      // Halo en el suelo
      const haloSuelo = new THREE.Mesh(geoHalo, new THREE.MeshBasicMaterial({
        map: texBrillo, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      haloSuelo.rotation.x = -Math.PI / 2;
      haloSuelo.position.y = 0.02;
      haloSuelo.scale.setScalar(s * 1.5);
      raiz.add(haloSuelo);

      // Etiqueta con el número
      const etiqueta = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      const escalaEtiqueta = alta ? 0.62 : 0.8;
      etiqueta.scale.setScalar(escalaEtiqueta);
      etiqueta.position.y = h + altoTapa + 0.33 * s + 0.42;
      etiqueta.renderOrder = 2;
      elevador.add(etiqueta);

      // Volumen invisible para el raycasting (más generoso en táctil)
      const caja = new THREE.Mesh(new THREE.BoxGeometry(w + 0.35, h + 1.1, d + 0.35), new THREE.MeshBasicMaterial());
      caja.visible = false;
      caja.position.y = (h + 1.1) / 2;
      caja.userData.dia = dia;
      elevador.add(caja);
      cajasClic.push(caja);

      // Pose de reposo de la tapa abierta: apoyada en un lateral de la caja
      const reposo = {
        pos: new THREE.Vector3(w / 2 + (w + 0.07) * 0.42, -h + (w + 0.07) * 0.5 * Math.sin(0.5) + 0.06, 0.05),
        rot: new THREE.Euler(0.08, 0.2, -1.07),
      };

      regalos.push({
        dia, raiz, elevador, tapa, lazo, candado, interiorBrillo, haloSuelo, etiqueta, escalaEtiqueta,
        matPapel, matCinta, reposo, w, h, d, s,
        estado: null, hover: 0, objetivoHover: 0, animando: false, fase: rnd() * Math.PI * 2,
      });
    }
    const porDia = new Map(regalos.map((r) => [r.dia, r]));

    const gris = new THREE.Color(0.5, 0.48, 0.47);
    const blanco = new THREE.Color(1, 1, 1);

    function aplicarEstado(r, estado) {
      r.estado = estado;
      const bloq = estado === 'bloqueada';
      const abierta = estado === 'abierta';
      r.matPapel.color.copy(bloq ? gris : blanco);
      r.matCinta.color.set(r.matCinta.userData.base || (r.matCinta.userData.base = '#' + r.matCinta.color.getHexString()));
      if (bloq) r.matCinta.color.multiply(gris);
      r.candado.visible = bloq;
      r.etiqueta.material.map = texturaEtiqueta(r.dia, estado);
      r.etiqueta.material.needsUpdate = true;
      r.etiqueta.material.opacity = bloq ? 0.92 : 1;
      if (!r.animando) {
        if (abierta) {
          r.tapa.position.copy(r.reposo.pos).add(new THREE.Vector3(0, r.h, 0));
          r.tapa.rotation.copy(r.reposo.rot);
          r.lazo.visible = false;
          r.interiorBrillo.material.opacity = 0.85;
        } else {
          r.tapa.position.set(0, r.h, 0);
          r.tapa.rotation.set(0, 0, 0);
          r.lazo.visible = true;
          r.lazo.scale.setScalar(r.s * 1.15);
          r.interiorBrillo.material.opacity = 0;
        }
      }
    }

    function actualizar() {
      for (const r of regalos) aplicarEstado(r, estadoDe(r.dia));
    }
    actualizar();

    progreso(0.75);
    await respiro();

    // ---------- Confeti ----------
    const MAX_CONFETI = movimientoReducido ? 40 : alta ? 280 : 130;
    const confeti = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.07, 0.12),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }),
      MAX_CONFETI,
    );
    confeti.frustumCulled = false;
    const coloresConfeti = [col(HEX.doradoClaro), col(HEX.dorado), col(HEX.dorado), col(HEX.rojo), col('#2f9e63'), col(HEX.nieve)];
    const particulas = Array.from({ length: MAX_CONFETI }, (_, i) => {
      confeti.setColorAt(i, coloresConfeti[i % coloresConfeti.length].clone().multiplyScalar(1.3));
      return { vida: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), vr: new THREE.Vector3() };
    });
    const ocultar = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_CONFETI; i++) confeti.setMatrixAt(i, ocultar);
    escena.add(confeti);
    let siguienteParticula = 0;
    let confetiActivo = false;

    function estallido(origen, cantidad) {
      const n = Math.min(cantidad, MAX_CONFETI);
      const fuerza = movimientoReducido ? 1.6 : 4.2;
      for (let k = 0; k < n; k++) {
        const pt = particulas[siguienteParticula];
        siguienteParticula = (siguienteParticula + 1) % MAX_CONFETI;
        pt.vida = 2.6 + Math.random() * 1.2;
        pt.p.copy(origen);
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * 0.9;
        pt.v.set(Math.cos(a) * e * fuerza * 0.55, fuerza * (0.75 + Math.random() * 0.6), Math.sin(a) * e * fuerza * 0.55);
        pt.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        pt.vr.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
      }
      confetiActivo = true;
    }

    function actualizarConfeti(dt) {
      if (!confetiActivo) return;
      let vivas = 0;
      for (let i = 0; i < MAX_CONFETI; i++) {
        const pt = particulas[i];
        if (pt.vida <= 0) continue;
        pt.vida -= dt;
        if (pt.vida <= 0) {
          confeti.setMatrixAt(i, ocultar);
          continue;
        }
        vivas++;
        if (pt.p.y > 0.02) {
          pt.v.y -= 5.2 * dt;
          pt.v.multiplyScalar(1 - 1.6 * dt);
          pt.p.addScaledVector(pt.v, dt);
          pt.r.x += pt.vr.x * dt;
          pt.r.y += pt.vr.y * dt;
          pt.r.z += pt.vr.z * dt;
        } else {
          pt.p.y = 0.02;
          pt.r.x = -Math.PI / 2;
          pt.r.y = 0;
        }
        aux.position.copy(pt.p);
        aux.rotation.copy(pt.r);
        aux.scale.setScalar(Math.min(1, pt.vida * 1.5));
        aux.updateMatrix();
        confeti.setMatrixAt(i, aux.matrix);
      }
      confeti.instanceMatrix.needsUpdate = true;
      if (!vivas) confetiActivo = false;
    }

    // ---------- Animaciones (mini sistema de interpolación) ----------
    const animaciones = new Set();
    let reloj = 0;
    function animar(duracion, fn) {
      return new Promise((resolve) => {
        animaciones.add({ inicio: reloj, duracion, fn, resolve });
      });
    }
    function actualizarAnimaciones() {
      for (const a of animaciones) {
        const p = clamp((reloj - a.inicio) / a.duracion, 0, 1);
        a.fn(p);
        if (p >= 1) {
          animaciones.delete(a);
          a.resolve();
        }
      }
    }

    // ---------- Cámara: adaptación a la pantalla y giros ----------
    let retratoPrevio = null;
    function ajustarTamano() {
      const w = Math.max(1, contenedor.clientWidth);
      const h = Math.max(1, contenedor.clientHeight);
      renderer.setSize(w, h, false);
      const aspecto = w / h;
      camara.aspect = aspecto;
      camara.fov = clamp((2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(27)) / aspecto) * 180) / Math.PI, 44, 64);
      camara.updateProjectionMatrix();
      const retrato = aspecto < 1;
      if (retrato !== retratoPrevio) {
        const dist = retrato ? 13 : 14.5;
        const esf = new THREE.Spherical().setFromVector3(camara.position.clone().sub(controles.target));
        if (retratoPrevio === null) {
          const r = porDia.get(op.diaInicial);
          const theta = r ? Math.atan2(r.raiz.position.x, r.raiz.position.z) : 0.12;
          esf.set(dist, 1.0, theta);
        }
        else esf.radius = dist;
        camara.position.setFromSpherical(esf).add(controles.target);
        retratoPrevio = retrato;
      }
    }
    ajustarTamano();
    controles.update();
    const observador = new ResizeObserver(() => ajustarTamano());
    observador.observe(contenedor);

    let temporizadorInactivo = null;
    let girando = false;
    function programarAutoGiro(ms = 6000) {
      clearTimeout(temporizadorInactivo);
      controles.autoRotate = false;
      if (movimientoReducido) return;
      temporizadorInactivo = setTimeout(() => { if (!girando && !bloqueoAutoGiro) controles.autoRotate = true; }, ms);
    }
    let bloqueoAutoGiro = false;
    controles.addEventListener('start', () => programarAutoGiro(8000));

    function girarHacia(r, duracion = 0.8) {
      const destino = Math.atan2(r.raiz.position.x, r.raiz.position.z);
      const offset = camara.position.clone().sub(controles.target);
      const esf = new THREE.Spherical().setFromVector3(offset);
      let delta = destino - esf.theta;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      programarAutoGiro(8000);
      if (Math.abs(delta) < 0.35) return Promise.resolve();
      const inicioTheta = esf.theta;
      const inicioPhi = esf.phi;
      const phiDestino = clamp(esf.phi, 0.95, 1.15);
      if (movimientoReducido || duracion === 0) {
        esf.theta = destino;
        esf.phi = phiDestino;
        camara.position.setFromSpherical(esf).add(controles.target);
        return Promise.resolve();
      }
      girando = true;
      return animar(duracion, (p) => {
        const e = entradaSalida(p);
        esf.theta = inicioTheta + delta * e;
        esf.phi = lerp(inicioPhi, phiDestino, e);
        camara.position.setFromSpherical(esf).add(controles.target);
        if (p >= 1) girando = false;
      });
    }

    // ---------- Interacción: hover y clic con raycasting ----------
    const rayo = new THREE.Raycaster();
    const puntero = new THREE.Vector2();
    let hoverDia = null;
    let resaltadoDia = null;
    let punteroPendiente = null;
    let inicioToque = null;

    function diaEn(clientX, clientY) {
      const rect = lienzo.getBoundingClientRect();
      puntero.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      rayo.setFromCamera(puntero, camara);
      const hit = rayo.intersectObjects(cajasClic, false)[0];
      return hit ? hit.object.userData.dia : null;
    }

    function posicionPantalla(r) {
      const v = new THREE.Vector3();
      r.etiqueta.getWorldPosition(v);
      v.project(camara);
      const rect = lienzo.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    }

    function fijarHover(dia) {
      if (dia === hoverDia) return;
      hoverDia = dia;
      lienzo.style.cursor = dia ? 'pointer' : '';
      if (!dia) op.alHover?.(null, null);
    }

    const alMoverPuntero = (e) => {
      if (e.pointerType === 'touch') return;
      punteroPendiente = { x: e.clientX, y: e.clientY };
    };
    const alSalirPuntero = () => {
      punteroPendiente = null;
      fijarHover(null);
    };
    const alPulsar = (e) => {
      inicioToque = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const alSoltar = (e) => {
      if (!inicioToque) return;
      const dx = e.clientX - inicioToque.x;
      const dy = e.clientY - inicioToque.y;
      const dt = performance.now() - inicioToque.t;
      inicioToque = null;
      if (dx * dx + dy * dy > 64 || dt > 700) return;
      const dia = diaEn(e.clientX, e.clientY);
      if (dia) op.alSeleccionar?.(dia);
    };
    lienzo.addEventListener('pointermove', alMoverPuntero);
    lienzo.addEventListener('pointerleave', alSalirPuntero);
    lienzo.addEventListener('pointerdown', alPulsar);
    lienzo.addEventListener('pointerup', alSoltar);

    // ---------- Bucle de animación ----------
    const relojThree = new THREE.Clock();
    let tiempoNieve = 0;
    let parpadeo = 0;
    const medicion = { frames: 0, tiempo: 0, calentamiento: 1.2, resolver: null, objetivo: 90 };

    function bucle() {
      const bruto = relojThree.getDelta();
      const dt = Math.min(bruto, 0.05);
      reloj += dt;

      if (medicion.resolver) {
        if (medicion.calentamiento > 0) medicion.calentamiento -= dt;
        else {
          medicion.frames++;
          medicion.tiempo += bruto;
          if (medicion.frames >= medicion.objetivo) {
            medicion.resolver(medicion.frames / Math.max(medicion.tiempo, 0.001));
            medicion.resolver = null;
          }
        }
      }

      if (punteroPendiente) {
        const dia = diaEn(punteroPendiente.x, punteroPendiente.y);
        punteroPendiente = null;
        fijarHover(dia);
      }

      actualizarAnimaciones();
      controles.update(dt);

      // Nieve
      const factorNieve = movimientoReducido ? 0.25 : 1;
      tiempoNieve += dt * factorNieve;
      for (const c of copos) {
        for (let i = 0; i < c.vel.length; i++) {
          const iy = i * 3 + 1;
          c.pos[iy] -= c.vel[i] * dt * factorNieve;
          c.pos[i * 3] += Math.sin(tiempoNieve * 1.3 + c.fase[i]) * 0.12 * dt * factorNieve;
          if (c.pos[iy] < -c.h / 2) {
            c.pos[iy] = c.h / 2;
            c.pos[i * 3] = (Math.random() - 0.5) * c.w;
          }
          if (c.pos[i * 3] > c.w / 2) c.pos[i * 3] = -c.w / 2;
          else if (c.pos[i * 3] < -c.w / 2) c.pos[i * 3] = c.w / 2;
        }
        c.geo.attributes.position.needsUpdate = true;
      }

      // Estrella y luces del árbol
      if (!movimientoReducido) {
        estrella.rotation.y += dt * 0.6;
        halo.material.opacity = 0.8 + Math.sin(reloj * 2) * 0.15;
        parpadeo += dt;
        if (parpadeo > 0.06) {
          parpadeo = 0;
          const tmp = new THREE.Color();
          baseLuces.forEach((l, i) => {
            const k = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(reloj * 2.2 + l.fase));
            lucesArbol.setColorAt(i, tmp.copy(l.c).multiplyScalar(k));
          });
          lucesArbol.instanceColor.needsUpdate = true;
        }
      }

      // Regalos: hover, pulso, flotación
      for (const r of regalos) {
        const activo = r.dia === hoverDia || r.dia === resaltadoDia;
        r.objetivoHover = activo ? 1 : 0;
        r.hover += (r.objetivoHover - r.hover) * Math.min(1, dt * 10);
        if (r.animando) continue;
        const bloq = r.estado === 'bloqueada';
        const hoy = r.estado === 'hoy';
        const disp = r.estado === 'disponible';
        const pulso = movimientoReducido ? 0.5 : 0.5 + 0.5 * Math.sin(reloj * (hoy ? 3.2 : 2) + r.fase);
        const flota = hoy && !movimientoReducido ? Math.sin(reloj * 2.2 + r.fase) * 0.05 + 0.05 : 0;
        r.elevador.position.y = flota + r.hover * (bloq ? 0.08 : 0.28);
        let brillo = 0;
        if (hoy) brillo = 0.1 + pulso * 0.28;
        else if (disp) brillo = 0.06 + pulso * 0.08;
        else if (r.estado === 'abierta') brillo = 0.04;
        brillo += r.hover * (bloq ? 0.05 : 0.22);
        r.matPapel.emissiveIntensity = brillo;
        r.matCinta.emissiveIntensity = brillo * 0.8;
        r.haloSuelo.material.opacity = bloq ? 0 : hoy ? 0.35 + pulso * 0.45 : disp ? 0.25 + pulso * 0.15 : r.hover * 0.3;
        const escalaTag = r.escalaEtiqueta * (1 + r.hover * 0.18 + (hoy && !movimientoReducido ? pulso * 0.08 : 0));
        r.etiqueta.scale.setScalar(escalaTag);
      }

      actualizarConfeti(dt);
      renderer.render(escena, camara);

      if (hoverDia) {
        const r = porDia.get(hoverDia);
        op.alHover?.(hoverDia, posicionPantalla(r));
      }
    }

    // Pausa cuando la pestaña no se ve o el lienzo está fuera de pantalla
    let visiblePestana = !document.hidden;
    let visibleLienzo = true;
    let enMarcha = false;
    function sincronizarBucle() {
      const debe = visiblePestana && visibleLienzo;
      if (debe === enMarcha) return;
      enMarcha = debe;
      if (debe) relojThree.getDelta();
      renderer.setAnimationLoop(debe ? bucle : null);
    }
    const alCambiarVisibilidad = () => {
      visiblePestana = !document.hidden;
      sincronizarBucle();
    };
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    const io = new IntersectionObserver((entradas) => {
      visibleLienzo = entradas.some((e) => e.isIntersecting);
      sincronizarBucle();
    });
    io.observe(contenedor);

    progreso(0.88);
    await respiro();
    // Precompila los shaders para evitar tirones en el primer fotograma.
    try {
      renderer.compile(escena, camara);
    } catch { /* opcional */ }
    renderer.render(escena, camara);
    progreso(1);
    sincronizarBucle();
    programarAutoGiro(2500);

    // ---------- API pública ----------
    return {
      actualizar,

      /** Resalta una casilla (p. ej. al enfocarla desde la lista accesible). */
      resaltar(dia, { girar = false } = {}) {
        resaltadoDia = dia || null;
        const r = dia && porDia.get(dia);
        if (r && girar) girarHacia(r);
      },

      /** Pequeña sacudida para las casillas bloqueadas. */
      sacudir(dia) {
        const r = porDia.get(dia);
        if (!r || r.animando) return;
        if (movimientoReducido) return;
        r.animando = true;
        animar(0.5, (p) => {
          r.elevador.rotation.z = Math.sin(p * Math.PI * 6) * 0.1 * (1 - p);
          r.elevador.position.y = r.hover * 0.08;
          if (p >= 1) {
            r.elevador.rotation.z = 0;
            r.animando = false;
          }
        });
      },

      /**
       * Animación de apertura: la tapa sale volando, estallido de confeti dorado
       * y la tapa acaba apoyada junto a la caja. Resuelve cuando conviene abrir el modal.
       */
      async abrirRegalo(dia, { desdeLista = false } = {}) {
        const r = porDia.get(dia);
        if (!r) return;
        bloqueoAutoGiro = true;
        controles.autoRotate = false;
        if (desdeLista) await girarHacia(r, 0.6);
        r.animando = true;
        const origen = new THREE.Vector3();
        r.tapa.getWorldPosition(origen);
        const reposo = r.reposo.pos.clone().add(new THREE.Vector3(0, r.h, 0));
        const finalRot = r.reposo.rot;

        if (movimientoReducido) {
          estallido(origen.add(new THREE.Vector3(0, 0.2, 0)), 30);
          r.lazo.visible = false;
          await animar(0.3, (p) => {
            r.tapa.position.lerpVectors(new THREE.Vector3(0, r.h, 0), reposo, p);
            r.tapa.rotation.set(finalRot.x * p, finalRot.y * p, finalRot.z * p);
            r.interiorBrillo.material.opacity = 0.85 * p;
          });
          r.animando = false;
          bloqueoAutoGiro = false;
          return;
        }

        const subida = new THREE.Vector3(r.w * 0.4, r.h + 2.3, 0.2);
        // 1) Anticipación: la caja se encoge un poco
        await animar(0.16, (p) => {
          const e = Math.sin(p * Math.PI);
          r.elevador.scale.set(1 + e * 0.06, 1 - e * 0.1, 1 + e * 0.06);
          r.elevador.position.y = 0.28 * r.hover;
        });
        r.elevador.scale.set(1, 1, 1);
        // 2) Estallido + la tapa sale volando
        estallido(origen.clone().add(new THREE.Vector3(0, 0.15, 0)), alta ? 220 : 110);
        luzDestello.position.copy(origen).add(new THREE.Vector3(0, 0.6, 0));
        animar(0.9, (p) => { luzDestello.intensity = 40 * Math.pow(1 - p, 2); });
        animar(0.3, (p) => {
          r.lazo.scale.setScalar(r.s * 1.15 * (1 - p));
          r.lazo.rotation.y = p * 4;
          if (p >= 1) { r.lazo.visible = false; r.lazo.rotation.y = 0; }
        });
        animar(0.6, (p) => { r.interiorBrillo.material.opacity = 0.85 * suave(p); });
        const inicio = new THREE.Vector3(0, r.h, 0);
        await animar(0.62, (p) => {
          const e = salidaCubica(p);
          r.tapa.position.lerpVectors(inicio, subida, e);
          r.tapa.rotation.set(p * Math.PI * 2.2, p * 1.4, -p * Math.PI * 1.1);
        });
        // 3) La tapa cae y se apoya junto a la caja (el modal ya puede abrirse)
        const rotIni = r.tapa.rotation.clone();
        const caida = animar(0.5, (p) => {
          const e = p * p;
          r.tapa.position.lerpVectors(subida, reposo, e);
          r.tapa.rotation.set(
            lerp(rotIni.x, finalRot.x + Math.PI * 2, e),
            lerp(rotIni.y, finalRot.y, e),
            lerp(rotIni.z, finalRot.z, e),
          );
          if (p >= 1) {
            r.tapa.rotation.copy(finalRot);
            r.animando = false;
            bloqueoAutoGiro = false;
          }
        });
        await new Promise((res) => setTimeout(res, 220));
        return caida;
      },

      /** Mide los FPS reales durante ~90 fotogramas tras un calentamiento. */
      medirRendimiento() {
        return new Promise((resolve) => {
          medicion.frames = 0;
          medicion.tiempo = 0;
          medicion.calentamiento = 1.2;
          medicion.resolver = resolve;
        });
      },

      pausarAutoGiro(valor) {
        bloqueoAutoGiro = valor;
        if (valor) controles.autoRotate = false;
        else programarAutoGiro(4000);
      },

      destruir() {
        renderer.setAnimationLoop(null);
        observador.disconnect();
        io.disconnect();
        document.removeEventListener('visibilitychange', alCambiarVisibilidad);
        clearTimeout(temporizadorInactivo);
        controles.dispose();
        escena.traverse((o) => {
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
          mats.forEach((m) => { m.map?.dispose?.(); m.dispose(); });
        });
        entorno.dispose();
        renderer.dispose();
        renderer.forceContextLoss?.();
        lienzo.remove();
      },
    };
  }

  Object.assign(A, { cargarThree, crearEscena });
})(window.Adviento = window.Adviento || {});
