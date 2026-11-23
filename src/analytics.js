const STORAGE_KEY = 'aerogenii-game-analytics-v1';
const SESSION_KEY = 'aerogenii-game-session-v1';
const MAX_EVENTS = 2000;
const REMOTE_ENDPOINT = globalThis.AEROGENII_ANALYTICS_ENDPOINT || '';
const sessionId = globalThis.crypto?.randomUUID?.() ??
  `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const startedAt = performance.now();
let ended = false;

function readEvents() {
  try {
    const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

export function recordGameEvent(type, details = {}) {
  const event = {
    type,
    at: new Date().toISOString(),
    mission: Number.isInteger(details.mission) ? details.mission : null,
    device: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop',
    sessionId,
    ...(Number.isFinite(details.durationSeconds) ? { durationSeconds: Math.round(details.durationSeconds) } : {}),
  };
  try {
    const events = readEvents();
    events.push(event);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    // Analytics are optional and must never interfere with gameplay.
  }
  if (REMOTE_ENDPOINT) {
    fetch(REMOTE_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {});
  }
}

export function endAnalyticsSession() {
  if (ended) return;
  ended = true;
  recordGameEvent('session_end', { durationSeconds: (performance.now() - startedAt) / 1000 });
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

try {
  if (!sessionStorage.getItem(SESSION_KEY)) {
    sessionStorage.setItem(SESSION_KEY, sessionId);
    recordGameEvent('session_start');
  }
} catch {
  recordGameEvent('session_start');
}

window.addEventListener('pagehide', endAnalyticsSession);
