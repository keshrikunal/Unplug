// ── APP CONSTANTS & QUOTES ──
const QUOTES = [
  { text: "Quiet the mind, and the soul will speak.", author: "Ma Jaya Sati" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "Are you looking at the screen, or looking for an escape?", author: "Digital Zen" },
  { text: "The present moment is filled with joy and happiness.", author: "Thich Nhat Hanh" },
  { text: "Technology is a useful servant but a dangerous master.", author: "Christian Lous Lange" },
  { text: "Be here now. Focus on what is directly in front of you.", author: "Ram Dass" },
  { text: "Where your attention goes, your energy flows.", author: "James Redfield" },
  { text: "Rule your mind or it will rule you.", author: "Horace" },
  { text: "Disconnect to reconnect with what truly matters.", author: "Minimal living" },
  { text: "Look up. The sky has more to say than a feed.", author: "Mindfulness Practice" },
  { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu" },
  { text: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott" }
];

const REFLECTIONS = {
  calm: [
    { text: "Keep protecting this peace. You are doing great.", author: "Detox Guide" },
    { text: "A calm mind is a powerful mind.", author: "Zen Maxim" }
  ],
  bored: [
    { text: "Boredom is the space where creativity is born. Let yourself be bored.", author: "Manoush Zomorodi" },
    { text: "Instead of unlocking a screen, take 3 deep breaths and look around.", author: "Detox Tip" }
  ],
  restless: [
    { text: "Roll your shoulders. Unclench your jaw. Take a slow deep breath.", author: "Body Check-in" },
    { text: "Restlessness is just physical energy seeking focus. Go for a quick walk.", author: "Habit Guide" }
  ],
  anxious: [
    { text: "Inhale for 4 seconds, hold for 4, exhale for 4, hold for 4. Repeat 3 times.", author: "Box Breathing" },
    { text: "Thoughts are just clouds passing. You are the sky.", author: "Amit Ray" }
  ],
  tired: [
    { text: "Close your eyes for 2 minutes. The world can wait.", author: "Detox Rest" },
    { text: "Sleep is the best meditation. Prepare your mind for bed.", author: "Dalai Lama" }
  ]
};

// ── INITIAL STATE CONFIGURATION ──
const TODAY = new Date().toDateString();
let db = JSON.parse(localStorage.getItem('minPhoneData') || '{}');

function initializeDatabase() {
  const defaultDb = {
    day: TODAY,
    opens: 0,
    screentime: 0, // in ms
    streak: 1,
    lastActiveDay: "",
    calls: 0,
    waterIntake: 0,
    waterTarget: 8,
    bedtime: "21:30",
    hapticsEnabled: true,
    soundEnabled: false,
    customTasks: [],
    habitsChecked: { walk: false, meditate: false, screenbed: false },
    feelingsLogs: [], // array of { time: DateStr, feeling: string }
    history: [], // past 7 days of summaries
    guideCheckboxes: { pwa: false, distractions: false, grayscale: false },
    theme: "theme-obsidian"
  };

  // Merge default values to preserve existing user data on update (deep default check)
  db = { ...defaultDb, ...db };
  db.habitsChecked = { ...defaultDb.habitsChecked, ...db.habitsChecked };
  db.guideCheckboxes = { ...defaultDb.guideCheckboxes, ...db.guideCheckboxes };
  db.customTasks = db.customTasks || [];
  db.feelingsLogs = db.feelingsLogs || [];
  db.history = db.history || [];
  db.contactsList = db.contactsList || [];

  // Screen time tracking timestamp
  db.sessionStart = Date.now();

  // Reset trackers if it's a new calendar day
  if (db.day !== TODAY) {
    // Record history
    const yesterdaySummary = {
      day: db.day,
      opens: db.opens,
      minutes: Math.round(db.screentime / 60000),
      water: db.waterIntake,
      habitsPercent: calculateHabitsPercent(db)
    };
    db.history.push(yesterdaySummary);
    if (db.history.length > 7) db.history.shift();

    // Streak logic
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (db.day === yesterday.toDateString()) {
      db.streak = (db.streak || 0) + 1;
    } else {
      db.streak = 1;
    }

    // Reset daily values
    db.day = TODAY;
    db.opens = 0;
    db.screentime = 0;
    db.calls = 0;
    db.waterIntake = 0;
    db.habitsChecked = { walk: false, meditate: false, screenbed: false };
    db.feelingsLogs = [];
    
    // Clear checklist custom tasks completion status
    db.customTasks.forEach(task => task.completed = false);
  }

  db.opens++;
  saveDb();
}

function saveDb() {
  localStorage.setItem('minPhoneData', JSON.stringify(db));
}

function calculateHabitsPercent(data) {
  let count = 0;
  let total = 3;
  if (data.habitsChecked.walk) count++;
  if (data.habitsChecked.meditate) count++;
  if (data.habitsChecked.screenbed) count++;
  
  if (data.customTasks && data.customTasks.length > 0) {
    data.customTasks.forEach(t => {
      total++;
      if (t.completed) count++;
    });
  }
  return Math.round((count / total) * 100);
}

// Initialize on execution
initializeDatabase();

// ── DOM ELEMENTS & GLOBAL VARIABLES ──
let currentScreen = 0; // 0 = Home, 1 = Dashboard
let timerInterval = null;
let timerTotalSeconds = 1500; // 25 minutes default
let timerSecondsLeft = 1500;
let timerIsRunning = false;
let activeCallInterval = null;
let activeCallSeconds = 0;

// Haptic trigger
function triggerHaptic() {
  if (db.hapticsEnabled && 'vibrate' in navigator) {
    navigator.vibrate(12);
  }
}

// Play UI sounds
function playSound(type) {
  if (!db.soundEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'tick') {
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } else if (type === 'alarm') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      osc.start();
      // Simple alarm beep pattern
      osc.frequency.setValueAtTime(554, audioCtx.currentTime + 0.2);
      osc.frequency.setValueAtTime(659, audioCtx.currentTime + 0.4);
      osc.stop(audioCtx.currentTime + 0.8);
    } else if (type === 'call') {
      osc.frequency.setValueAtTime(350, audioCtx.currentTime);
      osc.frequency.setValueAtTime(440, audioCtx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) {
    console.error("Audio Context playback failed: ", e);
  }
}

// ── SCREEN NAVIGATION ──
const viewportWrapper = document.getElementById('viewport-wrapper');

function navigateTo(screenIndex) {
  triggerHaptic();
  currentScreen = screenIndex;
  if (screenIndex === 0) {
    viewportWrapper.style.transform = 'translateX(0)';
  } else {
    viewportWrapper.style.transform = 'translateX(-50%)';
    renderAnalytics(); // Refresh graphs when entering dashboard
  }
}

// Touch swipe gesture support
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

document.querySelector('.viewport').addEventListener('touchstart', e => {
  touchStartX = e.changedTouches[0].screenX;
  touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.querySelector('.viewport').addEventListener('touchend', e => {
  touchEndX = e.changedTouches[0].screenX;
  touchEndY = e.changedTouches[0].screenY;
  handleSwipeGesture();
}, { passive: true });

function handleSwipeGesture() {
  const threshold = 80; // slightly higher threshold to prevent accidental triggers
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  
  // Only trigger swipe navigation if the horizontal drag is dominant and exceeds threshold
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
    if (diffX < 0 && currentScreen === 0) {
      navigateTo(1); // Swipe Left -> Go to Dashboard
    } else if (diffX > 0 && currentScreen === 1) {
      // Check if typing in input to avoid swiping back
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
      navigateTo(0); // Swipe Right -> Go to Home Launcher
    }
  }
}

// ── UTILITY DATES & TIME CLOCK ──
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function updateClocks() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;

  // Update DOM clocks
  document.getElementById('status-time').textContent = timeString;
  document.getElementById('home-clock').textContent = timeString;

  // Format date
  const dayName = daysOfWeek[now.getDay()];
  const monthName = months[now.getMonth()];
  const dateVal = now.getDate();
  const dateString = `${dayName}, ${monthName} ${String(dateVal).padStart(2, '0')}`;
  document.getElementById('home-date').textContent = dateString;

  // Track screen time (add elapsed time from last update)
  const elapsed = Date.now() - db.sessionStart;
  db.screentime += elapsed;
  db.sessionStart = Date.now();
  saveDb();

  // Refresh home page stats pills
  updateHomeStats();
  
  // Bedtime check
  checkBedtimeLock();
}

function updateHomeStats() {
  const activeMin = Math.round(db.screentime / 60000);
  document.getElementById('home-opens').textContent = db.opens;
  document.getElementById('home-screentime').textContent = activeMin < 60 ? activeMin + 'm' : Math.floor(activeMin / 60) + 'h ' + (activeMin % 60) + 'm';
  document.getElementById('home-streak').textContent = db.streak;
}

// Initial clock update and timer intervals
updateClocks();
setInterval(updateClocks, 1000);

// Set Battery Mock
function updateBatteryMock() {
  const batVal = Math.floor(Math.random() * 20) + 70; // 70 to 90%
  document.getElementById('status-battery').textContent = batVal + '%';
}
updateBatteryMock();

// ── DAILY QUOTES COMPONENT ──
const quoteText = document.getElementById('quote-text');
const quoteAuthor = document.getElementById('quote-author');
const quoteContainer = document.getElementById('quote-container');

let quoteIndex = Math.floor(Math.random() * QUOTES.length);

function cycleQuote() {
  triggerHaptic();
  quoteIndex = (quoteIndex + 1) % QUOTES.length;
  quoteText.style.opacity = '0';
  quoteAuthor.style.opacity = '0';
  setTimeout(() => {
    quoteText.textContent = `"${QUOTES[quoteIndex].text}"`;
    quoteAuthor.textContent = QUOTES[quoteIndex].author;
    quoteText.style.opacity = '1';
    quoteAuthor.style.opacity = '0.7';
  }, 200);
}

// Double tap or click quote to change
quoteContainer.addEventListener('click', cycleQuote);
// Initial quote paint
quoteText.textContent = `"${QUOTES[quoteIndex].text}"`;
quoteAuthor.textContent = QUOTES[quoteIndex].author;

// ── MODAL TOGGLES ──
function registerModal(triggerId, overlayId, closeId, onOpen = null, onClose = null) {
  const trigger = document.getElementById(triggerId);
  const overlay = document.getElementById(overlayId);
  const closeBtn = document.getElementById(closeId);

  if (trigger) {
    trigger.addEventListener('click', () => {
      triggerHaptic();
      overlay.classList.add('open');
      if (onOpen) onOpen();
    });
  }

  const hideModal = () => {
    triggerHaptic();
    overlay.classList.remove('open');
    if (onClose) onClose();
  };

  if (closeBtn) closeBtn.addEventListener('click', hideModal);
  
  // Close when tapping backdrop
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideModal();
  });
}

// Open modals
registerModal('btn-dialer-trigger', 'overlay-dialer', 'btn-dialer-close', renderContacts);
registerModal('btn-whatsapp-trigger', 'overlay-whatsapp', 'btn-whatsapp-close');
registerModal('btn-settings-trigger', 'overlay-settings', 'btn-settings-close', populateSettings);

// Toggle contacts drawer inside Dialer
const btnToggleContacts = document.getElementById('btn-toggle-contacts');
const contactsDrawer = document.getElementById('contacts-drawer');
const dialerNumericPad = document.getElementById('dialer-numeric-pad');

btnToggleContacts.addEventListener('click', () => {
  triggerHaptic();
  contactsDrawer.classList.toggle('hidden');
  dialerNumericPad.classList.toggle('hidden');
});

// ── DIALER & CONTACTS LOGIC ──
const dialDisplay = document.getElementById('dial-display');
let inputNumber = "";

function updateDialDisplay() {
  if (inputNumber === "") {
    dialDisplay.textContent = "Enter number to call";
    dialDisplay.classList.add('placeholder');
  } else {
    dialDisplay.textContent = inputNumber;
    dialDisplay.classList.remove('placeholder');
  }
}

// Keypad tap
document.querySelectorAll('.dial-key').forEach(button => {
  button.addEventListener('click', () => {
    const val = button.getAttribute('data-val');
    if (!val) return; // Deluxe action buttons handled separately
    triggerHaptic();
    playSound('tick');
    if (inputNumber.length >= 18) return;
    inputNumber += val;
    updateDialDisplay();
  });
});

// Del button
document.getElementById('btn-dial-del').addEventListener('click', () => {
  triggerHaptic();
  inputNumber = inputNumber.slice(0, -1);
  updateDialDisplay();
});

// Custom long-press del for full clear
document.getElementById('btn-dial-del').addEventListener('dblclick', () => {
  triggerHaptic();
  inputNumber = "";
  updateDialDisplay();
});

// Call button
const activeCallOverlay = document.getElementById('overlay-active-call');
const activeCallName = document.getElementById('active-call-name');
const activeCallStatus = document.getElementById('active-call-status');
const activeCallTimer = document.getElementById('active-call-timer');

document.getElementById('btn-dial-call').addEventListener('click', startCallSimulation);

function startCallSimulation() {
  if (inputNumber === "") return;
  triggerHaptic();
  playSound('call');
  
  // Lookup name
  let displayName = inputNumber;
  const match = db.contactsList && db.contactsList.find(c => c.phone === inputNumber);
  if (match) displayName = match.name;

  activeCallName.textContent = displayName;
  activeCallStatus.textContent = "Connecting...";
  activeCallTimer.textContent = "00:00";
  
  activeCallOverlay.classList.add('open');
  
  activeCallSeconds = 0;
  
  setTimeout(() => {
    activeCallStatus.textContent = "Active Call";
    activeCallInterval = setInterval(() => {
      activeCallSeconds++;
      const m = String(Math.floor(activeCallSeconds / 60)).padStart(2, '0');
      const s = String(activeCallSeconds % 60).padStart(2, '0');
      activeCallTimer.textContent = `${m}:${s}`;
    }, 1000);
  }, 1500);

  // Increment call statistic
  db.calls++;
  saveDb();
}

// Hangup button
document.getElementById('btn-hangup').addEventListener('click', () => {
  triggerHaptic();
  clearInterval(activeCallInterval);
  activeCallStatus.textContent = "Call Ended";
  setTimeout(() => {
    activeCallOverlay.classList.remove('open');
    // Open Dialer link to trigger actual device tel link on mobile if dialNumber is input
    if (inputNumber !== "") {
      window.location.href = `tel:${inputNumber}`;
    }
  }, 800);
});

// Contacts CRUD
const contactsContainer = document.getElementById('contacts-list-container');
const formAddContact = document.getElementById('form-add-contact');

formAddContact.addEventListener('submit', (e) => {
  e.preventDefault();
  triggerHaptic();
  const name = document.getElementById('input-contact-name').value.trim();
  const phone = document.getElementById('input-contact-phone').value.trim();
  
  if (!db.contactsList) db.contactsList = [];
  
  // Add to contact array
  db.contactsList.push({ name, phone });
  saveDb();
  
  // Clean form & repaint
  formAddContact.reset();
  renderContacts();
});

function renderContacts() {
  contactsContainer.innerHTML = "";
  const contacts = db.contactsList || [];
  
  if (contacts.length === 0) {
    contactsContainer.innerHTML = '<span style="font-size:11px;color:var(--muted);text-align:center;padding:12px 0;">No contacts saved.</span>';
    return;
  }
  
  // Sort alphabetically
  contacts.sort((a,b) => a.name.localeCompare(b.name)).forEach((contact, idx) => {
    const card = document.createElement('div');
    card.className = "contact-item";
    card.innerHTML = `
      <div class="contact-info">
        <span class="contact-name">${contact.name}</span>
        <span class="contact-phone">${contact.phone}</span>
      </div>
      <div class="contact-actions">
        <button class="btn-contact-call" data-num="${contact.phone}">Call</button>
        <button class="btn-contact-del" data-idx="${idx}">×</button>
      </div>
    `;
    contactsContainer.appendChild(card);
  });
  
  // Attach quick-call & delete events
  document.querySelectorAll('.btn-contact-call').forEach(btn => {
    btn.addEventListener('click', (e) => {
      inputNumber = e.target.getAttribute('data-num');
      updateDialDisplay();
      contactsDrawer.classList.add('hidden');
      dialerNumericPad.classList.remove('hidden');
      startCallSimulation();
    });
  });

  document.querySelectorAll('.btn-contact-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      triggerHaptic();
      const idx = parseInt(e.target.getAttribute('data-idx'));
      db.contactsList.splice(idx, 1);
      saveDb();
      renderContacts();
    });
  });
}

// ── WHATSAPP REDIRECT FORM ──
const formWhatsApp = document.getElementById('form-whatsapp-chat');
formWhatsApp.addEventListener('submit', (e) => {
  e.preventDefault();
  triggerHaptic();
  let num = document.getElementById('input-whatsapp-phone').value.trim();
  // Strip symbols
  num = num.replace(/[+\s-()]/g, "");
  if (num) {
    window.location.href = `https://wa.me/${num}`;
  }
});

// ── WIDGET: FEELINGS TRACKER ──
const feelingsPills = document.querySelectorAll('.feeling-pill');
const reflectionBox = document.getElementById('reflection-box');
const reflectionText = document.getElementById('reflection-text');
const reflectionAuthor = document.getElementById('reflection-author');

feelingsPills.forEach(pill => {
  pill.addEventListener('click', () => {
    const feeling = pill.getAttribute('data-feeling');
    
    // Highlight UI
    feelingsPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    
    triggerHaptic();
    playSound('tick');
    
    // Write log to DB
    db.feelingsLogs.push({
      time: Date.now(),
      feeling: feeling
    });
    saveDb();
    
    // Render custom mind reflection
    const entries = REFLECTIONS[feeling] || QUOTES;
    const item = entries[Math.floor(Math.random() * entries.length)];
    
    reflectionBox.classList.remove('hidden');
    reflectionText.style.opacity = '0';
    setTimeout(() => {
      reflectionText.textContent = `"${item.text}"`;
      reflectionAuthor.textContent = `— ${item.author}`;
      reflectionText.style.opacity = '1';
    }, 200);
    
    // Refresh SVG analytics bar graph instantly
    renderMoodTimeline();
    renderAnalytics();
  });
});

function renderMoodTimeline() {
  const timeline = document.getElementById('mood-timeline-bar');
  timeline.innerHTML = "";
  
  const logs = db.feelingsLogs || [];
  if (logs.length === 0) {
    timeline.innerHTML = '<span class="timeline-empty">No feelings logged today.</span>';
    return;
  }
  
  // Calculate relative segments
  logs.forEach(log => {
    const segment = document.createElement('div');
    segment.className = `mood-bar-segment feel-${log.feeling}`;
    segment.style.width = `${100 / logs.length}%`;
    segment.title = `${log.feeling} logged at ${new Date(log.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    timeline.appendChild(segment);
  });
}

// ── WIDGET: FOCUS TIMER ──
const timerClock = document.getElementById('dashboard-timer-clock');
const timerLabel = document.getElementById('dashboard-timer-label');
const timerProgress = document.getElementById('timer-progress');
const btnTimerToggle = document.getElementById('btn-timer-toggle');
const btnTimerReset = document.getElementById('btn-timer-reset');

// Circumference of circular timer progress meter
const circumference = 2 * Math.PI * 76; // r=76 -> 477.5
timerProgress.style.strokeDasharray = `${circumference} ${circumference}`;
timerProgress.style.strokeDashoffset = circumference;

function updateTimerProgress() {
  const ratio = timerSecondsLeft / timerTotalSeconds;
  const offset = circumference - (ratio * circumference);
  timerProgress.style.strokeDashoffset = isNaN(offset) ? circumference : offset;
  
  const m = String(Math.floor(timerSecondsLeft / 60)).padStart(2, '0');
  const s = String(timerSecondsLeft % 60).padStart(2, '0');
  timerClock.textContent = `${m}:${s}`;
}

function setupTimer(mins) {
  triggerHaptic();
  clearInterval(timerInterval);
  timerIsRunning = false;
  timerTotalSeconds = mins * 60;
  timerSecondsLeft = timerTotalSeconds;
  
  updateTimerProgress();
  timerLabel.textContent = "Stay focused";
  btnTimerToggle.textContent = "Start";
  btnTimerToggle.className = 'timer-ctrl-btn primary';
  
  // Update UI preset selection
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent === `${mins}m`) btn.classList.add('active');
  });
}

btnTimerToggle.addEventListener('click', () => {
  triggerHaptic();
  if (timerIsRunning) {
    // Pause
    clearInterval(timerInterval);
    timerIsRunning = false;
    timerLabel.textContent = "Paused";
    btnTimerToggle.textContent = "Resume";
  } else {
    // Start
    timerIsRunning = true;
    timerLabel.textContent = "Stay focused 🌿";
    btnTimerToggle.textContent = "Pause";
    
    timerInterval = setInterval(() => {
      timerSecondsLeft--;
      updateTimerProgress();
      
      if (timerSecondsLeft <= 0) {
        clearInterval(timerInterval);
        timerIsRunning = false;
        timerLabel.textContent = "✓ Complete!";
        btnTimerToggle.textContent = "Start";
        playSound('alarm');
        
        // Push Native Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification("Focus Session Complete!", {
            body: "Great job keeping off your screens! Take a slow stretch.",
            icon: "./icon.svg"
          });
        }
      }
    }, 1000);
  }
});

btnTimerReset.addEventListener('click', () => {
  triggerHaptic();
  clearInterval(timerInterval);
  timerIsRunning = false;
  timerSecondsLeft = timerTotalSeconds;
  updateTimerProgress();
  timerLabel.textContent = "Stay focused";
  btnTimerToggle.textContent = "Start";
});

// Notification permissions request
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Initial draw
updateTimerProgress();

// ── WIDGET: WATER TRACKER ──
const waterFill = document.getElementById('water-fill-level');
const waterText = document.getElementById('water-glass-text');
const waterCountVal = document.getElementById('water-count');

function updateWaterUI() {
  const cups = db.waterIntake || 0;
  const target = db.waterTarget || 8;
  
  waterCountVal.textContent = cups;
  waterText.textContent = `${cups} / ${target}`;
  
  const fillPct = Math.min((cups / target) * 100, 100);
  waterFill.style.height = `${fillPct}%`;
}

document.getElementById('btn-water-plus').addEventListener('click', () => {
  triggerHaptic();
  playSound('tick');
  db.waterIntake = (db.waterIntake || 0) + 1;
  saveDb();
  updateWaterUI();
  renderAnalytics();
});

document.getElementById('btn-water-minus').addEventListener('click', () => {
  triggerHaptic();
  if (db.waterIntake && db.waterIntake > 0) {
    db.waterIntake--;
    saveDb();
    updateWaterUI();
    renderAnalytics();
  }
});

// Initial draw
updateWaterUI();

// ── CHECKLISTS & CUSTOM TASKS ──
const habitWalk = document.getElementById('habit-walk');
const habitMeditate = document.getElementById('habit-meditate');
const habitScreenbed = document.getElementById('habit-screenbed');

// Setup Checkbox change state triggers
function bindHabitCheck(el, key) {
  el.checked = db.habitsChecked[key] || false;
  el.addEventListener('change', () => {
    triggerHaptic();
    db.habitsChecked[key] = el.checked;
    saveDb();
    renderAnalytics();
  });
}

bindHabitCheck(habitWalk, 'walk');
bindHabitCheck(habitMeditate, 'meditate');
bindHabitCheck(habitScreenbed, 'screenbed');

// Render Custom Tasks Checklist
const customList = document.getElementById('custom-tasks-list');
const formAddTask = document.getElementById('form-add-task');
const inputTaskName = document.getElementById('input-task-name');

formAddTask.addEventListener('submit', (e) => {
  e.preventDefault();
  triggerHaptic();
  
  const text = inputTaskName.value.trim();
  if (!text) return;
  
  if (!db.customTasks) db.customTasks = [];
  
  // Guard max 3 items
  if (db.customTasks.length >= 3) {
    alert("Focus on 3 main tasks first. Less is more.");
    return;
  }
  
  db.customTasks.push({
    text: text,
    completed: false
  });
  saveDb();
  
  inputTaskName.value = "";
  renderCustomTasks();
  renderAnalytics();
});

function renderCustomTasks() {
  customList.innerHTML = "";
  const tasks = db.customTasks || [];
  
  tasks.forEach((task, idx) => {
    const item = document.createElement('label');
    item.className = "checklist-item";
    item.innerHTML = `
      <input type="checkbox" class="hidden-checkbox task-check-btn" data-idx="${idx}" ${task.completed ? 'checked' : ''}>
      <span class="custom-checkbox"></span>
      <span class="checklist-text">${task.text}</span>
      <button class="btn-delete-task" data-idx="${idx}">×</button>
    `;
    customList.appendChild(item);
  });
  
  // Checkbox toggle event bindings
  document.querySelectorAll('.task-check-btn').forEach(box => {
    box.addEventListener('change', (e) => {
      triggerHaptic();
      const idx = parseInt(e.target.getAttribute('data-idx'));
      db.customTasks[idx].completed = e.target.checked;
      saveDb();
      renderAnalytics();
    });
  });
  
  // Delete task event bindings
  document.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      triggerHaptic();
      const idx = parseInt(e.target.getAttribute('data-idx'));
      db.customTasks.splice(idx, 1);
      saveDb();
      renderCustomTasks();
      renderAnalytics();
    });
  });
}

// Initial checklist paint
renderCustomTasks();

// ── BEDTIME SCREEN DIGITAL LOCK CURFEW ──
const cardBedtimeWarning = document.getElementById('card-bedtime-warning');
const overlayCurfewLock = document.getElementById('overlay-curfew-lock');
const btnLockCurfew = document.getElementById('btn-lock-curfew');
const btnBypassCurfew = document.getElementById('btn-bypass-curfew');

let curfewBypassed = false;

function checkBedtimeLock() {
  const now = new Date();
  const timeString = String(now.getHours()).padStart(2,'0') + ":" + String(now.getMinutes()).padStart(2,'0');
  
  const bedtime = db.bedtime || "21:30";
  
  // Simple bedtime range: from bedtime until 05:00 in morning
  const isPastBedtime = (timeString >= bedtime || timeString < "05:00");
  
  if (isPastBedtime) {
    cardBedtimeWarning.classList.remove('hidden');
    if (!curfewBypassed) {
      overlayCurfewLock.classList.add('open');
    }
  } else {
    cardBedtimeWarning.classList.add('hidden');
    overlayCurfewLock.classList.remove('open');
    curfewBypassed = false; // Reset bypass state when morning arrives
  }
}

btnLockCurfew.addEventListener('click', () => {
  triggerHaptic();
  curfewBypassed = false;
  overlayCurfewLock.classList.add('open');
});

btnBypassCurfew.addEventListener('click', () => {
  triggerHaptic();
  curfewBypassed = true;
  overlayCurfewLock.classList.remove('open');
});

// ── SETTINGS VIEW LOADER ──
const themeButtons = document.querySelectorAll('.select-theme-btn');
const settingWaterTarget = document.getElementById('setting-water-target');
const settingBedtime = document.getElementById('setting-bedtime');
const settingHaptics = document.getElementById('setting-haptics');
const settingSound = document.getElementById('setting-sound');

function populateSettings() {
  settingWaterTarget.value = db.waterTarget || 8;
  settingBedtime.value = db.bedtime || "21:30";
  settingHaptics.checked = db.hapticsEnabled !== false;
  settingSound.checked = db.soundEnabled === true;
  
  // Mark active theme selected in settings grid
  themeButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-theme') === db.theme) {
      btn.classList.add('active');
    }
  });

  // Bind guide onboarding checkboxes
  const guidePwa = document.getElementById('guide-pwa');
  const guideDistractions = document.getElementById('guide-distractions');
  const guideGrayscale = document.getElementById('guide-grayscale');
  
  if (db.guideCheckboxes) {
    guidePwa.checked = db.guideCheckboxes.pwa || false;
    guideDistractions.checked = db.guideCheckboxes.distractions || false;
    guideGrayscale.checked = db.guideCheckboxes.grayscale || false;
  }

  const bindGuideEvent = (el, key) => {
    el.addEventListener('change', () => {
      triggerHaptic();
      if (!db.guideCheckboxes) db.guideCheckboxes = {};
      db.guideCheckboxes[key] = el.checked;
      saveDb();
    });
  };
  bindGuideEvent(guidePwa, 'pwa');
  bindGuideEvent(guideDistractions, 'distractions');
  bindGuideEvent(guideGrayscale, 'grayscale');
}

// Bind live theme clicks
themeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const selectedTheme = btn.getAttribute('data-theme');
    
    // Clear themes & set new one
    document.body.className = "";
    document.body.classList.add(selectedTheme);
    
    db.theme = selectedTheme;
    saveDb();
    
    themeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    triggerHaptic();
    playSound('tick');
  });
});

// Live setting binders
settingWaterTarget.addEventListener('change', () => {
  db.waterTarget = parseInt(settingWaterTarget.value) || 8;
  saveDb();
  updateWaterUI();
});

settingBedtime.addEventListener('change', () => {
  db.bedtime = settingBedtime.value || "21:30";
  saveDb();
  checkBedtimeLock();
});

settingHaptics.addEventListener('change', () => {
  db.hapticsEnabled = settingHaptics.checked;
  saveDb();
  triggerHaptic();
});

settingSound.addEventListener('change', () => {
  db.soundEnabled = settingSound.checked;
  saveDb();
  playSound('tick');
});

// Full reset data button
document.getElementById('btn-reset-storage').addEventListener('click', () => {
  if (confirm("Are you sure you want to delete all habits, logs, and statistics? This cannot be undone.")) {
    triggerHaptic();
    localStorage.removeItem('minPhoneData');
    window.location.reload();
  }
});

// Load saved theme on load
document.body.className = "";
document.body.classList.add(db.theme || "theme-obsidian");

// ── CUSTOM SVG GRAPHICS GENERATOR (ANALYTICS) ──
function renderAnalytics() {
  // 1. Habit Completion Circle
  const habitPct = calculateHabitsPercent(db);
  document.getElementById('habit-score-text').textContent = `${habitPct}%`;
  
  // Circumference of Habit Arc = 2 * Math.PI * 32 = 201
  const habitCirc = 201;
  const habitOffset = habitCirc - (habitPct / 100) * habitCirc;
  document.getElementById('habit-score-circle').style.strokeDashoffset = habitOffset;
  
  // 2. Average Session time display
  const sessionAvg = db.opens > 0 ? Math.round((db.screentime / 60000) / db.opens) : 0;
  document.getElementById('analytics-time-avg').textContent = `${sessionAvg}m`;
  
  // Render Mood logs timeline
  renderMoodTimeline();

  // 3. Weekly Usage Chart (SVG)
  const chartBox = document.getElementById('usage-chart-box');
  chartBox.innerHTML = "";
  
  // Prepare historical data + today
  const dataset = [...db.history];
  
  // Add today to charts comparison
  dataset.push({
    day: TODAY,
    opens: db.opens,
    minutes: Math.round(db.screentime / 60000),
    water: db.waterIntake,
    habitsPercent: habitPct
  });
  
  // Slice to keep only last 7 days
  const chartData = dataset.slice(-7);
  
  // Find max value to scale graph height (y axis bounds)
  let maxVal = Math.max(...chartData.map(d => d.minutes), 15); // min 15 minutes bounding limit
  
  // Build SVG string
  let svgContent = `
    <svg class="chart-svg" viewBox="0 0 320 120">
      <!-- Grid Lines -->
      <line x1="20" y1="20" x2="300" y2="20" stroke="#222" stroke-width="1" />
      <line x1="20" y1="55" x2="300" y2="55" stroke="#222" stroke-width="1" />
      <line x1="20" y1="90" x2="300" y2="90" stroke="#22" stroke-width="1" />
  `;
  
  const barWidth = 24;
  const spacing = 14;
  const startX = 30;
  
  chartData.forEach((dayData, index) => {
    const x = startX + index * (barWidth + spacing);
    
    // Scale height (max y = 80px range, mapping 0 -> 90px on chart coordinate grid)
    const barHeight = Math.max((dayData.minutes / maxVal) * 70, 4); // min height 4px to see it
    const y = 90 - barHeight;
    
    // Check if drawing today bar (highlight style)
    const isToday = dayData.day === TODAY;
    const barClass = isToday ? 'chart-bar highlight' : 'chart-bar';
    
    // Get simple day code: e.g. "Mon"
    const dayLabel = dayData.day.split(" ")[0];
    
    svgContent += `
      <!-- Bar -->
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" class="${barClass}" />
      
      <!-- Label minutes -->
      <text x="${x + barWidth/2}" y="${y - 4}" class="chart-val-text">${dayData.minutes}m</text>
      
      <!-- Label Day -->
      <text x="${x + barWidth/2}" y="106}" class="chart-text">${dayLabel}</text>
    `;
  });
  
  svgContent += `</svg>`;
  chartBox.innerHTML = svgContent;
}

// Initial analytics paint safely
try {
  renderAnalytics();
} catch (e) {
  console.error("Analytics rendering error on load:", e);
}
