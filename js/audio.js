/**
 * Música y efectos generados en tiempo real con Web Audio API.
 * La melodía es original (no hay archivos de audio ni obras con derechos).
 * Silenciado por defecto: el AudioContext solo se crea cuando la persona
 * pulsa el botón de sonido (requisito de los navegadores).
 */
(function (A) {
  'use strict';

  const BPM = 96;
  const PULSO = 60 / BPM;

  // Melodía original en Re mayor, compás de 3/4. [nota MIDI | null, pulsos]
  const MELODIA = [
    [78, 1], [76, 1], [74, 1], [69, 2], [71, 1],
    [73, 1], [74, 1], [76, 1], [78, 3],
    [79, 1], [78, 1], [76, 1], [74, 2], [71, 1],
    [73, 1], [69, 1], [71, 1], [69, 3],
    [71, 1], [73, 1], [74, 1], [76, 2], [74, 1],
    [73, 1], [71, 1], [69, 1], [71, 3],
    [74, 1], [76, 1], [78, 1], [79, 2], [76, 1],
    [78, 1], [76, 1], [73, 1], [74, 3],
  ];

  // Un acorde por compás (fundamental + terceras), en notas MIDI graves.
  const ACORDES = [
    [50, 54, 57], [55, 59, 62], [57, 61, 64], [50, 54, 57],
    [55, 59, 62], [47, 50, 54], [57, 61, 64], [57, 61, 64],
    [55, 59, 62], [57, 61, 64], [52, 55, 59], [47, 50, 54],
    [50, 54, 57], [55, 59, 62], [57, 61, 64], [50, 54, 57],
  ];

  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  function crearAudio() {
    let ctx = null;
    let maestro = null;
    let busMusica = null;
    let busEfectos = null;
    let reverbEnvio = null;
    let activo = false;
    let siguienteNota = 0;
    let indice = 0;
    let compas = 0;
    let pulsosEnCompas = 0;
    let temporizador = null;
    let ruido = null;

    function iniciarContexto() {
      if (ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      maestro = ctx.createGain();
      maestro.gain.value = 0;
      maestro.connect(ctx.destination);

      // Pequeña reverb con retardos realimentados (más barata que un convolver).
      reverbEnvio = ctx.createGain();
      reverbEnvio.gain.value = 0.35;
      const retardo = ctx.createDelay(1);
      retardo.delayTime.value = 0.23;
      const realim = ctx.createGain();
      realim.gain.value = 0.38;
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.frequency.value = 2600;
      reverbEnvio.connect(retardo);
      retardo.connect(filtro);
      filtro.connect(realim);
      realim.connect(retardo);
      filtro.connect(maestro);

      busMusica = ctx.createGain();
      busMusica.gain.value = 0.22;
      busMusica.connect(maestro);
      busMusica.connect(reverbEnvio);

      busEfectos = ctx.createGain();
      busEfectos.gain.value = 0.55;
      busEfectos.connect(maestro);
      busEfectos.connect(reverbEnvio);

      // Búfer de ruido blanco reutilizable (cascabeles y "whoosh").
      ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const datos = ruido.getChannelData(0);
      for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
      return true;
    }

    /** Campana: parciales armónicos e inarmónicos con caída exponencial. */
    function campana(t, frec, vol, destino, duracion = 1.6) {
      const parciales = [[1, 1], [2, 0.35], [3.01, 0.16], [4.2, 0.08]];
      for (const [mult, amp] of parciales) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = frec * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duracion / mult ** 0.5);
        osc.connect(g).connect(destino);
        osc.start(t);
        osc.stop(t + duracion + 0.05);
      }
    }

    function colchon(t, notas, dur) {
      for (const n of notas) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = hz(n);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.5);
        g.gain.setValueAtTime(0.06, t + dur - 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        osc.connect(f).connect(g).connect(busMusica);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
    }

    function cascabel(t, vol) {
      const src = ctx.createBufferSource();
      src.buffer = ruido;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 7000;
      f.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      src.connect(f).connect(g).connect(busMusica);
      src.start(t, Math.random() * 0.5, 0.15);
    }

    function programar() {
      const horizonte = ctx.currentTime + 0.25;
      while (siguienteNota < horizonte) {
        if (pulsosEnCompas === 0) {
          colchon(siguienteNota, ACORDES[compas % ACORDES.length], PULSO * 3);
        }
        const [nota, pulsos] = MELODIA[indice];
        if (nota) campana(siguienteNota, hz(nota), 0.16, busMusica, 1.4 + pulsos * 0.3);
        for (let p = 0; p < pulsos; p++) {
          cascabel(siguienteNota + p * PULSO, (pulsosEnCompas + p) % 3 === 0 ? 0.05 : 0.025);
        }
        siguienteNota += pulsos * PULSO;
        pulsosEnCompas += pulsos;
        while (pulsosEnCompas >= 3) {
          pulsosEnCompas -= 3;
          compas++;
        }
        indice = (indice + 1) % MELODIA.length;
        if (indice === 0) {
          compas = 0;
          pulsosEnCompas = 0;
          siguienteNota += PULSO * 3; // respiro entre vueltas
        }
      }
    }

    function arrancarMusica() {
      if (temporizador) return;
      siguienteNota = ctx.currentTime + 0.1;
      indice = 0;
      compas = 0;
      pulsosEnCompas = 0;
      temporizador = setInterval(programar, 100);
      programar();
    }

    function pararMusica() {
      clearInterval(temporizador);
      temporizador = null;
    }

    // Pausa la música si la pestaña no está visible.
    document.addEventListener('visibilitychange', () => {
      if (!ctx || !activo) return;
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });

    return {
      get activo() { return activo; },

      async alternar() {
        return this.establecer(!activo);
      },

      async establecer(valor) {
        if (valor && !iniciarContexto()) return false;
        activo = valor;
        if (!ctx) return activo;
        const t = ctx.currentTime;
        maestro.gain.cancelScheduledValues(t);
        maestro.gain.setValueAtTime(maestro.gain.value, t);
        if (activo) {
          await ctx.resume();
          maestro.gain.linearRampToValueAtTime(0.9, t + 0.6);
          arrancarMusica();
        } else {
          maestro.gain.linearRampToValueAtTime(0, t + 0.3);
          setTimeout(() => { if (!activo) { pararMusica(); ctx.suspend(); } }, 350);
        }
        return activo;
      },

      /** Efecto al abrir un regalo: "whoosh" + arpegio brillante. */
      abrir() {
        if (!activo || !ctx) return;
        const t = ctx.currentTime + 0.02;
        const src = ctx.createBufferSource();
        src.buffer = ruido;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 0.8;
        f.frequency.setValueAtTime(400, t);
        f.frequency.exponentialRampToValueAtTime(5000, t + 0.45);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.15);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
        src.connect(f).connect(g).connect(busEfectos);
        src.start(t, 0, 0.6);
        [74, 78, 81, 86, 90, 93].forEach((n, i) => campana(t + 0.18 + i * 0.07, hz(n), 0.22, busEfectos, 1.8));
      },

      /** Efecto de casilla bloqueada: golpe suave de madera. */
      bloqueada() {
        if (!activo || !ctx) return;
        const t = ctx.currentTime + 0.01;
        [0, 0.12].forEach((d) => {
          const osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(220, t + d);
          osc.frequency.exponentialRampToValueAtTime(110, t + d + 0.12);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t + d);
          g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.16);
          osc.connect(g).connect(busEfectos);
          osc.start(t + d);
          osc.stop(t + d + 0.2);
        });
      },
    };
  }

  Object.assign(A, { crearAudio });
})(window.Adviento = window.Adviento || {});
