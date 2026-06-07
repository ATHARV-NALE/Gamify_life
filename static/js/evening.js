/* ==========================================================================
   GAMIFY LIFE — EVENING.JS
   Star rating selector for day-end review
   ========================================================================== */

(function () {
  const stars = document.querySelectorAll('.star-btn');
  const ratingInput = document.getElementById('review-rating-input');

  if (!stars.length || !ratingInput) return;

  stars.forEach(btn => {
    btn.addEventListener('click', function () {
      const val = parseInt(this.dataset.value);
      ratingInput.value = val;

      stars.forEach(s => {
        if (parseInt(s.dataset.value) <= val) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    });
  });
})();
