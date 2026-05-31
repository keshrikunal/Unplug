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

// ── GLOBAL STATE & DATABASE variables ──
const TODAY = new Date().toDateString();
let db = {};
let currentScreen = 0; // 0 = Home, 1 = My Day, 2 = Stats & Settings
let isPageVisible = !document.hidden;

// Curfew state variables
let curfewBypassed = false;
let curfewSnoozeUntil = 0;

// Call simulation timers
let activeCallInterval = null;
let activeCallSeconds = 0;

// Focus countdown variables
let timerInterval = null;
let timerTotalSeconds = 1500;
let timerSecondsLeft = 1500;
let timerIsRunning = false;

// Touch Swipe Coordinates
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

// Days & Months Formatting Array
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── CORE DATA ACCESSORS ──
function loadDatabase() {
  try {
    db = JSON.parse(localStorage.getItem('minPhoneData') || '{}') || {};
  } catch (e) {
    console.error("Corrupted local storage database, resetting:", e);
    localStorage.removeItem('minPhoneData');
    db = {};
  }
}

function saveDb() {
  localStorage.setItem('minPhoneData', JSON.stringify(db));
}

function calculateHabitsPercent(data) {
  let count = 0;
  let total = 3; // 3 default checklist options
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

function initializeDatabase() {
  const defaultDb = {
    day: TODAY,
    opens: 0,
    screentime: 0, // ms
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
    feelingsLogs: [],
    history: [],
    guideCheckboxes: { pwa: false, distractions: false, grayscale: false },
    theme: "theme-obsidian",
    contactsList: [],
    username: "",
    dailyQuoteIndex: Math.floor(Math.random() * QUOTES.length)
  };

  db = { ...defaultDb, ...db };
  db.habitsChecked = { ...defaultDb.habitsChecked, ...db.habitsChecked };
  db.guideCheckboxes = { ...defaultDb.guideCheckboxes, ...db.guideCheckboxes };
  db.customTasks = db.customTasks || [];
  db.feelingsLogs = db.feelingsLogs || [];
  db.history = db.history || [];
  db.contactsList = db.contactsList || [];

  // Reset trackers if it's a new day
  if (db.day !== TODAY) {
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

    db.day = TODAY;
    db.opens = 0;
    db.screentime = 0;
    db.calls = 0;
    db.waterIntake = 0;
    db.habitsChecked = { walk: false, meditate: false, screenbed: false };
    db.feelingsLogs = [];
    db.customTasks.forEach(task => task.completed = false);
    db.dailyQuoteIndex = Math.floor(Math.random() * QUOTES.length);
  }

  db.opens++;
  db.sessionStart = Date.now();
  saveDb();
}

// ── SYSTEM UTILITIES (HAPTIC / ALARM) ──
function triggerHaptic() {
  if (db.hapticsEnabled && 'vibrate' in navigator) {
    navigator.vibrate(12);
  }
}

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

// ── REAL TIME BATTERY STATUS (BATTERY STATUS API) ──
function initBatteryAPI() {
  const statusBattery = document.getElementById('status-battery');
  if (!statusBattery) return;

  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      function updateBatteryInfo() {
        const pct = Math.round(battery.level * 100);
        statusBattery.textContent = `${pct}%`;
      }
      updateBatteryInfo();
      battery.addEventListener('levelchange', updateBatteryInfo);
    });
  } else {
    // Hide battery indicator if unsupported (e.g. desktop Firefox/Safari)
    statusBattery.style.display = 'none';
  }
}

// ── SYSTEM NAVIGATION & ROUTER ──
function navigateTo(screenIndex) {
  triggerHaptic();
  currentScreen = screenIndex;
  
  const viewportWrapper = document.getElementById('viewport-wrapper');
  if (viewportWrapper) {
    if (screenIndex === 0) {
      viewportWrapper.style.transform = 'translateX(0)';
    } else if (screenIndex === 1) {
      viewportWrapper.style.transform = 'translateX(-33.3333%)';
      updateGreeting();
    } else {
      viewportWrapper.style.transform = 'translateX(-66.6666%)';
      renderAnalytics(); // Refresh graphs when entering stats page
    }
  }

  // Update Bottom Tab Active States
  const tabs = ['tab-btn-home', 'tab-btn-myday', 'tab-btn-stats'];
  tabs.forEach((tabId, idx) => {
    const tabEl = document.getElementById(tabId);
    if (tabEl) {
      if (idx === screenIndex) tabEl.classList.add('active');
      else tabEl.classList.remove('active');
    }
  });
}

function handleSwipeGesture() {
  const threshold = 80;
  const diffX = touchEndX - touchStartX;
  const diffY = touchEndY - touchStartY;
  
  if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
    
    if (diffX < 0) {
      // Swipe Left -> next
      if (currentScreen === 0) navigateTo(1);
      else if (currentScreen === 1) navigateTo(2);
    } else {
      // Swipe Right -> prev
      if (currentScreen === 2) navigateTo(1);
      else if (currentScreen === 1) navigateTo(0);
    }
  }
}

// ── UTILITY DATES & TIME CLOCK ──
function updateClocks() {
  if (isPageVisible) {
    const elapsed = Date.now() - db.sessionStart;
    db.screentime += elapsed;
    db.sessionStart = Date.now();
    saveDb();
  }

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;

  // Update Status and Main Clocks
  const statusTime = document.getElementById('status-time');
  const homeClock = document.getElementById('home-clock');
  const homeDate = document.getElementById('home-date');
  const myDayDate = document.getElementById('myday-date-label');

  if (statusTime) statusTime.textContent = timeString;
  if (homeClock) homeClock.textContent = timeString;

  // Format date display
  const dayName = daysOfWeek[now.getDay()];
  const monthName = months[now.getMonth()];
  const dateVal = now.getDate();
  const dateString = `${dayName}, ${monthName} ${String(dateVal).padStart(2, '0')}`;
  
  if (homeDate) homeDate.textContent = dateString;
  if (myDayDate) myDayDate.textContent = `${dayName}, ${monthName} ${dateVal}`;

  // Refresh stats values
  updateHomeStats();
  
  // Bedtime Lockdown Check
  checkBedtimeLock();
}

function updateHomeStats() {
  const activeMin = Math.round(db.screentime / 60000);
  
  const opensEl = document.getElementById('home-opens');
  const screentimeEl = document.getElementById('home-screentime');
  const streakEl = document.getElementById('home-streak');

  if (opensEl) opensEl.textContent = db.opens;
  if (streakEl) streakEl.textContent = db.streak;
  if (screentimeEl) {
    screentimeEl.textContent = activeMin < 60 
      ? activeMin + 'm' 
      : Math.floor(activeMin / 60) + 'h ' + (activeMin % 60) + 'm';
  }
}

// ── DAILY USER GREETINGS ──
function updateGreeting() {
  const greetingEl = document.getElementById('greeting-title');
  if (!greetingEl) return;
  const hr = new Date().getHours();
  const name = db.username ? db.username.trim() : "friend";
  
  let greet = "My Day";
  if (hr < 12) greet = `Good morning, ${name}`;
  else if (hr < 17) greet = `Good afternoon, ${name}`;
  else greet = `Good evening, ${name}`;
  
  greetingEl.textContent = greet;
}

// ── DAILY QUOTES LOGIC ──
function setupQuotes() {
  const quoteText = document.getElementById('quote-text');
  const quoteAuthor = document.getElementById('quote-author');
  const quoteContainer = document.getElementById('quote-container');

  if (!quoteText || !quoteAuthor || !quoteContainer) return;

  // Display daily quote from index
  const index = db.dailyQuoteIndex || 0;
  quoteText.textContent = `"${QUOTES[index].text}"`;
  quoteAuthor.textContent = QUOTES[index].author;

  // Cycle quote when double-clicked
  quoteContainer.addEventListener('click', () => {
    triggerHaptic();
    db.dailyQuoteIndex = (db.dailyQuoteIndex + 1) % QUOTES.length;
    saveDb();
    
    quoteText.style.opacity = '0';
    quoteAuthor.style.opacity = '0';
    setTimeout(() => {
      const idx = db.dailyQuoteIndex;
      quoteText.textContent = `"${QUOTES[idx].text}"`;
      quoteAuthor.textContent = QUOTES[idx].author;
      quoteText.style.opacity = '1';
      quoteAuthor.style.opacity = '0.7';
    }, 200);
  });
}

// ── MODAL HELPERS ──
function registerModal(triggerId, overlayId, closeId, onOpen = null, onClose = null) {
  const trigger = document.getElementById(triggerId);
  const overlay = document.getElementById(overlayId);
  const closeBtn = document.getElementById(closeId);

  if (!overlay) return;

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
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideModal();
  });
}

// ── DIALER SIMULATION & QUICK CONTACTS ──
let inputNumber = "";

function updateDialDisplay() {
  const dialDisplay = document.getElementById('dial-display');
  if (!dialDisplay) return;

  if (inputNumber === "") {
    dialDisplay.textContent = "Enter number to call";
    dialDisplay.classList.add('placeholder');
  } else {
    dialDisplay.textContent = inputNumber;
    dialDisplay.classList.remove('placeholder');
  }
}

function startCallSimulation() {
  if (inputNumber === "") return;
  triggerHaptic();
  playSound('call');
  
  const activeCallOverlay = document.getElementById('overlay-active-call');
  const activeCallName = document.getElementById('active-call-name');
  const activeCallStatus = document.getElementById('active-call-status');
  const activeCallTimer = document.getElementById('active-call-timer');

  if (!activeCallOverlay) return;

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

  db.calls++;
  saveDb();
}

function setupDialer() {
  const btnToggleContacts = document.getElementById('btn-toggle-contacts');
  const contactsDrawer = document.getElementById('contacts-drawer');
  const dialerNumericPad = document.getElementById('dialer-numeric-pad');

  if (btnToggleContacts && contactsDrawer && dialerNumericPad) {
    btnToggleContacts.addEventListener('click', () => {
      triggerHaptic();
      contactsDrawer.classList.toggle('hidden');
      dialerNumericPad.classList.toggle('hidden');
    });
  }

  // Keypad clicks
  document.querySelectorAll('.dial-key').forEach(button => {
    button.addEventListener('click', () => {
      const val = button.getAttribute('data-val');
      if (!val) return;
      triggerHaptic();
      playSound('tick');
      if (inputNumber.length >= 18) return;
      inputNumber += val;
      updateDialDisplay();
    });
  });

  const delBtn = document.getElementById('btn-dial-del');
  if (delBtn) {
    delBtn.addEventListener('click', () => {
      triggerHaptic();
      inputNumber = inputNumber.slice(0, -1);
      updateDialDisplay();
    });
    delBtn.addEventListener('dblclick', () => {
      triggerHaptic();
      inputNumber = "";
      updateDialDisplay();
    });
  }

  const callBtn = document.getElementById('btn-dial-call');
  if (callBtn) callBtn.addEventListener('click', startCallSimulation);

  const hangupBtn = document.getElementById('btn-hangup');
  if (hangupBtn) {
    hangupBtn.addEventListener('click', () => {
      triggerHaptic();
      clearInterval(activeCallInterval);
      const activeCallStatus = document.getElementById('active-call-status');
      const activeCallOverlay = document.getElementById('overlay-active-call');
      
      if (activeCallStatus) activeCallStatus.textContent = "Call Ended";
      
      setTimeout(() => {
        if (activeCallOverlay) activeCallOverlay.classList.remove('open');
        if (inputNumber !== "") {
          window.location.href = `tel:${inputNumber}`;
        }
      }, 800);
    });
  }

  // Contact CRUD Binding
  const formAddContact = document.getElementById('form-add-contact');
  if (formAddContact) {
    formAddContact.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerHaptic();
      const nameVal = document.getElementById('input-contact-name').value.trim();
      const phoneVal = document.getElementById('input-contact-phone').value.trim();
      
      if (!db.contactsList) db.contactsList = [];
      db.contactsList.push({ name: nameVal, phone: phoneVal });
      saveDb();
      
      formAddContact.reset();
      renderContacts();
    });
  }
}

function renderContacts() {
  const container = document.getElementById('contacts-list-container');
  if (!container) return;

  container.innerHTML = "";
  const contacts = db.contactsList || [];
  
  if (contacts.length === 0) {
    container.innerHTML = '<span style="font-size:11px;color:var(--muted);text-align:center;padding:12px 0;">No contacts saved.</span>';
    return;
  }
  
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
    container.appendChild(card);
  });
  
  // Quick dial contacts bindings
  document.querySelectorAll('.btn-contact-call').forEach(btn => {
    btn.addEventListener('click', (e) => {
      inputNumber = e.target.getAttribute('data-num');
      updateDialDisplay();
      const drawer = document.getElementById('contacts-drawer');
      const pad = document.getElementById('dialer-numeric-pad');
      if (drawer) drawer.classList.add('hidden');
      if (pad) pad.classList.remove('hidden');
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

// ── WHATSAPP FORM MESSAGE ──
function setupWhatsApp() {
  const form = document.getElementById('form-whatsapp-chat');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    triggerHaptic();
    let num = document.getElementById('input-whatsapp-phone').value.trim();
    num = num.replace(/[+\s-()]/g, "");
    if (num) {
      window.location.href = `https://wa.me/${num}`;
    }
  });
}

// ── MIND FEELINGS LOGGER ──
function setupFeelings() {
  const feelingsPills = document.querySelectorAll('.feeling-pill');
  const reflectionBox = document.getElementById('reflection-box');
  const reflectionText = document.getElementById('reflection-text');
  const reflectionAuthor = document.getElementById('reflection-author');

  feelingsPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const feeling = pill.getAttribute('data-feeling');
      
      feelingsPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      
      triggerHaptic();
      playSound('tick');
      
      db.feelingsLogs.push({
        time: Date.now(),
        feeling: feeling
      });
      saveDb();
      
      const entries = REFLECTIONS[feeling] || QUOTES;
      const item = entries[Math.floor(Math.random() * entries.length)];
      
      if (reflectionBox) reflectionBox.classList.remove('hidden');
      if (reflectionText) reflectionText.textContent = `"${item.text}"`;
      if (reflectionAuthor) reflectionAuthor.textContent = `— ${item.author}`;
      
      renderMoodTimeline();
      renderAnalytics();
    });
  });
}

function renderMoodTimeline() {
  const timeline = document.getElementById('mood-timeline-bar');
  if (!timeline) return;

  timeline.innerHTML = "";
  const logs = db.feelingsLogs || [];
  if (logs.length === 0) {
    timeline.innerHTML = '<span class="timeline-empty">No feelings logged today.</span>';
    return;
  }
  
  logs.forEach(log => {
    const segment = document.createElement('div');
    segment.className = `mood-bar-segment feel-${log.feeling}`;
    segment.style.width = `${100 / logs.length}%`;
    segment.title = `${log.feeling} logged at ${new Date(log.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    timeline.appendChild(segment);
  });
}

// ── FOCUS TIMER CONTROLLER ──
function updateTimerProgress() {
  const timerClock = document.getElementById('dashboard-timer-clock');
  const timerProgress = document.getElementById('timer-progress');
  if (!timerClock || !timerProgress) return;

  const circumference = 2 * Math.PI * 76;
  const ratio = timerSecondsLeft / timerTotalSeconds;
  const offset = circumference - (ratio * circumference);
  
  timerProgress.style.strokeDasharray = `${circumference} ${circumference}`;
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
  const label = document.getElementById('dashboard-timer-label');
  const toggleBtn = document.getElementById('btn-timer-toggle');

  if (label) label.textContent = "Stay focused";
  if (toggleBtn) {
    toggleBtn.textContent = "Start";
    toggleBtn.className = 'timer-ctrl-btn primary';
  }
  
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent === `${mins}m`) btn.classList.add('active');
  });
}

function setupTimerBindings() {
  const toggleBtn = document.getElementById('btn-timer-toggle');
  const resetBtn = document.getElementById('btn-timer-reset');
  const label = document.getElementById('dashboard-timer-label');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      triggerHaptic();
      if (timerIsRunning) {
        clearInterval(timerInterval);
        timerIsRunning = false;
        if (label) label.textContent = "Paused";
        toggleBtn.textContent = "Resume";
      } else {
        timerIsRunning = true;
        if (label) label.textContent = "Stay focused 🌿";
        toggleBtn.textContent = "Pause";
        
        timerInterval = setInterval(() => {
          timerSecondsLeft--;
          updateTimerProgress();
          
          if (timerSecondsLeft <= 0) {
            clearInterval(timerInterval);
            timerIsRunning = false;
            if (label) label.textContent = "✓ Complete!";
            toggleBtn.textContent = "Start";
            playSound('alarm');
            
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
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      triggerHaptic();
      clearInterval(timerInterval);
      timerIsRunning = false;
      timerSecondsLeft = timerTotalSeconds;
      updateTimerProgress();
      if (label) label.textContent = "Stay focused";
      if (toggleBtn) toggleBtn.textContent = "Start";
    });
  }

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  updateTimerProgress();
}

// ── WATER TRACKER CONTROLLER ──
function updateWaterUI() {
  const fill = document.getElementById('water-fill-level');
  const text = document.getElementById('water-glass-text');
  const count = document.getElementById('water-count');

  if (!fill || !text || !count) return;

  const cups = db.waterIntake || 0;
  const target = db.waterTarget || 8;
  
  count.textContent = cups;
  text.textContent = `${cups} / ${target}`;
  
  const fillPct = Math.min((cups / target) * 100, 100);
  fill.style.height = `${fillPct}%`;
}

function setupWater() {
  const plusBtn = document.getElementById('btn-water-plus');
  const minusBtn = document.getElementById('btn-water-minus');

  if (plusBtn) {
    plusBtn.addEventListener('click', () => {
      triggerHaptic();
      playSound('tick');
      db.waterIntake = (db.waterIntake || 0) + 1;
      saveDb();
      updateWaterUI();
      renderAnalytics();
    });
  }

  if (minusBtn) {
    minusBtn.addEventListener('click', () => {
      triggerHaptic();
      if (db.waterIntake && db.waterIntake > 0) {
        db.waterIntake--;
        saveDb();
        updateWaterUI();
        renderAnalytics();
      }
    });
  }
  updateWaterUI();
}

// ── CHECKLISTS & FOCUS TASKS ──
function setupChecklists() {
  const walkCheck = document.getElementById('habit-walk');
  const meditateCheck = document.getElementById('habit-meditate');
  const screenbedCheck = document.getElementById('habit-screenbed');

  const bindCheck = (el, key) => {
    if (!el) return;
    el.checked = db.habitsChecked[key] || false;
    el.addEventListener('change', () => {
      triggerHaptic();
      db.habitsChecked[key] = el.checked;
      saveDb();
      renderAnalytics();
    });
  };

  bindCheck(walkCheck, 'walk');
  bindCheck(meditateCheck, 'meditate');
  bindCheck(screenbedCheck, 'screenbed');

  const taskForm = document.getElementById('form-add-task');
  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      triggerHaptic();
      
      const input = document.getElementById('input-task-name');
      const text = input ? input.value.trim() : "";
      if (!text) return;
      
      if (!db.customTasks) db.customTasks = [];
      if (db.customTasks.length >= 3) {
        alert("Focus on 3 main tasks first. Less is more.");
        return;
      }
      
      db.customTasks.push({ text, completed: false });
      saveDb();
      
      if (input) input.value = "";
      renderCustomTasks();
      renderAnalytics();
    });
  }
  renderCustomTasks();
}

function renderCustomTasks() {
  const container = document.getElementById('custom-tasks-list');
  if (!container) return;

  container.innerHTML = "";
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
    container.appendChild(item);
  });
  
  // Custom checklist event triggers
  document.querySelectorAll('.task-check-btn').forEach(box => {
    box.addEventListener('change', (e) => {
      triggerHaptic();
      const idx = parseInt(e.target.getAttribute('data-idx'));
      db.customTasks[idx].completed = e.target.checked;
      saveDb();
      renderAnalytics();
    });
  });
  
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

// ── DIGITAL BEDTIME CURFEW ──
function checkBedtimeLock() {
  const bedtime = db.bedtime || "21:30";
  const [bHours, bMinutes] = bedtime.split(":").map(Number);
  const bedtimeMinutes = bHours * 60 + bMinutes;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const morningMinutes = 5 * 60; // 5:00 AM

  let isPastBedtime = false;
  if (bedtimeMinutes > morningMinutes) {
    isPastBedtime = (currentMinutes >= bedtimeMinutes || currentMinutes < morningMinutes);
  } else {
    isPastBedtime = (currentMinutes >= bedtimeMinutes && currentMinutes < morningMinutes);
  }

  const isSnoozed = Date.now() < curfewSnoozeUntil;

  const warningCard = document.getElementById('card-bedtime-warning');
  const lockOverlay = document.getElementById('overlay-curfew-lock');

  if (isPastBedtime) {
    if (warningCard) warningCard.classList.remove('hidden');
    
    // Auto lock overlay if past bedtime, and not snoozed or bypassed
    if (!curfewBypassed && !isSnoozed) {
      if (lockOverlay) lockOverlay.classList.add('open');
    } else {
      if (lockOverlay) lockOverlay.classList.remove('open');
    }
  } else {
    if (warningCard) warningCard.classList.add('hidden');
    if (lockOverlay) lockOverlay.classList.remove('open');
    curfewBypassed = false;
    curozeUntil = 0;
  }
}

function setupCurfewActions() {
  const snoozeBtn = document.getElementById('btn-snooze-curfew');
  const slider = document.getElementById('curfew-unlock-slider');
  const warningLockBtn = document.getElementById('btn-lock-curfew');

  if (snoozeBtn) {
    snoozeBtn.addEventListener('click', () => {
      triggerHaptic();
      // Set snooze for 15 minutes
      curfewSnoozeUntil = Date.now() + 15 * 60 * 1000;
      const overlay = document.getElementById('overlay-curfew-lock');
      if (overlay) overlay.classList.remove('open');
      checkBedtimeLock();
    });
  }

  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (val >= 98) {
        triggerHaptic();
        curfewBypassed = true;
        e.target.value = 0;
        const overlay = document.getElementById('overlay-curfew-lock');
        if (overlay) overlay.classList.remove('open');
        checkBedtimeLock();
      }
    });

    slider.addEventListener('change', (e) => {
      if (parseInt(e.target.value) < 98) {
        e.target.value = 0;
      }
    });
  }

  if (warningLockBtn) {
    warningLockBtn.addEventListener('click', () => {
      triggerHaptic();
      curfewBypassed = false;
      curfewSnoozeUntil = 0;
      checkBedtimeLock();
    });
  }
}

// ── SETTINGS VIEW PREFERENCES ──
function setupSettings() {
  const waterTargetInput = document.getElementById('setting-water-target');
  const bedtimeInput = document.getElementById('setting-bedtime');
  const hapticsCheck = document.getElementById('setting-haptics');
  const soundCheck = document.getElementById('setting-sound');
  const usernameInput = document.getElementById('setting-username');

  // Load preferences values
  if (waterTargetInput) waterTargetInput.value = db.waterTarget || 8;
  if (bedtimeInput) bedtimeInput.value = db.bedtime || "21:30";
  if (hapticsCheck) hapticsCheck.checked = db.hapticsEnabled !== false;
  if (soundCheck) soundCheck.checked = db.soundEnabled === true;
  if (usernameInput) usernameInput.value = db.username || "";

  // Binders settings changes
  if (waterTargetInput) {
    waterTargetInput.addEventListener('change', () => {
      db.waterTarget = parseInt(waterTargetInput.value) || 8;
      saveDb();
      updateWaterUI();
      renderAnalytics();
    });
  }

  if (bedtimeInput) {
    bedtimeInput.addEventListener('change', () => {
      db.bedtime = bedtimeInput.value || "21:30";
      saveDb();
      checkBedtimeLock();
    });
  }

  if (hapticsCheck) {
    hapticsCheck.addEventListener('change', () => {
      db.hapticsEnabled = hapticsCheck.checked;
      saveDb();
      triggerHaptic();
    });
  }

  if (soundCheck) {
    soundCheck.addEventListener('change', () => {
      db.soundEnabled = soundCheck.checked;
      saveDb();
      playSound('tick');
    });
  }

  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      db.username = usernameInput.value;
      saveDb();
      updateGreeting();
    });
  }

  // Theme selection selectors binding
  const themeButtons = document.querySelectorAll('.select-theme-btn');
  themeButtons.forEach(btn => {
    const themeName = btn.getAttribute('data-theme');
    if (themeName === db.theme) btn.classList.add('active');

    btn.addEventListener('click', () => {
      document.body.className = "";
      document.body.classList.add(themeName);
      
      db.theme = themeName;
      saveDb();
      
      themeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      triggerHaptic();
      playSound('tick');
    });
  });

  // Onboarding settings guides binders
  const bindGuideCheck = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.checked = db.guideCheckboxes[key] || false;
    el.addEventListener('change', () => {
      triggerHaptic();
      db.guideCheckboxes[key] = el.checked;
      saveDb();
    });
  };

  bindGuideCheck('guide-pwa', 'pwa');
  bindGuideCheck('guide-distractions', 'distractions');
  bindGuideCheck('guide-grayscale', 'grayscale');

  // Hard Reset Button
  const resetBtn = document.getElementById('btn-reset-storage');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to delete all habits, logs, and statistics? This cannot be undone.")) {
        triggerHaptic();
        localStorage.removeItem('minPhoneData');
        window.location.reload();
      }
    });
  }

  // Set active visual theme from DB directly
  document.body.className = "";
  document.body.classList.add(db.theme || "theme-obsidian");
}

// ── CUSTOM SVG DATA CHARTING (ANALYTICS) ──
function renderAnalytics() {
  const habitPct = calculateHabitsPercent(db);
  const scoreText = document.getElementById('habit-score-text');
  const scoreCircle = document.getElementById('habit-score-circle');

  if (scoreText) scoreText.textContent = `${habitPct}%`;
  
  if (scoreCircle) {
    const habitCirc = 201; // 2 * PI * 32
    const habitOffset = habitCirc - (habitPct / 100) * habitCirc;
    scoreCircle.style.strokeDashoffset = habitOffset;
  }
  
  const sessionAvg = db.opens > 0 ? Math.round((db.screentime / 60000) / db.opens) : 0;
  const avgSessionEl = document.getElementById('analytics-time-avg');
  if (avgSessionEl) avgSessionEl.textContent = `${sessionAvg}m`;
  
  renderMoodTimeline();

  // Weekly detox bar charts SVG generator
  const chartBox = document.getElementById('usage-chart-box');
  if (!chartBox) return;
  chartBox.innerHTML = "";
  
  const dataset = [...db.history];
  dataset.push({
    day: TODAY,
    opens: db.opens,
    minutes: Math.round(db.screentime / 60000),
    water: db.waterIntake,
    habitsPercent: habitPct
  });
  
  const chartData = dataset.slice(-7);
  let maxVal = Math.max(...chartData.map(d => d.minutes), 15);
  
  let svgContent = `
    <svg class="chart-svg" viewBox="0 0 320 120">
      <!-- Grid Lines -->
      <line x1="20" y1="20" x2="300" y2="20" stroke="var(--border)" stroke-width="1" />
      <line x1="20" y1="55" x2="300" y2="55" stroke="var(--border)" stroke-width="1" />
      <line x1="20" y1="90" x2="300" y2="90" stroke="var(--border)" stroke-width="1" />
  `;
  
  const barWidth = 24;
  const spacing = 14;
  const startX = 30;
  
  chartData.forEach((dayData, index) => {
    const x = startX + index * (barWidth + spacing);
    const barHeight = Math.max((dayData.minutes / maxVal) * 70, 4);
    const y = 90 - barHeight;
    
    const isToday = dayData.day === TODAY;
    const barClass = isToday ? 'chart-bar highlight' : 'chart-bar';
    const dayLabel = dayData.day.split(" ")[0];
    
    svgContent += `
      <!-- Bar -->
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" class="${barClass}" rx="3" />
      
      <!-- Label minutes -->
      <text x="${x + barWidth/2}" y="${y - 4}" class="chart-val-text">${dayData.minutes}m</text>
      
      <!-- Label Day -->
      <text x="${x + barWidth/2}" y="106" class="chart-text">${dayLabel}</text>
    `;
  });
  
  svgContent += `</svg>`;
  chartBox.innerHTML = svgContent;
}

// ── ROOT SYSTEM INITIALIZATION ──
function init() {
  loadDatabase();
  initializeDatabase();
  initBatteryAPI();
  
  // Set up elements
  setupQuotes();
  setupDialer();
  setupWhatsApp();
  setupFeelings();
  setupTimerBindings();
  setupWater();
  setupChecklists();
  setupCurfewActions();
  setupSettings();
  
  // Modals overlays mapping
  registerModal('btn-dialer-trigger', 'overlay-dialer', 'btn-dialer-close', renderContacts);
  registerModal('btn-whatsapp-trigger', 'overlay-whatsapp', 'btn-whatsapp-close');
  
  // Set tab buttons binders
  const homeTab = document.getElementById('tab-btn-home');
  const myDayTab = document.getElementById('tab-btn-myday');
  const statsTab = document.getElementById('tab-btn-stats');

  if (homeTab) homeTab.addEventListener('click', () => navigateTo(0));
  if (myDayTab) myDayTab.addEventListener('click', () => navigateTo(1));
  if (statsTab) statsTab.addEventListener('click', () => navigateTo(2));

  // Bind sliding gesture touch handlers
  const viewport = document.querySelector('.viewport');
  if (viewport) {
    viewport.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    viewport.addEventListener('touchend', e => {
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      handleSwipeGesture();
    }, { passive: true });
  }

  // Draw initial clocks and launch update loops
  updateClocks();
  setInterval(updateClocks, 1000);

  // Initial draw greeting and statistics
  updateGreeting();
  try {
    renderAnalytics();
  } catch (e) {
    console.error("Analytics chart render failure:", e);
  }
}

// Kick off system init when DOM is loaded
window.addEventListener('DOMContentLoaded', init);
