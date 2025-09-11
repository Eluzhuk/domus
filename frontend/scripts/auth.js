/* global window, sessionStorage */
/**
 * Утилиты авторизации для фронта.
 * Хранит access в sessionStorage. Обновляет через /auth/refresh при 401.
 */

/**
 * Сохраняет access JWT в sessionStorage.
 * @param {string} token
 */
function setAccessToken(token) {
  // Храним access в localStorage, чтобы переживал перезагрузку
  localStorage.setItem('domus_access', token || '');
}

/**
 * Возвращает access JWT из sessionStorage.
 * @returns {string|null}
 */
function getAccessToken() {
  return localStorage.getItem('domus_access');
}

/**
 * Выполняет refresh access по httpOnly cookie domus_refresh.
 * @returns {Promise<string|null>} Новый access или null
 */
async function refreshAccessToken() {
  try {
    const r = await fetch(`${window.DOMUS_API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // важно для куки
      headers: { 'Origin': 'http://localhost:5173' } // для CORS dev
    });
    if (!r.ok) return null;
    const data = await r.json();
    if (data && data.access) {
      setAccessToken(data.access);
      return data.access;
    }
  } catch (e) {
    console.error('refreshAccessToken failed:', e);
  }
  return null;
}

/**
 * Выполняет fetch с подстановкой Authorization и авто-рефрешем при 401.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const req = { ...options, headers, credentials: 'include' }; // include для /auth/*
  let res = await fetch(url, req);
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers, credentials: 'include' });
    }
  }
  return res;
}

/**
 * Выполняет login и сохраняет access. Refresh-cookie поставит сервер.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<boolean>}
 */
async function login(email, password) {
  const r = await fetch(`${window.DOMUS_API_BASE_URL}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5173' },
    body: JSON.stringify({ email, password })
  });
  if (!r.ok) return false;
  const data = await r.json();
  if (data && data.access) {
    setAccessToken(data.access);
    return true;
  }
  return false;
}

/**
 * Выход: чистит refresh-cookie на сервере и local access.
 * @returns {Promise<void>}
 */
async function logout() {
  try {
    await fetch(`${window.DOMUS_API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Origin': 'http://localhost:5173' }
    });
  } catch (e) {
    // ignore
  } finally {
    setAccessToken('');
  }
}

/**
 * Пытается обеспечить авторизацию при загрузке страницы.
 * 1) Если есть access в localStorage — ок.
 * 2) Если нет — пробует refresh по cookie и сохраняет новый access.
 * @returns {Promise<boolean>} авторизован ли в итоге
 */
async function ensureAuthOnLoad() {
  const t = getAccessToken();
  if (t) return true;
  const refreshed = await refreshAccessToken();
  return !!refreshed;
}

// Экспорт в окно
window._auth = { setAccessToken, getAccessToken, refreshAccessToken, apiFetch, login, logout, ensureAuthOnLoad };
