/* ==========================================================================
   GAMIFY LIFE — PROFILE.JS
   Modal controls, AJAX updates, and dynamic focus suggestion logic
   ========================================================================== */

function openProfileModal() {
  document.getElementById('profile-modal').classList.add('active');
  fetchFocusSuggestion();
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('active');
}

function fetchFocusSuggestion() {
  fetch('/api/profile/suggestion')
    .then(res => res.json())
    .then(data => {
      const badge = document.getElementById('suggested-focus-badge');
      const reason = document.getElementById('suggested-focus-reason');
      if (badge && reason) {
        badge.textContent = data.suggested_focus;
        reason.textContent = data.suggestion_reason;
        
        // Style badge based on suggested level
        badge.className = 'suggestion-badge';
        if (data.suggested_focus === 'Laser Focused') {
          badge.classList.add('badge-laser');
        } else if (data.suggested_focus === 'Needs Realignment') {
          badge.classList.add('badge-realign');
        } else {
          badge.classList.add('badge-moderate');
        }
      }
    })
    .catch(err => console.error('Error fetching suggestions:', err));
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
  const form = document.getElementById('profile-form');
  const formData = new FormData(form);

  fetch('/api/profile/save', {
    method: 'POST',
    body: formData
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        // Update display greeting name
        const displayEl = document.getElementById('display-profile-name');
        if (displayEl) {
          displayEl.textContent = data.name;
        }
        closeProfileModal();
      } else {
        alert('Error saving profile settings.');
      }
    })
    .catch(err => console.error('Error saving profile:', err));
}
