// Mickey AI Productivity Workspace - Main Client Script

let currentTab = 'chat'; // AI Assistant is the default home tab
let activeConversationId = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let availableModels = [];
let activeWorkspaceMode = localStorage.getItem('mickey_mode') || 'work';

// Dynamic System Names
let currentSystemName = 'Mickey';
let currentAssistantName = 'Cookie';

// MS To-Do active states
let selectedTask = null;
let currentSort = 'default'; // 'default', 'priority', 'alphabetical', 'due'
let currentFilter = 'all';    // 'all', 'high', 'medium', 'low', 'myday', 'pending', 'completed'
let currentView = 'list'; // 'list', 'grid'

// Ecosystem Screen Time deltas
let lastActivityTime = Date.now();
let idleThreshold = 600000; // 10 minutes default (can be updated dynamically)
let syncActiveDelta = 0;
let syncIdleDelta = 0;
let syncLockedDelta = 0;
let syncSleepDelta = 0;

let syncFocusDelta = 0;
let syncLearningDelta = 0;
let syncBreakDelta = 0;
let lastTickTime = Date.now();

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
  
  // GitHub integration bindings
  el('btn-github-validate').addEventListener('click', validateAndConnectGitHub);
  el('btn-github-disconnect').addEventListener('click', disconnectGitHub);
  if (el('refresh-dash-github-btn')) {
    el('refresh-dash-github-btn').addEventListener('click', () => { Sound.playClick(); loadGitHubDashboardWidget(); });
  }


  
  // Setup GitHub interactive bindings
  setupGitHubPanelBindings();

  
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

  // Initialize Jira, MCP, and Logs bindings and sidebar indicators
  setupJiraPanelBindings();
  setupMcpPanelBindings();
  setupLogsPanelBindings();
  updateSidebarActiveMcps();

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

  // Programmatic click helpers for pickers
  el('details-due-btn').addEventListener('click', (e) => {
    if (e.target !== el('details-due-input')) {
      Sound.playClick();
      el('details-due-input').showPicker();
    }
  });
  el('details-remind-btn').addEventListener('click', (e) => {
    if (e.target !== el('details-remind-input')) {
      Sound.playClick();
      el('details-remind-input').showPicker();
    }
  });
  el('details-repeat-btn').addEventListener('click', (e) => {
    if (e.target !== el('details-repeat-select')) {
      Sound.playClick();
      el('details-repeat-select').showPicker();
    }
  });

  // Todo filter sorting Popover toggling
  el('todo-sort-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    Sound.playClick();
    const menu = el('todo-sort-menu');
    const isHidden = menu.style.display === 'none';
    menu.style.display = isHidden ? 'flex' : 'none';
  });

  document.addEventListener('click', () => {
    const menu = el('todo-sort-menu');
    if (menu) menu.style.display = 'none';
  });

  // Bind dropdown filter/sort clicks
  document.querySelectorAll('#todo-sort-menu .sort-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      Sound.playClick();
      el('todo-sort-menu').style.display = 'none';
      
      const sortVal = item.getAttribute('data-sort');
      const filterVal = item.getAttribute('data-filter');
      
      if (sortVal) {
        currentSort = sortVal;
      }
      if (filterVal) {
        currentFilter = filterVal;
      }
      
      const sortLabel = currentSort === 'default' ? 'Default' : 
                        currentSort === 'priority' ? 'Priority' : 
                        currentSort === 'alphabetical' ? 'A-Z' : 'Due';
      const filterLabel = currentFilter === 'all' ? 'All' :
                          currentFilter === 'high' ? 'High' :
                          currentFilter === 'medium' ? 'Medium' :
                          currentFilter === 'low' ? 'Low' :
                          currentFilter === 'myday' ? 'My Day' :
                          currentFilter === 'pending' ? 'Pending' : 'Completed';
      
      el('todo-sort-btn').querySelector('span').textContent = `Sort: ${sortLabel} | Filter: ${filterLabel}`;
      renderTasksList(allTasks);
    });
  });

  // Analytics toggle button listeners
  document.querySelectorAll('.analytics-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.playClick();
      document.querySelector('.analytics-toggle-btn.active').classList.remove('active');
      btn.classList.add('active');
      loadAnalyticsPage(btn.getAttribute('data-view'));
    });
  });

  // Background active tracking event listeners
  const recordActivity = () => { lastActivityTime = Date.now(); };
  window.addEventListener('mousemove', recordActivity);
  window.addEventListener('keydown', recordActivity);
  window.addEventListener('click', recordActivity);
  window.addEventListener('scroll', recordActivity);

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

  // Water reminder checkbox toggle
  el('set-water-enabled').addEventListener('change', (e) => {
    el('water-interval-group').style.display = e.target.checked ? 'block' : 'none';
  });

  // Settings view categories toggles initial state
  setupSettingsToggles();

  // Task repeat select listener
  el('details-repeat-select').addEventListener('change', async (e) => {
    if (!selectedTask) return;
    Sound.playClick();
    let detailsData = { notes: "", steps: [], is_myday: false };
    if (selectedTask.description && selectedTask.description.startsWith('{')) {
      try { detailsData = JSON.parse(selectedTask.description); } catch(err){}
    } else {
      detailsData.notes = selectedTask.description || "";
    }
    detailsData.repeat = e.target.value;
    
    const repeatVal = e.target.value;
    const repeatLabel = repeatVal === 'none' ? 'Repeat' : `Repeat: ${repeatVal.charAt(0).toUpperCase() + repeatVal.slice(1)}`;
    el('details-repeat-text').textContent = repeatLabel;
    
    await saveUpdatedTaskDescription(detailsData);
  });

  // Apply saved dashboard widgets order and set up drag-and-drop
  applyDashboardWidgetsOrder();
  setupDragAndDrop();

  // Start background tracking loops
  setInterval(tickScreenTime, 1000);
  setInterval(syncEcosystemData, 30000);
  window.addEventListener('beforeunload', syncEcosystemData);
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
    applyDashboardWidgetsOrder();
    loadDashboardData();
    loadConversations();
    loadTasks();
    loadNotes();
    renderCalendar();
    fetchSettings();
    updateSidebarActiveMcps();
    if (currentTab === 'jira') loadJiraPanel();
    if (currentTab === 'mcp') loadMcpPanel();
    if (currentTab === 'logs') loadLogsPanel();
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
      const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: currentClockFormat === '12hr'
      };
      localClock.textContent = now.toLocaleTimeString(undefined, timeOptions);
      el('clock-est').textContent = estDate.toLocaleTimeString(undefined, timeOptions);
      el('clock-london').textContent = londonDate.toLocaleTimeString(undefined, timeOptions);
      el('clock-jst').textContent = jstDate.toLocaleTimeString(undefined, timeOptions);
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
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim() || '#ffffff';
  ctx.fill();
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw center point
  ctx.beginPath();
  ctx.arc(radius, radius, 3, 0, 2 * Math.PI);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6366f1';
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
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || '#6366f1';
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
  const widgets = ["clocks", "tasks", "events", "gmail", "github", "figma", "notes", "weather", "ecosystem"];
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
  const widgets = ["clocks", "tasks", "events", "gmail", "github", "figma", "notes", "weather", "ecosystem"];
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
  const widgets = ["clocks", "tasks", "events", "gmail", "github", "figma", "notes", "weather", "ecosystem"];
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
  if (tabId === 'github') loadGitHubPanel();
  if (tabId === 'jira') loadJiraPanel();
  if (tabId === 'mcp') loadMcpPanel();
  if (tabId === 'logs') loadLogsPanel();
  if (tabId === 'ecosystem') loadEcosystemPage();
  if (tabId === 'analytics') loadAnalyticsPage();
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
    
    // Extract color tag and remove it from tags input value
    let tagsList = note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    let noteColor = '#fef08a'; // default
    const plainTags = [];
    tagsList.forEach(t => {
      if (t.startsWith('color:')) {
        noteColor = t.replace('color:', '');
      } else {
        plainTags.push(t);
      }
    });
    
    el('note-tags').value = plainTags.join(', ');
    
    // Select the correct radio color option
    const radio = document.querySelector(`input[name="note-color"][value="${noteColor}"]`);
    if (radio) {
      radio.checked = true;
    }
  } else {
    el('note-modal-title').textContent = "New Note";
    el('note-edit-id').value = "";
    // select default yellow radio color
    const defaultRadio = document.querySelector('input[name="note-color"][value="#fef08a"]');
    if (defaultRadio) {
      defaultRadio.checked = true;
    }
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

async function updateGitHubStatusDisplay(token, mcpUrl) {
  const valEl = el('github-status-val');
  if (!valEl) return;
  if (!token && !mcpUrl) {
    valEl.textContent = "Disconnected";
    valEl.style.color = "var(--text-muted)";
    return;
  }
  
  valEl.textContent = "Checking...";
  valEl.style.color = "var(--warning)";
  
  try {
    const res = await apiFetch('/api/github/validate', {
      method: 'POST',
      body: {
        github_access_token: token || null,
        mcp_github_url: mcpUrl || null
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'connected') {
        valEl.textContent = data.username ? `Connected as ${data.username}` : "Connected";
        valEl.style.color = "var(--success)";
      } else {
        valEl.textContent = "Connection Error";
        valEl.style.color = "var(--danger)";
      }
    } else {
      valEl.textContent = "Error";
      valEl.style.color = "var(--danger)";
    }
  } catch (e) {
    valEl.textContent = "Network Error";
    valEl.style.color = "var(--danger)";
  }
}

// Global clock style variable
let currentClockStyle = 'digital';
let currentClockFormat = '12hr';

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
    
    // GitHub inputs
    el('set-github-token').value = data.github_access_token || '';
    el('set-mcp-github-url').value = data.mcp_github_url || '';
    updateGitHubStatusDisplay(data.github_access_token, data.mcp_github_url);

    // If an external MCP server is configured for an integration, hide the corresponding Settings card
    try {
      if (data.mcp_github_url) {
        const githubCard = el('set-github-token')?.closest('.settings-card');
        if (githubCard) githubCard.style.display = 'none';
      }
    } catch(e){}
    try {
      if (data.mcp_figma_url) {
        const figmaCard = el('set-figma-token')?.closest('.settings-card');
        if (figmaCard) figmaCard.style.display = 'none';
      }
    } catch(e){}

    // If Jira is connected via MCP, hide Jira settings (double-check via /api/jira/config)
    try {
      const jiraCfgRes = await apiFetch('/api/jira/config');
      if (jiraCfgRes.ok) {
        const jiraCfg = await jiraCfgRes.json();
        if (jiraCfg.status === 'connected') {
          const jiraCard = el('set-jira-url')?.closest('.settings-card');
          if (jiraCard) jiraCard.style.display = 'none';
        }
      }
    } catch(e) {}

    currentClockStyle = data.clock_style || 'digital';
    el('set-clock-style').value = currentClockStyle;
    currentClockFormat = data.clock_format || '12hr';
    el('set-clock-format').value = currentClockFormat;
    renderClockVisibility();
    
    // Hydration break inputs
    el('set-water-enabled').checked = data.water_reminder_enabled || false;
    el('set-water-interval').value = data.water_reminder_interval || 60;
    el('water-interval-group').style.display = data.water_reminder_enabled ? 'block' : 'none';
    setupWaterReminder(data.water_reminder_enabled, data.water_reminder_interval);

    currentSystemName = data.system_name || 'Mickey';
    currentAssistantName = data.assistant_name || 'Cookie';
    applyRenamingUI();
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
    
    // Render dashboard tasks widget with completion checkboxes
    const tasksCont = el('dash-tasks-container');
    tasksCont.innerHTML = '';
    if (!data.tasks.length) {
      tasksCont.innerHTML = '<div class="placeholder-text">All caught up! No pending tasks.</div>';
    } else {
      data.tasks.forEach(t => {
        const item = document.createElement('div');
        item.className = 'dash-task-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';
        
        const isCompleted = t.status === 'completed';
        const checkedAttr = isCompleted ? 'checked' : '';
        
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:0.5rem; flex:1; min-width:0;">
            <input type="checkbox" class="todo-circle-check" ${checkedAttr} onclick="event.stopPropagation(); toggleTaskCompleteDirect('${t.id}', '${t.status}')">
            <span class="dash-task-title ${isCompleted ? 'completed' : ''}" style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; ${isCompleted ? 'text-decoration: line-through; opacity: 0.6;' : ''}">${t.title}</span>
          </div>
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
    
    // Update Ecosystem Dashboard Widget
    loadDashboardEcosystemWidget();
    
    // Update GitHub Dashboard Widget
    loadGitHubDashboardWidget();
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
        div.style.cursor = 'pointer';
        div.onclick = () => {
          Sound.playClick();
          window.open(`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(item.subject)}`, '_blank');
        };
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
  
  // Filter tasks based on currentFilter
  let filteredTasks = [...tasks];
  if (currentFilter !== 'all') {
    if (['high', 'medium', 'low'].includes(currentFilter)) {
      filteredTasks = filteredTasks.filter(t => t.priority === currentFilter);
    } else if (currentFilter === 'myday') {
      filteredTasks = filteredTasks.filter(t => {
        let detailsData = {};
        if (t.description && t.description.startsWith('{')) {
          try { detailsData = JSON.parse(t.description); } catch(e){}
        }
        return !!detailsData.is_myday;
      });
    } else if (currentFilter === 'pending') {
      filteredTasks = filteredTasks.filter(t => t.status === 'pending');
    } else if (currentFilter === 'completed') {
      filteredTasks = filteredTasks.filter(t => t.status === 'completed');
    }
  }

  // Separate tasks
  const pendingTasks = filteredTasks.filter(t => t.status === 'pending');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');
  
  // Sort function helper based on currentSort
  const sortTasks = (list) => {
    if (currentSort === 'priority') {
      const priorityWeight = { 'high': 3, 'medium': 2, 'low': 1 };
      list.sort((a, b) => (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2));
    } else if (currentSort === 'alphabetical') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentSort === 'due') {
      list.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });
    } else {
      // default: new created first
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
  };
  
  sortTasks(pendingTasks);
  sortTasks(completedTasks);
  
  if (currentView === 'grid') {
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(auto-fill, minmax(240px, 1fr))';
    container.style.gap = '1rem';
  } else {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '0.5rem';
  }

  const renderRow = (t) => {
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
    return row;
  };

  // Render pending tasks
  if (pendingTasks.length === 0 && completedTasks.length === 0) {
    container.innerHTML = '<div class="loading-state">No tasks. Type a task name above and press Enter.</div>';
    return;
  }
  
  pendingTasks.forEach(t => {
    container.appendChild(renderRow(t));
  });
  
  // Render completed tasks section
  if (completedTasks.length > 0) {
    const header = document.createElement('div');
    header.className = 'completed-tasks-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '0.5rem';
    header.style.marginTop = '1.5rem';
    header.style.marginBottom = '0.5rem';
    header.style.cursor = 'pointer';
    header.style.fontWeight = '600';
    header.style.fontSize = '0.9rem';
    header.style.color = 'var(--text-muted)';
    header.onclick = (e) => {
      e.stopPropagation();
      toggleCompletedGroup();
    };
    
    header.innerHTML = `
      <svg class="chevron-icon" style="transform: rotate(${completedGroupCollapsed ? '-90deg' : '0deg'}); transition: transform 0.2s;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      <span>Completed (${completedTasks.length})</span>
    `;
    container.appendChild(header);
    
    if (!completedGroupCollapsed) {
      completedTasks.forEach(t => {
        container.appendChild(renderRow(t));
      });
    }
  }
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
    syncFocusDelta += 10;
  } else {
    Sound.playClick();
  }

  try {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: { status: newStatus }
    });
    
    if (newStatus === 'completed') {
      const task = allTasks.find(t => t.id === id);
      if (task) {
        await handleTaskRepeat(task);
      }
    }
    
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

  // Repeat text
  const repeatVal = detailsData.repeat || "none";
  el('details-repeat-select').value = repeatVal;
  const repeatLabel = repeatVal === 'none' ? 'Repeat' : `Repeat: ${repeatVal.charAt(0).toUpperCase() + repeatVal.slice(1)}`;
  el('details-repeat-text').textContent = repeatLabel;

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
      
      // Render tags and extract color
      let noteColor = null;
      let tagsHtml = '';
      if (n.tags) {
        n.tags.split(',').forEach(t => {
          const trimmed = t.trim();
          if (trimmed.startsWith('color:')) {
            noteColor = trimmed.replace('color:', '');
          } else if (trimmed) {
            tagsHtml += `<span class="tag">#${trimmed}</span>`;
          }
        });
      }
      
      if (noteColor) {
        card.style.backgroundColor = noteColor;
        card.style.color = '#0f172a';
      }
      
      card.innerHTML = `
        <div>
          <h3 ${noteColor ? 'style="color:#0f172a !important;"' : ''}>${n.title}</h3>
          <p ${noteColor ? 'style="color:#334155 !important;"' : ''}>${contentDisplay}</p>
        </div>
        <div class="note-footer" ${noteColor ? 'style="color:#475569 !important;"' : ''}>
          <div class="note-tags-wrap">${tagsHtml}</div>
          <span>Updated ${updated}</span>
          <button class="btn-text-danger" ${noteColor ? 'style="color:#991b1b !important;"' : ''} onclick="event.stopPropagation(); deleteNote('${n.id}')">Delete</button>
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
  const tagsInput = el('note-tags').value;
  
  // Get selected color radio button
  const colorRadio = document.querySelector('input[name="note-color"]:checked');
  const selectedColor = colorRadio ? colorRadio.value : '#fef08a';
  
  // Combine tagsInput with color tag
  let tagsList = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
  tagsList = tagsList.filter(t => !t.startsWith('color:'));
  tagsList.push(`color:${selectedColor}`);
  const tags = tagsList.join(', ');
  
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
      if (method === 'POST') {
        syncLearningDelta += 15;
      }
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

async function handleSettingsSubmit(e) {
  e.preventDefault();
  const ollama_url = el('set-ollama-url').value;
  const selected_model = el('set-selected-model').value;
  const figma_access_token = el('set-figma-token').value;
  const mcp_figma_url = el('set-mcp-figma-url').value;
  const clock_style = el('set-clock-style').value;
  const clock_format = el('set-clock-format').value;
  const water_reminder_enabled = el('set-water-enabled').checked;
  const water_reminder_interval = parseInt(el('set-water-interval').value) || 60;
  
  const system_name = el('set-system-name').value.trim() || 'Mickey';
  const assistant_name = el('set-assistant-name').value.trim() || 'Cookie';

  const github_access_token = el('set-github-token').value;
  const mcp_github_url = el('set-mcp-github-url').value;

  const payload = {
    ollama_url: ollama_url || null,
    selected_model: selected_model || null,
    figma_access_token: figma_access_token || null,
    mcp_figma_url: mcp_figma_url || null,
    clock_style: clock_style || 'digital',
    clock_format: clock_format || '12hr',
    water_reminder_enabled,
    water_reminder_interval,
    system_name,
    assistant_name,
    github_access_token: github_access_token || null,
    mcp_github_url: mcp_github_url || null
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
      currentClockFormat = clock_format;
      renderClockVisibility();
      setupWaterReminder(water_reminder_enabled, water_reminder_interval);
      currentSystemName = system_name;
      currentAssistantName = assistant_name;
      applyRenamingUI();
      updateGitHubStatusDisplay(github_access_token, mcp_github_url);
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
  syncLearningDelta += 5;
  
  // Render user bubble immediately
  const container = el('chat-messages');
  const userBubble = document.createElement('div');
  userBubble.className = 'message-bubble user';
  userBubble.textContent = message;
  container.appendChild(userBubble);
  
  // Render loading assistant bubble with bouncing loading dots
  const assistantBubble = document.createElement('div');
  assistantBubble.className = 'message-bubble assistant';
  assistantBubble.innerHTML = `
    <div class="typing-indicator" style="display:inline-flex;">
      <span></span>
      <span></span>
      <span></span>
    </div>
    <span style="font-size:0.75rem; color:var(--text-muted); margin-left:0.5rem;">${currentAssistantName} is thinking...</span>
  `;
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
    
    if (!response.ok || !response.body) {
      assistantBubble.innerHTML = "Error: Streaming is unsupported or server returned error.";
      return;
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let fullText = '';
    let effortsStartJson = null;
    let clearedIndicator = false;
    
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
      
      // Clear the typing dots indicator on the first actual content chunk
      if (!clearedIndicator) {
        assistantBubble.innerHTML = '';
        clearedIndicator = true;
      }
      
      // Handle reasoning efforts block
      if (chunk.includes('__efforts_start__:')) {
        const parts = chunk.split('__efforts_start__:');
        const effortJsonStr = parts[1].split('\n')[0];
        effortsStartJson = JSON.parse(effortJsonStr);
        
        // Append clickable Efforts reasoning line
        const link = document.createElement('div');
        link.className = 'efforts-line';
        link.innerHTML = `<span>🔍 Reasoning: Invoking tool <strong>"${effortsStartJson.tool}"</strong></span>`;
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
          lastLink.innerHTML = `<span>✓ Completed tool <strong>"${effortsStartJson.tool}"</strong> (view detailed efforts logs)</span>`;
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
    assistantBubble.innerHTML = "Connection failed. Please ensure Ollama is serving on the backend.";
  }
}

function startNewChat() {
  activeConversationId = null;
  el('chat-messages').innerHTML = `
    <div class="system-bubble">
      New conversation started with ${currentAssistantName}. Ask me questions about your tasks, notes, or calendar scheduling.
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
        card.style.cursor = 'pointer';
        card.onclick = () => {
          Sound.playClick();
          window.open(`https://mail.google.com/mail/u/0/#search/${encodeURIComponent(item.subject)}`, '_blank');
        };
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

// ── HYDRATION REMINDER SCHEDULER ──
let waterReminderTimer = null;

function setupWaterReminder(enabled, intervalMinutes) {
  if (waterReminderTimer) {
    clearInterval(waterReminderTimer);
    waterReminderTimer = null;
  }
  
  if (!enabled || !intervalMinutes || intervalMinutes <= 0) return;
  
  const intervalMs = intervalMinutes * 60 * 1000;
  
  waterReminderTimer = setInterval(() => {
    triggerHydrationBreak();
  }, intervalMs);
}

function triggerHydrationBreak() {
  if (isFocusMode) {
    console.log("Hydration alarm muted/suppressed during Teams Focus Mode");
    return;
  }
  Sound.playSuccess();
  
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '1.5rem';
    container.style.right = '1.5rem';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '0.75rem';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = 'notif-toast';
  toast.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.25rem;">
      <strong style="font-weight:600; color:var(--primary);">Hydration Break! 💧</strong>
      <button type="button" class="close-toast-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.15rem;">&times;</button>
    </div>
    <span style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem;">Did you hydrate just now?</span>
    <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
      <button class="toast-btn toast-btn-no" style="background:var(--bg-app); border:1px solid var(--border); color:var(--text-muted); padding:0.25rem 0.6rem; font-size:0.75rem; border-radius:var(--radius); cursor:pointer; font-weight:500;">No</button>
      <button class="toast-btn toast-btn-yes" style="background:var(--primary); border:none; color:white; padding:0.25rem 0.6rem; font-size:0.75rem; border-radius:var(--radius); cursor:pointer; font-weight:500;">Yes (+10 pts)</button>
    </div>
  `;
  
  const closeBtn = toast.querySelector('.close-toast-btn');
  const yesBtn = toast.querySelector('.toast-btn-yes');
  const noBtn = toast.querySelector('.toast-btn-no');
  
  const dismissToast = () => {
    toast.style.animation = 'toast-slide-out 0.3s ease forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  };
  
  closeBtn.onclick = dismissToast;
  
  yesBtn.addEventListener('click', async () => {
    syncBreakDelta += 10;
    Sound.playSuccess();
    dismissToast();
    await syncEcosystemData();
  });
  
  noBtn.addEventListener('click', () => {
    Sound.playClick();
    dismissToast();
  });
  
  container.appendChild(toast);
}

// ── COMPLETED GROUPING & DIRECT CHECKOFFS ──
let completedGroupCollapsed = localStorage.getItem('mickey_completed_collapsed') === 'true';

function toggleCompletedGroup() {
  completedGroupCollapsed = !completedGroupCollapsed;
  localStorage.setItem('mickey_completed_collapsed', completedGroupCollapsed);
  Sound.playClick();
  renderTasksList(allTasks);
}

async function toggleTaskCompleteDirect(id, currentStatus) {
  const newStatus = currentStatus === 'pending' ? 'completed' : 'pending';
  if (newStatus === 'completed') {
    Sound.playComplete();
    syncFocusDelta += 10;
  } else {
    Sound.playClick();
  }
  try {
    await apiFetch(`/api/tasks/${id}`, {
      method: 'PUT',
      body: { status: newStatus }
    });
    
    if (newStatus === 'completed') {
      const task = allTasks.find(t => t.id === id);
      if (task) {
        await handleTaskRepeat(task);
      } else {
        try {
          const res = await apiFetch('/api/tasks');
          const tasks = await res.json();
          const t = tasks.find(item => item.id === id);
          if (t) await handleTaskRepeat(t);
        } catch (err){}
      }
    }
    
    loadDashboardData();
    if (currentTab === 'tasks') {
      loadTasks();
    }
  } catch (e) {
    console.error(e);
  }
}

// ── DRAG AND DROP WIDGETS REORDERING ──
function setupDragAndDrop() {
  const grid = el('dashboard-widgets-grid');
  if (!grid) return;
  
  const cards = grid.querySelectorAll('.dashboard-card');
  cards.forEach(card => {
    card.setAttribute('draggable', 'true');
    
    card.addEventListener('dragstart', (e) => {
      card.classList.add('drag-active');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.id);
    });
    
    card.addEventListener('dragend', () => {
      card.classList.remove('drag-active');
      saveDashboardWidgetsOrder();
    });
    
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const draggingCard = grid.querySelector('.drag-active');
      if (draggingCard && draggingCard !== card) {
        const children = Array.from(grid.children);
        const draggingIdx = children.indexOf(draggingCard);
        const targetIdx = children.indexOf(card);
        
        if (draggingIdx < targetIdx) {
          grid.insertBefore(draggingCard, card.nextSibling);
        } else {
          grid.insertBefore(draggingCard, card);
        }
      }
    });
  });
}

function saveDashboardWidgetsOrder() {
  const grid = el('dashboard-widgets-grid');
  if (!grid) return;
  const cards = Array.from(grid.children);
  const orderIds = cards.map(c => c.id);
  localStorage.setItem(`mickey_dashboard_order_${activeWorkspaceMode}`, JSON.stringify(orderIds));
}

function applyDashboardWidgetsOrder() {
  const grid = el('dashboard-widgets-grid');
  if (!grid) return;
  
  const savedOrder = localStorage.getItem(`mickey_dashboard_order_${activeWorkspaceMode}`);
  if (!savedOrder) return;
  
  try {
    const orderIds = JSON.parse(savedOrder);
    const cards = Array.from(grid.children);
    orderIds.forEach(id => {
      const card = cards.find(c => c.id === id);
      if (card) {
        grid.appendChild(card);
      }
    });
  } catch (e) {
    console.error("Failed to parse saved widget order", e);
  }
}

// ── CUSTOM DYNAMIC RENAME & ECOSYSTEM TELEMETRY SYSTEM ──

function applyRenamingUI() {
  document.title = `${currentSystemName} Workspace`;
  
  const sidebarLogo = document.querySelector('.logo > span');
  if (sidebarLogo) sidebarLogo.textContent = currentSystemName;
  
  const gatewayLogo = document.querySelector('.bio-logo > span');
  if (gatewayLogo) gatewayLogo.textContent = `${currentSystemName} Gateway`;
  
  const activeChatTitle = el('active-chat-title');
  if (activeChatTitle) activeChatTitle.textContent = currentAssistantName;
  
  const chatInput = el('chat-input');
  if (chatInput) chatInput.placeholder = `Ask ${currentAssistantName} workspace agent...`;
  
  const setSystemName = el('set-system-name');
  if (setSystemName && document.activeElement !== setSystemName) {
    setSystemName.value = currentSystemName;
  }
  const setAssistantName = el('set-assistant-name');
  if (setAssistantName && document.activeElement !== setAssistantName) {
    setAssistantName.value = currentAssistantName;
  }

  const systemBubble = document.querySelector('#chat-messages .system-bubble');
  if (systemBubble && systemBubble.textContent.includes('Welcome to your self-hosted AI Assistant')) {
    systemBubble.innerHTML = `
      Welcome to your self-hosted AI Assistant ${currentAssistantName}! I can help you manage your daily productivity. Ask me things like:
      <ul>
        <li>"What tasks are due today?"</li>
        <li>"Summarize my notes."</li>
        <li>"Create a task to review the Figma project on Friday."</li>
        <li>"List recent emails from Gmail."</li>
      </ul>
    `;
  }
}

function tickScreenTime() {
  const now = Date.now();
  const deltaMs = now - lastTickTime;
  lastTickTime = now;
  
  const deltaSec = Math.round(deltaMs / 1000);
  if (deltaSec <= 0) return;

  if (deltaSec > 5) {
    syncSleepDelta += deltaSec;
    lastActivityTime = now;
    return;
  }

  const isSessionActive = sessionStorage.getItem('mickey_session_active') === 'true';
  const bioGateway = el('biometric-gateway');
  const isLocked = !isSessionActive || (bioGateway && bioGateway.style.display !== 'none');
  
  if (isLocked) {
    syncLockedDelta += deltaSec;
    return;
  }

  const idleTimeMs = now - lastActivityTime;
  if (idleTimeMs >= idleThreshold) {
    syncIdleDelta += deltaSec;
  } else {
    syncActiveDelta += deltaSec;
  }
}

async function syncEcosystemData() {
  if (syncActiveDelta === 0 && 
      syncIdleDelta === 0 && 
      syncLockedDelta === 0 && 
      syncSleepDelta === 0 && 
      syncFocusDelta === 0 && 
      syncLearningDelta === 0 && 
      syncBreakDelta === 0) {
    return;
  }

  const payload = {
    active_time: syncActiveDelta,
    idle_time: syncIdleDelta,
    locked_time: syncLockedDelta,
    sleep_time: syncSleepDelta,
    focus_delta: syncFocusDelta,
    learning_delta: syncLearningDelta,
    break_delta: syncBreakDelta
  };

  syncActiveDelta = 0;
  syncIdleDelta = 0;
  syncLockedDelta = 0;
  syncSleepDelta = 0;
  syncFocusDelta = 0;
  syncLearningDelta = 0;
  syncBreakDelta = 0;

  try {
    const res = await apiFetch('/api/ecosystem/sync', {
      method: 'POST',
      body: payload
    });
    if (res.ok) {
      console.log("Ecosystem data synced.");
      if (currentTab === 'ecosystem') {
        loadEcosystemPage();
      } else if (currentTab === 'analytics') {
        loadAnalyticsPage();
      } else if (currentTab === 'dashboard') {
        loadDashboardData();
      }
    } else {
      syncActiveDelta += payload.active_time;
      syncIdleDelta += payload.idle_time;
      syncLockedDelta += payload.locked_time;
      syncSleepDelta += payload.sleep_time;
      syncFocusDelta += payload.focus_delta;
      syncLearningDelta += payload.learning_delta;
      syncBreakDelta += payload.break_delta;
    }
  } catch (e) {
    console.error("Failed to sync ecosystem:", e);
    syncActiveDelta += payload.active_time;
    syncIdleDelta += payload.idle_time;
    syncLockedDelta += payload.locked_time;
    syncSleepDelta += payload.sleep_time;
    syncFocusDelta += payload.focus_delta;
    syncLearningDelta += payload.learning_delta;
    syncBreakDelta += payload.break_delta;
  }
}

function getStageInfo(activeHours) {
  const STAGES = [
    { name: "Seed", emoji: "🌱", hours: 0 },
    { name: "Sprout", emoji: "🌿", hours: 5 },
    { name: "Grassland", emoji: "🌾", hours: 10 },
    { name: "Small Garden", emoji: "🌳", hours: 20 },
    { name: "Garden", emoji: "🌲", hours: 40 },
    { name: "Park", emoji: "🌴", hours: 60 },
    { name: "Village", emoji: "🏡", hours: 80 },
    { name: "Town", emoji: "🏘️", hours: 100 },
    { name: "Forest", emoji: "🌳", hours: 140 },
    { name: "Valley", emoji: "🏞️", hours: 180 },
    { name: "Continent", emoji: "🌍", hours: 220 },
    { name: "Ecosystem World", emoji: "🌎", hours: 240 }
  ];

  let currentIdx = 0;
  for (let i = 0; i < STAGES.length; i++) {
    if (activeHours >= STAGES[i].hours) {
      currentIdx = i;
    }
  }

  const currentStage = STAGES[currentIdx];
  let progress = 100;
  let nextText = "Fully evolved!";
  
  if (currentIdx < STAGES.length - 1) {
    const nextStage = STAGES[currentIdx + 1];
    progress = ((activeHours - currentStage.hours) / (nextStage.hours - currentStage.hours)) * 100;
    progress = Math.min(100, Math.max(0, progress));
    nextText = `Next Stage: ${nextStage.name} at ${nextStage.hours} hours`;
  }

  return {
    name: currentStage.name,
    emoji: currentStage.emoji,
    progress: progress,
    nextText: nextText
  };
}

async function loadEcosystemPage() {
  try {
    const res = await apiFetch('/api/ecosystem/status');
    const data = await res.json();
    
    const isSessionActive = sessionStorage.getItem('mickey_session_active') === 'true';
    const isLocked = !isSessionActive || (el('biometric-gateway') && el('biometric-gateway').style.display !== 'none');
    const isIdle = (Date.now() - lastActivityTime >= idleThreshold);
    
    let statusText = "🟢 Growing";
    if (isLocked) statusText = "⏸ Paused (Locked)";
    else if (isIdle) statusText = "⏸ Paused (Idle)";
    
    if (el('ecosystem-growth-status')) {
      el('ecosystem-growth-status').textContent = statusText;
      if (statusText === "🟢 Growing") {
        el('ecosystem-growth-status').style.backgroundColor = "rgba(16, 185, 129, 0.15)";
        el('ecosystem-growth-status').style.color = "var(--success)";
      } else {
        el('ecosystem-growth-status').style.backgroundColor = "rgba(239, 68, 68, 0.15)";
        el('ecosystem-growth-status').style.color = "var(--danger)";
      }
    }
    
    const activeHours = data.active_hours || 0.0;
    const stageInfo = getStageInfo(activeHours);
    
    if (el('ecosystem-health-score-badge')) {
      el('ecosystem-health-score-badge').textContent = `Health: ${data.health_score}%`;
      if (data.health_score >= 80) {
        el('ecosystem-health-score-badge').style.color = "var(--success)";
        el('ecosystem-health-score-badge').style.backgroundColor = "rgba(16, 185, 129, 0.15)";
      } else if (data.health_score >= 50) {
        el('ecosystem-health-score-badge').style.color = "var(--warning)";
        el('ecosystem-health-score-badge').style.backgroundColor = "rgba(245, 158, 11, 0.15)";
      } else {
        el('ecosystem-health-score-badge').style.color = "var(--danger)";
        el('ecosystem-health-score-badge').style.backgroundColor = "rgba(239, 68, 68, 0.15)";
      }
    }
    
    if (el('ecosystem-stage-emoji')) el('ecosystem-stage-emoji').textContent = stageInfo.emoji;
    if (el('ecosystem-stage-name')) el('ecosystem-stage-name').textContent = stageInfo.name;
    if (el('ecosystem-active-hours')) el('ecosystem-active-hours').textContent = `${activeHours.toFixed(2)} hours active`;
    if (el('ecosystem-stage-progress')) el('ecosystem-stage-progress').style.width = `${stageInfo.progress}%`;
    if (el('ecosystem-next-stage-text')) el('ecosystem-next-stage-text').textContent = stageInfo.nextText;
    
    const lf = data.lifetime || { focus: 0, learning: 0, break: 0, pollution: 0 };
    if (el('eco-param-focus')) el('eco-param-focus').textContent = `${lf.focus} points`;
    if (el('eco-param-learning')) el('eco-param-learning').textContent = `${lf.learning} points`;
    if (el('eco-param-breaks')) el('eco-param-breaks').textContent = `${lf.break} points`;
    if (el('eco-param-pollution')) el('eco-param-pollution').textContent = `${lf.pollution} points`;
    
    const canvas = el('ecosystem-canvas');
    if (canvas) {
      drawEcosystem(canvas, data.health_score, lf.focus, lf.learning, lf.break, lf.pollution, stageInfo.name);
    }
  } catch (err) {
    console.error("Error loading ecosystem page:", err);
  }
}

function drawEcosystem(canvas, health, focus, learning, breaks, pollution, stage) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // 1. Draw background voxel sky
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  if (health >= 80) {
    skyGrad.addColorStop(0, '#1a103c');
    skyGrad.addColorStop(0.6, '#312e81');
    skyGrad.addColorStop(1, '#4338ca');
  } else if (health >= 50) {
    skyGrad.addColorStop(0, '#2e1065');
    skyGrad.addColorStop(0.6, '#475569');
    skyGrad.addColorStop(1, '#d97706');
  } else {
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(0.6, '#334155');
    skyGrad.addColorStop(1, '#475569');
  }
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  // 2. Draw Minecraft sun or moon (square box style!)
  ctx.fillStyle = health >= 50 ? '#fef08a' : '#f97316';
  ctx.shadowColor = health >= 50 ? '#eab308' : '#ef4444';
  ctx.shadowBlur = health >= 80 ? 15 : 5;
  ctx.fillRect(w - 120, 60, 40, 40);
  ctx.shadowBlur = 0; // reset blur

  // Helper function to draw a 3D isometric block (cube)
  function drawCube(cx, cy, size, type) {
    const rx = size * 0.866;
    const ry = size * 0.5;
    
    let colors = {};
    if (type === 'grass') {
      colors = { top: '#5b8731', left: '#5c4033', right: '#4b3226' };
    } else if (type === 'dirt') {
      colors = { top: '#76533f', left: '#5c4033', right: '#4b3226' };
    } else if (type === 'water') {
      colors = { top: '#1d4ed8', left: '#1e40af', right: '#1e3a8a' };
    } else if (type === 'stone') {
      colors = { top: '#78716c', left: '#57534e', right: '#44403c' };
    } else if (type === 'brick') {
      colors = { top: '#b45309', left: '#92400e', right: '#78350f' };
    } else if (type === 'wood') {
      colors = { top: '#d97706', left: '#78350f', right: '#451a03' };
    } else if (type === 'leaves') {
      colors = { top: '#15803d', left: '#166534', right: '#14532d' };
    } else if (type === 'pollution') {
      colors = { top: '#27272a', left: '#18181b', right: '#09090b' };
    } else if (type === 'cloud') {
      colors = { top: '#f8fafc', left: '#f1f5f9', right: '#e2e8f0' };
    }

    // Top Face (Rhombus)
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + rx, cy - ry);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - rx, cy - ry);
    ctx.closePath();
    ctx.fill();

    // Left Face (Parallelogram)
    ctx.fillStyle = colors.left;
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy - ry);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - rx, cy + size - ry);
    ctx.closePath();
    ctx.fill();

    // Right Face (Parallelogram)
    ctx.fillStyle = colors.right;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + rx, cy - ry);
    ctx.lineTo(cx + rx, cy + size - ry);
    ctx.lineTo(cx, cy + size);
    ctx.closePath();
    ctx.fill();

    // Custom overlay details for Minecraft grass sides
    if (type === 'grass') {
      ctx.fillStyle = '#5b8731';
      // Left Face grass trim overlay
      ctx.beginPath();
      ctx.moveTo(cx - rx, cy - ry);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + size * 0.25);
      ctx.lineTo(cx - rx * 0.5, cy - ry * 0.5 + size * 0.15);
      ctx.lineTo(cx - rx, cy - ry + size * 0.25);
      ctx.closePath();
      ctx.fill();

      // Right Face grass trim overlay
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + rx, cy - ry);
      ctx.lineTo(cx + rx, cy - ry + size * 0.25);
      ctx.lineTo(cx + rx * 0.5, cy - ry * 0.5 + size * 0.15);
      ctx.lineTo(cx, cy + size * 0.25);
      ctx.closePath();
      ctx.fill();
    }
  }

  // 3. Render 8x8 grid back-to-front
  const gridWidth = 8;
  const gridDepth = 8;
  const size = 16;
  const rx = size * 0.866;
  const ry = size * 0.5;

  const startX = w / 2;
  const startY = h / 2 - 30;

  const occupied = {};

  for (let z = 0; z < 5; z++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      for (let gy = 0; gy < gridDepth; gy++) {
        const cx = startX + (gx - gy) * rx;
        const cy = startY + (gx + gy) * ry - z * size;

        const coordKey = `${gx},${gy}`;

        if (z === 0) {
          let blockType = 'grass';
          if (gx === 3 || gy === 4) {
            blockType = 'water';
          } else {
            const seedVal = (gx * 13 + gy * 27) % 100;
            const numPollutionBlocks = Math.min(64, Math.floor(pollution / 2));
            if (seedVal < (numPollutionBlocks * 1.5)) {
              blockType = 'pollution';
            } else if (seedVal % 7 === 0) {
              blockType = 'dirt';
            }
          }
          drawCube(cx, cy, size, blockType);
          occupied[coordKey] = blockType;
        } else {
          const baseBlock = occupied[coordKey];
          if (baseBlock === 'water' || baseBlock === 'pollution') {
            if (z === 1 && gx === 3 && gy === 3) {
              drawCube(cx, cy, size, 'wood');
            }
            continue;
          }

          const randomSeed = (gx * 31 + gy * 79) % 100;
          const numTrees = Math.min(18, Math.floor(focus / 5));
          const shouldTree = (randomSeed < (numTrees * 5));

          if (shouldTree) {
            if (z === 1) {
              drawCube(cx, cy, size, 'wood');
            } else if (z === 2) {
              drawCube(cx, cy, size, 'leaves');
            }
            continue;
          }

          const numHouses = Math.min(6, Math.floor(learning / 15));
          const shouldHouse = (randomSeed >= 70 && randomSeed < (70 + numHouses * 5));
          if (shouldHouse) {
            if (z === 1) {
              drawCube(cx, cy, size, 'stone');
            } else if (z === 2) {
              drawCube(cx, cy, size, 'brick');
            }
            continue;
          }
        }
      }
    }
  }

  // 4. Draw floaty cloud block layers (z = 4)
  const numClouds = Math.min(4, Math.floor(breaks / 10));
  for (let i = 0; i < numClouds; i++) {
    const cgx = (i * 2 + 1) % gridWidth;
    const cgy = (i * 3 + 2) % gridDepth;
    const ccx = startX + (cgx - cgy) * rx + (i * 10);
    const ccy = startY + (cgx + cgy) * ry - 5 * size;
    drawCube(ccx, ccy, size, 'cloud');
  }

  // 5. Draw text overlays
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.font = '700 24px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(stage, 20, h - 25);
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

async function loadAnalyticsPage(viewType = 'daily') {
  try {
    const res = await apiFetch('/api/ecosystem/status');
    const data = await res.json();
    
    const history = data.history || [];
    let aggregated = [];
    
    if (viewType === 'daily') {
      aggregated = history.slice(-7);
    } else if (viewType === 'weekly') {
      const temp = [...history].reverse();
      const weeks = [];
      for (let i = 0; i < temp.length; i += 7) {
        const chunk = temp.slice(i, i + 7);
        const active = chunk.reduce((sum, item) => sum + item.active_time, 0);
        const idle = chunk.reduce((sum, item) => sum + item.idle_time, 0);
        const sleep = chunk.reduce((sum, item) => sum + item.sleep_time, 0);
        const locked = chunk.reduce((sum, item) => sum + item.locked_time, 0);
        const focus = chunk.reduce((sum, item) => sum + item.focus_score, 0);
        const learning = chunk.reduce((sum, item) => sum + item.learning_score, 0);
        const breakSc = chunk.reduce((sum, item) => sum + item.break_score, 0);
        const meetings = chunk.reduce((sum, item) => sum + (item.meeting_duration || 0), 0);
        
        const dateLabel = `Wk -${Math.floor(i/7) + 1}`;
        weeks.push({
          date: dateLabel,
          active_time: active,
          idle_time: idle,
          sleep_time: sleep,
          locked_time: locked,
          focus_score: focus,
          learning_score: learning,
          break_score: breakSc,
          meeting_duration: meetings
        });
      }
      aggregated = weeks.reverse();
    } else if (viewType === 'monthly') {
      const monthsMap = {};
      history.forEach(item => {
        const monthKey = item.date.slice(0, 7);
        if (!monthsMap[monthKey]) {
          monthsMap[monthKey] = {
            date: monthKey,
            active_time: 0,
            idle_time: 0,
            sleep_time: 0,
            locked_time: 0,
            focus_score: 0,
            learning_score: 0,
            break_score: 0,
            meeting_duration: 0
          };
        }
        monthsMap[monthKey].active_time += item.active_time;
        monthsMap[monthKey].idle_time += item.idle_time;
        monthsMap[monthKey].sleep_time += item.sleep_time;
        monthsMap[monthKey].locked_time += item.locked_time;
        monthsMap[monthKey].focus_score += item.focus_score;
        monthsMap[monthKey].learning_score += item.learning_score;
        monthsMap[monthKey].break_score += item.break_score;
        monthsMap[monthKey].meeting_duration += (item.meeting_duration || 0);
      });
      aggregated = Object.values(monthsMap).sort((a, b) => a.date.localeCompare(b.date)).slice(-12);
    } else {
      aggregated = history.slice(-30);
    }
    
    const totalActive = aggregated.reduce((sum, item) => sum + item.active_time, 0);
    const totalIdle = aggregated.reduce((sum, item) => sum + item.idle_time, 0);
    const totalSleep = aggregated.reduce((sum, item) => sum + item.sleep_time, 0);
    const totalLocked = aggregated.reduce((sum, item) => sum + item.locked_time, 0);
    
    const totalTime = totalActive + totalIdle + totalSleep + totalLocked;
    let efficiency = 100;
    if (totalTime > 0) {
      efficiency = Math.round((totalActive / totalTime) * 100);
    }
    
    if (el('stat-active')) el('stat-active').textContent = formatDuration(totalActive);
    if (el('stat-idle')) el('stat-idle').textContent = formatDuration(totalIdle);
    if (el('stat-sleep-lock')) el('stat-sleep-lock').textContent = formatDuration(totalSleep + totalLocked);
    if (el('stat-efficiency')) el('stat-efficiency').textContent = `${efficiency}%`;
    
    const totalMeetings = aggregated.reduce((sum, item) => sum + (item.meeting_duration || 0), 0);
    if (el('stat-meetings')) el('stat-meetings').textContent = formatDuration(totalMeetings);

    
    const durationsCanvas = el('chart-durations');
    const healthCanvas = el('chart-health');
    
    if (durationsCanvas) {
      drawBarChart(durationsCanvas, aggregated);
    }
    if (healthCanvas) {
      drawLineChart(healthCanvas, aggregated);
    }
  } catch (err) {
    console.error("Error loading analytics page:", err);
  }
}

function drawBarChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  
  if (!data || data.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("No screen time logs recorded yet.", w / 2, h / 2);
    return;
  }
  
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 40;
  const paddingBottom = 40;
  
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;
  
  let maxHours = 1;
  data.forEach(item => {
    const act = item.active_time / 3600;
    const idl = item.idle_time / 3600;
    const slk = (item.sleep_time + item.locked_time) / 3600;
    const total = act + idl + slk;
    if (total > maxHours) maxHours = total;
  });
  maxHours = Math.ceil(maxHours / 2) * 2;
  
  ctx.strokeStyle = varColor('--border');
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxHours * i) / gridLines;
    const y = paddingTop + chartH - (chartH * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();
    ctx.fillText(`${val.toFixed(1)}h`, paddingLeft - 10, y + 3);
  }
  
  ctx.strokeStyle = varColor('--border');
  ctx.beginPath();
  ctx.moveTo(paddingLeft, paddingTop + chartH);
  ctx.lineTo(w - paddingRight, paddingTop + chartH);
  ctx.stroke();
  
  const numGroups = data.length;
  const groupW = chartW / numGroups;
  const gap = groupW * 0.15;
  const barW = (groupW - gap * 2) / 3;
  
  data.forEach((item, idx) => {
    const act = item.active_time / 3600;
    const idl = item.idle_time / 3600;
    const slk = (item.sleep_time + item.locked_time) / 3600;
    
    const groupX = paddingLeft + idx * groupW + gap;
    
    const actH = (act / maxHours) * chartH;
    ctx.fillStyle = varColor('--primary');
    ctx.fillRect(groupX, paddingTop + chartH - actH, barW, actH);
    
    const idlH = (idl / maxHours) * chartH;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(groupX + barW, paddingTop + chartH - idlH, barW, idlH);
    
    const slkH = (slk / maxHours) * chartH;
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(groupX + barW * 2, paddingTop + chartH - slkH, barW, slkH);
    
    let label = item.date;
    if (label.length > 5 && label.includes('-')) {
      label = label.slice(5);
    }
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText(label, groupX + barW * 1.5, paddingTop + chartH + 15);
  });
  
  ctx.textAlign = 'left';
  ctx.font = '10px Inter, sans-serif';
  
  ctx.fillStyle = varColor('--primary');
  ctx.fillRect(paddingLeft, 10, 10, 10);
  ctx.fillStyle = '#6b7280';
  ctx.fillText("Active Time", paddingLeft + 15, 18);
  
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(paddingLeft + 110, 10, 10, 10);
  ctx.fillStyle = '#6b7280';
  ctx.fillText("Idle Time", paddingLeft + 125, 18);
  
  ctx.fillStyle = '#6b7280';
  ctx.fillRect(paddingLeft + 210, 10, 10, 10);
  ctx.fillStyle = '#6b7280';
  ctx.fillText("Sleep / Locked", paddingLeft + 225, 18);
}

function drawLineChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
  ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
  
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);
  
  if (!data || data.length === 0) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("No health logs recorded yet.", w / 2, h / 2);
    return;
  }
  
  const paddingLeft = 50;
  const paddingRight = 50;
  const paddingTop = 40;
  const paddingBottom = 40;
  
  const chartW = w - paddingLeft - paddingRight;
  const chartH = h - paddingTop - paddingBottom;
  
  let maxPoints = 10;
  data.forEach(item => {
    const pts = item.focus_score + item.learning_score + item.break_score;
    if (pts > maxPoints) maxPoints = pts;
  });
  maxPoints = Math.ceil(maxPoints / 10) * 10;
  
  ctx.strokeStyle = varColor('--border');
  ctx.lineWidth = 1;
  ctx.fillStyle = '#6b7280';
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'right';
  
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const pct = (100 * i) / gridLines;
    const y = paddingTop + chartH - (chartH * i) / gridLines;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(w - paddingRight, y);
    ctx.stroke();
    ctx.fillText(`${pct}%`, paddingLeft - 10, y + 3);
  }
  
  ctx.textAlign = 'left';
  for (let i = 0; i <= gridLines; i++) {
    const val = (maxPoints * i) / gridLines;
    const y = paddingTop + chartH - (chartH * i) / gridLines;
    ctx.fillText(`${val}`, w - paddingRight + 10, y + 3);
  }
  
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#10b981';
  ctx.beginPath();
  
  const stepX = chartW / (data.length - 1 || 1);
  
  data.forEach((item, idx) => {
    const positive = item.focus_score + item.learning_score + item.break_score;
    const pollution = Math.floor(item.idle_time / 600);
    let health = 100;
    if (positive + pollution > 0) {
      health = Math.round((positive / (positive + pollution)) * 100);
    }
    
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + chartH - (health / 100) * chartH;
    
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  
  ctx.fillStyle = '#10b981';
  data.forEach((item, idx) => {
    const positive = item.focus_score + item.learning_score + item.break_score;
    const pollution = Math.floor(item.idle_time / 600);
    let health = 100;
    if (positive + pollution > 0) {
      health = Math.round((positive / (positive + pollution)) * 100);
    }
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + chartH - (health / 100) * chartH;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  
  ctx.strokeStyle = varColor('--primary');
  ctx.beginPath();
  data.forEach((item, idx) => {
    const pts = item.focus_score + item.learning_score + item.break_score;
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + chartH - (pts / maxPoints) * chartH;
    
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  
  ctx.fillStyle = varColor('--primary');
  data.forEach((item, idx) => {
    const pts = item.focus_score + item.learning_score + item.break_score;
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + chartH - (pts / maxPoints) * chartH;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    
    let label = item.date;
    if (label.length > 5 && label.includes('-')) {
      label = label.slice(5);
    }
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, paddingTop + chartH + 15);
  });
  
  ctx.textAlign = 'left';
  ctx.font = '10px Inter, sans-serif';
  
  ctx.fillStyle = '#10b981';
  ctx.fillRect(paddingLeft, 10, 10, 10);
  ctx.fillStyle = '#6b7280';
  ctx.fillText("Health Score %", paddingLeft + 15, 18);
  
  ctx.fillStyle = varColor('--primary');
  ctx.fillRect(paddingLeft + 130, 10, 10, 10);
  ctx.fillStyle = '#6b7280';
  ctx.fillText("Productivity Points", paddingLeft + 145, 18);
}

// ── SETTINGS CATEGORIES, REPEATING TASKS & DASHBOARD ECOSYSTEM HELPERS ──

function setupSettingsToggles() {
  const toggleButtons = document.querySelectorAll('.settings-toggle-btn');
  if (!toggleButtons.length) return;

  const updateSettingsCards = (sec) => {
    const cards = document.querySelectorAll('#settings-form .settings-card');
    cards.forEach((card) => {
      const category = card.getAttribute('data-category') || 'system';
      if (category === sec) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  };


  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      Sound.playClick();
      document.querySelector('.settings-toggle-btn.active').classList.remove('active');
      btn.classList.add('active');
      const sec = btn.getAttribute('data-sec');
      updateSettingsCards(sec);
    });
  });

  updateSettingsCards('integrations');
}

async function loadDashboardEcosystemWidget() {
  const ecoWidget = el('widget-ecosystem');
  if (ecoWidget && ecoWidget.style.display !== 'none') {
    try {
      const ecoRes = await apiFetch('/api/ecosystem/status');
      const ecoData = await ecoRes.json();
      
      const isSessionActive = sessionStorage.getItem('mickey_session_active') === 'true';
      const bioGateway = el('biometric-gateway');
      const isLocked = !isSessionActive || (bioGateway && bioGateway.style.display !== 'none');
      const isIdle = (Date.now() - lastActivityTime >= idleThreshold);
      
      let statusText = "🟢 Growing";
      if (isLocked) statusText = "⏸ Paused (Locked)";
      else if (isIdle) statusText = "⏸ Paused (Idle)";
      
      const activeHours = ecoData.active_hours || 0.0;
      const stageInfo = getStageInfo(activeHours);
      
      if (el('dash-eco-stage')) el('dash-eco-stage').textContent = `${stageInfo.emoji} ${stageInfo.name}`;
      if (el('dash-eco-hours')) el('dash-eco-hours').textContent = `${activeHours.toFixed(1)} hours`;
      if (el('dash-eco-progress')) el('dash-eco-progress').style.width = `${stageInfo.progress}%`;
      if (el('dash-eco-status')) el('dash-eco-status').textContent = statusText;
      if (el('dash-eco-health')) el('dash-eco-health').textContent = `Health: ${ecoData.health_score}%`;
    } catch (err) {
      console.error("Error loading dashboard ecosystem widget:", err);
    }
  }
}

async function handleTaskRepeat(task) {
  if (!task) return;
  let detailsData = {};
  if (task.description && task.description.startsWith('{')) {
    try { detailsData = JSON.parse(task.description); } catch(e){}
  } else {
    detailsData.notes = task.description || "";
  }
  
  if (detailsData.repeat && detailsData.repeat !== 'none') {
    const currentDue = task.due_date || new Date().toISOString();
    const nextDue = calculateNextDueDate(currentDue, detailsData.repeat);
    
    let nextDetails = { ...detailsData };
    if (nextDetails.steps) {
      nextDetails.steps = nextDetails.steps.map(s => ({ ...s, done: false }));
    }
    
    try {
      await apiFetch('/api/tasks', {
        method: 'POST',
        body: {
          title: task.title,
          priority: task.priority,
          status: 'pending',
          due_date: nextDue,
          description: JSON.stringify(nextDetails)
        }
      });
    } catch (err) {
      console.error("Error creating repeating task copy:", err);
    }
  }
}

function calculateNextDueDate(dueDateStr, repeat) {
  const date = new Date(dueDateStr);
  if (isNaN(date.getTime())) return new Date().toISOString();
  if (repeat === 'daily') {
    date.setDate(date.getDate() + 1);
  } else if (repeat === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (repeat === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (repeat === 'yearly') {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date.toISOString();
}

// ── FOCUS MODE STUB (Teams removed) ──
let isFocusMode = false;

// GitHub validate & disconnect
async function validateAndConnectGitHub() {
  const token = el('set-github-token').value;
  const mcpUrl = el('set-mcp-github-url').value;
  const valEl = el('github-status-val');
  
  if (!valEl) return;
  valEl.textContent = "Connecting...";
  valEl.style.color = "var(--warning)";
  Sound.playClick();
  
  try {
    const res = await apiFetch('/api/github/validate', {
      method: 'POST',
      body: {
        github_access_token: token || null,
        mcp_github_url: mcpUrl || null
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'connected') {
        valEl.textContent = data.username ? `Connected as ${data.username}` : (data.message || "Connected");
        valEl.style.color = "var(--success)";
        
        // Save settings to database
        const payload = {
          ollama_url: el('set-ollama-url').value || null,
          selected_model: el('set-selected-model').value || null,
          gmail_address: el('set-gmail-address').value || null,
          gmail_app_password: el('set-gmail-password').value || null,
          figma_access_token: el('set-figma-token').value || null,
          mcp_figma_url: el('set-mcp-figma-url').value || null,
          clock_style: el('set-clock-style').value || 'digital',
          clock_format: el('set-clock-format').value || '12hr',
          water_reminder_enabled: el('set-water-enabled').checked,
          water_reminder_interval: parseInt(el('set-water-interval').value) || 60,
          system_name: el('set-system-name').value.trim() || 'Mickey',
          assistant_name: el('set-assistant-name').value.trim() || 'Cookie',
          github_access_token: token || null,
          mcp_github_url: mcpUrl || null
        };
        
        const saveRes = await apiFetch('/api/settings', {
          method: 'POST',
          body: payload
        });
        if (saveRes.ok) {
          alert("GitHub connected and configuration saved successfully!");
          Sound.playSuccess();
          loadGitHubDashboardWidget();
        }
      } else {
        valEl.textContent = data.message || "Connection Error";
        valEl.style.color = "var(--danger)";
        alert("GitHub connection failed: " + (data.message || "Unknown error"));
      }
    }
  } catch (e) {
    valEl.textContent = "Error";
    valEl.style.color = "var(--danger)";
    console.error(e);
  }
}

async function disconnectGitHub() {
  const valEl = el('github-status-val');
  if (!valEl) return;
  Sound.playClick();
  
  el('set-github-token').value = '';
  el('set-mcp-github-url').value = '';
  
  const payload = {
    ollama_url: el('set-ollama-url').value || null,
    selected_model: el('set-selected-model').value || null,
    gmail_address: el('set-gmail-address').value || null,
    gmail_app_password: el('set-gmail-password').value || null,
    figma_access_token: el('set-figma-token').value || null,
    mcp_figma_url: el('set-mcp-figma-url').value || null,
    clock_style: el('set-clock-style').value || 'digital',
    clock_format: el('set-clock-format').value || '12hr',
    water_reminder_enabled: el('set-water-enabled').checked,
    water_reminder_interval: parseInt(el('set-water-interval').value) || 60,
    system_name: el('set-system-name').value.trim() || 'Mickey',
    assistant_name: el('set-assistant-name').value.trim() || 'Cookie',
    github_access_token: '',
    mcp_github_url: ''
  };
  
  try {
    const res = await apiFetch('/api/settings', {
      method: 'POST',
      body: payload
    });
    if (res.ok) {
      valEl.textContent = "Disconnected";
      valEl.style.color = "var(--text-muted)";
      alert("GitHub integration disconnected successfully.");
      Sound.playSuccess();
      loadGitHubDashboardWidget();
    }
  } catch (e) {
    console.error("Disconnect GitHub failed:", e);
  }
}

// GitHub workspace panel view
let activeGitHubRepo = null;
let currentGitHubSubtab = 'issues';

async function loadGitHubPanel() {
  const reposListEl = el('github-repos-list');
  const repoSelector = el('github-repo-selector');
  if (!reposListEl) return;
  
  reposListEl.innerHTML = '<div class="loading-state">Syncing repositories...</div>';
  if (repoSelector) {
    repoSelector.innerHTML = '<option value="">Select Repository...</option>';
  }
  
  try {
    const res = await apiFetch('/api/github-mcp', {
      method: 'POST',
      body: {
        method: 'tools/call',
        params: {
          name: 'list_repositories',
          arguments: {}
        }
      }
    });
    if (res.ok) {
      const data = await res.json();
      const repos = data.github_result ? (data.github_result.repositories || []) : [];
      
      reposListEl.innerHTML = '';
      if (repos.length === 0) {
        reposListEl.innerHTML = '<div class="placeholder-text">No repositories found or token lacks scopes.</div>';
        return;
      }
      
      repos.forEach(r => {
        const item = document.createElement('div');
        item.className = 'github-repo-item';
        if (activeGitHubRepo === r.name) item.classList.add('active');
        item.innerHTML = `
          <div style="font-weight:600; color:var(--text-main); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${r.name}</div>
          <div style="font-size:0.7rem; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; margin-top:0.15rem;">${r.description || 'No description.'}</div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.4rem; font-size:0.65rem; color:var(--text-muted);">
            <span>⭐ ${r.stars || 0}</span>
            <span>${r.private ? '🔒 Private' : '🔓 Public'}</span>
          </div>
        `;
        item.onclick = () => {
          Sound.playClick();
          selectGitHubRepo(r.name);
        };
        reposListEl.appendChild(item);
        
        if (repoSelector) {
          const opt = document.createElement('option');
          opt.value = r.name;
          opt.textContent = r.name;
          opt.selected = activeGitHubRepo === r.name;
          repoSelector.appendChild(opt);
        }
      });
      
      if (!activeGitHubRepo && repos.length > 0) {
        selectGitHubRepo(repos[0].name);
      }
    } else {
      reposListEl.innerHTML = '<div class="placeholder-text" style="color:var(--danger);">Failed to retrieve repositories. Configure Personal Access Token in settings.</div>';
    }
  } catch (e) {
    reposListEl.innerHTML = '<div class="placeholder-text" style="color:var(--danger);">Error connecting to GitHub MCP.</div>';
    console.error(e);
  }
}

function selectGitHubRepo(repoName) {
  activeGitHubRepo = repoName;
  
  document.querySelectorAll('.github-repo-item').forEach(item => {
    const name = item.querySelector('div').textContent;
    if (name === repoName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  const selector = el('github-repo-selector');
  if (selector) selector.value = repoName;
  
  el('github-select-repo-placeholder').style.display = 'none';
  el('github-repo-details-content').style.display = 'flex';
  
  el('github-code-search-input').value = '';
  el('github-subpanel-search').style.display = 'none';
  
  loadGitHubRepoDetails(repoName);
  loadGitHubSubtabContent();
}

async function loadGitHubRepoDetails(repoName) {
  el('github-active-repo-name').textContent = repoName;
  
  try {
    const res = await apiFetch('/api/github-mcp', {
      method: 'POST',
      body: {
        method: 'tools/call',
        params: {
          name: 'view_repository',
          arguments: { repo: repoName }
        }
      }
    });
    if (res.ok) {
      const data = await res.json();
      const r = data.github_result || {};
      
      el('github-active-repo-desc').textContent = r.description || 'No description provided.';
      el('github-active-repo-link').href = r.html_url || '#';
      el('github-stat-branch').textContent = r.default_branch || 'main';
      el('github-stat-stars').textContent = r.stars || '0';
      el('github-stat-issues').textContent = r.open_issues_count || '0';
      el('github-stat-forks').textContent = r.forks || '0';
    }
  } catch (e) {
    console.error("Failed to load repo stats details:", e);
  }
}

function loadGitHubSubtabContent() {
  document.querySelectorAll('.github-subpanel').forEach(p => p.style.display = 'none');
  
  if (currentGitHubSubtab === 'issues') {
    el('github-subpanel-issues').style.display = 'flex';
    loadGitHubRepoIssues(activeGitHubRepo);
  } else if (currentGitHubSubtab === 'pulls') {
    el('github-subpanel-pulls').style.display = 'flex';
    loadGitHubRepoPulls(activeGitHubRepo);
  } else if (currentGitHubSubtab === 'commits') {
    el('github-subpanel-commits').style.display = 'flex';
    loadGitHubRepoCommits(activeGitHubRepo);
  }
}

async function loadGitHubRepoIssues(repoName) {
  const container = el('github-issues-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Syncing issues...</div>';
  
  try {
    const res = await apiFetch('/api/github-mcp', {
      method: 'POST',
      body: {
        method: 'tools/call',
        params: {
          name: 'read_issues',
          arguments: { repo: repoName }
        }
      }
    });
    if (res.ok) {
      const data = await res.json();
      const issues = data.github_result ? (data.github_result.issues || []) : [];
      container.innerHTML = '';
      if (issues.length === 0) {
        container.innerHTML = '<div class="placeholder-text">No open issues found in this repository.</div>';
        return;
      }
      issues.forEach(i => {
        const item = document.createElement('div');
        item.className = 'github-list-item';
        item.innerHTML = `
          <div>
            <div class="github-list-item-title">#${i.number} ${i.title}</div>
            <div class="github-list-item-meta">Opened by ${i.user} &bull; ${new Date(i.created_at).toLocaleDateString()}</div>
          </div>
          <a href="${i.html_url}" target="_blank" class="action-link">Open</a>
        `;
        container.appendChild(item);
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="placeholder-text" style="color:var(--danger);">Error fetching issues.</div>';
  }
}

async function loadGitHubRepoPulls(repoName) {
  const container = el('github-pulls-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Syncing pull requests...</div>';
  
  try {
    const res = await apiFetch('/api/github-mcp', {
      method: 'POST',
      body: {
        method: 'tools/call',
        params: {
          name: 'read_pull_requests',
          arguments: { repo: repoName }
        }
      }
    });
    if (res.ok) {
      const data = await res.json();
      const pulls = data.github_result ? (data.github_result.pull_requests || []) : [];
      container.innerHTML = '';
      if (pulls.length === 0) {
        container.innerHTML = '<div class="placeholder-text">No open pull requests found.</div>';
        return;
      }
      pulls.forEach(p => {
        const item = document.createElement('div');
        item.className = 'github-list-item';
        item.innerHTML = `
          <div>
            <div class="github-list-item-title">#${p.number} ${p.title}</div>
            <div class="github-list-item-meta">Opened by ${p.user} &bull; merge ${p.branch_from} into ${p.branch_to}</div>
          </div>
          <a href="${p.html_url}" target="_blank" class="action-link">Open</a>
        `;
        container.appendChild(item);
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="placeholder-text" style="color:var(--danger);">Error fetching pull requests.</div>';
  }
}

async function loadGitHubRepoCommits(repoName) {
  const container = el('github-commits-container');
  if (!container) return;
  container.innerHTML = '<div class="loading-state">Syncing commits...</div>';
  
  try {
    const res = await apiFetch('/api/github-mcp', {
      method: 'POST',
      body: {
        method: 'tools/call',
        params: {
          name: 'view_commits',
          arguments: { repo: repoName }
        }
      }
    });
    if (res.ok) {
      const data = await res.json();
      const commits = data.github_result ? (data.github_result.commits || []) : [];
      container.innerHTML = '';
      if (commits.length === 0) {
        container.innerHTML = '<div class="placeholder-text">No commits found in default branch.</div>';
        return;
      }
      commits.forEach(c => {
        const item = document.createElement('div');
        item.className = 'github-list-item';
        item.innerHTML = `
          <div>
            <div class="github-list-item-title">${c.message}</div>
            <div class="github-list-item-meta">${c.author} committed on ${new Date(c.date).toLocaleDateString()} &bull; sha: <code>${c.sha}</code></div>
          </div>
          <a href="${c.html_url}" target="_blank" class="action-link">View</a>
        `;
        container.appendChild(item);
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="placeholder-text" style="color:var(--danger);">Error fetching commits.</div>';
  }
}

async function searchGitHubCode(repoName, query) {
  const container = el('github-search-container');
  if (!container) return;
  
  document.querySelectorAll('.github-subpanel').forEach(p => p.style.display = 'none');
  el('github-subpanel-search').style.display = 'flex';
  
  container.innerHTML = '<div class="loading-state">Searching code files...</div>';
  
  try {
    const res = await apiFetch('/api/github-mcp', {
      method: 'POST',
      body: {
        method: 'tools/call',
        params: {
          name: 'search_code',
          arguments: {
            repo: repoName,
            query: query
          }
        }
      }
    });
    if (res.ok) {
      const data = await res.json();
      const results = data.github_result ? (data.github_result.items || []) : [];
      container.innerHTML = '';
      if (results.length === 0) {
        container.innerHTML = `<div class="placeholder-text">No matching code files found for "${query}".</div>`;
        return;
      }
      results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'github-list-item';
        div.innerHTML = `
          <div>
            <div class="github-list-item-title">${item.name}</div>
            <div class="github-list-item-meta">${item.path}</div>
          </div>
          <a href="${item.html_url}" target="_blank" class="action-link">View Code</a>
        `;
        container.appendChild(div);
      });
    }
  } catch (e) {
    container.innerHTML = '<div class="placeholder-text" style="color:var(--danger);">Error searching code.</div>';
  }
}

async function createGitHubIssue(repoName, title, body) {
  if (!title) {
    alert("Please specify a title for the issue.");
    return;
  }
  
  try {
    const res = await apiFetch('/api/github-mcp', {
      method: 'POST',
      body: {
        method: 'tools/call',
        params: {
          name: 'create_issue',
          arguments: {
            repo: repoName,
            title: title,
            body: body
          }
        }
      }
    });
    if (res.ok) {
      const data = await res.json();
      const result = data.github_result || {};
      if (result.status === 'success') {
        alert(`Issue #${result.number} created successfully!`);
        Sound.playSuccess();
        
        el('github-issue-title').value = '';
        el('github-issue-body').value = '';
        el('github-new-issue-form-container').style.display = 'none';
        
        loadGitHubRepoIssues(repoName);
      } else {
        alert("Failed to create issue: " + (result.error || "Unknown error"));
      }
    }
  } catch (e) {
    alert("Error creating issue: " + e.message);
  }
}

// GitHub Dashboard Widget
async function loadGitHubDashboardWidget() {
  const container = el('dash-github-container');
  const badge = el('dash-github-status');
  if (!container) return;
  
  try {
    const res = await apiFetch('/api/github-mcp', {
      method: 'POST',
      body: {
        method: 'tools/call',
        params: {
          name: 'list_repositories',
          arguments: {}
        }
      }
    });
    if (res.ok) {
      const data = await res.json();
      
      if (data.error || (data.github_result && data.github_result.error)) {
        if (badge) {
          badge.textContent = "Disconnected";
          badge.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
          badge.style.color = "var(--danger)";
        }
        container.innerHTML = '<div class="placeholder-text">Configure GitHub Integration in Settings to link repositories.</div>';
        return;
      }
      
      const repos = data.github_result ? (data.github_result.repositories || []) : [];
      if (badge) {
        badge.textContent = "Connected";
        badge.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
        badge.style.color = "var(--success)";
      }
      
      container.innerHTML = '';
      if (repos.length === 0) {
        container.innerHTML = '<div class="placeholder-text">No repositories linked.</div>';
        return;
      }
      
      repos.slice(0, 5).forEach(r => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '0.5rem 0';
        item.style.borderBottom = '1px solid var(--border)';
        item.style.fontSize = '0.8rem';
        item.style.textAlign = 'left';
        
        item.innerHTML = `
          <div style="flex:1; min-width:0;">
            <div style="font-weight:600; color:var(--text-main); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${r.name}</div>
            <div style="font-size:0.7rem; color:var(--text-muted); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; margin-top:0.1rem;">${r.description || 'No description.'}</div>
          </div>
          <a href="${r.html_url}" target="_blank" class="action-link" style="margin-left:1rem; flex-shrink:0;">GitHub</a>
        `;
        container.appendChild(item);
      });
      if (container.lastChild) {
        container.lastChild.style.borderBottom = 'none';
      }
    } else {
      if (badge) {
        badge.textContent = "Error";
        badge.style.backgroundColor = "rgba(239, 68, 68, 0.1)";
        badge.style.color = "var(--danger)";
      }
      container.innerHTML = '<div class="placeholder-text">Failed to sync GitHub. Check your configuration.</div>';
    }
  } catch (e) {
    if (badge) {
      badge.textContent = "Offline";
      badge.style.backgroundColor = "rgba(107, 114, 128, 0.1)";
      badge.style.color = "var(--text-muted)";
    }
    container.innerHTML = '<div class="placeholder-text">GitHub MCP Server Unreachable.</div>';
  }
}

function setupGitHubPanelBindings() {
  const selector = el('github-repo-selector');
  if (selector) {
    selector.addEventListener('change', (e) => {
      if (e.target.value) {
        selectGitHubRepo(e.target.value);
      }
    });
  }
  
  const refreshBtn = el('github-panel-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      Sound.playClick();
      loadGitHubPanel();
    });
  }
  
  document.querySelectorAll('.github-sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      Sound.playClick();
      document.querySelectorAll('.github-sub-tab').forEach(t => {
        t.classList.remove('active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = 'var(--text-muted)';
      });
      tab.classList.add('active');
      tab.style.borderBottomColor = 'var(--primary)';
      tab.style.color = 'var(--primary)';
      
      currentGitHubSubtab = tab.getAttribute('data-subtab');
      loadGitHubSubtabContent();
    });
  });
  
  const searchInput = el('github-code-search-input');
  const searchBtn = el('github-code-search-btn');
  const handleSearch = () => {
    if (!activeGitHubRepo) {
      alert("Please select a repository first.");
      return;
    }
    const q = searchInput.value.trim();
    if (q) {
      Sound.playClick();
      searchGitHubCode(activeGitHubRepo, q);
    }
  };
  if (searchBtn) searchBtn.addEventListener('click', handleSearch);
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
  }
  
  const clearSearchBtn = el('github-clear-search-btn');
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      Sound.playClick();
      el('github-subpanel-search').style.display = 'none';
      loadGitHubSubtabContent();
    });
  }
  
  const newIssueBtn = el('github-new-issue-btn');
  const cancelIssueBtn = el('github-cancel-issue-btn');
  const formCont = el('github-new-issue-form-container');
  
  if (newIssueBtn) {
    newIssueBtn.addEventListener('click', () => {
      Sound.playClick();
      formCont.style.display = 'flex';
    });
  }
  if (cancelIssueBtn) {
    cancelIssueBtn.addEventListener('click', () => {
      Sound.playClick();
      formCont.style.display = 'none';
    });
  }
  
  const submitIssueBtn = el('github-submit-issue-btn');
  if (submitIssueBtn) {
    submitIssueBtn.addEventListener('click', () => {
      if (!activeGitHubRepo) return;
      const title = el('github-issue-title').value.trim();
      const body = el('github-issue-body').value.trim();
      createGitHubIssue(activeGitHubRepo, title, body);
    });
  }
}

// ── JIRA WORK BOARD CORE CONTROLLER ──
let allJiraIssues = [];
let selectedJiraIssue = null;

async function loadJiraPanel() {
  const discView = el('jira-disconnected-view');
  const connView = el('jira-connected-view');
  if (!discView || !connView) return;

  try {
    const res = await apiFetch('/api/jira/config');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'connected') {
        discView.style.display = 'none';
        connView.style.display = 'grid';
        
        // Populate setup inputs if empty
        el('jira-url-input').value = data.url || '';
        el('jira-email-input').value = data.email || '';
        
        await loadJiraProjects();
        await loadJiraIssues();
      } else {
        discView.style.display = 'flex';
        connView.style.display = 'none';
        el('jira-setup-status').textContent = 'Status: Disconnected';
        el('jira-setup-status').style.color = 'var(--text-muted)';
      }
    }
  } catch (e) {
    console.error("Error loading Jira configuration:", e);
  }
}

async function loadJiraProjects() {
  const selector = el('jira-project-selector');
  if (!selector) return;
  try {
    const res = await apiFetch('/api/jira/projects');
    if (res.ok) {
      const data = await res.json();
      const projects = data.projects || [];
      
      selector.innerHTML = '<option value="">All Projects</option>';
      projects.forEach(p => {
        selector.innerHTML += `<option value="${p.key}">${p.name} (${p.key})</option>`;
      });
    }
  } catch (e) {
    console.error("Error loading Jira projects:", e);
  }
}

async function loadJiraIssues() {
  const listCont = el('jira-issues-list');
  const countBadge = el('jira-issues-count-badge');
  if (!listCont) return;
  
  listCont.innerHTML = '<div class="loading-state">Syncing issues board...</div>';
  
  const projectKey = el('jira-project-selector').value;
  let url = '/api/jira/issues';
  if (projectKey) {
    url += `?jql=${encodeURIComponent('project = ' + projectKey + ' AND resolution = Unresolved')}`;
  }
  
  try {
    const res = await apiFetch(url);
    if (res.ok) {
      const data = await res.json();
      allJiraIssues = data.issues || [];
      listCont.innerHTML = '';
      
      if (countBadge) {
        countBadge.textContent = `${allJiraIssues.length} Issues`;
      }
      
      if (allJiraIssues.length === 0) {
        listCont.innerHTML = '<div class="placeholder-text">No unresolved tickets found.</div>';
        return;
      }
      
      allJiraIssues.forEach(issue => {
        const item = document.createElement('div');
        item.className = 'task-row';
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => openJiraIssueDetail(issue));
        
        const key = issue?.key || issue?.id || (issue?.fields && issue.fields.issueKey) || 'UNKNOWN';
        const summary = issue?.fields?.summary || issue?.summary || issue?.name || 'No Summary';
        const statusName = issue?.fields?.status?.name || issue?.status || 'To Do';
        const typeName = issue?.fields?.issuetype?.name || issue?.type || 'Task';
        
        // Determine status badge class
        let badgeClass = 'badge-low';
        const statusLower = (typeof statusName === 'string') ? statusName.toLowerCase() : '';
        if (statusLower === 'in progress') badgeClass = 'badge-medium';
        if (statusLower === 'done' || statusLower === 'resolved') badgeClass = 'badge-low';
        if (statusLower === 'to do' || statusLower === 'backlog') badgeClass = 'badge-high';
        
        item.innerHTML = `
          <div class="task-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--primary);"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            <div class="task-details">
              <h3>[${key}] ${summary}</h3>
              <span style="font-size:0.7rem; color:var(--text-muted);">${typeName}</span>
            </div>
          </div>
          <div class="task-right">
            <span class="badge ${badgeClass}">${statusName}</span>
          </div>
        `;
        listCont.appendChild(item);
      });
    } else {
      listCont.innerHTML = '<div class="placeholder-text text-danger">Failed to sync Jira issues. Check connection.</div>';
    }
  } catch (e) {
    listCont.innerHTML = '<div class="placeholder-text text-danger">Jira Connection failed.</div>';
  }
}

function openJiraIssueDetail(issue) {
  selectedJiraIssue = issue;
  
  el('jira-modal-issue-key').textContent = issue.key;
  el('jira-modal-issue-summary').textContent = issue.fields?.summary || '';
  
  const statusEl = el('jira-modal-issue-status');
  const statusName = issue.fields?.status?.name || 'To Do';
  statusEl.textContent = statusName;
  statusEl.className = 'badge';
  if (statusName.toLowerCase() === 'in progress') statusEl.classList.add('badge-medium');
  else if (statusName.toLowerCase() === 'done' || statusName.toLowerCase() === 'resolved') statusEl.classList.add('badge-low');
  else statusEl.classList.add('badge-high');
  
  el('jira-modal-issue-type').textContent = issue.fields?.issuetype?.name || 'Task';
  
  // Render description
  const descEl = el('jira-modal-issue-description');
  let description = issue.fields?.description;
  if (description && typeof description === 'object') {
    // If Atlassian ADF format
    try {
      description = description.content?.map(c => c.content?.map(t => t.text).join('')).join('\n') || '';
    } catch(e) {
      description = JSON.stringify(description);
    }
  }
  descEl.textContent = description || 'No description provided.';
  
  // Populate transition dropdown options if available
  const transitionSelect = el('jira-modal-transition-select');
  transitionSelect.innerHTML = '<option value="">Choose Transition...</option>';
  // Provide basic common transitions
  transitionSelect.innerHTML += `
    <option value="To Do">To Do</option>
    <option value="In Progress">In Progress</option>
    <option value="Done">Done (Resolve)</option>
  `;

  // Render comments
  renderJiraComments(issue);
  
  el('jira-issue-detail-modal').style.display = 'flex';
  Sound.playClick();
}

function renderJiraComments(issue) {
  const commList = el('jira-modal-comments-list');
  if (!commList) return;
  commList.innerHTML = '';
  
  const comments = issue.fields?.comment?.comments || [];
  if (comments.length === 0) {
    commList.innerHTML = '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:0.5rem 0;">No comments yet.</div>';
    return;
  }
  
  comments.forEach(c => {
    const item = document.createElement('div');
    item.style.padding = '0.5rem';
    item.style.borderRadius = 'var(--radius)';
    item.style.border = '1px solid var(--border)';
    item.style.background = 'var(--bg-app)';
    item.style.fontSize = '0.8rem';
    
    const author = c.author?.displayName || 'User';
    let body = c.body;
    if (body && typeof body === 'object') {
      try {
        body = body.content?.map(co => co.content?.map(t => t.text).join('')).join('\n') || '';
      } catch(err) {
        body = JSON.stringify(body);
      }
    }
    
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
        <strong>${author}</strong>
        <span style="font-size:0.7rem; color:var(--text-muted);">${c.created ? new Date(c.created).toLocaleString() : ''}</span>
      </div>
      <p style="color:var(--text-main); white-space:pre-wrap; line-height:1.4;">${body}</p>
    `;
    commList.appendChild(item);
  });
}

function setupJiraPanelBindings() {
  // Setup Connect
  const setupConnBtn = el('btn-jira-setup-connect');
  if (setupConnBtn) {
    setupConnBtn.addEventListener('click', async () => {
      const url = el('jira-url-input').value.trim();
      const email = el('jira-email-input').value.trim();
      const token = el('jira-token-input').value;
      
      if (!url || !email || !token) {
        alert("Please fill in all setup fields.");
        return;
      }
      
      setupConnBtn.textContent = 'Connecting...';
      Sound.playClick();
      
      try {
        const res = await apiFetch('/api/jira/connect', {
          method: 'POST',
          body: { url, email, token }
        });
        if (res.ok) {
          alert("Jira connected successfully!");
          Sound.playSuccess();
          el('jira-disconnected-view').style.display = 'none';
          el('jira-connected-view').style.display = 'grid';
          await loadJiraPanel();
          updateSidebarActiveMcps();
        } else {
          const err = await res.json();
          alert("Connection failed: " + (err.detail || 'check settings'));
        }
      } catch(e) {
        alert("Connection failed: network error.");
      } finally {
        setupConnBtn.textContent = 'Connect Account';
      }
    });
  }
  
  // Panel Disconnect
  const pnlDiscBtn = el('btn-jira-panel-disconnect');
  if (pnlDiscBtn) {
    pnlDiscBtn.addEventListener('click', async () => {
      if (!confirm("Are you sure you want to disconnect Jira?")) return;
      Sound.playClick();
      try {
        const res = await apiFetch('/api/jira/disconnect', { method: 'POST' });
        if (res.ok) {
          Sound.playSuccess();
          el('jira-url-input').value = '';
          el('jira-email-input').value = '';
          el('jira-token-input').value = '';
          await loadJiraPanel();
          updateSidebarActiveMcps();
        }
      } catch(e) {
        console.error("Disconnect failed:", e);
      }
    });
  }
  
  // Refresh button
  const refBtn = el('jira-panel-refresh-btn');
  if (refBtn) {
    refBtn.addEventListener('click', () => {
      Sound.playClick();
      loadJiraIssues();
    });
  }
  
  // Project select change
  const selector = el('jira-project-selector');
  if (selector) {
    selector.addEventListener('change', () => {
      Sound.playClick();
      loadJiraIssues();
    });
  }
  
  // Create issue form
  const createForm = el('jira-create-issue-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      Sound.playClick();
      
      const project_key = el('jira-create-project-key').value.trim();
      const summary = el('jira-create-summary').value.trim();
      const description = el('jira-create-description').value.trim();
      const issue_type = el('jira-create-type').value;
      
      try {
        const res = await apiFetch('/api/jira/issues', {
          method: 'POST',
          body: { project_key, summary, description, issue_type }
        });
        if (res.ok) {
          alert("Jira Ticket Created Successfully!");
          Sound.playSuccess();
          createForm.reset();
          loadJiraIssues();
        } else {
          const err = await res.json();
          alert("Failed to create issue: " + (err.detail || 'check parameters'));
        }
      } catch(err) {
        alert("Failed to create issue due to networking.");
      }
    });
  }
  
  // Close details modal
  const closeModalBtn = el('close-jira-detail-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      Sound.playClick();
      el('jira-issue-detail-modal').style.display = 'none';
      selectedJiraIssue = null;
    });
  }
  
  // Transition apply
  const transBtn = el('btn-jira-modal-transition');
  if (transBtn) {
    transBtn.addEventListener('click', async () => {
      if (!selectedJiraIssue) return;
      const transName = el('jira-modal-transition-select').value;
      if (!transName) {
        alert("Please select a status transition.");
        return;
      }
      
      // Map names to mockup IDs (Jira v3 uses transition ids, fallback map)
      let transition_id = "21"; // In progress fallback
      if (transName === 'To Do') transition_id = "11";
      if (transName === 'Done') transition_id = "31";
      
      Sound.playClick();
      try {
        const res = await apiFetch(`/api/jira/issues/${selectedJiraIssue.key}/transition`, {
          method: 'PUT',
          body: { transition_id }
        });
        if (res.ok) {
          Sound.playSuccess();
          el('jira-issue-detail-modal').style.display = 'none';
          loadJiraIssues();
        } else {
          const err = await res.json();
          alert("Transition failed: " + (err.detail || 'check workflow'));
        }
      } catch(e) {
        console.error(e);
      }
    });
  }
  
  // Add Comment Form
  const commentForm = el('jira-modal-comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedJiraIssue) return;
      
      const commentInput = el('jira-modal-comment-input');
      const comment = commentInput.value.trim();
      if (!comment) return;
      
      Sound.playClick();
      try {
        const res = await apiFetch(`/api/jira/issues/${selectedJiraIssue.key}/comment`, {
          method: 'POST',
          body: { comment }
        });
        if (res.ok) {
          Sound.playSuccess();
          commentInput.value = '';
          // Re-fetch issues details to render comment
          const detailsUrl = `/api/jira/issues?jql=${encodeURIComponent('key = ' + selectedJiraIssue.key)}`;
          const detRes = await apiFetch(detailsUrl);
          if (detRes.ok) {
            const detData = await detRes.json();
            if (detData.issues && detData.issues.length > 0) {
              selectedJiraIssue = detData.issues[0];
              renderJiraComments(selectedJiraIssue);
            }
          }
        }
      } catch(err) {
        console.error(err);
      }
    });
  }
}


// ── MCP MANAGEMENT SIDEBAR PAGE CORE CONTROLLER ──
let activeMcpCardTab = null;

async function loadMcpPanel() {
  const settingsRes = await apiFetch('/api/settings');
  const settings = settingsRes.ok ? await settingsRes.json() : {};
  const jiraRes = await apiFetch('/api/jira/config');
  const jira = jiraRes.ok ? await jiraRes.json() : {};

  // Verify GitHub
  const githubActive = !!settings.github_access_token || !!settings.mcp_github_url;
  updateMcpCardIndicator('github', githubActive);
  
  // Verify Jira
  const jiraActive = jira.status === 'connected';
  updateMcpCardIndicator('jira', jiraActive);

  // Verify Figma
  const figmaActive = !!settings.figma_access_token || !!settings.mcp_figma_url;
  updateMcpCardIndicator('figma', figmaActive);

  // Verify Gmail MCP
  const gmailActive = !!settings.gmail_address;
  updateMcpCardIndicator('gmail', gmailActive);

  // Verify Files MCP
  let filesWhitelist = [];
  try {
    const whitelistRes = await apiFetch('/api/files/whitelist');
    if (whitelistRes.ok) {
      const wData = await whitelistRes.json();
      filesWhitelist = wData.folders || [];
    }
  } catch(e) {}
  const filesActive = filesWhitelist.length > 0;
  updateMcpCardIndicator('files', filesActive);

  // Re-load configs of selected cards in edit views
  if (activeMcpCardTab) {
    openMcpConfigView(activeMcpCardTab, settings, jira, filesWhitelist);
  }
}

function updateMcpCardIndicator(mcpKey, isActive) {
  const dot = el(`mcp-status-dot-${mcpKey}`);
  const txt = el(`mcp-status-text-${mcpKey}`);
  if (dot && txt) {
    dot.className = isActive ? 'status-indicator online' : 'status-indicator offline';
    txt.textContent = isActive ? 'Active' : 'Inactive';
    txt.style.color = isActive ? 'var(--success)' : 'var(--text-muted)';
  }
}

function openMcpConfigView(mcpKey, settings, jira, filesWhitelist = []) {
  // Hide placeholder and all form bodies
  el('mcp-config-placeholder').style.display = 'none';
  const keys = ['github', 'jira', 'figma', 'gmail', 'files'];
  keys.forEach(k => {
    const f = el(`mcp-config-form-${k}`);
    if (f) f.style.display = 'none';
  });

  // Display selected
  const form = el(`mcp-config-form-${mcpKey}`);
  if (!form) return;
  form.style.display = 'flex';

  // Populate inputs
  if (mcpKey === 'github') {
    el('mcp-github-token').value = settings.github_access_token || '';
    el('mcp-github-url').value = settings.mcp_github_url || '';
  } else if (mcpKey === 'jira') {
    el('mcp-jira-url').value = jira.url || '';
    el('mcp-jira-email').value = jira.email || '';
    el('mcp-jira-token').value = '';
  } else if (mcpKey === 'figma') {
    el('mcp-figma-token').value = settings.figma_access_token || '';
    el('mcp-figma-url').value = settings.mcp_figma_url || '';
  } else if (mcpKey === 'gmail') {
    el('mcp-gmail-address').value = settings.gmail_address || '';
    el('mcp-gmail-password').value = '';
  } else if (mcpKey === 'files') {
    renderMcpFilesWhitelist(filesWhitelist);
  }
}

/* Helper: create a DOM item for a whitelist folder */
function createFolderWhitelistItem(path) {
  const item = document.createElement('div');
  item.className = 'files-folder-item';
  item.setAttribute('data-path', path);
  item.style.display = 'flex';
  item.style.alignItems = 'center';
  item.style.justifyContent = 'space-between';
  item.style.padding = '0.35rem 0.5rem';
  item.style.border = '1px solid var(--border)';
  item.style.borderRadius = '6px';
  item.style.background = 'var(--bg-card)';

  const left = document.createElement('div');
  left.style.display = 'flex';
  left.style.gap = '0.5rem';
  left.style.alignItems = 'center';

  const icon = document.createElement('svg');
  icon.setAttribute('width','16');
  icon.setAttribute('height','16');
  icon.setAttribute('viewBox','0 0 24 24');
  icon.innerHTML = '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>';

  const span = document.createElement('span');
  span.textContent = path;
  span.style.fontSize = '0.85rem';
  span.style.color = 'var(--text-main)';
  span.style.overflow = 'hidden';
  span.style.textOverflow = 'ellipsis';
  span.style.whiteSpace = 'nowrap';
  span.style.maxWidth = '520px';

  left.appendChild(icon);
  left.appendChild(span);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'action-link';
  removeBtn.textContent = 'Remove';
  removeBtn.style.fontSize = '0.75rem';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    item.remove();
    updateMcpFilesStatus();
  });

  item.appendChild(left);
  item.appendChild(removeBtn);
  return item;
}

/* Render list of whitelist folders into the MCP Files form */
function renderMcpFilesWhitelist(list) {
  const container = el('mcp-files-folder-list');
  if (!container) return;
  container.innerHTML = '';
  if (!list || list.length === 0) {
    const placeholder = document.createElement('div');
    placeholder.className = 'loading-state';
    placeholder.textContent = 'No folders configured yet.';
    container.appendChild(placeholder);
    return;
  }
  list.forEach(p => {
    const item = createFolderWhitelistItem(p);
    container.appendChild(item);
  });
  updateMcpFilesStatus();
}

/* Update small UI bits related to files whitelist (e.g., active badge) */
function updateMcpFilesStatus() {
  const container = el('mcp-files-folder-list');
  if (!container) return;
  const count = container.querySelectorAll('.files-folder-item').length;
  // Optionally update a small count badge if present
  const countEl = el('mcp-files-count');
  if (countEl) {
    countEl.textContent = `${count} folder(s)`;
  }
}

function setupMcpPanelBindings() {
  document.querySelectorAll('.mcp-card').forEach(card => {
    card.addEventListener('click', async () => {
      Sound.playClick();
      const mcpKey = card.getAttribute('data-mcp');
      activeMcpCardTab = mcpKey;
      
      // Update styling
      document.querySelectorAll('.mcp-card').forEach(c => c.style.borderColor = 'var(--border)');
      card.style.borderColor = 'var(--primary)';
      
      // Fetch latest values and render
      const settingsRes = await apiFetch('/api/settings');
      const settings = settingsRes.ok ? await settingsRes.json() : {};
      const jiraRes = await apiFetch('/api/jira/config');
      const jira = jiraRes.ok ? await jiraRes.json() : {};

      let filesWhitelist = [];
      if (mcpKey === 'files') {
        try {
          const whRes = await apiFetch('/api/files/whitelist');
          if (whRes.ok) {
            const wData = await whRes.json();
            filesWhitelist = wData.folders || [];
          }
        } catch(e) {}
      }
      openMcpConfigView(mcpKey, settings, jira, filesWhitelist);
    });
  });

  // GitHub connect
  el('btn-mcp-github-connect').addEventListener('click', async () => {
    Sound.playClick();
    const token = el('mcp-github-token').value.trim();
    const mcp_url = el('mcp-github-url').value.trim();
    
    const connectBtn = el('btn-mcp-github-connect');
    connectBtn.textContent = 'Validating...';
    
    try {
      const res = await apiFetch('/api/github/validate', {
        method: 'POST',
        body: { github_access_token: token || null, mcp_github_url: mcp_url || null }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'connected') {
          // Save Settings
          await apiFetch('/api/settings', {
            method: 'POST',
            body: { github_access_token: token || null, mcp_github_url: mcp_url || null }
          });
          alert("GitHub MCP server linked successfully!");
          Sound.playSuccess();
          loadMcpPanel();
          updateSidebarActiveMcps();
        } else {
          alert("Validation failed: " + data.message);
        }
      }
    } catch(err) {
      alert("Verification failed due to connectivity error.");
    } finally {
      connectBtn.textContent = 'Validate & Save';
    }
  });

  el('btn-mcp-github-disconnect').addEventListener('click', async () => {
    if (!confirm("Disconnect GitHub MCP?")) return;
    Sound.playClick();
    await apiFetch('/api/settings', {
      method: 'POST',
      body: { github_access_token: null, mcp_github_url: null }
    });
    Sound.playSuccess();
    el('mcp-github-token').value = '';
    el('mcp-github-url').value = '';
    loadMcpPanel();
    updateSidebarActiveMcps();
  });

  el('btn-mcp-jira-connect').addEventListener('click', async () => {
    Sound.playClick();
    const url = el('mcp-jira-url').value.trim();
    const email = el('mcp-jira-email').value.trim();
    const token = el('mcp-jira-token').value;
    
    if (!url || !email || !token) {
      alert("Please fill in URL, Email, and Token.");
      return;
    }
    
    const connectBtn = el('btn-mcp-jira-connect');
    connectBtn.textContent = 'Connecting...';
    
    try {
      const res = await apiFetch('/api/jira/connect', {
        method: 'POST',
        body: { url, email, token }
      });
      if (res.ok) {
        alert("Jira Connected Successfully!");
        Sound.playSuccess();
        loadMcpPanel();
        updateSidebarActiveMcps();
      } else {
        const err = await res.json();
        alert("Verification failed: " + (err.detail || 'check parameters'));
      }
    } catch(e) {
      alert("Jira verify failed: network error.");
    } finally {
      connectBtn.textContent = 'Validate & Save';
    }
  });

  el('btn-mcp-jira-disconnect').addEventListener('click', async () => {
    if (!confirm("Disconnect Jira server?")) return;
    Sound.playClick();
    await apiFetch('/api/jira/disconnect', { method: 'POST' });
    Sound.playSuccess();
    el('mcp-jira-url').value = '';
    el('mcp-jira-email').value = '';
    el('mcp-jira-token').value = '';
    loadMcpPanel();
    updateSidebarActiveMcps();
  });

  el('btn-mcp-figma-connect').addEventListener('click', async () => {
    Sound.playClick();
    const token = el('mcp-figma-token').value.trim();
    const mcp_url = el('mcp-figma-url').value.trim();
    
    await apiFetch('/api/settings', {
      method: 'POST',
      body: { figma_access_token: token || null, mcp_figma_url: mcp_url || null }
    });
    alert("Figma MCP Saved!");
    Sound.playSuccess();
    loadMcpPanel();
    updateSidebarActiveMcps();
  });

  el('btn-mcp-figma-disconnect').addEventListener('click', async () => {
    Sound.playClick();
    await apiFetch('/api/settings', {
      method: 'POST',
      body: { figma_access_token: null, mcp_figma_url: null }
    });
    Sound.playSuccess();
    el('mcp-figma-token').value = '';
    el('mcp-figma-url').value = '';
    loadMcpPanel();
    updateSidebarActiveMcps();
  });

  // Gmail MCP Connect
  el('btn-mcp-gmail-connect').addEventListener('click', async () => {
    Sound.playClick();
    const address = el('mcp-gmail-address').value.trim();
    const password = el('mcp-gmail-password').value;
    
    if (!address) {
      alert("Please enter a Gmail address.");
      return;
    }
    
    const connectBtn = el('btn-mcp-gmail-connect');
    connectBtn.textContent = 'Saving...';
    
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        body: { gmail_address: address, gmail_app_password: password || undefined }
      });
      if (res.ok) {
        alert("Gmail credentials saved! Inbox will sync on next load.");
        Sound.playSuccess();
        loadMcpPanel();
        updateSidebarActiveMcps();
      }
    } catch(e) {
      alert("Failed to save Gmail settings.");
    } finally {
      connectBtn.textContent = 'Save & Test Connection';
    }
  });

  el('btn-mcp-gmail-disconnect').addEventListener('click', async () => {
    if (!confirm("Remove Gmail credentials?")) return;
    Sound.playClick();
    await apiFetch('/api/settings', {
      method: 'POST',
      body: { gmail_address: null, gmail_app_password: null }
    });
    Sound.playSuccess();
    el('mcp-gmail-address').value = '';
    el('mcp-gmail-password').value = '';
    loadMcpPanel();
    updateSidebarActiveMcps();
  });

  // Files MCP - Add Folder button
  el('btn-mcp-files-add-folder').addEventListener('click', () => {
    Sound.playClick();
    const input = el('mcp-files-new-folder');
    const folderPath = input.value.trim();
    if (!folderPath) return;

    const list = el('mcp-files-folder-list');
    // Check for duplicate
    const existing = Array.from(list.querySelectorAll('.files-folder-item')).map(item => item.getAttribute('data-path'));
    if (existing.includes(folderPath)) {
      alert("This folder is already in the whitelist.");
      return;
    }

    const item = createFolderWhitelistItem(folderPath);
    list.appendChild(item);
    input.value = '';
    updateMcpFilesStatus();
  });

  // Files MCP - Save whitelist button
  el('btn-mcp-files-save').addEventListener('click', async () => {
    Sound.playClick();
    const list = el('mcp-files-folder-list');
    const folders = Array.from(list.querySelectorAll('.files-folder-item')).map(item => item.getAttribute('data-path'));
    
    const saveBtn = el('btn-mcp-files-save');
    saveBtn.textContent = 'Saving...';
    
    try {
      const res = await apiFetch('/api/files/whitelist', {
        method: 'POST',
        body: { folders }
      });
      if (res.ok) {
        alert(`Files whitelist saved with ${folders.length} folder(s)!`);
        Sound.playSuccess();
        loadMcpPanel();
        updateSidebarActiveMcps();
      }
    } catch(e) {
      alert("Failed to save file whitelist.");
    } finally {
      saveBtn.textContent = 'Save Whitelist';
    }
  });
}


// ── DYNAMIC SIDEBAR ACTIVE MCPS DISPLAY ──
async function updateSidebarActiveMcps() {
  const list = el('sidebar-active-mcps-list');
  if (!list) return;
  list.innerHTML = '';

  try {
    const settingsRes = await apiFetch('/api/settings');
    const settings = settingsRes.ok ? await settingsRes.json() : {};
    const jiraRes = await apiFetch('/api/jira/config');
    const jira = jiraRes.ok ? await jiraRes.json() : {};

    let filesActive = false;
    try {
      const whRes = await apiFetch('/api/files/whitelist');
      if (whRes.ok) {
        const wData = await whRes.json();
        filesActive = (wData.folders || []).length > 0;
      }
    } catch(e) {}

    const mcps = [
      { key: 'github', name: 'GitHub', active: !!settings.github_access_token || !!settings.mcp_github_url },
      { key: 'jira', name: 'Jira', active: jira.status === 'connected' },
      { key: 'figma', name: 'Figma', active: !!settings.figma_access_token || !!settings.mcp_figma_url },
      { key: 'gmail', name: 'Gmail', active: !!settings.gmail_address },
      { key: 'files', name: 'Files', active: filesActive }
    ];

    let anyActive = false;
    mcps.forEach(mcp => {
      if (mcp.active) {
        anyActive = true;
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '0.4rem';
        item.style.fontSize = '0.75rem';
        item.style.color = 'var(--text-main)';
        item.style.fontWeight = '500';
        item.style.padding = '0.2rem 0.4rem';
        item.style.borderRadius = '4px';
        item.style.background = 'rgba(16, 185, 129, 0.06)';
        
        item.innerHTML = `<span class="status-indicator online" style="width:6px; height:6px;"></span>${mcp.name}`;
        list.appendChild(item);
      }
    });

    if (!anyActive) {
      list.innerHTML = '<span style="font-size:0.7rem; color:var(--text-muted); font-style:italic;">No active connections</span>';
    }
  } catch(e) {
    console.error("Failed to load sidebar active indicators:", e);
  }
}


// ── WORKSPACE SYSTEM & FILES LOGS CONTROLLER ──
let currentLogsSubTab = 'system';

async function loadLogsPanel() {
  const screen = el('logs-output-screen');
  if (!screen) return;
  screen.textContent = 'Loading logs data...';

  let url = '';
  if (currentLogsSubTab === 'system') url = '/api/logs/system';
  else if (currentLogsSubTab === 'actions') url = '/api/logs/actions';
  else if (currentLogsSubTab === 'mcp') url = '/api/logs/mcp';
  else if (currentLogsSubTab === 'files') url = '/api/logs/actions'; // filtered to files in frontend

  try {
    const res = await apiFetch(url);
    if (res.ok) {
      const data = await res.json();
      screen.innerHTML = '';
      
      if (currentLogsSubTab === 'system') {
        screen.textContent = data.logs || 'System console is empty.';
      } else if (currentLogsSubTab === 'actions') {
        const rows = data.logs || [];
        if (rows.length === 0) {
          screen.textContent = 'No user action logs recorded.';
          return;
        }
        rows.forEach(r => {
          screen.innerHTML += `[${new Date(r.timestamp).toLocaleString()}] action_type: ${r.action_type} | details: ${r.details}\n`;
        });
      } else if (currentLogsSubTab === 'mcp') {
        const rows = data.logs || [];
        if (rows.length === 0) {
          screen.textContent = 'No MCP logs recorded.';
          return;
        }
        rows.forEach(r => {
          screen.innerHTML += `[${new Date(r.timestamp).toLocaleString()}] MCP: ${r.mcp_name} | action: ${r.action} | arguments: ${r.details}\n`;
        });
      } else if (currentLogsSubTab === 'files') {
        const rows = data.logs || [];
        // Filter actions where action_type starts with file_
        const fileRows = rows.filter(r => r.action_type.startsWith('file_'));
        if (fileRows.length === 0) {
          screen.textContent = 'No file access logs recorded.';
          return;
        }
        fileRows.forEach(r => {
          screen.innerHTML += `[${new Date(r.timestamp).toLocaleString()}] event: ${r.action_type} | filepath/query: ${r.details}\n`;
        });
      }
    } else {
      screen.textContent = 'Failed to fetch logs from server.';
    }
  } catch(e) {
    screen.textContent = 'Log sync failed: network error.';
  }
}

function setupLogsPanelBindings() {
  document.querySelectorAll('.logs-sub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      Sound.playClick();
      document.querySelectorAll('.logs-sub-tab').forEach(t => {
        t.classList.remove('active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = 'var(--text-muted)';
      });
      tab.classList.add('active');
      tab.style.borderBottomColor = 'var(--primary)';
      tab.style.color = 'var(--primary)';
      
      currentLogsSubTab = tab.getAttribute('data-logtype');
      loadLogsPanel();
    });
  });

  const refreshBtn = el('logs-panel-refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      Sound.playClick();
      loadLogsPanel();
    });
  }
}


