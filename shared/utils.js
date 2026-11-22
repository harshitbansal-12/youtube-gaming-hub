/**
 * Shared Utilities for YouTube Gaming Hub
 * Common helpers for date formatting, caching, API calls, etc.
 */

// ========================================
// Cache Management
// ========================================

const CACHE_PREFIX = 'ygh_';
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch with localStorage caching and automatic expiration
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options + cache options
 * @returns {Promise<Response>}
 */
export async function fetchWithCache(url, options = {}) {
  const {
    cacheKey = null,
    ttl = DEFAULT_CACHE_TTL,
    forceRefresh = false,
    ...fetchOptions
  } = options;

  const key = cacheKey || `fetch_${url}`;
  const fullKey = `${CACHE_PREFIX}${key}`;

  // Check cache first (unless forced refresh)
  if (!forceRefresh) {
    const cached = getCache(fullKey);
    if (cached) {
      console.log(`[Cache HIT] ${key}`);
      return new Response(JSON.stringify(cached.data), {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'HIT' }
      });
    }
  }

  console.log(`[Cache MISS] ${key}`);
  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    setCache(fullKey, data, ttl);
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'MISS' }
    });
  } catch (error) {
    // Try to return stale cache on error
    const stale = getCache(fullKey, true);
    if (stale) {
      console.warn(`[Cache STALE] ${key} - returning expired data`);
      return new Response(JSON.stringify(stale.data), {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'STALE' }
      });
    }
    throw error;
  }
}

function getCache(key, allowExpired = false) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const { data, expires } = JSON.parse(item);
    if (!allowExpired && Date.now() > expires) return null;
    return { data, expires };
  } catch { return null; }
}

function setCache(key, data, ttl) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      expires: Date.now() + ttl,
      cachedAt: Date.now()
    }));
  } catch (e) {
    // Storage full - clear old entries
    clearOldCache();
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        expires: Date.now() + ttl,
        cachedAt: Date.now()
      }));
    } catch { /* ignore */ }
  }
}

function clearOldCache() {
  const now = Date.now();
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      try {
        const { expires } = JSON.parse(localStorage.getItem(key));
        if (expires < now) localStorage.removeItem(key);
      } catch { localStorage.removeItem(key); }
    }
  }
}

// ========================================
// Date & Time Formatting
// ========================================

/**
 * Format time remaining until target date
 * @param {Date|number|string} target - Target date
 * @returns {Object} { days, hours, minutes, seconds, totalMs, isPast, isLive }
 */
export function getTimeRemaining(target) {
  const targetTime = new Date(target).getTime();
  const now = Date.now();
  const diff = targetTime - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isPast: true, isLive: false };
  }

  // Consider "live" if within 30 minutes of target
  const isLive = diff < 30 * 60 * 1000;

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    totalMs: diff,
    isPast: false,
    isLive
  };
}

/**
 * Format countdown for display
 * @param {Object} timeRemaining - Output from getTimeRemaining
 * @param {Object} options - Formatting options
 * @returns {string}
 */
export function formatCountdown(timeRemaining, options = {}) {
  const { compact = false, showSeconds = true, hideZeroDays = false } = options;
  const { days, hours, minutes, seconds, isPast, isLive } = timeRemaining;

  if (isPast) return 'Ended';
  if (isLive) return showSeconds ? 'LIVE NOW' : 'LIVE';

  const parts = [];

  if (days > 0 || !hideZeroDays) {
    parts.push(`${days}d`);
  }
  if (days > 0 || hours > 0 || !compact) {
    parts.push(`${hours.toString().padStart(2, '0')}h`);
  }
  if (!compact || days === 0) {
    parts.push(`${minutes.toString().padStart(2, '0')}m`);
  }
  if (showSeconds && (days === 0 || !compact)) {
    parts.push(`${seconds.toString().padStart(2, '0')}s`);
  }

  return parts.join(compact ? ' ' : ' : ');
}

/**
 * Format date for display
 * @param {Date|number|string} date
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string}
 */
export function formatDate(date, options = {}) {
  const defaultOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  return new Date(date).toLocaleDateString(undefined, defaultOptions);
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param {Date|number|string} date
 * @returns {string}
 */
export function formatRelativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  const units = [
    { name: 'year', ms: 365.25 * 24 * 60 * 60 * 1000 },
    { name: 'month', ms: 30.44 * 24 * 60 * 60 * 1000 },
    { name: 'week', ms: 7 * 24 * 60 * 60 * 1000 },
    { name: 'day', ms: 24 * 60 * 60 * 1000 },
    { name: 'hour', ms: 60 * 60 * 1000 },
    { name: 'minute', ms: 60 * 1000 },
    { name: 'second', ms: 1000 }
  ];

  for (const unit of units) {
    const value = Math.floor(absDiff / unit.ms);
    if (value >= 1) {
      return `${value} ${unit.name}${value > 1 ? 's' : ''} ${isPast ? 'ago' : 'from now'}`;
    }
  }
  return 'just now';
}

// ========================================
// Number Formatting
// ========================================

/**
 * Format number with abbreviations (1.2K, 1.5M, etc.)
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

/**
 * Format viewer count for display
 * @param {number} count
 * @returns {string}
 */
export function formatViewers(count) {
  return formatNumber(count) + ' viewers';
}

// ========================================
// DOM Utilities
// ========================================

/**
 * Create element with attributes and children
 * @param {string} tag
 * @param {Object} attrs
 * @param {...Node|string} children
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  });
  children.flat().forEach(child => {
    if (child instanceof Node) el.appendChild(child);
    else if (child != null) el.appendChild(document.createTextNode(String(child)));
  });
  return el;
}

/**
 * Safe query selector
 * @param {string} selector
 * @param {Element} root
 * @returns {Element|null}
 */
export function $(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Safe query selector all
 * @param {string} selector
 * @param {Element} root
 * @returns {NodeList}
 */
export function $$(selector, root = document) {
  return root.querySelectorAll(selector);
}

/**
 * Debounce function
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function
 * @param {Function} fn
 * @param {number} limit
 * @returns {Function}
 */
export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// ========================================
// Theme Management
// ========================================

export function initTheme() {
  const saved = localStorage.getItem('ygh_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ygh_theme', next);
  return next;
}

// ========================================
// URL & Query String Helpers
// ========================================

export function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function setQueryParam(name, value) {
  const url = new URL(window.location);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  window.history.replaceState({}, '', url);
}

// ========================================
// Analytics / UTM Helpers
// ========================================

export function addUTMParams(url, source = 'gaming-hub') {
  const u = new URL(url);
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', 'web');
  u.searchParams.set('utm_campaign', 'live_tools');
  return u.toString();
}

// ========================================
// Error Handling
// ========================================

export function handleError(error, context = '') {
  console.error(`[Error${context ? ` ${context}` : ''}]`, error);
  // Could send to error tracking service here
  return { error: true, message: error.message || 'Unknown error' };
}

// ========================================
// Animation Helpers
// ========================================

export function animateCountdown(element, targetDate, onComplete) {
  const update = () => {
    const remaining = getTimeRemaining(targetDate);
    element.textContent = formatCountdown(remaining, { showSeconds: true });

    if (remaining.isPast) {
      element.textContent = 'Ended';
      element.classList.add('ended');
      if (onComplete) onComplete();
      return;
    }

    if (remaining.isLive) {
      element.textContent = 'LIVE NOW';
      element.classList.add('live');
    }

    requestAnimationFrame(update);
  };
  update();
}

// ========================================
// Export all as default namespace
// ========================================

export const Utils = {
  fetchWithCache,
  getTimeRemaining,
  formatCountdown,
  formatDate,
  formatRelativeTime,
  formatNumber,
  formatViewers,
  createElement,
  $,
  $$,
  debounce,
  throttle,
  initTheme,
  toggleTheme,
  getQueryParam,
  setQueryParam,
  addUTMParams,
  handleError,
  animateCountdown
};

export default Utils;