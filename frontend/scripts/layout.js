// layout.js — инжекция общего лэйаута Tabler, загрузка partials, активное меню, профиль, logout
// Требует: config.js, ui.js, (опц.) auth.js с apiFetch()

/**
 * Собирает оболочку страницы (header/sidebar/footer) и переносит текущий контент в #page-content.
 */
(function initLayout() {
  // Не применять лэйаут на странице логина
  if (location.pathname.endsWith('/login.html')) return;

  document.addEventListener('DOMContentLoaded', async () => {
    // 1) Сконструировать каркас Tabler
    const bodyChildren = [...document.body.childNodes];
    const shell = document.createElement('div');
    shell.className = 'page';
    shell.innerHTML = `
      <div id="sidebarMount"></div>
      <div class="page-wrapper">
        <div id="headerMount"></div>
        <div class="page-body">
          <div class="container-xl">
            <div id="page-content"></div>
          </div>
        </div>
        <div id="footerMount"></div>
      </div>
    `;
    document.body.innerHTML = '';
    document.body.appendChild(shell);

    // 2) Переносим старый контент в #page-content
    const content = document.getElementById('page-content');
    bodyChildren.forEach(n => content.appendChild(n));

	// 3) Подгружаем partials и вставляем ИМЕННО элементами (outerHTML), без лишних обёрток,
	// чтобы <aside.navbar-vertical> стал СОСЕДОМ .page-wrapper (это критично для отступа Tabler)
	const headerMountEl = document.getElementById('headerMount');
	const sidebarMountEl = document.getElementById('sidebarMount');
	const footerMountEl = document.getElementById('footerMount');

	const [headerHtml, sidebarHtml, footerHtml] = await Promise.all([
	fetch('/partials/header.html').then(r => r.text()),
	fetch('/partials/sidebar.html').then(r => r.text()),
	fetch('/partials/footer.html').then(r => r.text()),
	]);

	// sidebar ДОЛЖЕН быть реальным <aside class="navbar navbar-vertical ..."> соседом для .page-wrapper
	// поэтому заменяем placeholder целиком, а не innerHTML
	if (sidebarMountEl) sidebarMountEl.outerHTML = sidebarHtml;
	if (headerMountEl) headerMountEl.outerHTML = headerHtml;
	if (footerMountEl) footerMountEl.outerHTML = footerHtml;

	    // 3.1) Подключаем наш общий CSS (и, при желании, Google Font Inter) во <head>
    (function injectHeadLinks() {
      const ensureLink = (href, rel = 'stylesheet') => {
        if (!document.querySelector(`link[rel="${rel}"][href="${href}"]`)) {
          const link = document.createElement('link');
          link.rel = rel;
          link.href = href;
          document.head.appendChild(link);
        }
      };

      // (Опционально) Шрифт Inter от Google — раскомментируйте 2 строки ниже, если нужен Inter
      // ensureLink('https://fonts.googleapis.com', 'preconnect'); // ускорение
      // ensureLink('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

      // Наши локальные стили для сайдбара
      ensureLink('/assets/styles.css');
    })();


    // 4) Год в футере
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    // 5) Активный пункт в сайдбаре
    const map = {
      '/pages/houses.html': 'houses',
      '/pages/board.html': 'board',
      '/pages/users.html': 'users',
    };
    const activeKey = map[location.pathname] || '';
    document.querySelectorAll('[data-nav]').forEach(a => {
      if (a.getAttribute('data-nav') === activeKey) a.classList.add('active');
    });

    // 6) Привязка logout
    const bindLogout = (el) => el && el.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        // Очистим токен локально и попросим сервер убрать refresh-cookie
        localStorage.removeItem('domus_access');
        await fetch(`${window.DOMUS_API_BASE_URL}/auth/logout`, {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {});
      } finally {
        location.href = '/pages/login.html';
      }
    });
    bindLogout(document.getElementById('logoutLink'));
    bindLogout(document.getElementById('logoutLinkSidebar'));

    // 7) Загрузим профиль для хэдера
    try {
      // Если есть глобальный apiFetch — используем его; иначе минимальный вызов
      const meResp = await fetch(`${window.DOMUS_API_BASE_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('domus_access') || ''}` },
        credentials: 'include'
      });
      if (meResp.ok) {
        const me = await meResp.json();
        const nameEl = document.getElementById('userDisplayName');
        const emailEl = document.getElementById('userEmail');
        if (nameEl && me.display_name) nameEl.textContent = me.display_name;
        if (emailEl && me.email) emailEl.textContent = me.email;
        // Инициал для аватарки
        const avatar = document.querySelector('.avatar.avatar-sm');
        if (avatar && me.display_name) avatar.textContent = me.display_name.trim().slice(0,1).toUpperCase();
      }
    } catch (e) {
      // молчим — guard разрулит редирект
    }
  });
})();
