// Gráficos del panel con Chart.js (cargado desde vendor/ como global `Chart`).
// Script clásico (sin módulos ES) para que funcione abriendo index.html directamente.
window.App = window.App || {};
(function () {
  'use strict';
  const { eur, fmtNum } = App['format'];

  let graficos = [];

  function destruirGraficos() {
    for (const g of graficos) { try { g.destroy(); } catch { /* ignorar */ } }
    graficos = [];
  }

  function css(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  }

  function base() {
    const Chart = globalThis.Chart;
    Chart.defaults.font.family = css('--fuente') || 'system-ui';
    Chart.defaults.color = css('--texto-suave');
    Chart.defaults.borderColor = css('--borde');
    return Chart;
  }

  const ejeEuros = () => ({
    ticks: { callback: (v) => (Math.abs(v) >= 1000 ? fmtNum(v / 1000, 0) + ' mil €' : fmtNum(v, 0) + ' €') },
    grid: { color: css('--borde') },
    beginAtZero: true,
  });

  const tooltipEuros = {
    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${eur(ctx.parsed[ctx.chart.options.indexAxis === 'y' ? 'x' : 'y'])}` },
  };

  /** Barras agrupadas: presupuesto frente a consumo apilado (ejecutado, comprometido, previsto). */
  function graficoDepartamentos(canvas, datos) {
    if (!globalThis.Chart) return null;
    const Chart = base();
    const g = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: datos.map((d) => d.nombre),
        datasets: [
          { label: 'Presupuesto', data: datos.map((d) => d.presupuesto), stack: 'p', backgroundColor: css('--superficie-3'), borderColor: css('--borde-fuerte'), borderWidth: 1.5 },
          { label: 'Ejecutado (recibido)', data: datos.map((d) => d.ejecutado), stack: 'c', backgroundColor: css('--estado-recibido') },
          { label: 'Comprometido (pedido)', data: datos.map((d) => d.comprometido), stack: 'c', backgroundColor: css('--estado-pedido') },
          { label: 'Previsto (pendiente)', data: datos.map((d) => d.previsto), stack: 'c', backgroundColor: css('--borde-fuerte') },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { stacked: true, grid: { display: false } }, y: { ...ejeEuros(), stacked: true } },
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: tooltipEuros },
      },
    });
    graficos.push(g);
    return g;
  }

  /** Barras horizontales de una sola serie (un único color: no codifica categorías). */
  function graficoBarrasH(canvas, etiquetas, valores, etiquetaSerie) {
    if (!globalThis.Chart) return null;
    const Chart = base();
    const g = new Chart(canvas, {
      type: 'bar',
      data: { labels: etiquetas, datasets: [{ label: etiquetaSerie, data: valores, backgroundColor: css('--primario'), borderRadius: 3, maxBarThickness: 26 }] },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        scales: { x: ejeEuros(), y: { grid: { display: false }, ticks: { autoSkip: false, callback(v) { const l = this.getLabelForValue(v); return l.length > 28 ? l.slice(0, 27) + '…' : l; } } } },
        plugins: { legend: { display: false }, tooltip: tooltipEuros },
      },
    });
    graficos.push(g);
    return g;
  }

  App['charts'] = { destruirGraficos, graficoDepartamentos, graficoBarrasH };
})();
