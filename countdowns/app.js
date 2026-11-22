/**
 * Universal Game Countdown Hub - Main Application
 * Loads events from JSON, renders interactive countdown cards with live timers
 */

import { Utils, fetchWithCache, getTimeRemaining, formatCountdown, formatDate, formatNumber, createElement, $, $$, initTheme, toggleTheme, addUTMParams, debounce } from '../shared/utils.js';

// ========================================
// State
// ========================================
let eventsData = null;
let activeFilter = 'all';
let updateInterval = null;
const UPDATE_INTERVAL_MS = 1000; // Update timers every second

// ========================================
// DOM Elements
// ========================================
const filterTabs = $('#filterTabs');
const categoriesContainer = $('#categoriesContainer');
const liveBanner = $('#liveBanner');
const liveCount = $('#liveCount');
const scrollToLive = $('#scrollToLive');
const lastUpdated = $('#lastUpdated');
const themeToggle = $('#themeToggle');

// ========================================
// Initialization
// ========================================
async function init() {
  // Initialize theme
  initTheme();
  themeToggle.addEventListener('click', () => toggleTheme());

  // Load events data
  await loadEvents();

  // Render filter tabs
  renderFilterTabs();

  // Render all categories
  renderAllCategories();

  // Start timer updates
  startTimerUpdates();

  // Update last updated timestamp
  updateLastUpdated();

  // Set up scroll to live
  scrollToLive.addEventListener('click', (e) => {
    e.preventDefault();
    const liveCard = document.querySelector('.countdown-card.live');
    if (liveCard) {
      liveCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      liveCard.style.animation = 'pulse 1s ease 3';
      setTimeout(() => liveCard.style.animation = '', 3000);
    }
  });

  console.log('[Countdown Hub] Initialized successfully');
}

// ========================================
// Data Loading
// ========================================
async function loadEvents() {
  try {
    // Try to load from localStorage cache first (instant)
    const cached = localStorage.getItem('ygh_events_data');
    if (cached) {
      const { data, cachedAt } = JSON.parse(cached);
      eventsData = data;
      console.log('[Countdown Hub] Loaded from localStorage cache');
    }

    // Fetch fresh data in background
    const response = await fetchWithCache('data/events.json', {
      cacheKey: 'events_json',
      ttl: 60 * 60 * 1000 // 1 hour cache for JSON
    });

    const freshData = await response.json();
    eventsData = freshData;

    // Cache for next visit
    localStorage.setItem('ygh_events_data', JSON.stringify({
      data: freshData,
      cachedAt: Date.now()
    }));

    console.log('[Countdown Hub] Events loaded:', eventsData.events.length, 'events');
  } catch (error) {
    console.error('[Countdown Hub] Failed to load events:', error);
    showError('Failed to load event data. Please refresh the page.');
  }
}

// ========================================
// Rendering
// ========================================
function renderFilterTabs() {
  if (!eventsData) return;

  const categories = eventsData.categories;
  const allTab = createElement('button', {
    class: 'filter-tab active',
    role: 'tab',
    'aria-selected': 'true',
    'data-filter': 'all',
    onclick: () => setFilter('all')
  }, 'All Events');

  const categoryTabs = categories.map(cat => createElement('button', {
    class: 'filter-tab',
    role: 'tab',
    'aria-selected': 'false',
    'data-filter': cat.id,
    onclick: () => setFilter(cat.id)
  }, `${cat.icon} ${cat.name}`));

  filterTabs.append(allTab, ...categoryTabs);
}

function renderAllCategories() {
  if (!eventsData) return;

  categoriesContainer.innerHTML = '';

  const categories = activeFilter === 'all'
    ? eventsData.categories
    : eventsData.categories.filter(c => c.id === activeFilter);

  categories.forEach(category => {
    const categoryEvents = eventsData.events
      .filter(e => activeFilter === 'all' || e.category === activeFilter)
      .filter(e => e.category === category.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (categoryEvents.length === 0) return;

    const section = createElement('section', { class: 'category-section', 'data-category': category.id });
    section.innerHTML = `
      <div class="category-header">
        <h2 class="category-title">
          <span style="color: ${category.color}; font-size: 1.5rem;">${category.icon}</span>
          ${category.name}
          <span class="category-count">${categoryEvents.length} event${categoryEvents.length !== 1 ? 's' : ''}</span>
        </h2>
      </div>
      <div class="countdown-grid" id="grid-${category.id}"></div>
    `;
    categoriesContainer.appendChild(section);

    const grid = $(`#grid-${category.id}`);
    categoryEvents.forEach(event => {
      grid.appendChild(createCountdownCard(event, category));
    });
  });

  // Update live banner
  updateLiveBanner();
}

function createCountdownCard(event, category) {
  const card = createElement('article', {
    class: 'countdown-card',
    'data-event-id': event.id,
    'data-category': event.category
  });

  const timeRemaining = getTimeRemaining(event.date);
  const isLive = timeRemaining.isLive;
  const isPast = timeRemaining.isPast;

  if (isLive) card.classList.add('live');
  if (isPast) card.classList.add('ended');

  // Build badges
  const badges = [];
  if (isLive) badges.push(createElement('span', { class: 'badge badge-live' }, 'LIVE NOW'));
  else if (isPast) badges.push(createElement('span', { class: 'badge badge-ended' }, 'Ended'));
  else badges.push(createElement('span', { class: 'badge badge-soon' }, 'UPCOMING'));

  badges.push(createElement('span', { class: 'badge badge-category', style: `background: ${category.color}20; color: ${category.color};` }, category.name));

  // Format platforms
  const platformsHtml = event.platforms.map(p => `<span class="badge badge-category" style="background: var(--bg-tertiary); color: var(--text-secondary); font-size: 0.625rem;">${p}</span>`).join('');

  // Countdown timer HTML
  let timerHtml = '';
  if (isPast) {
    timerHtml = `<div class="countdown" style="justify-content: center;"><span style="color: var(--text-muted); font-family: var(--font-mono);">Event Ended</span></div>`;
  } else if (isLive) {
    timerHtml = `<div class="countdown" style="justify-content: center;"><span class="live-indicator"><span class="live-dot"></span>LIVE NOW</span></div>`;
  } else {
    timerHtml = `<div class="countdown" id="timer-${event.id}">${renderCountdownUnits(timeRemaining)}</div>`;
  }

  card.innerHTML = `
    <div class="countdown-card-header">
      <div class="countdown-game">
        <img class="countdown-game-icon" src="${event.icon}" alt="" loading="lazy" onerror="this.style.display='none'">
        <div class="countdown-game-info">
          <div class="countdown-game-name">${escapeHtml(event.game)}</div>
          <div class="countdown-event-name">${escapeHtml(event.event)}</div>
        </div>
      </div>
      <div class="countdown-timer">${timerHtml}</div>
    </div>

    <div class="countdown-body">
      <div class="countdown-meta">
        <div class="badges" style="display: flex; flex-wrap: wrap; gap: 6px;">${badges.map(b => b.outerHTML).join('')}</div>
        <div class="platforms" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">${platformsHtml}</div>
        <div class="countdown-date" style="margin-top: 8px;">
          📅 ${formatDate(event.date, { timeZone: event.timezone || 'UTC' })} ${event.timezone ? `(${event.timezone})` : '(UTC)'}
        </div>
        ${event.notes ? `<div class="countdown-notes" style="margin-top: 8px; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5;">${escapeHtml(event.notes)}</div>` : ''}
      </div>

      <div class="countdown-actions">
        ${event.url ? `<a href="${addUTMParams(event.url, 'countdown-hub')}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">Official Site</a>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="shareEvent('${event.id}')" aria-label="Share ${escapeHtml(event.game)} ${escapeHtml(event.event)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><path d="M13 19a5 5 0 0 1-5-5 5 5 0 0 1 5-5"/>
          </svg>
          Share
        </button>
      </div>
    </div>
  `;

  return card;
}

function renderCountdownUnits(timeRemaining) {
  const { days, hours, minutes, seconds } = timeRemaining;
  return `
    <div class="countdown-unit"><span class="countdown-value">${days.toString().padStart(2, '0')}</span><span class="countdown-label">Days</span></div>
    <span class="countdown-separator" aria-hidden="true">:</span>
    <div class="countdown-unit"><span class="countdown-value">${hours.toString().padStart(2, '0')}</span><span class="countdown-label">Hours</span></div>
    <span class="countdown-separator" aria-hidden="true">:</span>
    <div class="countdown-unit"><span class="countdown-value">${minutes.toString().padStart(2, '0')}</span><span class="countdown-label">Mins</span></div>
    <span class="countdown-separator" aria-hidden="true">:</span>
    <div class="countdown-unit"><span class="countdown-value">${seconds.toString().padStart(2, '0')}</span><span class="countdown-label">Secs</span></div>
  `;
}

function updateCountdownTimers() {
  if (!eventsData) return;

  let liveCountNum = 0;

  eventsData.events.forEach(event => {
    const timerEl = $(`#timer-${event.id}`);
    if (!timerEl) return;

    const timeRemaining = getTimeRemaining(event.date);
    const card = $(`[data-event-id="${event.id}"]`);

    if (timeRemaining.isPast) {
      timerEl.innerHTML = '<span style="color: var(--text-muted); font-family: var(--font-mono);">Event Ended</span>';
      if (card && !card.classList.contains('ended')) {
        card.classList.add('ended');
        card.classList.remove('live');
        // Update badge
        const badge = card.querySelector('.badge-soon, .badge-live');
        if (badge) {
          badge.className = 'badge badge-ended';
          badge.textContent = 'Ended';
        }
      }
    } else if (timeRemaining.isLive) {
      liveCountNum++;
      timerEl.innerHTML = '<span class="live-indicator"><span class="live-dot"></span>LIVE NOW</span>';
      if (card && !card.classList.contains('live')) {
        card.classList.add('live');
        card.classList.remove('ended');
        const badge = card.querySelector('.badge-soon, .badge-ended');
        if (badge) {
          badge.className = 'badge badge-live';
          badge.textContent = 'LIVE NOW';
        }
      }
    } else {
      timerEl.innerHTML = renderCountdownUnits(timeRemaining);
    }
  });

  // Update live banner
  liveCount.textContent = liveCountNum;
  liveBanner.style.display = liveCountNum > 0 ? 'flex' : 'none';
}

// ========================================
// Filter Handling
// ========================================
function setFilter(filterId) {
  activeFilter = filterId;

  // Update tab states
  $$('.filter-tab').forEach(tab => {
    const isActive = tab.dataset.filter === filterId;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive);
  });

  // Re-render categories
  renderAllCategories();
}

// ========================================
// Live Banner
// ========================================
function updateLiveBanner() {
  const liveEvents = eventsData.events.filter(e => {
    const tr = getTimeRemaining(e.date);
    return tr.isLive;
  });
  liveCount.textContent = liveEvents.length;
  liveBanner.style.display = liveEvents.length > 0 ? 'flex' : 'none';
}

// ========================================
// Timer Updates
// ========================================
function startTimerUpdates() {
  // Initial update
  updateCountdownTimers();

  // Set up interval
  updateInterval = setInterval(updateCountdownTimers, UPDATE_INTERVAL_MS);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (updateInterval) clearInterval(updateInterval);
  });

  // Pause when tab hidden (performance)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(updateInterval);
    } else {
      updateCountdownTimers(); // Immediate update on return
      updateInterval = setInterval(updateCountdownTimers, UPDATE_INTERVAL_MS);
    }
  });
}

function updateLastUpdated() {
  if (eventsData?.lastUpdated) {
    lastUpdated.textContent = formatDate(eventsData.lastUpdated, { hour: '2-digit', minute: '2-digit' });
  } else {
    lastUpdated.textContent = 'Just now';
  }
}

// ========================================
// Share Functionality
// ========================================
window.shareEvent = async function(eventId) {
  const event = eventsData.events.find(e => e.id === eventId);
  if (!event) return;

  const shareData = {
    title: `${event.game}: ${event.event}`,
    text: `Countdown: ${event.game} - ${event.event} starts ${formatDate(event.date)}`,
    url: window.location.origin + window.location.pathname + `?event=${eventId}`
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (err) {
      if (err.name !== 'AbortError') fallbackShare(shareData);
    }
  } else {
    fallbackShare(shareData);
  }
};

function fallbackShare(shareData) {
  navigator.clipboard.writeText(shareData.url).then(() => {
    // Show toast notification
    showToast('Link copied to clipboard!');
  }).catch(() => {
    showToast('Unable to copy link');
  });
}

// ========================================
// Toast Notifications
// ========================================
function showToast(message) {
  const toast = createElement('div', {
    class: 'toast',
    style: `
      position: fixed; bottom: 24px; right: 24px; z-index: 1000;
      background: var(--bg-card); border: 1px solid var(--border-primary);
      padding: 12px 20px; border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg); animation: slideIn 0.3s ease;
    `
  }, message);

  // Add animation styles if not present
  if (!$('#toast-styles')) {
    const style = createElement('style', { id: 'toast-styles' }, `
      @keyframes slideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes slideOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }
    `);
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========================================
// Error Handling
// ========================================
function showError(message) {
  categoriesContainer.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
      <div class="empty-state-icon">⚠️</div>
      <h3>Unable to Load Events</h3>
      <p>${escapeHtml(message)}</p>
      <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 16px;">Retry</button>
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
// URL Parameter Handling (deep linking)
// ========================================
function handleUrlParams() {
  const eventId = new URLSearchParams(window.location.search).get('event');
  if (eventId) {
    setTimeout(() => {
      const card = $(`[data-event-id="${eventId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.animation = 'pulse 1s ease 3';
        setTimeout(() => card.style.animation = '', 3000);
      }
    }, 500);
  }
}

// ========================================
// Start App
// ========================================
init().then(handleUrlParams);

// Export for debugging
window.CountdownHub = {
  getEvents: () => eventsData,
  refresh: () => loadEvents().then(renderAllCategories),
  setFilter
};