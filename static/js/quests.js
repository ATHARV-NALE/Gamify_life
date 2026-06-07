/* ==========================================================================
   GAMIFY LIFE — QUESTS.JS
   Card stack logic, toggle completion, subtask expansion, XP floats, garden sync
   ========================================================================== */

(function () {
  const questCountEl = document.getElementById('quest-count');
  const gardenFillEl = document.getElementById('garden-fill');
  const gardenTextEl = document.getElementById('garden-text');

  function updateGardenState() {
    const total = window.__totalQuests || 0;
    const done = window.__completedQuests || 0;
    const pct = total > 0 ? done / total : 0;

    // Update quest count badge
    if (questCountEl) questCountEl.textContent = `${done}/${total}`;

    // Update progress bar
    if (gardenFillEl) gardenFillEl.style.width = `${pct * 100}%`;

    // Update garden text
    if (gardenTextEl) {
      if (total === 0) {
        gardenTextEl.textContent = 'Plant some seeds by setting a goal.';
      } else {
        const stage = pct < 0.3 ? 'just sprouting'
                    : pct < 0.6 ? 'growing nicely'
                    : pct < 1.0 ? 'almost in bloom'
                    : 'in full bloom ✨';
        gardenTextEl.textContent = `Your garden is ${stage} — ${done} of ${total} quests done`;
      }
    }

    // Sync with canvas
    window.__gardenProgress = pct;
  }

  function showXpFloat(element, xpVal) {
    const rect = element.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'xp-float';
    popup.textContent = (xpVal >= 0 ? '+' : '') + xpVal + ' XP';
    popup.style.left = (rect.left + rect.width / 2) + 'px';
    popup.style.top = rect.top + 'px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 950);
  }

  function updateHudStats(data) {
    const levelEl = document.getElementById('hud-level');
    const xpEl = document.getElementById('hud-xp-text');
    const streakEl = document.getElementById('hud-streak');
    if (levelEl) levelEl.textContent = data.new_level;
    if (xpEl) xpEl.textContent = data.new_xp;
    if (streakEl) streakEl.textContent = data.new_streak;
  }

  function updateSubtasksDom(card, subtasks) {
    if (!subtasks || subtasks.length === 0) return;
    const items = card.querySelectorAll('.subtask-item');
    let doneCount = 0;
    subtasks.forEach((st, i) => {
      if (items[i]) {
        if (st.done) {
          items[i].classList.add('done');
          doneCount++;
        } else {
          items[i].classList.remove('done');
        }
      }
    });

    // Update progress badge
    const badge = card.querySelector('.subtask-progress-badge');
    if (badge) {
      badge.textContent = `📋 ${doneCount}/${subtasks.length}`;
      if (doneCount === subtasks.length) {
        badge.classList.add('all-done');
      } else {
        badge.classList.remove('all-done');
      }
    }
  }

  /* ── Toggle Expand Quest (click on content area or arrow) ── */
  window.toggleExpandQuest = function (card) {
    if (!card || !card.classList.contains('has-subtasks')) return;
    card.classList.toggle('expanded');
  };

  /* ── Toggle Main Quest (click on checkbox) ── */
  window.toggleQuest = function (card) {
    const taskId = card.getAttribute('data-id');
    if (!taskId) return;

    const isCompleting = !card.classList.contains('done');

    // Optimistic UI update
    card.style.pointerEvents = 'none';

    fetch('/api/task/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, is_completed: isCompleting })
    })
    .then(res => res.json())
    .then(data => {
      card.style.pointerEvents = '';

      if (data.success) {
        if (isCompleting) {
          card.classList.add('done');
          window.__completedQuests = (window.__completedQuests || 0) + 1;
          showXpFloat(card, data.xp_added);
        } else {
          card.classList.remove('done');
          window.__completedQuests = Math.max(0, (window.__completedQuests || 0) - 1);
        }

        // Update all subtask states in the DOM
        if (data.subtasks) {
          updateSubtasksDom(card, data.subtasks);
        }

        updateHudStats(data);
        updateGardenState();

        // Level up modal
        if (data.level_up && isCompleting) {
          const modalLevel = document.getElementById('modal-new-level');
          if (modalLevel) modalLevel.textContent = data.new_level;
          const modal = document.getElementById('level-modal');
          if (modal) modal.classList.add('active');
        }
      } else {
        console.error('Task toggle error:', data.error);
      }
    })
    .catch(err => {
      card.style.pointerEvents = '';
      console.error('Network error:', err);
    });
  };

  /* ── Toggle Individual Subtask ── */
  window.toggleSubtask = function (subtaskEl) {
    const taskId = subtaskEl.getAttribute('data-task-id');
    const subtaskIndex = parseInt(subtaskEl.getAttribute('data-index'), 10);
    if (!taskId || isNaN(subtaskIndex)) return;

    const isDone = !subtaskEl.classList.contains('done');
    const card = subtaskEl.closest('.quest-card');

    // Optimistic UI update
    subtaskEl.style.pointerEvents = 'none';

    fetch('/api/subtask/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, subtask_index: subtaskIndex, is_done: isDone })
    })
    .then(res => res.json())
    .then(data => {
      subtaskEl.style.pointerEvents = '';

      if (data.success) {
        // Update subtask DOM
        if (data.subtasks) {
          updateSubtasksDom(card, data.subtasks);
        }

        // Handle quest auto-completion when all subtasks are done
        if (data.quest_completed) {
          card.classList.add('done');
          window.__completedQuests = (window.__completedQuests || 0) + 1;
          showXpFloat(card, data.xp_added);
        } else if (data.quest_uncompleted) {
          card.classList.remove('done');
          window.__completedQuests = Math.max(0, (window.__completedQuests || 0) - 1);
        }

        updateHudStats(data);
        updateGardenState();

        // Level up modal
        if (data.level_up && data.quest_completed) {
          const modalLevel = document.getElementById('modal-new-level');
          if (modalLevel) modalLevel.textContent = data.new_level;
          const modal = document.getElementById('level-modal');
          if (modal) modal.classList.add('active');
        }
      } else {
        console.error('Subtask toggle error:', data.error);
      }
    })
    .catch(err => {
      subtaskEl.style.pointerEvents = '';
      console.error('Network error:', err);
    });
  };

  window.closeModal = function () {
    const modal = document.getElementById('level-modal');
    if (modal) modal.classList.remove('active');
  };

  // Initialize on load
  updateGardenState();
})();
