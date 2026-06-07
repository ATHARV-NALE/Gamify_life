/* ==========================================================================
   GAMIFY LIFE — GARDEN.JS
   Procedural canvas garden that grows with quest progress
   ========================================================================== */

(function () {
  const canvas = document.getElementById('garden-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;
    ctx.clearRect(0, 0, w, h);

    const progress = window.__gardenProgress || 0;

    // ── Ground ──
    ctx.fillStyle = '#1E1B18';
    ctx.fillRect(0, h - 24, w, 24);

    // Tiny grass blades
    ctx.strokeStyle = '#2C2824';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 8) {
      const gh = 4 + Math.sin(i * 0.3) * 3;
      ctx.beginPath();
      ctx.moveTo(i, h - 24);
      ctx.lineTo(i + 2, h - 24 - gh);
      ctx.stroke();
    }

    // ── Stem ──
    const stemHeight = 80 + progress * 40;
    ctx.strokeStyle = progress > 0 ? '#8B7355' : '#3D3730';
    ctx.lineWidth = progress > 0.5 ? 4 : 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 24);
    ctx.quadraticCurveTo(w / 2 + 6, h - 24 - stemHeight * 0.6, w / 2, h - 24 - stemHeight);
    ctx.stroke();

    // ── Leaves (appear at 30%) ──
    if (progress >= 0.3) {
      const leafAlpha = Math.min(1, (progress - 0.3) * 3);
      ctx.globalAlpha = leafAlpha;

      // Left leaf
      ctx.fillStyle = '#6B8E3D';
      ctx.beginPath();
      ctx.ellipse(w / 2 - 14, h - 24 - stemHeight * 0.55, 12, 5, -0.6, 0, Math.PI * 2);
      ctx.fill();

      // Right leaf
      ctx.fillStyle = '#7CB342';
      ctx.beginPath();
      ctx.ellipse(w / 2 + 14, h - 24 - stemHeight * 0.4, 12, 5, 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Small sprout leaf near top
      if (progress >= 0.5) {
        ctx.fillStyle = '#8BC34A';
        ctx.beginPath();
        ctx.ellipse(w / 2 - 8, h - 24 - stemHeight * 0.8, 8, 3.5, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
    }

    // ── Flower bud (appears at 70%) ──
    if (progress >= 0.7) {
      const flowerAlpha = Math.min(1, (progress - 0.7) * 4);
      ctx.globalAlpha = flowerAlpha;

      const flowerY = h - 24 - stemHeight;
      const petalCount = 6;

      // Petals
      for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const petalR = 8 + progress * 6;
        ctx.fillStyle = i % 2 === 0 ? '#D4A853' : '#E0B966';
        ctx.beginPath();
        ctx.ellipse(
          w / 2 + Math.cos(angle) * petalR,
          flowerY + Math.sin(angle) * petalR,
          7, 3.5, angle, 0, Math.PI * 2
        );
        ctx.fill();
      }

      // Center
      ctx.beginPath();
      ctx.arc(w / 2, flowerY, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#B8923A';
      ctx.fill();

      ctx.globalAlpha = 1;
    }

    // ── Sparkles when fully complete ──
    if (progress >= 1.0) {
      const time = Date.now() / 1000;
      for (let i = 0; i < 7; i++) {
        const sx = w / 2 + Math.sin(time + i * 1.3) * 35;
        const sy = (h - 24 - stemHeight) + Math.cos(time + i * 1.8) * 25;
        ctx.fillStyle = '#D4A853';
        ctx.globalAlpha = 0.25 + Math.sin(time * 2.5 + i) * 0.2;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5 + Math.sin(time + i) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function tick() {
    draw();
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', () => { resize(); draw(); });
  resize();
  requestAnimationFrame(tick);
})();
