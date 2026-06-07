/* ==========================================================================
   GAMIFY LIFE — CHAT.JS
   AI Coach slide-out drawer with warm conversational tone
   ========================================================================== */

(function () {
  const fab = document.getElementById('chat-fab');
  const drawer = document.getElementById('chat-drawer');
  const closeBtn = document.getElementById('chat-close');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');
  const body = document.getElementById('chat-body');

  if (!fab || !drawer) return;

  fab.addEventListener('click', () => drawer.classList.add('open'));
  closeBtn.addEventListener('click', () => drawer.classList.remove('open'));

  function parseAndRenderProposedTask(text) {
    const jsonRegex = /```json\n([\s\S]*?)\n```/;
    const match = text.match(jsonRegex);
    let htmlText = text;
    let proposedTask = null;

    if (match) {
      try {
        const jsonStr = match[1];
        const obj = JSON.parse(jsonStr);
        if (obj.type === 'proposed_task') {
          proposedTask = obj;
          htmlText = text.replace(match[0], '').trim();
        }
      } catch (e) {
        console.error("Failed to parse proposed task JSON:", e);
      }
    }

    let html = htmlText
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    if (proposedTask) {
      const widgetId = 'task-widget-' + Date.now();
      const taskJson = JSON.stringify(proposedTask).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
      
      html += `
        <div class="proposed-task-card" id="${widgetId}">
          <div class="proposed-task-header">✨ Suggested Quest</div>
          <div class="proposed-task-title">${proposedTask.action}</div>
          <div class="proposed-task-meta">
            <span class="quest-tag">${proposedTask.when_time}</span>
            <span class="quest-tag xp-tag">+${proposedTask.xp_reward} XP</span>
          </div>
          <button class="btn-add-task" onclick='window.addProposedTask(${taskJson}, "${widgetId}")'>
            Add to Quests
          </button>
        </div>
      `;
    }

    return html;
  }

  window.addProposedTask = function(taskObj, widgetId) {
    const widget = document.getElementById(widgetId);
    if (widget) {
      const btn = widget.querySelector('.btn-add-task');
      if (btn) {
        btn.textContent = "Adding...";
        btn.style.pointerEvents = "none";
        btn.style.opacity = "0.7";
      }
    }

    fetch('/api/task/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(taskObj)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        if (widget) {
          widget.innerHTML = `<div class="proposed-task-success">✅ Task added! Refreshing...</div>`;
        }
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        alert("Error adding task: " + data.error);
        if (widget) {
          const btn = widget.querySelector('.btn-add-task');
          if (btn) {
            btn.textContent = "Add to Quests";
            btn.style.pointerEvents = "auto";
            btn.style.opacity = "1";
          }
        }
      }
    })
    .catch(err => {
      console.error(err);
      alert("Network error.");
    });
  };

  function addBubble(text, isUser) {
    const wrap = document.createElement('div');
    wrap.className = `chat-bubble-wrap ${isUser ? 'user' : 'assistant'}`;
    let html = text;
    
    if (!isUser) {
      html = parseAndRenderProposedTask(text);
    } else {
      html = text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    }
    
    wrap.innerHTML = `<div class="chat-bubble">${html}</div>`;
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }

  function send() {
    const text = input.value.trim();
    if (!text) return;

    addBubble(text, true);
    input.value = '';

    // Show typing indicator
    const typing = document.createElement('div');
    typing.className = 'chat-bubble-wrap assistant';
    typing.innerHTML = '<div class="chat-bubble" style="opacity: 0.5;">Thinking…</div>';
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    })
    .then(res => res.json())
    .then(data => {
      typing.remove();
      if (data.message && data.message.content) {
        addBubble(data.message.content, false);
      } else if (data.error) {
        addBubble('Sorry, something went wrong: ' + data.error, false);
      }
    })
    .catch(() => {
      typing.remove();
      addBubble("I'm having trouble connecting. Try again in a moment. 🌱", false);
    });
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keypress', e => { if (e.key === 'Enter') send(); });
})();
