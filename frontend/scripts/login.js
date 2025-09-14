// login.js — обработчик формы входа

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const hint = document.getElementById('loginHint');

  const setLoading = (v) => {
    btn.disabled = v;
    btn.textContent = v ? 'Входим…' : 'Войти';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setLoading(true);
    hint.style.display = 'none';
    try {
      const email = (document.getElementById('email').value || '').trim();
      const password = document.getElementById('password').value || '';

      const r = await fetch(`${window.DOMUS_API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // важно: сервер поставит HttpOnly cookie domus_refresh
        body: JSON.stringify({ email, password })
      });

      if (!r.ok) {
        const msg = await r.text();
        showToast('danger', 'Неверный e-mail или пароль');
        hint.textContent = msg || 'Ошибка входа';
        hint.style.display = 'block';
        return;
      }

      const data = await r.json();
      if (!data || !data.access) {
        showToast('danger', 'Сервер не вернул access-токен');
        return;
      }

      // Сохраняем access и переходим в админку
      localStorage.setItem('domus_access', data.access);

      // Опционально подтянем профиль и сохраним имя, это улучшит UX в хедере сразу
      try {
        const meR = await fetch(`${window.DOMUS_API_BASE_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${data.access}` },
          credentials: 'include'
        });
        if (meR.ok) {
          const me = await meR.json();
          if (me && me.display_name) localStorage.setItem('domus_display_name', me.display_name);
          if (me && me.email) localStorage.setItem('domus_email', me.email);
        }
      } catch {}

      location.href = '/pages/houses.html';
    } catch (err) {
      showToast('danger', 'Не удалось выполнить вход. Проверьте соединение.');
    } finally {
      setLoading(false);
    }
  });
});
