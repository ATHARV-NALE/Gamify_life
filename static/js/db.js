/* ==========================================================================
   GAMIFY LIFE — DB.JS
   Browser-local LocalStorage Database Adapter & Seeder
   ========================================================================== */

(function () {
  const STORAGE_KEYS = {
    PROFILE: 'gl_profile',
    ACTIVITIES: 'gl_activities',
    GOALS: 'gl_goals',
    TASKS: 'gl_tasks',
    REVIEWS: 'gl_reviews',
    CHAT: 'gl_chat_messages'
  };

  // Helper: Get item from localStorage with optional default value
  function getLocal(key, defaultVal = []) {
    const data = localStorage.getItem(key);
    if (!data) return defaultVal;
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error(`Error parsing localStorage key "${key}":`, e);
      return defaultVal;
    }
  }

  // Helper: Save item to localStorage
  function saveLocal(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  // --- 1. USER PROFILE ---
  function getProfile() {
    const defaultProfile = {
      level: 1,
      xp: 0,
      streak: 0,
      last_active: null,
      name: 'Explorer',
      age: '',
      birthdate: '',
      focus_level: 'Moderate'
    };
    const profile = getLocal(STORAGE_KEYS.PROFILE, null);
    if (!profile) {
      saveLocal(STORAGE_KEYS.PROFILE, defaultProfile);
      return defaultProfile;
    }
    return profile;
  }

  function saveProfile(profile) {
    saveLocal(STORAGE_KEYS.PROFILE, profile);
  }

  // --- 2. DAILY ACTIVITIES ---
  const DEFAULT_ACTIVITIES = [
    { id: 1, name: 'Sleep & Recovery', duration_hours: 8.0, type: 'neutral' },
    { id: 2, name: 'Morning Routine & Breakfast', duration_hours: 1.0, type: 'neutral' },
    { id: 3, name: 'Focused Study / Coding', duration_hours: 3.5, type: 'productive' },
    { id: 4, name: 'Lunch & Short Walk', duration_hours: 1.5, type: 'neutral' },
    { id: 5, name: 'Gym Workout / Athletic Training', duration_hours: 1.5, type: 'productive' },
    { id: 6, name: 'Core Project Work / Learning', duration_hours: 4.0, type: 'productive' },
    { id: 7, name: 'Social Media & Video Browsing', duration_hours: 2.0, type: 'unproductive' },
    { id: 8, name: 'Dinner & Wind-down', duration_hours: 1.5, type: 'neutral' },
    { id: 9, name: 'Reading & Evening Meditation', duration_hours: 1.0, type: 'productive' }
  ];

  function getActivities() {
    const activities = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    if (!activities) {
      saveLocal(STORAGE_KEYS.ACTIVITIES, DEFAULT_ACTIVITIES);
      return DEFAULT_ACTIVITIES;
    }
    try {
      return JSON.parse(activities);
    } catch (e) {
      return DEFAULT_ACTIVITIES;
    }
  }

  function addActivity(name, duration, type) {
    const activities = getActivities();
    const total = activities.reduce((sum, a) => sum + parseFloat(a.duration_hours), 0);
    const durVal = parseFloat(duration);

    if (total + durVal > 24.0) {
      return { success: false, error: `Cannot log more than 24 hours (Current total logged: ${total}h).` };
    }

    const newAct = {
      id: Date.now(),
      name: name.trim(),
      duration_hours: durVal,
      type: type
    };
    activities.push(newAct);
    saveLocal(STORAGE_KEYS.ACTIVITIES, activities);
    return { success: true, activity: newAct };
  }

  function deleteActivity(id) {
    let activities = getActivities();
    activities = activities.filter(a => a.id !== id);
    saveLocal(STORAGE_KEYS.ACTIVITIES, activities);
    return { success: true };
  }

  // --- 3. CAMPAIGNS & TASKS ---
  function getGoals() {
    return getLocal(STORAGE_KEYS.GOALS, []);
  }

  function getActiveGoals() {
    let goals = getGoals();
    let active = goals.filter(g => g.is_active === 1);
    
    if (active.length === 0 && goals.length > 0) {
      // Fallback: activate latest
      goals[0].is_active = 1;
      saveLocal(STORAGE_KEYS.GOALS, goals);
      active = [goals[0]];
    }

    // Hydrate plan tasks
    active.forEach(g => {
      g.plan = getTasksByGoalId(g.id);
    });

    return active;
  }

  function saveGoal(goalText, currentLevel, deadline, availableTime, plan, probability, focusScore, rationale) {
    const goals = getGoals();
    const newGoalId = Date.now();
    
    // Deactivate previous active goals if desired (original app kept multiple active, but let's follow the schema defaults)
    const newGoal = {
      id: newGoalId,
      goal_text: goalText,
      current_level: currentLevel || 'Not specified',
      deadline: deadline || 'Not specified',
      available_time: availableTime || 'Not specified',
      base_probability: probability,
      current_probability: probability,
      focus_score: focusScore,
      rationale: rationale,
      generated_at: new Date().toISOString(),
      is_active: 1
    };

    goals.unshift(newGoal); // Add to beginning
    saveLocal(STORAGE_KEYS.GOALS, goals);

    // Save associated tasks
    const allTasks = getLocal(STORAGE_KEYS.TASKS, []);
    plan.forEach(task => {
      allTasks.push({
        id: Date.now() + Math.random(),
        goal_id: newGoalId,
        action: task.action,
        why: task.why,
        when_time: task.when,
        xp_reward: parseInt(task.xp_reward) || 15,
        probability_impact: parseFloat(task.probability_impact) || 3.0,
        is_completed: 0,
        subtasks: task.subtasks.map(st => ({ text: typeof st === 'string' ? st : st.text, done: false }))
      });
    });
    saveLocal(STORAGE_KEYS.TASKS, allTasks);

    return newGoal;
  }

  function activateGoal(goalId) {
    const goals = getGoals();
    const target = goals.find(g => g.id === goalId);
    if (!target) return { success: false, error: 'Goal not found' };

    target.is_active = target.is_active === 1 ? 0 : 1;
    saveLocal(STORAGE_KEYS.GOALS, goals);
    return { success: true, goal: target };
  }

  function deleteGoal(goalId) {
    let goals = getGoals();
    goals = goals.filter(g => g.id !== goalId);
    saveLocal(STORAGE_KEYS.GOALS, goals);

    let tasks = getLocal(STORAGE_KEYS.TASKS, []);
    tasks = tasks.filter(t => t.goal_id !== goalId);
    saveLocal(STORAGE_KEYS.TASKS, tasks);

    return { success: true };
  }

  function getTasksByGoalId(goalId) {
    const tasks = getLocal(STORAGE_KEYS.TASKS, []);
    const filtered = tasks.filter(t => t.goal_id === goalId);
    
    // Tag each with goal text
    const goals = getGoals();
    const g = goals.find(x => x.id === goalId);
    filtered.forEach(t => {
      t.goal_text = g ? g.goal_text : 'Unknown Goal';
    });
    return filtered;
  }

  function addCustomTask(goalId, action, why, whenTime, xpReward, probabilityImpact, subtasks = []) {
    const tasks = getLocal(STORAGE_KEYS.TASKS, []);
    const newTask = {
      id: Date.now(),
      goal_id: goalId,
      action: action,
      why: why,
      when_time: whenTime,
      xp_reward: xpReward,
      probability_impact: probabilityImpact,
      is_completed: 0,
      subtasks: subtasks.map(st => ({ text: st.text, done: false }))
    };
    tasks.push(newTask);
    saveLocal(STORAGE_KEYS.TASKS, tasks);
    return newTask;
  }

  // --- XP & STREAK CALCULATIONS ---
  function updateXpAndLevel(xpChange) {
    const profile = getProfile();
    let level = profile.level || 1;
    let xp = profile.xp || 0;
    let newXp = xp + xpChange;
    let levelUp = false;

    while (newXp >= 100) {
      newXp -= 100;
      level += 1;
      levelUp = true;
    }

    while (newXp < 0) {
      if (level > 1) {
        level -= 1;
        newXp += 100;
        levelUp = true;
      } else {
        newXp = 0;
        break;
      }
    }

    profile.level = level;
    profile.xp = newXp;
    saveProfile(profile);

    return { newLevel: level, newXp, levelUp };
  }

  function updateStreak() {
    const profile = getProfile();
    const todayStr = new Date().toISOString().split('T')[0];
    const lastActiveStr = profile.last_active;
    let newStreak = 1;

    if (lastActiveStr) {
      const lastActiveDate = new Date(lastActiveStr);
      const todayDate = new Date(todayStr);
      const diffTime = Math.abs(todayDate - lastActiveDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak = (profile.streak || 0) + 1;
      } else if (diffDays === 0) {
        newStreak = profile.streak || 1;
      } else {
        newStreak = 1;
      }
    }
    profile.streak = newStreak;
    profile.last_active = todayStr;
    saveProfile(profile);
  }

  // --- TASK ACTIONS ---
  function completeTask(taskId, isCompleted) {
    const tasks = getLocal(STORAGE_KEYS.TASKS, []);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found' };

    const wasCompleted = task.is_completed === 1;
    const isNowCompleted = isCompleted ? 1 : 0;

    if (wasCompleted === (isNowCompleted === 1)) {
      const profile = getProfile();
      const goal = getGoals().find(g => g.id === task.goal_id);
      return {
        success: true,
        xp_added: 0,
        level_up: false,
        new_level: profile.level,
        new_xp: profile.xp,
        new_streak: profile.streak,
        new_probability: goal ? goal.current_probability : 'Unknown',
        subtasks: task.subtasks
      };
    }

    // Update completion state
    task.is_completed = isNowCompleted;
    task.subtasks.forEach(st => {
      st.done = isCompleted;
    });

    saveLocal(STORAGE_KEYS.TASKS, tasks);

    const xpDiff = isCompleted ? task.xp_reward : -task.xp_reward;
    const probDiff = isCompleted ? task.probability_impact : -task.probability_impact;

    const xpResult = updateXpAndLevel(xpDiff);
    if (isCompleted) {
      updateStreak();
    }

    // Update goal probability
    let newProbStr = 'Unknown';
    const goals = getGoals();
    const goal = goals.find(g => g.id === task.goal_id);
    if (goal) {
      const parseProb = s => {
        try {
          return parseFloat(s.replace('%', '').trim());
        } catch(e) {
          return 50.0;
        }
      };
      const baseVal = parseProb(goal.base_probability);
      const currVal = parseProb(goal.current_probability);
      let newVal = currVal + probDiff;
      newVal = Math.max(baseVal, Math.min(100.0, newVal));
      newProbStr = `${newVal.toFixed(1)}%`;
      goal.current_probability = newProbStr;
      saveLocal(STORAGE_KEYS.GOALS, goals);
    }

    const updatedProfile = getProfile();
    return {
      success: true,
      xp_added: xpDiff,
      level_up: xpResult.levelUp,
      new_level: updatedProfile.level,
      new_xp: updatedProfile.xp,
      new_streak: updatedProfile.streak,
      new_probability: newProbStr,
      subtasks: task.subtasks
    };
  }

  function toggleSubtask(taskId, subtaskIndex, isDone) {
    const tasks = getLocal(STORAGE_KEYS.TASKS, []);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found' };

    task.subtasks[subtaskIndex].done = isDone;
    
    const allDone = task.subtasks.every(st => st.done);
    const wasCompleted = task.is_completed === 1;

    let xpDiff = 0;
    let probDiff = 0.0;
    let levelUp = false;

    if (allDone && !wasCompleted) {
      task.is_completed = 1;
      xpDiff = task.xp_reward;
      probDiff = task.probability_impact;
      updateStreak();
    } else if (!allDone && wasCompleted) {
      task.is_completed = 0;
      xpDiff = -task.xp_reward;
      probDiff = -task.probability_impact;
    }

    saveLocal(STORAGE_KEYS.TASKS, tasks);

    let xpResult = { levelUp: false };
    if (xpDiff !== 0) {
      xpResult = updateXpAndLevel(xpDiff);
    }

    let newProbStr = 'Unknown';
    const goals = getGoals();
    const goal = goals.find(g => g.id === task.goal_id);
    if (goal) {
      if (probDiff !== 0) {
        const parseProb = s => {
          try {
            return parseFloat(s.replace('%', '').trim());
          } catch(e) {
            return 50.0;
          }
        };
        const baseVal = parseProb(goal.base_probability);
        const currVal = parseProb(goal.current_probability);
        let newVal = currVal + probDiff;
        newVal = Math.max(baseVal, Math.min(100.0, newVal));
        newProbStr = `${newVal.toFixed(1)}%`;
        goal.current_probability = newProbStr;
        saveLocal(STORAGE_KEYS.GOALS, goals);
      } else {
        newProbStr = goal.current_probability;
      }
    }

    const updatedProfile = getProfile();
    return {
      success: true,
      subtasks: task.subtasks,
      quest_completed: allDone && !wasCompleted,
      quest_uncompleted: !allDone && wasCompleted,
      xp_added: xpDiff,
      level_up: xpResult.levelUp,
      new_level: updatedProfile.level,
      new_xp: updatedProfile.xp,
      new_streak: updatedProfile.streak,
      new_probability: newProbStr
    };
  }

  // --- 4. EVENING REVIEWS ---
  function getReviews() {
    return getLocal(STORAGE_KEYS.REVIEWS, []).slice(0, 10);
  }

  function addReview(rating, notes) {
    const reviews = getLocal(STORAGE_KEYS.REVIEWS, []);
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

    const newReview = {
      id: Date.now(),
      rating: rating,
      notes: notes.trim(),
      created_at: dateStr
    };
    reviews.unshift(newReview);
    saveLocal(STORAGE_KEYS.REVIEWS, reviews);

    // Add +15 XP for review
    const xpResult = updateXpAndLevel(15);
    return { success: true, review: newReview, xpResult };
  }

  // --- 5. CHAT SYSTEM ---
  function getChatHistory() {
    return getLocal(STORAGE_KEYS.CHAT, []);
  }

  function saveChatMessage(role, content) {
    const chat = getChatHistory();
    const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
    const newMsg = {
      role: role,
      content: content,
      created_at: dateStr
    };
    chat.push(newMsg);
    saveLocal(STORAGE_KEYS.CHAT, chat);
    return newMsg;
  }

  function clearChatHistory() {
    localStorage.removeItem(STORAGE_KEYS.CHAT);
    return { success: true };
  }

  // Export DB namespace globally
  window.db = {
    getProfile,
    saveProfile,
    getActivities,
    addActivity,
    deleteActivity,
    getGoals,
    getActiveGoals,
    saveGoal,
    activateGoal,
    deleteGoal,
    getTasksByGoalId,
    addCustomTask,
    completeTask,
    toggleSubtask,
    getReviews,
    addReview,
    getChatHistory,
    saveChatMessage,
    clearChatHistory
  };
})();
