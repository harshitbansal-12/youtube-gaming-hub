/**
 * Gaming Hub - Stream Dashboard
 * Fullscreen OBS-ready countdown dashboard with particle background and music player
 */

import { fetchWithCache, getTimeRemaining, formatDate, formatNumber } from '../shared/utils.js';

// ========================================
// State
// ========================================
let eventsData = null;
let cards = [];
let musicPlaylist = [];
let currentTrackIndex = 0;
let isPlaying = false;
let animationFrameId = null;
let particles = [];
const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');

// ========================================
// DOM Elements
// ========================================
const countdownGrid = document.getElementById('countdownGrid');
const liveCount = document.getElementById('liveCount');
const currentTimeEl = document.getElementById('currentTime');
const currentDateEl = document.getElementById('currentDate');
const nextGameName = document.getElementById('nextGameName');
const nextCountdown = document.getElementById('nextCountdown');
const musicTitle = document.getElementById('musicTitle');
const musicArtist = document.getElementById('musicArtist');
const musicPlayPause = document.getElementById('musicPlayPause');
const musicPrev = document.getElementById('musicPrev');
const musicNext = document.getElementById('musicNext');
const musicVolume = document.getElementById('musicVolume');
const musicVisualizer = document.querySelector('.music-visualizer');
const bgMusic = document.getElementById('bgMusic');

// ========================================
// Canvas & Particles
// ========================================
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.scale(dpr, dpr);
}

function createParticles() {
  particles = [];
  const count = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 15000));

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.6 ? 'cyan' : 'orange',
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.002 + Math.random() * 0.003
    });
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  particles.forEach(p => {
    // Update position
    p.x += p.vx;
    p.y += p.vy;
    p.pulsePhase += p.pulseSpeed;

    // Wrap around edges
    if (p.x < 0) p.x = window.innerWidth;
    if (p.x > window.innerWidth) p.x = 0;
    if (p.y < 0) p.y = window.innerHeight;
    if (p.y > window.innerHeight) p.y = 0;

    // Draw particle
    const pulseOpacity = p.opacity * (0.5 + 0.5 * Math.sin(p.pulsePhase));
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * (0.8 + 0.4 * Math.sin(p.pulsePhase)), 0, Math.PI * 2);

    if (p.color === 'cyan') {
      ctx.fillStyle = `rgba(0, 200, 248, ${pulseOpacity})`;
      ctx.shadowColor = '#00C8F8';
    } else {
      ctx.fillStyle = `rgba(255, 122, 0, ${pulseOpacity})`;
      ctx.shadowColor = '#FF7A00';
    }
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw connections to nearby particles
    particles.forEach(p2 => {
      if (p === p2) return;
      const dx = p2.x - p.x;
      const dy = p2.y - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120) {
        const alpha = (1 - dist / 120) * 0.08 * pulseOpacity;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = p.color === 'cyan' ? `rgba(0, 200, 248, ${alpha})` : `rgba(255, 122, 0, ${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    });
  });

  animationFrameId = requestAnimationFrame(animateParticles);
}

// ========================================
// Time Display
// ========================================
function updateTimeDisplay() {
  const now = new Date();
  currentTimeEl.textContent = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  currentDateEl.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).toUpperCase();
}

// ========================================
// Event Loading
// ========================================
async function loadEvents() {
  try {
    // Try cache first
    const cached = localStorage.getItem('ygh_stream_events');
    if (cached) {
      const { data } = JSON.parse(cached);
      eventsData = data;
      musicPlaylist = data.musicPlaylist || [];
      console.log('[Stream Dashboard] Loaded from cache');
    }

    // Fetch fresh
    const response = await fetchWithCache('data/stream-events.json', {
      cacheKey: 'stream_events_json',
      ttl: 60 * 60 * 1000
    });

    const freshData = await response.json();
    eventsData = freshData;
    musicPlaylist = freshData.musicPlaylist || [];

    localStorage.setItem('ygh_stream_events', JSON.stringify({
      data: freshData,
      cachedAt: Date.now()
    }));

    console.log('[Stream Dashboard] Events loaded:', eventsData.events.length);
    renderCards();
    initMusicPlayer();
    updateNextEvent();
  } catch (error) {
    console.error('[Stream Dashboard] Failed to load events:', error);
    showError();
  }
}

// ========================================
// Render Countdown Cards
// ========================================
function renderCards() {
  if (!eventsData) return;

  // Sort by date (soonest first)
  const sortedEvents = [...eventsData.events].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  countdownGrid.innerHTML = '';
  cards = [];

  sortedEvents.forEach((event, index) => {
    const card = createCard(event, index);
    countdownGrid.appendChild(card);
    cards.push({ element: card, event });
  });
}

function createCard(event, index) {
  const card = document.createElement('article');
  card.className = 'stream-card';
  card.dataset.eventId = event.id;
  card.style.animationDelay = `${(index + 1) * 0.1}s`;

  const timeRemaining = getTimeRemaining(event.date);
  const isLive = timeRemaining.isLive;
  const isPast = timeRemaining.isPast;

  if (isLive) card.classList.add('is-live');
  if (isPast) card.classList.add('ended');

  // Platform tags with colors
  const platformColors = {
    'PS5': '#006FCD',
    'Xbox': '#107C10',
    'PC': '#6B7280',
    'Switch': '#E60012',
    'PS4': '#006FCD'
  };

  const platformsHtml = event.platforms.map(p => `
    <span class="platform-tag" style="background: ${platformColors[p] || 'var(--color-cyan)'}20; color: ${platformColors[p] || 'var(--color-cyan)'}; border-color: ${platformColors[p] || 'var(--color-cyan)'}50;">
      ${p}
    </span>
  `).join('');

  card.innerHTML = `
    <div class="card-art" style="background-image: url('${event.art || event.icon}')" aria-hidden="true"></div>
    <div class="card-content">
      <div class="card-header">
        <img class="game-icon" src="${event.icon}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="game-info">
          <div class="game-name">${escapeHtml(event.game)}</div>
          <div class="game-event">${escapeHtml(event.event)}</div>
        </div>
        <div class="game-platforms">${platformsHtml}</div>
      </div>

      <div class="countdown-display">
        <div class="live-badge" style="display: ${isLive ? 'flex' : 'none'};">
          <span>LIVE NOW</span>
        </div>
        <div class="timer-row" id="timer-${event.id}">
          ${renderTimerUnits(timeRemaining)}
        </div>
        ${isPast ? '<div class="ended-text" style="color: var(--text-muted); font-weight: 600;">LAUNCHED</div>' : ''}
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

function renderTimerUnits(timeRemaining) {
  const { days, hours, minutes, seconds, isPast, isLive } = timeRemaining;

  if (isPast) {
    return `<span style="color: var(--text-muted); font-family: var(--font-mono); font-size: clamp(1.5rem, 3vw, 2.5rem);">--:--:--</span>`;
  }

  if (isLive) {
    return `
      <div class="timer-unit">
        <span class="timer-value" style="font-size: clamp(1.5rem, 3vw, 2.5rem);">LIVE</span>
        <span class="timer-label">NOW</span>
      </div>
    `;
  }

  return `
    <div class="timer-unit">
      <span class="timer-value">${days.toString().padStart(2, '0')}</span>
      <span class="timer-label">Days</span>
    </div>
    <span class="timer-separator" aria-hidden="true">:</span>
    <div class="timer-unit">
      <span class="timer-value">${hours.toString().padStart(2, '0')}</span>
      <span class="timer-label">Hours</span>
    </div>
    <span class="timer-separator" aria-hidden="true">:</span>
    <div class="timer-unit">
      <span class="timer-value">${minutes.toString().padStart(2, '0')}</span>
      <span class="timer-label">Mins</span>
    </div>
    <span class="timer-separator" aria-hidden="true">:</span>
    <div class="timer-unit">
      <span class="timer-value">${seconds.toString().padStart(2, '0')}</span>
      <span class="timer-label">Secs</span>
    </div>
  `;
}

// ========================================
// Update Timers
// ========================================
function updateTimers() {
  if (!eventsData) return;

  let liveCountNum = 0;
  let nextEvent = null;
  let nextEventTime = Infinity;

  cards.forEach(({ element, event }) => {
    const timerEl = element.querySelector(`#timer-${event.id}`);
    const liveBadge = element.querySelector('.live-badge');
    const timeRemaining = getTimeRemaining(event.date);

    if (timeRemaining.isPast) {
      if (!element.classList.contains('ended')) {
        element.classList.add('ended');
        element.classList.remove('is-live');
        if (timerEl) timerEl.innerHTML = '<span style="color: var(--text-muted); font-family: var(--font-mono); font-size: clamp(1.5rem, 3vw, 2.5rem);">--:--:--</span>';
        if (liveBadge) liveBadge.style.display = 'none';
        // Add ended text
        const countdownDisplay = element.querySelector('.countdown-display');
        if (countdownDisplay && !countdownDisplay.querySelector('.ended-text')) {
          countdownDisplay.insertAdjacentHTML('beforeend', '<div class="ended-text" style="color: var(--text-muted); font-weight: 600;">LAUNCHED</div>');
        }
      }
    } else if (timeRemaining.isLive) {
      liveCountNum++;
      if (!element.classList.contains('is-live')) {
        element.classList.add('is-live');
        element.classList.remove('ended');
        if (liveBadge) liveBadge.style.display = 'flex';
      }
      if (timerEl) {
        timerEl.innerHTML = `
          <div class="timer-unit">
            <span class="timer-value" style="font-size: clamp(1.5rem, 3vw, 2.5rem);">LIVE</span>
            <span class="timer-label">NOW</span>
          </div>
        `;
      }
      // Remove ended text if present
      const endedText = element.querySelector('.ended-text');
      if (endedText) endedText.remove();
    } else {
      if (timerEl) {
        timerEl.innerHTML = renderTimerUnits(timeRemaining);
      }
      if (liveBadge) liveBadge.style.display = 'none';
      const endedText = element.querySelector('.ended-text');
      if (endedText) endedText.remove();

      // Track next event
      if (timeRemaining.totalMs < nextEventTime) {
        nextEventTime = timeRemaining.totalMs;
        nextEvent = { event, timeRemaining };
      }
    }
  });

  liveCount.textContent = liveCountNum;

  // Update next event preview
  if (nextEvent) {
    updateNextEventPreview(nextEvent);
  }

  updateTimeDisplay();
}

function updateNextEventPreview({ event, timeRemaining }) {
  nextGameName.textContent = event.game;
  const { days, hours, minutes } = timeRemaining;
  if (days > 0) {
    nextCountdown.textContent = `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    nextCountdown.textContent = `${hours}h ${minutes}m`;
  } else {
    nextCountdown.textContent = `${minutes}m ${timeRemaining.seconds}s`;
  }
}

function updateNextEvent() {
  // Called on init, will be updated by updateTimers
  if (!eventsData) return;

  const futureEvents = eventsData.events
    .map(e => ({ event: e, timeRemaining: getTimeRemaining(e.date) }))
    .filter(e => !e.timeRemaining.isPast)
    .sort((a, b) => a.timeRemaining.totalMs - b.timeRemaining.totalMs);

  if (futureEvents.length > 0) {
    updateNextEventPreview(futureEvents[0]);
  }
}

// ========================================
// Music Player
// ========================================
function initMusicPlayer() {
  if (musicPlaylist.length === 0) {
    musicTitle.textContent = 'No music loaded';
    musicArtist.textContent = 'Add tracks to stream-events.json';
    return;
  }

  // Load first track
  loadTrack(currentTrackIndex);

  // Event listeners
  musicPlayPause.addEventListener('click', togglePlayPause);
  musicPrev.addEventListener('click', playPrevious);
  musicNext.addEventListener('click', playNext);
  musicVolume.addEventListener('input', (e) => {
    bgMusic.volume = parseFloat(e.target.value);
  });

  bgMusic.addEventListener('ended', playNext);
  bgMusic.addEventListener('play', () => {
    isPlaying = true;
    updatePlayPauseIcon();
    musicVisualizer.classList.add('playing');
  });
  bgMusic.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayPauseIcon();
    musicVisualizer.classList.remove('playing');
  });
  bgMusic.addEventListener('error', () => {
    console.warn('[Music] Track failed, playing next');
    playNext();
  });

  // Set initial volume
  bgMusic.volume = parseFloat(musicVolume.value);
}

function loadTrack(index) {
  const track = musicPlaylist[index];
  if (!track) return;

  currentTrackIndex = index;
  musicTitle.textContent = track.title;
  musicArtist.textContent = `${track.artist} • ${track.source}`;

  bgMusic.src = track.url;
  bgMusic.load();

  if (isPlaying) {
    bgMusic.play().catch(() => { /* autoplay blocked */ });
  }
}

function playTrack(index) {
  loadTrack(index);
  bgMusic.play().catch(() => { /* autoplay blocked */ });
}

function togglePlayPause() {
  if (isPlaying) {
    bgMusic.pause();
  } else {
    bgMusic.play().catch(() => { /* autoplay blocked */ });
  }
}

function playPrevious() {
  const newIndex = (currentTrackIndex - 1 + musicPlaylist.length) % musicPlaylist.length;
  playTrack(newIndex);
}

function playNext() {
  const newIndex = (currentTrackIndex + 1) % musicPlaylist.length;
  playTrack(newIndex);
}

function updatePlayPauseIcon() {
  const playIcon = musicPlayPause.querySelector('.icon-play');
  const pauseIcon = musicPlayPause.querySelector('.icon-pause');
  if (isPlaying) {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
  } else {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
  }
}

// ========================================
// Error Handling
// ========================================
function showError() {
  countdownGrid.innerHTML = `
    <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-muted); text-align: center; padding: 40px;">
      <div style="font-size: 4rem; margin-bottom: 16px;">⚠️</div>
      <h2 style="margin-bottom: 8px;">Unable to Load Data</h2>
      <p style="margin-bottom: 24px;">Please refresh the page or check console for errors.</p>
      <button onclick="location.reload()" class="music-btn music-play" style="width: auto; padding: 12px 24px; border-radius: 12px; background: linear-gradient(135deg, var(--color-cyan), var(--color-orange));">
        <span style="margin-left: 8px;">Retry</span>
      </button>
    </div>
  `;
}

// ========================================
// Utility
// ========================================
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========================================
// Main Loop
// ========================================
function startMainLoop() {
  // Initial updates
  updateTimers();
  updateTimeDisplay();

  // Timer updates every second
  setInterval(updateTimers, 1000);

  // Time display updates every second
  setInterval(updateTimeDisplay, 1000);

  // Start particle animation
  animateParticles();

  // Handle visibility change (pause when tab hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
    } else {
      animateParticles();
    }
  });

  // Handle resize
  window.addEventListener('resize', () => {
    resizeCanvas();
    createParticles();
  });
}

// ========================================
// Initialize
// ========================================
async function init() {
  console.log('[Stream Dashboard] Initializing...');

  // Setup canvas
  resizeCanvas();
  createParticles();

  // Load events
  await loadEvents();

  // Start main loop
  startMainLoop();

  console.log('[Stream Dashboard] Ready for streaming!');
}

// Auto-start
init();

// Expose for debugging
window.StreamDashboard = {
  playTrack,
  togglePlayPause,
  playNext,
  playPrevious,
  events: () => eventsData
};

// Keyboard shortcuts for stream control
document.addEventListener('keydown', (e) => {
  // Space = Play/Pause
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    togglePlayPause();
  }
  // Left/Right = Previous/Next track
  if (e.code === 'ArrowLeft') playPrevious();
  if (e.code === 'ArrowRight') playNext();
  // M = Mute toggle
  if (e.code === 'KeyM') {
    bgMusic.muted = !bgMusic.muted;
    musicVolume.value = bgMusic.muted ? 0 : musicVolume.value;
  }
});