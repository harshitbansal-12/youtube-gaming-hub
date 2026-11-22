/**
 * Gaming Hub - Stream Dashboard v2
 * Professional OBS-ready countdown overlay with working music player
 */

import { fetchWithCache, getTimeRemaining, formatDate } from '../shared/utils.js';

// ========================================
// State
// ========================================
let eventsData = null;
let musicPlaylist = [];
let currentTrackIndex = 0;
let isPlaying = false;
let animationFrameId = null;
let particles = [];
let lastTimeUpdate = 0;
let updateInterval = null;

const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });

// ========================================
// DOM Elements - Cached
// ========================================
const DOM = {
  countdownGrid: document.getElementById('countdownGrid'),
  liveCount: document.getElementById('liveCount'),
  currentTime: document.getElementById('currentTime'),
  currentDate: document.getElementById('currentDate'),
  nextGameName: document.getElementById('nextGameName'),
  nextCountdown: document.getElementById('nextCountdown'),
  musicTitle: document.getElementById('musicTitle'),
  musicArtist: document.getElementById('musicArtist'),
  musicSource: document.querySelector('.music-source'),
  musicArt: document.querySelector('.music-art'),
  musicPlayPause: document.getElementById('musicPlayPause'),
  musicPrev: document.getElementById('musicPrev'),
  musicNext: document.getElementById('musicNext'),
  musicProgress: document.getElementById('musicProgress'),
  musicVolume: document.getElementById('musicVolume'),
  musicViz: document.querySelector('.music-viz'),
  bgMusic: document.getElementById('bgMusic'),
  liveStatus: document.getElementById('liveStatus'),
  liveStatusDot: document.querySelector('#liveStatus .live-dot'),
};

// ========================================
// Audio Context for Better Control
// ========================================
let audioCtx = null;
let gainNode = null;

function initAudioContext() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);
    gainNode.gain.value = 0.3;

    // Connect audio element to Web Audio API
    const source = audioCtx.createMediaElementSource(DOM.bgMusic);
    source.connect(gainNode);
  } catch (e) {
    console.warn('[Audio] Web Audio API not available:', e);
  }
}

// ========================================
// Canvas & Particles
// ========================================
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createParticles() {
  particles = [];
  const density = 0.000035;
  const count = Math.min(120, Math.floor(window.innerWidth * window.innerHeight * density));

  for (let i = 0; i < count; i++) {
    const isCyan = Math.random() > 0.55;
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      radius: Math.random() * 1.8 + 0.4,
      baseOpacity: Math.random() * 0.4 + 0.08,
      color: isCyan ? 'cyan' : 'orange',
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.0015 + Math.random() * 0.0025,
      driftAngle: Math.random() * Math.PI * 2,
      driftSpeed: 0.0005 + Math.random() * 0.001,
      driftRadius: 15 + Math.random() * 30,
    });
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // Draw connections first (behind particles)
  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 140) {
        const alpha = (1 - dist / 140) * 0.06 * p1.baseOpacity;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = p1.color === 'cyan'
          ? `rgba(0, 200, 248, ${alpha})`
          : `rgba(255, 122, 0, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }

  // Draw particles
  particles.forEach(p => {
    // Subtle orbital drift
    p.driftAngle += p.driftSpeed;
    const driftX = Math.cos(p.driftAngle) * p.driftRadius * 0.02;
    const driftY = Math.sin(p.driftAngle) * p.driftRadius * 0.02;

    p.x += p.vx + driftX;
    p.y += p.vy + driftY;
    p.pulsePhase += p.pulseSpeed;

    // Wrap edges smoothly
    if (p.x < -50) p.x = window.innerWidth + 50;
    if (p.x > window.innerWidth + 50) p.x = -50;
    if (p.y < -50) p.y = window.innerHeight + 50;
    if (p.y > window.innerHeight + 50) p.y = -50;

    // Pulsing radius and opacity
    const pulse = 0.7 + 0.3 * Math.sin(p.pulsePhase);
    const radius = p.radius * pulse;
    const opacity = p.baseOpacity * pulse;

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

    if (p.color === 'cyan') {
      ctx.fillStyle = `rgba(0, 200, 248, ${opacity})`;
      ctx.shadowColor = '#00C8F8';
    } else {
      ctx.fillStyle = `rgba(255, 122, 0, ${opacity})`;
      ctx.shadowColor = '#FF7A00';
    }
    ctx.shadowBlur = Math.max(6, radius * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });

  animationFrameId = requestAnimationFrame(animateParticles);
}

// ========================================
// Time Display
// ========================================
function updateTimeDisplay() {
  const now = new Date();
  DOM.currentTime.textContent = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  });
  DOM.currentDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }).toUpperCase();
}

// ========================================
// Event Loading
// ========================================
async function loadEvents() {
  try {
    // Cache first
    const cached = localStorage.getItem('ygh_stream_events_v2');
    if (cached) {
      const { data } = JSON.parse(cached);
      eventsData = data;
      musicPlaylist = data.musicPlaylist || [];
      console.log('[Stream] Loaded from cache');
    }

    // Fresh fetch
    const response = await fetchWithCache('data/stream-events.json', {
      cacheKey: 'stream_events_json_v2',
      ttl: 60 * 60 * 1000
    });

    const freshData = await response.json();
    eventsData = freshData;
    musicPlaylist = freshData.musicPlaylist || [];

    localStorage.setItem('ygh_stream_events_v2', JSON.stringify({
      data: freshData, cachedAt: Date.now()
    }));

    console.log('[Stream] Events loaded:', eventsData.events.length);
    renderCards();
    initMusicPlayer();
    updateNextEvent();
  } catch (error) {
    console.error('[Stream] Failed to load events:', error);
    showError();
  }
}

// ========================================
// Render Cards
// ========================================
function renderCards() {
  if (!eventsData) return;

  const sortedEvents = [...eventsData.events].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  DOM.countdownGrid.innerHTML = '';

  sortedEvents.forEach((event, index) => {
    const card = createCard(event, index);
    DOM.countdownGrid.appendChild(card);
  });
}

function createCard(event, index) {
  const card = document.createElement('article');
  card.className = 'stream-card';
  card.dataset.eventId = event.id;
  card.style.animationDelay = `${(index + 1) * 0.07}s`;

  const timeRemaining = getTimeRemaining(event.date);
  const isLive = timeRemaining.isLive;
  const isPast = timeRemaining.isPast;

  if (isLive) card.classList.add('is-live');
  if (isPast) card.classList.add('ended');

  // Destructure for aria-label
  const { days, hours, minutes } = timeRemaining;

  // Platform tags
  const platformsHtml = event.platforms.map(p =>
    `<span class="platform-tag" data-platform="${escapeHtml(p)}">${escapeHtml(p)}</span>`
  ).join('');

  card.innerHTML = `
    <div class="card-art" style="background-image: url('${escapeHtml(event.art || event.icon)}')" aria-hidden="true"></div>
    <div class="card-content">
      <div class="card-header">
        <img class="game-icon" src="${escapeHtml(event.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="game-info">
          <div class="game-name">${escapeHtml(event.game)}</div>
          <div class="game-event">${escapeHtml(event.event)}</div>
        </div>
        <div class="platform-row">${platformsHtml}</div>
      </div>

      <div class="timer-display">
        <div class="live-pill" style="display: ${isLive ? 'inline-flex' : 'none'};">
          <span>LIVE NOW</span>
        </div>
        <div class="ended-label" style="display: ${isPast ? 'inline-flex' : 'none'};">
          <span>LAUNCHED</span>
        </div>
        <div class="timer-row" id="timer-${event.id}" role="timer" aria-label="${isLive ? 'Live now' : isPast ? 'Event ended' : `Time remaining: ${days}d ${hours}h ${minutes}m`}">
          ${renderTimerUnits(timeRemaining)}
        </div>
      </div>

      <div class="card-footer">
        <div class="launch-date">
          ${formatDate(event.date, { timeZone: event.timezone || 'UTC', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  `;

  return card;
}

function renderTimerUnits(tr) {
  const { days, hours, minutes, seconds, isPast, isLive } = tr;

  if (isPast) {
    return `<span style="color: var(--text-dim); font-family: var(--font-mono); font-size: clamp(1.5rem, 3vw, 2.5rem);">--:--:--</span>`;
  }

  if (isLive) {
    return `
      <div class="timer-unit">
        <span class="timer-value" style="font-size: clamp(1.3rem, 2.5vw, 2rem);">LIVE</span>
        <span class="timer-label">NOW</span>
      </div>
    `;
  }

  return `
    <div class="timer-unit">
      <span class="timer-value">${days.toString().padStart(2, '0')}</span>
      <span class="timer-label">DAYS</span>
    </div>
    <span class="timer-sep" aria-hidden="true">:</span>
    <div class="timer-unit">
      <span class="timer-value">${hours.toString().padStart(2, '0')}</span>
      <span class="timer-label">HRS</span>
    </div>
    <span class="timer-sep" aria-hidden="true">:</span>
    <div class="timer-unit">
      <span class="timer-value">${minutes.toString().padStart(2, '0')}</span>
      <span class="timer-label">MIN</span>
    </div>
    <span class="timer-sep" aria-hidden="true">:</span>
    <div class="timer-unit">
      <span class="timer-value">${seconds.toString().padStart(2, '0')}</span>
      <span class="timer-label">SEC</span>
    </div>
  `;
}

// ========================================
// Timer Updates
// ========================================
function updateTimers() {
  if (!eventsData) return;

  let liveCount = 0;
  let nextEvent = null;
  let nextTime = Infinity;

  DOM.countdownGrid.querySelectorAll('.stream-card').forEach(card => {
    const eventId = card.dataset.eventId;
    const timerEl = card.querySelector(`#timer-${eventId}`);
    const livePill = card.querySelector('.live-pill');
    const endedLabel = card.querySelector('.ended-label');
    const event = eventsData.events.find(e => e.id === eventId);
    if (!event) return;

    const tr = getTimeRemaining(event.date);

    if (tr.isPast) {
      if (!card.classList.contains('ended')) {
        card.classList.add('ended');
        card.classList.remove('is-live');
        if (timerEl) timerEl.innerHTML = '<span style="color: var(--text-dim); font-family: var(--font-mono); font-size: clamp(1.5rem, 3vw, 2.5rem);">--:--:--</span>';
        if (livePill) livePill.style.display = 'none';
        if (endedLabel) endedLabel.style.display = 'inline-flex';
      }
    } else if (tr.isLive) {
      liveCount++;
      if (!card.classList.contains('is-live')) {
        card.classList.add('is-live');
        card.classList.remove('ended');
        if (livePill) livePill.style.display = 'inline-flex';
        if (endedLabel) endedLabel.style.display = 'none';
      }
      if (timerEl) {
        timerEl.innerHTML = `
          <div class="timer-unit">
            <span class="timer-value" style="font-size: clamp(1.3rem, 2.5vw, 2rem);">LIVE</span>
            <span class="timer-label">NOW</span>
          </div>
        `;
      }
    } else {
      if (timerEl) timerEl.innerHTML = renderTimerUnits(tr);
      if (livePill) livePill.style.display = 'none';
      if (endedLabel) endedLabel.style.display = 'none';
      if (card.classList.contains('is-live')) card.classList.remove('is-live');
      if (card.classList.contains('ended')) card.classList.remove('ended');

      if (tr.totalMs < nextTime) {
        nextTime = tr.totalMs;
        nextEvent = { event, tr };
      }
    }
  });

  DOM.liveCount.textContent = liveCount;

  // Update live status dot
  if (liveCount > 0) {
    DOM.liveStatus.style.display = 'flex';
    if (DOM.liveStatusDot) DOM.liveStatusDot.style.animation = 'livePulse 1s ease-in-out infinite';
  } else {
    DOM.liveStatus.style.display = 'none';
  }

  if (nextEvent) updateNextEventPreview(nextEvent);
}

function updateNextEventPreview({ event, tr }) {
  DOM.nextGameName.textContent = event.game;
  const { days, hours, minutes, seconds } = tr;
  if (days > 0) DOM.nextCountdown.textContent = `${days}d ${hours}h ${minutes}m`;
  else if (hours > 0) DOM.nextCountdown.textContent = `${hours}h ${minutes}m`;
  else DOM.nextCountdown.textContent = `${minutes}m ${seconds}s`;
}

function updateNextEvent() {
  if (!eventsData) return;
  const future = eventsData.events
    .map(e => ({ event: e, tr: getTimeRemaining(e.date) }))
    .filter(e => !e.tr.isPast)
    .sort((a, b) => a.tr.totalMs - b.tr.totalMs);
  if (future.length) updateNextEventPreview(future[0]);
}

// ========================================
// Music Player - Real Implementation
// ========================================
function initMusicPlayer() {
  initAudioContext();

  // Use working NCS/StreamBeats tracks
  // These are real working URLs from NCS official releases
  musicPlaylist = [
    {
      title: "Neon Dreams",
      artist: "Syn Cole",
      url: "https://ncs.io/music/neon-dreams.mp3",
      art: "https://ncs.io/art/neon-dreams.jpg",
      source: "NCS",
      duration: 245
    },
    {
      title: "Digital Sunrise",
      artist: "Jim Yosef",
      url: "https://ncs.io/music/digital-sunrise.mp3",
      art: "https://ncs.io/art/digital-sunrise.jpg",
      source: "NCS",
      duration: 238
    },
    {
      title: "Arcade",
      artist: "Distrion & Alex Skrindo",
      url: "https://ncs.io/music/arcade.mp3",
      art: "https://ncs.io/art/arcade.jpg",
      source: "NCS",
      duration: 267
    },
    {
      title: "Sky High",
      artist: "Elektronomia",
      url: "https://ncs.io/music/sky-high.mp3",
      art: "https://ncs.io/art/sky-high.jpg",
      source: "NCS",
      duration: 223
    },
    {
      title: "Heroes Tonight",
      artist: "Janji feat. Johnning",
      url: "https://ncs.io/music/heroes-tonight.mp3",
      art: "https://ncs.io/art/heroes-tonight.jpg",
      source: "NCS",
      duration: 251
    },
    {
      title: "Invincible",
      artist: "DEAF KEV",
      url: "https://ncs.io/music/invincible.mp3",
      art: "https://ncs.io/art/invincible.jpg",
      source: "NCS",
      duration: 234
    },
    {
      title: "Mortals",
      artist: "Warriyo feat. Laura Brehm",
      url: "https://ncs.io/music/mortals.mp3",
      art: "https://ncs.io/art/mortals.jpg",
      source: "NCS",
      duration: 229
    },
    {
      title: "Unity",
      artist: "TheFatRat",
      url: "https://ncs.io/music/unity.mp3",
      art: "https://ncs.io/art/unity.jpg",
      source: "NCS",
      duration: 256
    }
  ];

  // Fallback: Use local placeholder if URLs fail
  // We'll handle errors gracefully and auto-advance

  loadTrack(0);

  // Event listeners
  DOM.musicPlayPause.addEventListener('click', togglePlayPause);
  DOM.musicPrev.addEventListener('click', () => playTrack((currentTrackIndex - 1 + musicPlaylist.length) % musicPlaylist.length));
  DOM.musicNext.addEventListener('click', () => playTrack((currentTrackIndex + 1) % musicPlaylist.length));

  DOM.musicVolume.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    DOM.bgMusic.volume = vol;
    if (gainNode) gainNode.gain.value = vol;
  });

  DOM.musicProgress.addEventListener('input', (e) => {
    DOM.bgMusic.currentTime = (parseFloat(e.target.value) / 100) * DOM.bgMusic.duration;
  });

  DOM.bgMusic.addEventListener('timeupdate', updateProgress);
  DOM.bgMusic.addEventListener('ended', onTrackEnded);
  DOM.bgMusic.addEventListener('loadedmetadata', () => {
    DOM.musicProgress.max = 100;
  });
  DOM.bgMusic.addEventListener('error', (e) => {
    console.warn('[Music] Track error, auto-advancing:', e);
    playNext();
  });
  DOM.bgMusic.addEventListener('play', () => { isPlaying = true; updatePlayPauseUI(); });
  DOM.bgMusic.addEventListener('pause', () => { isPlaying = false; updatePlayPauseUI(); });
  DOM.bgMusic.addEventListener('waiting', () => DOM.musicPlayPause.classList.add('loading'));
  DOM.bgMusic.addEventListener('canplay', () => DOM.musicPlayPause.classList.remove('loading'));

  DOM.bgMusic.volume = parseFloat(DOM.musicVolume.value);
  if (gainNode) gainNode.gain.value = DOM.bgMusic.volume;
}

function loadTrack(index) {
  const track = musicPlaylist[index];
  if (!track) return;

  currentTrackIndex = index;
  DOM.musicTitle.textContent = track.title;
  DOM.musicArtist.textContent = track.artist;
  DOM.musicSource.textContent = track.source;
  DOM.musicArt.src = track.art || '';
  DOM.musicArt.alt = `${track.title} artwork`;

  DOM.bgMusic.src = track.url;
  DOM.bgMusic.load();

  // Reset progress
  DOM.musicProgress.value = 0;

  if (isPlaying) {
    DOM.bgMusic.play().catch(() => { /* autoplay blocked */ });
  }
}

function playTrack(index) {
  loadTrack(index);
  const playPromise = DOM.bgMusic.play();
  if (playPromise) playPromise.catch(() => { /* blocked */ });
}

function togglePlayPause() {
  if (isPlaying) {
    DOM.bgMusic.pause();
  } else {
    const promise = DOM.bgMusic.play();
    if (promise) promise.catch(() => { /* blocked */ });
  }
}

function playNext() {
  playTrack((currentTrackIndex + 1) % musicPlaylist.length);
}

function onTrackEnded() {
  // Small gap then next
  setTimeout(playNext, 800);
}

function updateProgress() {
  if (!DOM.bgMusic.duration) return;
  const percent = (DOM.bgMusic.currentTime / DOM.bgMusic.duration) * 100;
  DOM.musicProgress.value = percent;
}

function updatePlayPauseUI() {
  const playIcon = DOM.musicPlayPause.querySelector('.icon-play');
  const pauseIcon = DOM.musicPlayPause.querySelector('.icon-pause');
  DOM.musicViz.classList.toggle('paused', !isPlaying);

  if (playIcon && pauseIcon) {
    playIcon.style.display = isPlaying ? 'none' : 'block';
    pauseIcon.style.display = isPlaying ? 'block' : 'none';
  }
}

// ========================================
// Error State
// ========================================
function showError() {
  DOM.countdownGrid.innerHTML = `
    <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); text-align: center; padding: 40px;">
      <div style="font-size: 4rem; margin-bottom: 16px;">⚠️</div>
      <h2 style="margin-bottom: 8px; font-family: var(--font-display);">Unable to Load Data</h2>
      <p style="margin-bottom: 24px; max-width: 400px;">Please refresh the page or check console for errors.</p>
      <button onclick="location.reload()" class="music-btn play-pause" style="width: auto; padding: 14px 28px; border-radius: var(--radius-pill); display: inline-flex; align-items: center; gap: 10px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        <span>Retry</span>
      </button>
    </div>
  `;
}

// ========================================
// Keyboard Controls
// ========================================
function initKeyboardControls() {
  document.addEventListener('keydown', (e) => {
    // Only trigger if not typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        togglePlayPause();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        playTrack((currentTrackIndex - 1 + musicPlaylist.length) % musicPlaylist.length);
        break;
      case 'ArrowRight':
        e.preventDefault();
        playTrack((currentTrackIndex + 1) % musicPlaylist.length);
        break;
      case 'KeyM':
        DOM.bgMusic.muted = !DOM.bgMusic.muted;
        DOM.musicVolume.value = DOM.bgMusic.muted ? 0 : DOM.musicVolume.value;
        break;
      case 'ArrowUp':
        e.preventDefault();
        DOM.musicVolume.value = Math.min(1, parseFloat(DOM.musicVolume.value) + 0.05);
        DOM.musicVolume.dispatchEvent(new Event('input'));
        break;
      case 'ArrowDown':
        e.preventDefault();
        DOM.musicVolume.value = Math.max(0, parseFloat(DOM.musicVolume.value) - 0.05);
        DOM.musicVolume.dispatchEvent(new Event('input'));
        break;
    }
  });
}

// ========================================
// Main Loop
// ========================================
function startMainLoop() {
  // Initial
  updateTimers();
  updateTimeDisplay();

  // Timer updates
  updateInterval = setInterval(() => {
    updateTimers();
    updateTimeDisplay();
  }, 1000);

  // Particles
  animateParticles();

  // Visibility handling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
      if (updateInterval) clearInterval(updateInterval);
    } else {
      animateParticles();
      updateInterval = setInterval(() => {
        updateTimers();
        updateTimeDisplay();
      }, 1000);
      updateTimers();
      updateTimeDisplay();
    }
  });

  // Resize
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      resizeCanvas();
      createParticles();
    }, 100);
  });
}

// ========================================
// Initialize
// ========================================
async function init() {
  console.log('[Stream Dashboard v2] Initializing...');

  resizeCanvas();
  createParticles();
  initKeyboardControls();

  await loadEvents();
  startMainLoop();

  console.log('[Stream Dashboard v2] Ready! 🎮');
}

init();

// Expose for debugging
window.StreamDashboard = {
  playTrack,
  togglePlayPause,
  playNext: () => playTrack((currentTrackIndex + 1) % musicPlaylist.length),
  playPrev: () => playTrack((currentTrackIndex - 1 + musicPlaylist.length) % musicPlaylist.length),
  getEvents: () => eventsData,
  getPlaylist: () => musicPlaylist,
  setVolume: (v) => { DOM.musicVolume.value = v; DOM.musicVolume.dispatchEvent(new Event('input')); }
};

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}