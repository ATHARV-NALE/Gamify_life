/* ==========================================================================
   GAMIFY LIFE — TIME-RING.JS
   Donut chart SVG driven by Flask time_analysis data
   ========================================================================== */

(function () {
  const circumference = 2 * Math.PI * 40; // ≈ 251.33

  function drawRing() {
    const data = window.__timeAnalysis;
    if (!data) return;

    const total = 24.0;
    const p = (data.productive / total) * circumference;
    const n = (data.neutral / total) * circumference;
    const u = (data.unproductive / total) * circumference;
    const f = (data.free / total) * circumference;

    setRing('ring-productive', p, 0);
    setRing('ring-neutral', n, -p);
    setRing('ring-unproductive', u, -(p + n));
    setRing('ring-free', f, -(p + n + u));
  }

  function setRing(id, length, offset) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.strokeDasharray = `${length} ${circumference}`;
    el.style.strokeDashoffset = `${offset}`;
  }

  drawRing();
})();
