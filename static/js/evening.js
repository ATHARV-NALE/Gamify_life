/* ==========================================================================
   GAMIFY LIFE — EVENING.JS
   Star rating selector & client-side LocalStorage evening review submit handler
   ========================================================================== */

(function () {
  const stars = document.querySelectorAll('.star-btn');
  const ratingInput = document.getElementById('review-rating-input');

  if (!stars.length || !ratingInput) return;

  stars.forEach(btn => {
    btn.addEventListener('click', function () {
      const val = parseInt(this.dataset.value, 10);
      ratingInput.value = val;

      stars.forEach(s => {
        if (parseInt(s.dataset.value, 10) <= val) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    });
  });

  // Handle client-side form submission
  const form = document.getElementById('review-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      
      const rating = parseInt(ratingInput.value, 10) || 5;
      const notesInput = form.querySelector('input[name="notes"]');
      const notes = notesInput ? notesInput.value.trim() : '';

      // Save to local storage DB
      window.db.addReview(rating, notes);

      // Reset form
      if (notesInput) notesInput.value = '';
      
      alert("Day-End Review logged! +15 XP rewarded.");
      
      // Reload UI stats
      if (window.updateHudStats) window.updateHudStats();
      if (window.renderQuests) window.renderQuests();
      
      // Redirect to home tab
      const dockBtn = document.querySelector('.dock-item[data-tab="home"]');
      if (dockBtn) {
        dockBtn.click();
      } else {
        window.location.reload();
      }
    });
  }
})();
