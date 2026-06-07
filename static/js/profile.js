/* ==========================================================================
   GAMIFY LIFE — PROFILE.JS
   Modal controls, localStorage updates, and dynamic focus suggestion logic
   ========================================================================== */

function openProfileModal() {
  document.getElementById('profile-modal').classList.add('active');
  fetchFocusSuggestion();
  
  // Hydrate fields
  const profile = window.db.getProfile();
  document.getElementById('profile-name').value = profile.name || '';
  document.getElementById('profile-age').value = profile.age || '';
  document.getElementById('profile-birthdate').value = profile.birthdate || '';
  document.getElementById('profile-focus').value = profile.focus_level || 'Moderate';
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('active');
}

function fetchFocusSuggestion() {
  const activities = window.db.getActivities();
  const productive = activities
    .filter(a => a.type === 'productive')
    .reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);
  const unproductive = activities
    .filter(a => a.type === 'unproductive')
    .reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);
  
  const totalActive = productive + unproductive;
  let suggestedFocus = 'Moderate';
  let suggestionReason = 'Log some routine activities to get a tailored suggestion.';

  if (totalActive > 0) {
    const prodRatio = productive / totalActive;
    const pct = Math.round(prodRatio * 100);
    if (prodRatio >= 0.7) {
      suggestedFocus = 'Laser Focused';
      suggestionReason = `Excellent! ${pct}% of your logged active time is productive.`;
    } else if (prodRatio >= 0.4) {
      suggestedFocus = 'Moderate';
      suggestionReason = `Balanced. ${pct}% of your logged active time is productive.`;
    } else {
      suggestedFocus = 'Needs Realignment';
      suggestionReason = `Alert! Only ${pct}% of your logged active time is productive. Reduce wasted hours.`;
    }
  }

  const badge = document.getElementById('suggested-focus-badge');
  const reason = document.getElementById('suggested-focus-reason');
  if (badge && reason) {
    badge.textContent = suggestedFocus;
    reason.textContent = suggestionReason;
    
    badge.className = 'suggestion-badge';
    if (suggestedFocus === 'Laser Focused') {
      badge.classList.add('badge-laser');
    } else if (suggestedFocus === 'Needs Realignment') {
      badge.classList.add('badge-realign');
    } else {
      badge.classList.add('badge-moderate');
    }
  }
}

function applySuggestedFocus() {
  const badge = document.getElementById('suggested-focus-badge');
  const select = document.getElementById('profile-focus');
  if (badge && select) {
    const suggestedValue = badge.textContent.trim();
    if (suggestedValue && suggestedValue !== 'Calculating...') {
      select.value = suggestedValue;
    }
  }
}

function saveProfile(event) {
  event.preventDefault();
  
  const nameVal = document.getElementById('profile-name').value;
  const ageVal = document.getElementById('profile-age').value;
  const birthdateVal = document.getElementById('profile-birthdate').value;
  const focusLevelVal = document.getElementById('profile-focus').value;

  const profile = window.db.getProfile();
  profile.name = nameVal.trim() || 'Explorer';
  profile.age = ageVal ? parseInt(ageVal, 10) : '';
  profile.birthdate = birthdateVal;
  profile.focus_level = focusLevelVal;

  window.db.saveProfile(profile);
  window.updateHudStats();
  closeProfileModal();
}
