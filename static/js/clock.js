/* ==========================================================================
   GAMIFY LIFE — CLOCK.JS
   Ambient clock in the top bar + dynamic greeting
   ========================================================================== */

(function () {
  const clockEl = document.getElementById('ambient-clock');
  const dateEl = document.getElementById('ambient-date');
  const greetingLabel = document.getElementById('greeting-label');
  const greetingIcon = document.getElementById('greeting-icon');
  const greetingTextPrefix = document.getElementById('greeting-text-prefix');

  function update() {
    const now = new Date();
    const hrs = now.getHours();
    const hStr = String(hrs).padStart(2, '0');
    const mStr = String(now.getMinutes()).padStart(2, '0');

    if (clockEl) clockEl.textContent = `${hStr}:${mStr}`;

    if (dateEl) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayName = days[now.getDay()];
      const monthName = months[now.getMonth()];
      const dateNum = now.getDate();
      dateEl.textContent = `${dayName}, ${monthName} ${dateNum}`;
    }

    let greeting = 'Good morning';
    let icon = '🌅';
    if (hrs >= 12 && hrs < 17) { greeting = 'Good afternoon'; icon = '☀️'; }
    else if (hrs >= 17)        { greeting = 'Good evening';   icon = '🌙'; }

    if (greetingLabel) greetingLabel.textContent = greeting;
    if (greetingIcon) greetingIcon.textContent = icon;
    if (greetingTextPrefix) greetingTextPrefix.textContent = greeting;
  }

  update();
  setInterval(update, 1000);

  // Loading Screen dismissal after anim finishes
  window.addEventListener('load', () => {
    const loader = document.getElementById('loading-screen');
    if (loader) {
      setTimeout(() => {
        loader.classList.add('fade-out');
      }, 2500);
    }
  });
})();
