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

  function updateHudStats() {
    const profile = window.db.getProfile();
    const levelEl = document.getElementById('hud-level');
    const xpEl = document.getElementById('hud-xp-text');
    const streakEl = document.getElementById('hud-streak');
    const displayEl = document.getElementById('display-profile-name');

    if (levelEl) levelEl.textContent = profile.level;
    if (xpEl) xpEl.textContent = profile.xp;
    if (streakEl) streakEl.textContent = profile.streak;
    if (displayEl) displayEl.textContent = profile.name;
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

  // Render Quests list dynamically from localStorage
  function renderQuests() {
    const questListEl = document.getElementById('quest-list');
    if (!questListEl) return;

    const activeGoals = window.db.getActiveGoals();
    let allTasks = [];
    activeGoals.forEach(g => {
      allTasks.push(...g.plan);
    });

    if (allTasks.length === 0) {
      questListEl.innerHTML = `
        <div class="quest-card" style="cursor: default; opacity: 0.6;">
          <div class="quest-content">
            <div class="quest-title">No active campaign yet</div>
            <div class="quest-meta">
              <span class="quest-tag">Go to Goals to start one</span>
            </div>
          </div>
        </div>
      `;
      window.__totalQuests = 0;
      window.__completedQuests = 0;
      updateGardenState();
      return;
    }

    let completedCount = 0;
    let html = '';

    allTasks.forEach(item => {
      const hasSubtasks = item.subtasks && item.subtasks.length > 0;
      const subtaskDoneCount = hasSubtasks ? item.subtasks.filter(s => s.done).length : 0;
      if (item.is_completed === 1) completedCount++;

      let subtasksHtml = '';
      if (hasSubtasks) {
        subtasksHtml = `
          <div class="quest-subtasks-container">
            <div class="quest-subtasks-divider"></div>
            <div class="quest-subtasks-list">
              ${item.subtasks.map((st, idx) => `
                <div class="subtask-item ${st.done ? 'done' : ''}" data-task-id="${item.id}" data-index="${idx}" onclick="toggleSubtask(this)">
                  <div class="subtask-checkbox">
                    <span class="subtask-check-icon">✓</span>
                  </div>
                  <span class="subtask-text">${st.text}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      html += `
        <div class="quest-card ${item.is_completed === 1 ? 'done' : ''} ${hasSubtasks ? 'has-subtasks' : ''}" data-id="${item.id}">
          <div class="quest-main-row">
            <div class="quest-checkbox" onclick="toggleQuest(this.closest('.quest-card'))">
              <span class="check-icon">✓</span>
            </div>
            <div class="quest-content" onclick="toggleExpandQuest(this.closest('.quest-card'))">
              <div class="quest-title">${item.action}</div>
              <div class="quest-meta">
                <span class="quest-tag goal-tag">${item.goal_text.substring(0, 25)}</span>
                <span class="quest-tag">${item.when_time}</span>
                <span class="quest-tag xp-tag">+${item.xp_reward} XP</span>
                <span class="quest-tag prob-tag">+${item.probability_impact}%</span>
                ${hasSubtasks ? `<span class="subtask-progress-badge ${subtaskDoneCount === item.subtasks.length ? 'all-done' : ''}" data-task-id="${item.id}">📋 ${subtaskDoneCount}/${item.subtasks.length}</span>` : ''}
              </div>
            </div>
            <div class="quest-reward">
              <span class="quest-xp">+${item.xp_reward}</span>
            </div>
            ${hasSubtasks ? `<div class="quest-expand-indicator" onclick="toggleExpandQuest(this.closest('.quest-card'))">▶</div>` : ''}
          </div>
          ${subtasksHtml}
        </div>
      `;
    });

    questListEl.innerHTML = html;

    window.__totalQuests = allTasks.length;
    window.__completedQuests = completedCount;
    updateGardenState();
  }

  /* ── Toggle Expand Quest (click on content area or arrow) ── */
  window.toggleExpandQuest = function (card) {
    if (!card || !card.classList.contains('has-subtasks')) return;
    card.classList.toggle('expanded');
  };

  /* ── Toggle Main Quest (click on checkbox) ── */
  window.toggleQuest = function (card) {
    const taskId = parseFloat(card.getAttribute('data-id'));
    if (isNaN(taskId)) return;

    const isCompleting = !card.classList.contains('done');

    // Optimistic UI lock
    card.style.pointerEvents = 'none';

    setTimeout(() => {
      const data = window.db.completeTask(taskId, isCompleting);
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

        if (data.subtasks) {
          updateSubtasksDom(card, data.subtasks);
        }

        updateHudStats();
        updateGardenState();

        // Level up modal
        if (data.level_up && isCompleting) {
          const modalLevel = document.getElementById('modal-new-level');
          if (modalLevel) modalLevel.textContent = data.new_level;
          const modal = document.getElementById('level-modal');
          if (modal) modal.classList.add('active');
        }
      } else {
        console.error('Task complete error:', data.error);
      }
    }, 150);
  };

  /* ── Toggle Individual Subtask ── */
  window.toggleSubtask = function (subtaskEl) {
    const taskId = parseFloat(subtaskEl.getAttribute('data-task-id'));
    const subtaskIndex = parseInt(subtaskEl.getAttribute('data-index'), 10);
    if (isNaN(taskId) || isNaN(subtaskIndex)) return;

    const isDone = !subtaskEl.classList.contains('done');
    const card = subtaskEl.closest('.quest-card');

    subtaskEl.style.pointerEvents = 'none';

    setTimeout(() => {
      const data = window.db.toggleSubtask(taskId, subtaskIndex, isDone);
      subtaskEl.style.pointerEvents = '';

      if (data.success) {
        if (data.subtasks) {
          updateSubtasksDom(card, data.subtasks);
        }

        if (data.quest_completed) {
          card.classList.add('done');
          window.__completedQuests = (window.__completedQuests || 0) + 1;
          showXpFloat(card, data.xp_added);
        } else if (data.quest_uncompleted) {
          card.classList.remove('done');
          window.__completedQuests = Math.max(0, (window.__completedQuests || 0) - 1);
        }

        updateHudStats();
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
    }, 150);
  };

  window.closeModal = function () {
    const modal = document.getElementById('level-modal');
    if (modal) modal.classList.remove('active');
  };

  // Expose render function globally
  window.renderQuests = renderQuests;
  window.updateHudStats = updateHudStats;

  // Initialize on load
  updateHudStats();
  renderQuests();
})();
