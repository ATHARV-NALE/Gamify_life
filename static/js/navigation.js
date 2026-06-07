/* ==========================================================================
   GAMIFY LIFE — NAVIGATION.JS
   Bottom dock tab switching + URL sync
   ========================================================================== */

(function () {
  const dockItems = document.querySelectorAll('.dock-item');
  const panels = document.querySelectorAll('.tab-panel');

  function switchTab(tabName) {
    // Hide all panels
    panels.forEach(p => {
      p.classList.remove('active');
      p.style.display = 'none';
    });

    // Deactivate all dock items
    dockItems.forEach(d => d.classList.remove('active'));

    // Show target panel
    const target = document.getElementById('tab-' + tabName);
    if (target) {
      target.style.display = 'block';
      // Trigger reflow so animation fires
      void target.offsetWidth;
      target.classList.add('active');
    }

    // Activate dock item
    const dockBtn = document.querySelector(`.dock-item[data-tab="${tabName}"]`);
    if (dockBtn) dockBtn.classList.add('active');

    // Sync URL
    const url = new URL(window.location);
    url.searchParams.set('tab', tabName);
    window.history.replaceState({}, '', url);

    // Re-init canvas if switching to home
    if (tabName === 'home') {
      window.dispatchEvent(new Event('resize'));
    }
  }

  // Bind dock clicks
  dockItems.forEach(item => {
    item.addEventListener('click', function () {
      const tab = this.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Activate tab from URL on load
  const urlParams = new URLSearchParams(window.location.search);
  const startTab = urlParams.get('tab') || 'home';
  switchTab(startTab);
})();
