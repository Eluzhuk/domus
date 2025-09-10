/**
 * Глобальная конфигурация фронтенда Domus.
 * Переменная window.DOMUS_API_BASE_URL используется во всех fetch.
 * Можно переопределить через localStorage.setItem('DOMUS_API', 'https://api.myhost.com/api')
 */
(() => {
// Базовый URL по умолчанию — локальный dev
const fallback = 'http://localhost:5000/api';

/** Возвращает строку базового URL API из localStorage или дефолт.
	* @returns {string} Базовый URL API
	*/
function resolveApiBase() {
	try {
		const fromLS = typeof localStorage !== 'undefined' ? localStorage.getItem('DOMUS_API') : null;
		if (fromLS && typeof fromLS === 'string' && fromLS.trim().length > 0) return fromLS.trim();
	} catch (_) { /* игнорируем */ }
	return fallback;
}

// Пишем в глобальную область видимости
window.DOMUS_API_BASE_URL = resolveApiBase();
})();
