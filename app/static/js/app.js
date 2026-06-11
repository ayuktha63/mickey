// Mickey AI Productivity Workspace - Main Client Script

let currentTab = 'chat'; // AI Assistant is the default home tab
let activeConversationId = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let availableModels = [];
let activeWorkspaceMode = localStorage.getItem('mickey_mode') || 'work';

// MS To-Do active states
let selectedTask = null;
let currentSort = 'default'; // 'default', 'priority', 'alphabetical', 'due'
let currentView = 'list'; // 'list', 'grid'

// Global document selectors helper
const el = (id) => document.getElementById(id);

// Custom Fetch Wrapper to inject mode header on every request
async function apiFetch(url, options = {}) {
  if (!options.headers) {
    options.headers = {};
  }
  options.headers['X-Workspace-Mode'] = activeWorkspaceMode;
  
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  
  return fetch(url, options);
}

document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('mickey_session_active') === 'true') {
    initApp();
  } else {
    window.onMickeyUnlocked = () => {
      initApp();
    };
  }
});

// App Initialization
async function initApp() {
  applyModeThemeClass();
  setupNavigation();
  setupTheme();
  setupModals();
  setupModeToggle();
  setupSidebarLayout();
  setupClocks();
  setupDashboardWidgets();

  // Load initial settings and model configuration
  await fetchSettings();
  await fetchModels();
  
  // Initial data loads
  loadDashboardData();
  loadConversations();
  loadTasks();
  loadNotes();
  renderCalendar();
  
  // Form submission bindings
  el('chat-form').addEventListener('submit', handleChatSubmit);
  el('todo-add-form').addEventListener('submit', handleQuickTaskSubmit);
  el('note-form').addEventListener('submit', handleNoteSubmit);
  el('event-form').addEventListener('submit', handleEventSubmit);
  el('settings-form').addEventListener('submit', handleSettingsSubmit);
  
  // Dashboard quick links refresh
  el('refresh-gmail-btn').addEventListener('click', () => { Sound.playClick(); loadGmailFeed(); });
  el('trigger-figma-btn').addEventListener('click', () => { Sound.playClick(); triggerFigmaSandbox(); });
  el('refresh-weather-btn').addEventListener('click', () => { Sound.playClick(); loadWeatherForecast(); });
  
  // Search listener for notes
  el('notes-search-input').addEventListener('input', () => {
    loadNotes(el('notes-search-input').value);
  });
  
  // Chat buttons
  el('new-chat-btn').addEventListener('click', () => { Sound.playClick(); startNewChat(); });
  el('test-ollama-btn').addEventListener('click', () => { Sound.playClick(); checkOllamaConnection(); });

  // Sidebar logout trigger
  el('sidebar-logout-btn').addEventListener('click', () => {
    Biometrics.logout();
  });

  // Notifications Bell Click
  el('notification-bell-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = el('notification-popover');
    const isHidden = pop.style.display === 'none';
    pop.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) {
      Sound.playClick();
      updateNotifications();
    }
  });

  document.addEventListener('click', () => {
    const pop = el('notification-popover');
    if (pop) pop.style.display = 'none';
  });

  el('notification-popover').addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // Chat Keyboard Enter Listener
  el('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      el('chat-form').requestSubmit();
    }
  });

  // Gmail Panel refresh
  el('gmail-panel-refresh-btn').addEventListener('click', () => {
    Sound.playClick();
    loadGmailPanel();
  });

  // Delete event binding
  el('delete-event-btn').addEventListener('click', () => {
    const id = el('event-edit-id').value;
    if (id) deleteEvent(id);
  });

  // MS To-Do details bindings
  el('details-close-btn').addEventListener('click', () => { Sound.playClick(); closeDetailsPane(); });
  el('details-delete-btn').addEventListener('click', () => { Sound.playClick(); deleteActiveTask(); });
  el('details-check').addEventListener('click', () => toggleActiveTaskCheck());
  el('details-star-btn').addEventListener('click', () => toggleActiveTaskImportance());
  el('details-add-step-form').addEventListener('submit', handleAddSubStep);
  el('details-note-textarea').addEventListener('change', autoSaveActiveTaskDetails);
  el('details-title-input').addEventListener('change', autoSaveActiveTaskDetails);
  el('details-remind-input').addEventListener('change', autoSaveActiveTaskDetails);
  el('details-due-input').addEventListener('change', autoSaveActiveTaskDetails);

  // Todo filter sorting
  el('todo-sort-btn').addEventListener('click', () => {
    Sound.playClick();
    cycleSortOption();
  });

  // Mode View toggle (List vs Grid)
  document.querySelectorAll('.todo-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.playClick();
      document.querySelector('.todo-view-btn.active').classList.remove('active');
      btn.classList.add('active');
      currentView = btn.getAttribute('data-view');
      loadTasks();
    });
  });

  // Sound triggering on nav links
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => Sound.playClick());
  });
}

// Sidebar Layout Cycling (Collapsed -> Expanded -> Pinned)
function setupSidebarLayout() {
  const hamburger = el('sidebar-hamburger');
  const layout = document.querySelector('.app-layout');
  let sidebarState = localStorage.getItem('mickey_sidebar_state') || 'expanded'; // collapsed, expanded
  
  if (sidebarState === 'collapsed') {
    layout.classList.add('sidebar-collapsed');
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    Sound.playClick();
    if (layout.classList.contains('sidebar-collapsed')) {
      layout.classList.remove('sidebar-collapsed');
      localStorage.setItem('mickey_sidebar_state', 'expanded');
    } else {
      layout.classList.add('sidebar-collapsed');
      localStorage.setItem('mickey_sidebar_state', 'collapsed');
    }
  });
}

// Work / Personal mode dynamic database toggling
function setupModeToggle() {
  const workBtn = el('mode-work-btn');
  const personalBtn = el('mode-personal-btn');
  const activeModeBadge = el('active-mode-badge');

  const updateModeUI = () => {
    if (activeWorkspaceMode === 'work') {
      workBtn.classList.add('active');
      personalBtn.classList.remove('active');
      if (activeModeBadge) {
        activeModeBadge.textContent = "Work Mode";
        activeModeBadge.style.backgroundColor = "rgba(99, 102, 241, 0.15)";
        activeModeBadge.style.color = "var(--primary)";
      }
    } else {
      workBtn.classList.remove('active');
      personalBtn.classList.add('active');
      if (activeModeBadge) {
        activeModeBadge.textContent = "Personal Mode";
        activeModeBadge.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
        activeModeBadge.style.color = "var(--success)";
      }
    }
  };

  updateModeUI();

  const switchMode = (mode) => {
    if (activeWorkspaceMode === mode) return;
    activeWorkspaceMode = mode;
    localStorage.setItem('mickey_mode', mode);
    updateModeUI();
    applyModeThemeClass();
    Sound.playSuccess();

    // Close details drawer if open
    closeDetailsPane();

    // Refresh all data modules
    loadDashboardData();
    loadConversations();
    loadTasks();
    loadNotes();
    renderCalendar();
    fetchSettings();
  };

  workBtn.addEventListener('click', () => switchMode('work'));
  personalBtn.addEventListener('click', () => switchMode('personal'));
}

function applyModeThemeClass() {
  if (activeWorkspaceMode === 'personal') {
    document.documentElement.classList.add('theme-personal');
    document.documentElement.classList.remove('theme-work');
  } else {
    document.documentElement.classList.add('theme-work');
    document.documentElement.classList.remove('theme-personal');
  }
}

// Clocks and Timezone ticks
function setupClocks() {
  const updateClocks = () => {
    const localClock = el('clock-local');
    if (!localClock) return;
    
    const now = new Date();
    
    // Get dates for each zone
    const localDate = new Date();
    const estDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
    const londonDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/London"}));
    const jstDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));

    if (currentClockStyle === 'analog') {
      drawAnalogClock(el('clock-canvas-local'), localDate);
      drawAnalogClock(el('clock-canvas-est'), estDate);
      drawAnalogClock(el('clock-canvas-london'), londonDate);
      drawAnalogClock(el('clock-canvas-jst'), jstDate);
    } else {
      localClock.textContent = now.toLocaleTimeString();
      el('clock-est').textContent = estDate.toLocaleTimeString();
      el('clock-london').textContent = londonDate.toLocaleTimeString();
      el('clock-jst').textContent = jstDate.toLocaleTimeString();
    }

    // Subtitle date formats
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    const dateStr = now.toLocaleDateString('en-US', options);
    el('todo-subtitle').textContent = dateStr;
  };
  setInterval(updateClocks, 1000);
  updateClocks();
}

function drawAnalogClock(canvas, date) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const radius = canvas.width / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw clock face circle
  ctx.beginPath();
  ctx.arc(radius, radius, radius - 2, 0, 2 * Math.PI);
  ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#18181b' : '#ffffff';
  ctx.fill();
  ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#27272a' : '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw center point
  ctx.beginPath();
  ctx.arc(radius, radius, 3, 0, 2 * Math.PI);
  ctx.fillStyle = 'var(--primary)';
  ctx.fill();

  // Draw hour ticks
  ctx.strokeStyle = varColor('--text-muted');
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(radius + Math.sin(angle) * (radius - 8), radius - Math.cos(angle) * (radius - 8));
    ctx.lineTo(radius + Math.sin(angle) * (radius - 3), radius - Math.cos(angle) * (radius - 3));
    ctx.stroke();
  }

  // Clock hands angles
  const hr = date.getHours();
  const min = date.getMinutes();
  const sec = date.getSeconds();
  
  // Hour hand
  const hourAngle = ((hr % 12) * Math.PI / 6) + (min * Math.PI / 360);
  drawHand(ctx, radius, hourAngle, radius * 0.45, 2.5, varColor('--text-main'));
  
  // Minute hand
  const minAngle = (min * Math.PI / 30) + (sec * Math.PI / 1800);
  drawHand(ctx, radius, minAngle, radius * 0.65, 1.5, varColor('--text-main'));
  
  // Sweep Second hand
  const secAngle = (sec * Math.PI / 30);
  drawHand(ctx, radius, secAngle, radius * 0.75, 1, '#ef4444');
}

function varColor(variableName) {
  const isDark = document.documentElement.classList.contains('dark');
  if (variableName === '--text-main') return isDark ? '#f4f4f5' : '#0f172a';
  if (variableName === '--text-muted') return isDark ? '#a1a1aa' : '#64748b';
  return '#6366f1';
}

function drawHand(ctx, center, angle, length, width, color) {
  ctx.beginPath();
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  ctx.moveTo(center, center);
  ctx.lineTo(center + Math.sin(angle) * length, center - Math.cos(angle) * length);
  ctx.stroke();
}

function renderClockVisibility() {
  const isAnalog = currentClockStyle === 'analog';
  const timezones = ['local', 'est', 'london', 'jst'];
  timezones.forEach(tz => {
    const textEl = el(`clock-${tz}`);
    const canvasEl = el(`clock-canvas-${tz}`);
    if (textEl && canvasEl) {
      textEl.style.display = isAnalog ? 'none' : 'block';
      canvasEl.style.display = isAnalog ? 'block' : 'none';
    }
  });
}

// Dashboard customizable widgets configuration
function setupDashboardWidgets() {
  const btn = el('dashboard-customize-btn');
  const popover = el('dash-customizer-popover');
  const closeBtn = el('close-customizer-btn');
  const applyBtn = el('apply-customizer-btn');

  btn.addEventListener('click', () => {
    Sound.playClick();
    popover.style.display = 'flex';
  });

  closeBtn.addEventListener('click', () => {
    Sound.playClick();
    popover.style.display = 'none';
  });

  applyBtn.addEventListener('click', () => {
    Sound.playClick();
    saveDashboardWidgetsConfig();
    popover.style.display = 'none';
  });

  // Load saved toggles configuration
  const widgets = ["clocks", "tasks", "events", "gmail", "figma", "notes", "weather"];
  widgets.forEach(w => {
    const toggleEl = el(`toggle-widget-${w}`);
    if (toggleEl) {
      const checked = localStorage.getItem(`mickey_widget_${w}`) !== 'false';
      toggleEl.checked = checked;
    }
  });
  renderDashboardWidgetsVisibility();
}

function saveDashboardWidgetsConfig() {
  const widgets = ["clocks", "tasks", "events", "gmail", "figma", "notes", "weather"];
  widgets.forEach(w => {
    const toggleEl = el(`toggle-widget-${w}`);
    if (toggleEl) {
      localStorage.setItem(`mickey_widget_${w}`, toggleEl.checked);
    }
  });
  renderDashboardWidgetsVisibility();
  Sound.playSuccess();
}

function renderDashboardWidgetsVisibility() {
  const widgets = ["clocks", "tasks", "events", "gmail", "figma", "notes", "weather"];
  widgets.forEach(w => {
    const visible = localStorage.getItem(`mickey_widget_${w}`) !== 'false';
    const widgetCard = el(`widget-${w}`);
    if (widgetCard) {
      widgetCard.style.display = visible ? 'flex' : 'none';
    }
  });
  
  const weatherVisible = localStorage.getItem('mickey_widget_weather') !== 'false';
  if (weatherVisible) {
    loadWeatherForecast();
  }
}

// Theme (Dark/Light Mode)
function setupTheme() {
  const themeToggle = el('theme-toggle');
  
  // Read preference
  const currentTheme = localStorage.getItem('theme') || 'dark';
  if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
  
  themeToggle.addEventListener('click', () => {
    Sound.playClick();
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
}

// Navigation Tabs
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });
}

function switchTab(tabId) {
  currentTab = tabId;
  
  // Update nav UI
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  // Update Content Panels
  document.querySelectorAll('.tab-panel').forEach(panel => {
    if (panel.id === `panel-${tabId}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
  
  // Re-run context loads if entering a panel
  if (tabId === 'dashboard') loadDashboardData();
  if (tabId === 'tasks') loadTasks();
  if (tabId === 'notes') loadNotes();
  if (tabId === 'calendar') renderCalendar();
  if (tabId === 'gmail') loadGmailPanel();
}

// Modals Utilities
function setupModals() {
  el('open-note-modal-btn').addEventListener('click', () => openNoteModal());
  el('open-event-modal-btn').addEventListener('click', () => openEventModal());
}

function openModal(id) {
  el(id).classList.add('active');
}

function closeModal(id) {
  el(id).classList.remove('active');
}

function openNoteModal(note = null) {
  const form = el('note-form');
  form.reset();
  
  if (note) {
    el('note-modal-title').textContent = "Edit Note";
    el('note-edit-id').value = note.id;
    el('note-title').value = note.title;
    el('note-content').value = note.content || "";
    el('note-tags').value = note.tags || "";
  } else {
    el('note-modal-title').textContent = "New Note";
    el('note-edit-id').value = "";
  }
  openModal('note-modal');
}

function openEventModal(event = null) {
  const form = el('event-form');
  form.reset();
  
  if (event) {
    el('event-modal-title').textContent = "Edit Event";
    el('event-edit-id').value = event.id;
    el('event-title').value = event.title;
    el('event-desc').value = event.description || "";
    el('event-loc').value = event.location || "";
    el('event-start').value = event.start_time.slice(0, 16);
    el('event-end').value = event.end_time.slice(0, 16);
    el('event-allday').checked = event.all_day;
    el('delete-event-btn').style.display = 'inline-block';
  } else {
    el('event-modal-title').textContent = "Add Event";
    el('event-edit-id').value = "";
    el('delete-event-btn').style.display = 'none';
  }
  openModal('event-modal');
}

// Global clock style variable
let currentClockStyle = 'digital';

// ── GET SETTINGS & MODELS ──
async function fetchSettings() {
  try {
    const res = await apiFetch('/api/settings');
    const data = await res.json();
    el('set-ollama-url').value = data.ollama_url || '';
    el('set-gmail-address').value = data.gmail_address || '';
    el('set-gmail-password').value = data.gmail_app_password || '';
    el('set-figma-token').value = data.figma_access_token || '';
    el('set-mcp-figma-url').value = data.mcp_figma_url || '';
    currentClockStyle = data.clock_style || 'digital';
    el('set-clock-style').value = currentClockStyle;
    renderClockVisibility();
  } catch (e) {
    console.error("Error fetching settings:", e);
  }
}

async function fetchModels() {
  try {
    const res = await apiFetch('/api/models');
    const data = await res.json();
    availableModels = data.models || [];
    
    // Populate model selector dropdowns
    const chatModelSelect = el('chat-model-select');
    const settingsModelSelect = el('set-selected-model');
    
    chatModelSelect.innerHTML = '<option value="">Default Model</option>';
    settingsModelSelect.innerHTML = '<option value="">Default Model</option>';
    
    availableModels.forEach(m => {
      const opt = `<option value="${m}">${m}</option>`;
      chatModelSelect.innerHTML += opt;
      settingsModelSelect.innerHTML += opt;
    });
    
    // Try to restore chosen model from settings
    const activeSettingRes = await apiFetch('/api/settings');
    const activeSettingData = await activeSettingRes.json();
    if (activeSettingData.selected_model) {
      chatModelSelect.value = activeSettingData.selected_model;
      settingsModelSelect.value = activeSettingData.selected_model;
      el('active-model-display').textContent = `ollama (${activeSettingData.selected_model})`;
    }
  } catch (e) {
    console.error("Error fetching models:", e);
  }
}

// Check Ollama status connection
async function checkOllamaConnection() {
  const btn = el('test-ollama-btn');
  btn.textContent = "Checking connection...";
  try {
    const res = await apiFetch('/api/models');
    if (res.ok) {
      alert("Success! Connected to local Ollama server.");
      fetchModels();
    } else {
      alert("Ollama responded but failed model listing.");
    }
  } catch (e) {
    alert("Connection failed. Check that Ollama is running locally.");
  } finally {
    btn.textContent = "Check Ollama status";
  }
}

// ── DASHBOARD LOADING ──
async function loadDashboardData() {
  try {
    const res = await apiFetch('/api/dashboard');
    const data = await res.json();
    
    // Render dashboard tasks widget
    const tasksCont = el('dash-tasks-container');
    tasksCont.innerHTML = '';
    if (!data.tasks.length) {
      tasksCont.innerHTML = '<div class="placeholder-text">All caught up! No pending tasks.</div>';
    } else {
      data.tasks.forEach(t => {
        const item = document.createElement('div');
        item.className = 'dash-task-item';
        item.innerHTML = `
          <span>${t.title}</span>
          <span class="badge badge-${t.priority}">${t.priority}</span>
        `;
        tasksCont.appendChild(item);
      });
    }
    
    // Render dashboard events widget
    const eventsCont = el('dash-events-container');
    eventsCont.innerHTML = '';
    if (!data.events.length) {
      eventsCont.innerHTML = '<div class="placeholder-text">No upcoming events this week.</div>';
    } else {
      data.events.forEach(e => {
        const item = document.createElement('div');
        item.className = 'dash-event-item';
        const start = new Date(e.start_time).toLocaleDateString(undefined, {month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
        item.innerHTML = `
          <span>${e.title}</span>
          <span style="font-size:0.7rem; color:var(--text-muted);">${start}</span>
        `;
        eventsCont.appendChild(item);
      });
    }

    // Render dashboard notes widget
    const notesCont = el('dash-notes-container');
    notesCont.innerHTML = '';
    if (!data.notes.length) {
      notesCont.innerHTML = '<div class="placeholder-text">No notes yet.</div>';
    } else {
      data.notes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'dash-note-item';
        item.innerHTML = `
          <span>${n.title}</span>
        `;
        notesCont.appendChild(item);
      });
    }
    
    // Load Gmail feed
    loadGmailFeed();
  } catch (e) {
    console.error("Error fetching dashboard updates:", e);
  }
}

async function loadGmailFeed() {
  const gmailCont = el('dash-gmail-container');
  gmailCont.innerHTML = '<div class="loading-state">Syncing Gmail IMAP...</div>';
  try {
    const res = await apiFetch('/api/gmail/recent');
    const data = await res.json();
    gmailCont.innerHTML = '';
    if (data.emails && data.emails.length > 0) {
      data.emails.forEach(item => {
        if (item.error) {
          gmailCont.innerHTML = `
            <div class="placeholder-text text-danger" style="flex-direction: column; gap: 0.4rem; padding: 1rem; text-align: center;">
              <strong>${item.error}</strong>
              ${item.snippet ? `<span style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; max-width: 90%; margin-top: 0.2rem;">${item.snippet}</span>` : ''}
            </div>`;
          return;
        }
        const div = document.createElement('div');
        div.className = 'dash-gmail-item';
        div.innerHTML = `
          <div class="gmail-meta">
            <strong>${item.from}</strong>
            <span>${item.date}</span>
          </div>
          <strong>${item.subject}</strong>
          <span class="gmail-snippet">${item.snippet}</span>
        `;
        gmailCont.appendChild(div);
      });
    } else {
      gmailCont.innerHTML = '<div class="placeholder-text">Inbox feed is empty.</div>';
    }
  } catch (e) {
    gmailCont.innerHTML = '<div class="placeholder-text text-danger">Gmail Sync Failed.</div>';
  }
}

async function triggerFigmaSandbox() {
  const figmaCont = el('dash-figma-container');
  figmaCont.innerHTML = '<div class="loading-state">Querying Figma Sandbox...</div>';
  try {
    const mockRes = await apiFetch('/api/settings');
    const settingsData = await mockRes.json();
    
    let displayHtml = '';
    if (settingsData.figma_access_token) {
      displayHtml = `
        <div class="dash-task-item">
          <strong>Figma Access Token Active</strong>
          <span class="badge badge-low">Linked</span>
        </div>
        <p class="placeholder-text">Design sandbox ready for tool calling.</p>
      `;
    } else {
      displayHtml = `
        <div class="dash-task-item">
          <strong>Sandbox Design System</strong>
          <span class="badge badge-medium">Fallback</span>
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem;">
          Using mock design tokens. Add Figma PAT in Settings for live access.
        </p>
      `;
    }
    figmaCont.innerHTML = displayHtml;
  } catch (e) {
    figmaCont.innerHTML = '<div class="placeholder-text text-danger">Figma MCP query failed.</div>';
  }
}

// ── MICROSOFT TO-DO RE-ENGINEERED TASKS SECTION ──
let allTasks = [];

async function loadTasks() {
  try {
    const res = await apiFetch('/api/tasks');
    allTasks = await res.json();
    renderTasksList(allTasks);
    updateNotifications();
  } catch (e) {
    console.error("Error loading tasks:", e);
  }
}

function cycleSortOption() {
  const options = ['default', 'priority', 'alphabetical', 'due'];
  const nextIdx = (options.indexOf(currentSort) + 1) % options.length;
  currentSort = options[nextIdx];
  el('todo-sort-btn').querySelector('span').textContent = `Sort: ${currentSort}`;
  renderTasksList(allTasks);
}

function renderTasksList(tasks) {
  const container = el('tasks-list-container');
  container.innerHTML = '';
  
  if (currentSort === 'priority') {
    const priorityWeight = { 'high': 3, 'medium': 2, 'low': 1 };
    tasks.sort((a, b) => (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2));
  } else if (currentSort === 'alphabetical') {
    tasks.sort((a, b) => a.title.localeCompare(b.title));
  } else if (currentSort === 'due') {
    tasks.sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  } else {
    // default: pending first, then by date created/due
    tasks.sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'pending' ? -1 : 1;
      }
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  if (!tasks.length) {
    container.innerHTML = '<div class="loading-state">No tasks. Type a task name above and press Enter.</div>';
    return;
  }

  if (currentView === 'grid') {
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
    container.style.gap = '1rem';
  } else {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '0.5rem';
  }
  
  tasks.forEach(t => {
    const row = document.createElement('div');
    row.className = `todo-item-row ${selectedTask && selectedTask.id === t.id ? 'active' : ''}`;
    row.onclick = () => openDetailsPane(t);

    const isCompleted = t.status === 'completed';
    const checkedAttr = isCompleted ? 'checked' : '';
    const dueDisplay = t.due_date ? new Date(t.due_date).toLocaleDateString() : '';
    
    // Parse description for steps checklist count
    let descriptionData = { steps: [] };
    if (t.description && t.description.startsWith('{')) {
      try { descriptionData = JSON.parse(t.description); } catch(e){}
    }

    const stepsCount = descriptionData.steps ? descriptionData.steps.length : 0;
    const completedSteps = descriptionData.steps ? descriptionData.steps.filter(s => s.done).length : 0;
    
    let subtext = "Tasks";
    if (descriptionData.is_myday) subtext += " • My Day";
    if (stepsCount > 0) subtext += ` • ${completedSteps} of ${stepsCount} steps`;
    if (dueDisplay) subtext += ` • Due ${dueDisplay}`;

    row.innerHTML = `
      <div style="display:flex; align-items:center; flex:1; min-width:0;">
        <input type="checkbox" class="todo-circle-check" ${checkedAttr} onclick="event.stopPropagation(); toggleTaskComplete('${t.id}', '${t.status}')">
        <div class="todo-item-content ${isCompleted ? 'completed' : ''}">
          <h3>${t.title}</h3>
          <div class="todo-item-meta">
            <span>${subtext}</span>
          </div>
        </div>
      </div>
      <button class="star-btn ${t.priority === 'high' ? 'active' : ''}" onclick="event.stopPropagation(); toggleTaskPriority('${t.id}', '${t.priority}')">
        ${t.priority === 'high' ? '★' : '☆'}
      </button>
    `;
    container.appendChild(row);
  });
}

// Create new task quickly by typing & enter
async function handleQuickTaskSubmit(e) {
  e.preventDefault();
  const input = el('todo-new-title');
  const title = input.value.trim();
  if (!title) return;

  const payload = {
    title,
    priority: 'medium',
    status: 'pending'
  };

  try {
    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      body: payload
    });
    if (res.ok) {
      input.value = '';
      Sound.playClick();
      await loadTasks();
    }
  } catch (e) {
    console.error(e);
  }
}

// Toggle checklist completed check
async function toggleTaskComplete(id, currentStatus) {
  const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
  
  if (newStatus === 'completed') {
    Sound.playComplete();
  } else {
    Sound.playClick();
  }

  try {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: { status: newStatus }
    });
    await loadTasks();
    
    // If details pane is active on this task, update it
    if (selectedTask && selectedTask.id === id) {
      selectedTask.status = newStatus;
      el('details-check').checked = (newStatus === 'completed');
    }
  } catch (e) {
    console.error(e);
  }
}

// Toggle Star priority
async function toggleTaskPriority(id, currentPriority) {
  const newPriority = currentPriority === 'high' ? 'medium' : 'high';
  Sound.playClick();
  try {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: { priority: newPriority }
    });
    await loadTasks();
    
    if (selectedTask && selectedTask.id === id) {
      selectedTask.priority = newPriority;
      const starBtn = el('details-star-btn');
      starBtn.innerHTML = newPriority === 'high' ? '★' : '☆';
      if (newPriority === 'high') {
        starBtn.classList.add('active');
      } else {
        starBtn.classList.remove('active');
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// Details pane display logic
function openDetailsPane(task) {
  selectedTask = task;
  Sound.playClick();
  
  // Highlight active row
  document.querySelectorAll('.todo-item-row').forEach(row => {
    row.classList.remove('active');
  });
  loadTasks(); // Redraws to highlight active row properly
  
  const pane = el('todo-details-pane');
  pane.classList.add('active');

  // Fill in fields
  el('details-check').checked = (task.status === 'completed');
  el('details-title-input').value = task.title;
  
  const starBtn = el('details-star-btn');
  starBtn.innerHTML = task.priority === 'high' ? '★' : '☆';
  if (task.priority === 'high') {
    starBtn.classList.add('active');
  } else {
    starBtn.classList.remove('active');
  }

  // Parse JSON description details
  let detailsData = { notes: "", steps: [], is_myday: false };
  if (task.description && task.description.startsWith('{')) {
    try { detailsData = JSON.parse(task.description); } catch(e){}
  } else {
    detailsData.notes = task.description || "";
  }

  el('details-note-textarea').value = detailsData.notes;
  
  // Date due and reminder inputs
  el('details-due-input').value = task.due_date ? task.due_date.slice(0, 10) : "";
  el('details-due-text').textContent = task.due_date ? `Due: ${new Date(task.due_date).toLocaleDateString()}` : "Add due date";
  
  // Reminder text
  const remindTime = localStorage.getItem(`mickey_remind_${task.id}`);
  el('details-remind-input').value = remindTime ? remindTime.slice(0, 16) : "";
  el('details-remind-text').textContent = remindTime ? `Remind: ${new Date(remindTime).toLocaleString()}` : "Remind me";

  // Added to My Day text
  const myDayText = el('details-myday-text');
  if (detailsData.is_myday) {
    myDayText.textContent = "Added to My Day";
    myDayText.parentElement.style.color = "var(--primary)";
  } else {
    myDayText.textContent = "Add to My Day";
    myDayText.parentElement.style.color = "inherit";
  }

  // Steps checklist
  renderSubSteps(detailsData.steps);
  
  // Creation Date display
  const createdDate = new Date(task.created_at).toLocaleDateString();
  el('details-created-display').textContent = `Created: ${createdDate}`;
}

function closeDetailsPane() {
  selectedTask = null;
  el('todo-details-pane').classList.remove('active');
  loadTasks();
}

// Sub Steps Checklist Rendering
function renderSubSteps(steps) {
  const container = el('details-steps-list');
  container.innerHTML = '';
  
  if (!steps || !steps.length) return;

  steps.forEach((step, idx) => {
    const item = document.createElement('div');
    item.className = 'details-step-item';
    item.innerHTML = `
      <input type="checkbox" class="todo-circle-check" style="width:16px; height:16px;" ${step.done ? 'checked' : ''} onchange="toggleSubStep(${idx})">
      <span class="details-step-text ${step.done ? 'completed' : ''}">${step.title}</span>
      <button type="button" class="delete-step-btn" onclick="deleteSubStep(${idx})">&times;</button>
    `;
    container.appendChild(item);
  });
}

// Add a sub step to task checklist
async function handleAddSubStep(e) {
  e.preventDefault();
  if (!selectedTask) return;

  const input = el('details-new-step-title');
  const title = input.value.trim();
  if (!title) return;

  Sound.playClick();
  input.value = '';

  let detailsData = { notes: "", steps: [], is_myday: false };
  if (selectedTask.description && selectedTask.description.startsWith('{')) {
    try { detailsData = JSON.parse(selectedTask.description); } catch(e){}
  } else {
    detailsData.notes = selectedTask.description || "";
  }

  detailsData.steps.push({ title, done: false });
  await saveUpdatedTaskDescription(detailsData);
}

async function toggleSubStep(idx) {
  if (!selectedTask) return;
  Sound.playClick();
  
  let detailsData = JSON.parse(selectedTask.description);
  detailsData.steps[idx].done = !detailsData.steps[idx].done;
  
  if (detailsData.steps[idx].done) {
    Sound.playComplete();
  }

  await saveUpdatedTaskDescription(detailsData);
}

async function deleteSubStep(idx) {
  if (!selectedTask) return;
  Sound.playClick();
  
  let detailsData = JSON.parse(selectedTask.description);
  detailsData.steps.splice(idx, 1);
  await saveUpdatedTaskDescription(detailsData);
}

// Save detailed description attributes to db
async function saveUpdatedTaskDescription(detailsData) {
  try {
    const res = await apiFetch(`/api/tasks/${selectedTask.id}`, {
      method: 'PUT',
      body: { description: JSON.stringify(detailsData) }
    });
    if (res.ok) {
      const updatedTask = await res.json();
      selectedTask = updatedTask;
      openDetailsPane(updatedTask);
    }
  } catch(e) {
    console.error(e);
  }
}

// Toggle Task Complete in Details Pane
async function toggleActiveTaskCheck() {
  if (!selectedTask) return;
  await toggleTaskComplete(selectedTask.id, selectedTask.status);
}

// Toggle Importance Star inside Details Pane
async function toggleActiveTaskImportance() {
  if (!selectedTask) return;
  await toggleTaskPriority(selectedTask.id, selectedTask.priority);
}

// Added to My Day details toggler
async function toggleActiveTaskMyDay() {
  if (!selectedTask) return;
  Sound.playClick();

  let detailsData = { notes: "", steps: [], is_myday: false };
  if (selectedTask.description && selectedTask.description.startsWith('{')) {
    try { detailsData = JSON.parse(selectedTask.description); } catch(e){}
  } else {
    detailsData.notes = selectedTask.description || "";
  }

  detailsData.is_myday = !detailsData.is_myday;
  await saveUpdatedTaskDescription(detailsData);
}
el('details-myday-btn').addEventListener('click', toggleActiveTaskMyDay);

// Autosave notes/title edits inside details pane
async function autoSaveActiveTaskDetails() {
  if (!selectedTask) return;
  
  const title = el('details-title-input').value.trim();
  const notes = el('details-note-textarea').value;
  const due = el('details-due-input').value;
  const remind = el('details-remind-input').value;

  let detailsData = { notes: "", steps: [], is_myday: false };
  if (selectedTask.description && selectedTask.description.startsWith('{')) {
    try { detailsData = JSON.parse(selectedTask.description); } catch(e){}
  } else {
    detailsData.notes = selectedTask.description || "";
  }

  detailsData.notes = notes;
  
  if (remind) {
    localStorage.setItem(`mickey_remind_${selectedTask.id}`, new Date(remind).toISOString());
  } else {
    localStorage.removeItem(`mickey_remind_${selectedTask.id}`);
  }

  try {
    const payload = {
      title,
      description: JSON.stringify(detailsData),
      due_date: due ? new Date(due).toISOString() : null
    };

    const res = await apiFetch(`/api/tasks/${selectedTask.id}`, {
      method: 'PUT',
      body: payload
    });
    
    if (res.ok) {
      const updated = await res.json();
      selectedTask = updated;
      // Refresh list
      loadTasks();
      
      // Update due display
      el('details-due-text').textContent = due ? `Due: ${new Date(due).toLocaleDateString()}` : "Add due date";
      el('details-remind-text').textContent = remind ? `Remind: ${new Date(remind).toLocaleString()}` : "Remind me";
    }
  } catch(e) {
    console.error(e);
  }
}

async function deleteActiveTask() {
  if (!selectedTask) return;
  if (!confirm("Are you sure you want to delete this task?")) return;
  
  try {
    const res = await apiFetch(`/api/tasks/${selectedTask.id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      closeDetailsPane();
      Sound.playClick();
    }
  } catch (e) {
    console.error(e);
  }
}

// ── NOTES SECTION ──
async function loadNotes(query = "") {
  try {
    const url = query ? `/api/notes?q=${encodeURIComponent(query)}` : '/api/notes';
    const res = await apiFetch(url);
    const notes = await res.json();
    
    const container = el('notes-grid-container');
    container.innerHTML = '';
    
    if (!notes.length) {
      container.innerHTML = '<div class="loading-state">No notes found. Create a new one.</div>';
      return;
    }
    
    notes.forEach(n => {
      const card = document.createElement('div');
      card.className = 'note-card';
      card.onclick = () => { Sound.playClick(); openNoteModal(n); };
      
      const contentDisplay = n.content || '*No content*';
      const updated = new Date(n.updated_at).toLocaleDateString();
      
      // Render tags
      let tagsHtml = '';
      if (n.tags) {
        n.tags.split(',').forEach(t => {
          if (t.trim()) {
            tagsHtml += `<span class="tag">#${t.trim()}</span>`;
          }
        });
      }
      
      card.innerHTML = `
        <div>
          <h3>${n.title}</h3>
          <p>${contentDisplay}</p>
        </div>
        <div class="note-footer">
          <div class="note-tags-wrap">${tagsHtml}</div>
          <span>Updated ${updated}</span>
          <button class="btn-text-danger" onclick="event.stopPropagation(); deleteNote('${n.id}')">Delete</button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    console.error("Error fetching notes:", e);
  }
}

async function handleNoteSubmit(e) {
  e.preventDefault();
  const id = el('note-edit-id').value;
  const title = el('note-title').value;
  const content = el('note-content').value;
  const tags = el('note-tags').value;
  
  const payload = { title, content, tags: tags || null };
  
  const url = id ? `/api/notes/${id}` : '/api/notes';
  const method = id ? 'PUT' : 'POST';
  
  try {
    const res = await apiFetch(url, {
      method,
      body: payload
    });
    if (res.ok) {
      closeModal('note-modal');
      Sound.playSuccess();
      loadNotes();
    }
  } catch (e) {
    console.error(e);
  }
}

async function deleteNote(id) {
  if (!confirm("Delete this note permanently?")) return;
  try {
    await apiFetch(`/api/notes/${id}`, {method: 'DELETE'});
    Sound.playClick();
    loadNotes();
  } catch (e) {
    console.error(e);
  }
}

// ── CALENDAR SECTION ──
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

async function renderCalendar() {
  el('calendar-month-year').textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevLastDay = new Date(currentYear, currentMonth, 0).getDate();
  
  const grid = el('calendar-days-grid');
  grid.innerHTML = '';
  
  // Fetch calendar events
  let events = [];
  try {
    const res = await apiFetch('/api/events');
    events = await res.json();
  } catch (e) {
    console.error(e);
  }
  
  // Render Prev Month inactive days
  for (let i = firstDayIndex; i > 0; i--) {
    const day = document.createElement('div');
    day.className = 'calendar-day inactive';
    day.innerHTML = `<span class="day-number">${prevLastDay - i + 1}</span>`;
    grid.appendChild(day);
  }
  
  // Render Current Month days
  const today = new Date();
  for (let i = 1; i <= lastDay; i++) {
    const day = document.createElement('div');
    day.className = 'calendar-day';
    
    // Check if day is today
    const isToday = today.getDate() === i && today.getMonth() === currentMonth && today.getFullYear() === currentYear;
    if (isToday) day.classList.add('today');
    
    // Render events inside day
    const dayDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const dayEvents = events.filter(e => e.start_time.startsWith(dayDateStr));
    
    let eventsHtml = '';
    dayEvents.forEach(e => {
      eventsHtml += `<div class="day-event-item" onclick="openEventDetails('${e.id}')">${e.title}</div>`;
    });
    
    day.innerHTML = `
      <span class="day-number">${i}</span>
      <div class="day-events">${eventsHtml}</div>
    `;
    
    day.onclick = (event) => {
      if (event.target.classList.contains('day-event-item')) return;
      Sound.playClick();
      const formattedDay = String(i).padStart(2, '0');
      const formattedMonth = String(currentMonth + 1).padStart(2, '0');
      const datePrefix = `${currentYear}-${formattedMonth}-${formattedDay}`;
      
      const form = el('event-form');
      form.reset();
      el('event-modal-title').textContent = "Add Event";
      el('event-edit-id').value = "";
      el('event-start').value = `${datePrefix}T09:00`;
      el('event-end').value = `${datePrefix}T10:00`;
      el('delete-event-btn').style.display = 'none';
      
      openModal('event-modal');
    };
    
    grid.appendChild(day);
  }
  
  // Navigation listeners
  el('prev-month-btn').onclick = () => {
    Sound.playClick();
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    renderCalendar();
  };
  
  el('next-month-btn').onclick = () => {
    Sound.playClick();
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    renderCalendar();
  };
}

async function openEventDetails(id) {
  try {
    const res = await apiFetch('/api/events');
    const events = await res.json();
    const event = events.find(e => e.id === id);
    if (event) {
      openEventModal(event);
    }
  } catch (e) {
    console.error(e);
  }
}

async function handleEventSubmit(e) {
  e.preventDefault();
  const id = el('event-edit-id').value;
  const title = el('event-title').value;
  const description = el('event-desc').value;
  const location = el('event-loc').value;
  const start = el('event-start').value;
  const end = el('event-end').value;
  const allDay = el('event-allday').checked;
  
  const payload = {
    title,
    description: description || null,
    location: location || null,
    start_time: new Date(start).toISOString(),
    end_time: new Date(end).toISOString(),
    all_day: allDay
  };
  
  const url = id ? `/api/events/${id}` : '/api/events';
  const method = id ? 'PUT' : 'POST';
  
  try {
    const res = await apiFetch(url, {
      method,
      body: payload
    });
    if (res.ok) {
      closeModal('event-modal');
      Sound.playSuccess();
      renderCalendar();
    }
  } catch (e) {
    console.error(e);
  }
}

// ── SETTINGS SUBMIT ──
async function handleSettingsSubmit(e) {
  e.preventDefault();
  const ollama_url = el('set-ollama-url').value;
  const selected_model = el('set-selected-model').value;
  const gmail_address = el('set-gmail-address').value;
  const gmail_app_password = el('set-gmail-password').value;
  const figma_access_token = el('set-figma-token').value;
  const mcp_figma_url = el('set-mcp-figma-url').value;
  const clock_style = el('set-clock-style').value;
  
  const payload = {
    ollama_url: ollama_url || null,
    selected_model: selected_model || null,
    gmail_address: gmail_address || null,
    gmail_app_password: gmail_app_password || null,
    figma_access_token: figma_access_token || null,
    mcp_figma_url: mcp_figma_url || null,
    clock_style: clock_style || 'digital'
  };
  
  try {
    const res = await apiFetch('/api/settings', {
      method: 'POST',
      body: payload
    });
    if (res.ok) {
      alert("Settings saved successfully.");
      Sound.playSuccess();
      currentClockStyle = clock_style;
      renderClockVisibility();
      await fetchModels();
    }
  } catch (e) {
    console.error(e);
  }
}

// ── CHAT AND STREAMING ──
async function loadConversations() {
  try {
    const res = await apiFetch('/api/conversations');
    const conversations = await res.json();
    
    const container = el('conv-list-container');
    container.innerHTML = '';
    
    conversations.forEach(c => {
      const item = document.createElement('div');
      item.className = 'conv-item';
      if (activeConversationId === c.id) item.classList.add('active');
      item.onclick = () => loadMessages(c.id);
      
      item.innerHTML = `
        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${c.title}</span>
        <button class="delete-conv-btn" onclick="event.stopPropagation(); deleteConversation('${c.id}')">&times;</button>
      `;
      container.appendChild(item);
    });
  } catch (e) {
    console.error("Error loading chat conversations:", e);
  }
}

async function loadMessages(convId) {
  activeConversationId = convId;
  Sound.playClick();
  loadConversations(); // refresh active highlight
  
  try {
    const res = await apiFetch(`/api/conversations/${convId}/messages`);
    const messages = await res.json();
    
    const container = el('chat-messages');
    container.innerHTML = '';
    
    messages.forEach(m => {
      const bubble = document.createElement('div');
      bubble.className = `message-bubble ${m.role}`;
      bubble.innerHTML = renderMarkdown(m.content);
      container.appendChild(bubble);
    });
    
    scrollToBottom('chat-messages');
  } catch (e) {
    console.error(e);
  }
}

// Open efforts detailed popup overlay modal
let lastEffortsData = null;
function openEffortsPopup(toolCall, result) {
  Sound.playClick();
  el('efforts-tool-call').textContent = JSON.stringify(toolCall, null, 2);
  el('efforts-tool-result').textContent = JSON.stringify(result, null, 2);
  openModal('efforts-modal');
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const input = el('chat-input');
  const message = input.value.trim();
  if (!message) return;
  
  input.value = '';
  
  // Render user bubble immediately
  const container = el('chat-messages');
  const userBubble = document.createElement('div');
  userBubble.className = 'message-bubble user';
  userBubble.textContent = message;
  container.appendChild(userBubble);
  
  // Render loading assistant bubble
  const assistantBubble = document.createElement('div');
  assistantBubble.className = 'message-bubble assistant';
  assistantBubble.innerHTML = '<em>Mickey is thinking...</em>';
  container.appendChild(assistantBubble);
  
  scrollToBottom('chat-messages');
  
  // Send to streaming endpoint
  const payload = {
    message,
    conversation_id: activeConversationId || null,
    model_name: el('chat-model-select').value || null
  };
  
  try {
    const response = await apiFetch('/api/chat', {
      method: 'POST',
      body: payload
    });
    
    if (!response.body) {
      assistantBubble.textContent = "Error: Streaming is unsupported by server response.";
      return;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    assistantBubble.innerHTML = '';
    
    let fullText = '';
    let effortsStartJson = null;
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      
      // Look for metadata chunk
      if (chunk.includes('__metadata__:')) {
        const metaStr = chunk.split('\n')[0].replace('__metadata__:', '');
        const meta = JSON.parse(metaStr);
        activeConversationId = meta.conversation_id;
        loadConversations();
        continue;
      }
      
      // Handle reasoning efforts block
      if (chunk.includes('__efforts_start__:')) {
        const parts = chunk.split('__efforts_start__:');
        const effortJsonStr = parts[1].split('\n')[0];
        effortsStartJson = JSON.parse(effortJsonStr);
        
        // Append clickable Efforts reasoning line
        const link = document.createElement('div');
        link.className = 'efforts-line';
        link.innerHTML = `<span>🔍 Reasoning: Invoking Mickey tool <strong>"${effortsStartJson.tool}"</strong></span>`;
        link.onclick = () => openEffortsPopup(effortsStartJson, { status: "pending" });
        assistantBubble.appendChild(link);
        scrollToBottom('chat-messages');
        continue;
      }

      if (chunk.includes('__efforts_end__:')) {
        const parts = chunk.split('__efforts_end__:');
        const effortResultStr = parts[1].split('\n')[0];
        const effortsResultJson = JSON.parse(effortResultStr);
        
        // Find the link inside bubble and bind final result
        const links = assistantBubble.querySelectorAll('.efforts-line');
        if (links.length > 0) {
          const lastLink = links[links.length - 1];
          lastLink.innerHTML = `<span>✓ Completed Mickey tool <strong>"${effortsStartJson.tool}"</strong> (view detailed efforts logs)</span>`;
          lastLink.onclick = () => openEffortsPopup(effortsStartJson, effortsResultJson);
        }
        continue;
      }
      
      // Regular response chunk
      fullText += chunk;
      
      // Format text correctly
      const cleanText = fullText.replace(/__efforts_start__:.+?\n/g, '').replace(/__efforts_end__:.+?\n/g, '');
      
      // Append text
      const textSpan = assistantBubble.querySelector('.response-text');
      if (textSpan) {
        textSpan.innerHTML = renderMarkdown(cleanText);
      } else {
        const span = document.createElement('span');
        span.className = 'response-text';
        span.innerHTML = renderMarkdown(cleanText);
        assistantBubble.appendChild(span);
      }
      scrollToBottom('chat-messages');
    }
  } catch (e) {
    assistantBubble.textContent = "Connection failed. Please ensure Ollama is serving on the backend.";
  }
}

function startNewChat() {
  activeConversationId = null;
  el('chat-messages').innerHTML = `
    <div class="system-bubble">
      New conversation started with Mickey. Ask me questions about your tasks, notes, or calendar scheduling.
    </div>
  `;
  loadConversations();
}

async function deleteConversation(id) {
  if (!confirm("Delete this conversation?")) return;
  try {
    await apiFetch(`/api/conversations/${id}`, {method: 'DELETE'});
    if (activeConversationId === id) activeConversationId = null;
    startNewChat();
  } catch (e) {
    console.error(e);
  }
}

// Basic markdown-to-HTML parser for local chat responses
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, '<br>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/```json([\s\S]+?)```/g, '<pre><code class="language-json">$1</code></pre>');
}

function scrollToBottom(id) {
  const c = el(id);
  c.scrollTop = c.scrollHeight;
}

// ── WEATHER AND GMAIL PANEL AND NOTIFICATIONS HELPERS ──
async function loadWeatherForecast() {
  const container = el('dash-weather-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Fetching location...</div>';
  
  if (!navigator.geolocation) {
    fetchWeatherForCoords(51.5074, -0.1278, "London (Default)");
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      fetchWeatherForCoords(lat, lon, "Local Weather");
    },
    (error) => {
      console.warn("Geolocation error, using fallback London:", error);
      fetchWeatherForCoords(51.5074, -0.1278, "London (Fallback)");
    },
    { timeout: 10000 }
  );
}

async function fetchWeatherForCoords(lat, lon, locationLabel) {
  const container = el('dash-weather-container');
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    if (!res.ok) throw new Error("Weather API error");
    const data = await res.json();
    
    const temp = data.current_weather.temperature;
    const code = data.current_weather.weathercode;
    const desc = getWeatherCodeDescription(code);
    const icon = getWeatherCodeIcon(code);
    
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.5rem; padding:1rem; text-align:center; flex:1; width:100%;">
        <span style="font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--text-muted);">${locationLabel}</span>
        <div style="font-size:2.2rem; line-height:1; font-weight:700; color:var(--text-main); margin-top:0.25rem;">
          ${temp}°C
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; font-weight:500; margin-top:0.25rem;">
          <span>${icon}</span>
          <span>${desc}</span>
        </div>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<div class="placeholder-text text-danger">Weather query failed.</div>';
  }
}

function getWeatherCodeDescription(code) {
  if (code === 0) return "Clear Sky";
  if (code >= 1 && code <= 3) return "Partly Cloudy";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rainy";
  if (code >= 71 && code <= 77) return "Snowy";
  if (code >= 80 && code <= 82) return "Rain Showers";
  if (code >= 95) return "Thunderstorm";
  return "Cloudy";
}

function getWeatherCodeIcon(code) {
  if (code === 0) return "☀️";
  if (code >= 1 && code <= 3) return "⛅";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 57) return "🌧️";
  if (code >= 61 && code <= 67) return "🌧️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "☁️";
}

async function loadGmailPanel() {
  const gmailList = el('gmail-inbox-list');
  gmailList.innerHTML = '<div class="loading-state">Syncing Gmail IMAP...</div>';
  try {
    const res = await apiFetch('/api/gmail/recent?limit=15');
    const data = await res.json();
    gmailList.innerHTML = '';
    
    if (data.emails && data.emails.length > 0) {
      data.emails.forEach(item => {
        if (item.error) {
          gmailList.innerHTML = `
            <div class="placeholder-text text-danger" style="flex-direction: column; gap: 0.4rem; padding: 1.5rem; text-align: center;">
              <strong>${item.error}</strong>
              ${item.snippet ? `<span style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; max-width: 80%; margin-top: 0.2rem;">${item.snippet}</span>` : ''}
            </div>`;
          return;
        }
        
        const senderName = item.from.split('<')[0].replace(/['"]/g, '').trim();
        const initial = senderName ? senderName.charAt(0).toUpperCase() : 'M';
        
        const card = document.createElement('div');
        card.className = 'gmail-panel-item';
        card.innerHTML = `
          <div class="gmail-avatar">${initial}</div>
          <div class="gmail-item-content">
            <div class="gmail-item-header">
              <span class="gmail-item-sender">${item.from}</span>
              <span class="gmail-item-date">${item.date}</span>
            </div>
            <div class="gmail-item-subject">${item.subject}</div>
            <div class="gmail-item-snippet">${item.snippet}</div>
          </div>
        `;
        gmailList.appendChild(card);
      });
    } else {
      gmailList.innerHTML = '<div class="placeholder-text">Inbox feed is empty.</div>';
    }
  } catch (e) {
    gmailList.innerHTML = '<div class="placeholder-text text-danger">Gmail Sync Failed.</div>';
  }
}

function updateNotifications() {
  const notifList = el('notification-list');
  const notifBadge = el('notification-badge');
  if (!notifList) return;
  notifList.innerHTML = '';
  
  const alerts = [];
  const now = new Date();
  
  allTasks.forEach(t => {
    if (t.status === 'pending' && t.due_date) {
      const due = new Date(t.due_date);
      if (due < now) {
        alerts.push({
          title: `Overdue Task`,
          desc: `${t.title} (due ${due.toLocaleDateString()})`
        });
      } else if (due.toDateString() === now.toDateString()) {
        alerts.push({
          title: `Task Due Today`,
          desc: `${t.title} at ${due.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
        });
      }
    }
  });

  if (alerts.length === 0) {
    notifList.innerHTML = '<div class="notif-empty">No pending works or notifications.</div>';
    notifBadge.style.display = 'none';
  } else {
    notifBadge.style.display = 'flex';
    notifBadge.textContent = alerts.length;
    
    alerts.forEach(alert => {
      const div = document.createElement('div');
      div.className = 'notif-item';
      div.innerHTML = `
        <span class="notif-title">${alert.title}</span>
        <span class="notif-desc">${alert.desc}</span>
      `;
      notifList.appendChild(div);
    });
  }
}

async function deleteEvent(id) {
  if (!confirm("Are you sure you want to delete this event?")) return;
  try {
    const res = await apiFetch(`/api/events/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      closeModal('event-modal');
      Sound.playClick();
      renderCalendar();
    }
  } catch(e) {
    console.error(e);
  }
}
