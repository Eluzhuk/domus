// auth-guard.js — защищает страницы админки и пытается "мягко" обновить access токен

/**
 * Пробует выполнить refresh и сохранить новый access.
 * @returns {Promise<boolean>} true — если получили новый access; false — иначе.
 */
async function tryRefreshAccess() {
  try {
    const r = await fetch(`${window.DOMUS_API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    if (!r.ok) return false;
    const data = await r.json().catch(() => null);
    if (data && data.access) {
      localStorage.setItem('domus_access', data.access);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Проверяет наличие access; если нет — пробует refresh; если не вышло — редирект на /login.html
 */
(function guard() {
  if (location.pathname.endsWith('/login.html')) return; // логин — общедоступен

  document.addEventListener('DOMContentLoaded', async () => {
    let access = localStorage.getItem('domus_access');
    if (!access) {
      const refreshed = await tryRefreshAccess();
      if (!refreshed) {
        location.replace('/pages/login.html');
        return;
      }
      access = localStorage.getItem('domus_access');
    }

    // Доп. проверка токена, опционально можно дернуть /auth/me здесь
    // Если страницы сами делают запросы — возможный 401 поймает apiFetch/refresh или пользователь улетит на логин позже.
  });
})();
