/* ==========================================================================
   GAMIFY LIFE — TIME-RING.JS
   Donut chart SVG driven by browser-local LocalStorage activities
   ========================================================================== */

(function () {
  const circumference = 2 * Math.PI * 40; // ≈ 251.33

  function renderTimeRing() {
    const activities = window.db.getActivities();
    
    // Sum hours
    const prod = activities.filter(a => a.type === 'productive').reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);
    const unprod = activities.filter(a => a.type === 'unproductive').reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);
    const neutral = activities.filter(a => a.type === 'neutral').reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);
    
    const totalLogged = prod + unprod + neutral;
    const free = Math.max(0.0, 24.0 - totalLogged);

    // Update global bridge data
    window.__timeAnalysis = {
      productive: prod,
      unproductive: unprod,
      neutral: neutral,
      free: free
    };

    // Calculate dash arrays
    const total = 24.0;
    const p = (prod / total) * circumference;
    const n = (neutral / total) * circumference;
    const u = (unprod / total) * circumference;
    const f = (free / total) * circumference;

    setRing('ring-productive', p, 0);
    setRing('ring-neutral', n, -p);
    setRing('ring-unproductive', u, -(p + n));
    setRing('ring-free', f, -(p + n + u));

    // Update legend UI text
    const pText = document.querySelector('.time-legend-item:nth-child(1) .legend-time');
    const uText = document.querySelector('.time-legend-item:nth-child(2) .legend-time');
    const nText = document.querySelector('.time-legend-item:nth-child(3) .legend-time');
    const fText = document.querySelector('.time-legend-item:nth-child(4) .legend-time');

    if (pText) pText.textContent = `${prod.toFixed(1)}h`;
    if (uText) uText.textContent = `${unprod.toFixed(1)}h`;
    if (nText) nText.textContent = `${neutral.toFixed(1)}h`;
    if (fText) fText.textContent = `${free.toFixed(1)}h`;
  }

  function setRing(id, length, offset) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.strokeDasharray = `${length} ${circumference}`;
    el.style.strokeDashoffset = `${offset}`;
  }

  // Expose function globally
  window.renderTimeRing = renderTimeRing;

  // Initial render
  renderTimeRing();
})();
