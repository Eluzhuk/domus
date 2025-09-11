/* global window, document */
/**
 * Логика страницы Users:
 * - логин/refresh/logout
 * - загрузка домов, ролей, прав
 * - список пользователей и действия
 */

const API = window.DOMUS_API_BASE_URL;
const $ = (sel) => document.querySelector(sel);

/** Рендер чипов ролей */
function renderRoles(roles) {
  if (!roles?.length) return '<span class="muted">нет ролей</span>';
  return roles.map(r => {
    const s = JSON.stringify(r.scope || {});
    return `<span class="pill">${r.role}</span> <span class="muted">${s}</span>`;
  }).join('<br>');
}

/** Получить отмеченные дома из блока чекбоксов */
function getCheckedHouses(container) {
  return Array.from(container.querySelectorAll('input[type=checkbox]:checked')).map(i => Number(i.value));
}

/** Сформировать чекбоксы домов */
function renderHouseChecks(houses, prefix) {
  if (!houses?.length) return '<span class="err">Нет домов</span>';
  return houses.map(h => {
    const id = `${prefix}-house-${h.id}`;
    return `<label class="inline"><input type="checkbox" id="${id}" value="${h.id}"><span>${h.name || ('Дом #' + h.id)}</span></label>`;
  }).join('<br>');
}

/** Рендер таблицы пользователей */
function renderUsersTable(users) {
  if (!users?.length) return '<div class="muted">Пока нет пользователей</div>';
  const rows = users.map(u => `
    <tr data-id="${u.id}">
      <td>${u.id}</td>
      <td>
        <div><strong>${u.display_name ? u.display_name + ' ' : ''}</strong><span class="muted">${u.email}</span></div>
        <div class="muted">${u.is_active ? 'активен' : 'отключен'}</div>
      </td>
      <td>${renderRoles(u.roles)}</td>
      <td>
        <div class="inline" style="flex-wrap: wrap;">
          <button class="btn warn act-role">Скоуп</button>
          <button class="btn act-boosts">Бусты</button>
          <button class="btn act-cap">Кэп</button>
          ${u.is_active
            ? `<button class="btn" data-action="disable">Отключить</button>`
            : `<button class="btn" data-action="enable">Включить</button>`
          }
          <button class="btn danger" data-action="delete">Удалить</button>
        </div>
        <div class="hidden" style="margin-top:8px;" data-form="role"></div>
        <div class="hidden" style="margin-top:8px;" data-form="boosts"></div>
        <div class="hidden" style="margin-top:8px;" data-form="cap"></div>
      </td>
    </tr>
  `).join('');
  return `
    <table>
      <thead><tr><th>ID</th><th>Email / Ник</th><th>Роли</th><th>Действия</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}


/** Загрузка домов для чекбоксов */
async function loadHouses() {
  const res = await window._auth.apiFetch(`${API}/houses`);
  if (!res.ok) throw new Error('houses failed');
  const houses = await res.json();
  $('#adminHouses').innerHTML = renderHouseChecks(houses, 'admin');
  $('#mgrHouses').innerHTML = renderHouseChecks(houses, 'mgr');
}

/** Загрузка списка пользователей */
async function loadUsers() {
  const res = await window._auth.apiFetch(`${API}/users`);
  const root = $('#usersTable');
  if (!res.ok) { root.innerHTML = `<span class="err">Ошибка ${res.status}</span>`; return; }
  const data = await res.json();
  root.innerHTML = renderUsersTable(data);
}

/** Загрузка прав и ролей */
async function loadPermsAndRoles() {
  // Роли можно и захардкодить, но для единообразия спросим бэк
  const [rRoles, rPerms] = await Promise.all([
    window._auth.apiFetch(`${API}/roles`),
    window._auth.apiFetch(`${API}/permissions`) // может вернуть 403, если нет прав
  ]);
  let roles = ['admin', 'manager'];
  try { if (rRoles.ok) roles = await rRoles.json(); } catch(_) {}
  let perms = [];
  if (rPerms.status === 200) perms = await rPerms.json();
  return { roles, perms };
}

/** Рендер формы Роль/Скоуп под строкой пользователя */
function showRoleForm(tr, roles, houses) {
  const box = tr.querySelector('[data-form="role"]');
  const id = Number(tr.dataset.id);
  box.innerHTML = `
    <div class="card">
      <div class="inline" style="gap:12px; flex-wrap:wrap;">
        <span class="muted">Скоуп по домам (роль: admin):</span>
        <span>${renderHouseChecks(houses, `role-${id}`)}</span>
        <button class="btn primary" data-do="save-role">Сохранить</button>
      </div>
      <div class="muted">Назначение скоупа пользователю (роль admin).</div>
    </div>
  `;
  box.classList.remove('hidden');
}

/** Рендер формы Бусты (персональные права) */
function showBoostsForm(tr, perms) {
  const box = tr.querySelector('[data-form="boosts"]');
  const id = Number(tr.dataset.id);
  if (!perms?.length) {
    box.innerHTML = `<div class="muted">Нет прав для отображения или 403 (нет доступа к /permissions)</div>`;
  } else {
    box.innerHTML = `
      <div class="card">
        <div>Отметьте права для персональной выдачи:</div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:6px; margin:8px 0;">
          ${perms.map(p => `
            <label class="inline">
              <input type="checkbox" value="${p.code}"><span>${p.code}</span>
            </label>
          `).join('')}
        </div>
        <button class="btn primary" data-do="save-boosts">Сохранить</button>
      </div>
    `;
  }
  box.classList.remove('hidden');
}

/** Рендер формы Кэп (разрешённый набор для делегирования) */
function showCapForm(tr, perms, isSuper) {
  const box = tr.querySelector('[data-form="cap"]');
  const id = Number(tr.dataset.id);
  box.innerHTML = `
    <div class="card">
      <div class="inline">
        <button class="btn" data-do="cap-all" ${isSuper ? '' : 'disabled'}>Разрешить ALL (только супер)</button>
        <span class="muted">или выберите конкретные права ниже</span>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); gap:6px; margin:8px 0;">
        ${perms.map(p => `
          <label class="inline">
            <input type="checkbox" value="${p.code}"><span>${p.code}</span>
          </label>
        `).join('')}
      </div>
      <button class="btn primary" data-do="save-cap">Сохранить</button>
      <div class="muted">Кэп ограничивает, какие права этот пользователь сможет делегировать дальше.</div>
    </div>
  `;
  box.classList.remove('hidden');
}

/** Инициализация */
document.addEventListener('DOMContentLoaded', async () => {
  const s = $('#authStatus');

  // Кнопки входа/refresh/выход
  $('#btnLogin').addEventListener('click', async () => {
    const ok = await window._auth.login($('#loginEmail').value.trim(), $('#loginPass').value);
    s.textContent = ok ? 'Вход выполнен' : 'Ошибка входа';
    if (ok) { await Promise.all([loadHouses(), loadUsers()]); }
  });

  $('#btnRefresh').addEventListener('click', async () => {
    const t = await window._auth.refreshAccessToken();
    s.textContent = t ? 'access обновлён' : 'refresh не сработал';
  });

  $('#btnLogout').addEventListener('click', async () => {
    await window._auth.logout();
    s.textContent = 'Вы вышли';
  });

  // Создать админа (с валидацией и показом текста ошибки)
  $('#btnCreateAdmin').addEventListener('click', async () => {
    const email = $('#adminEmail').value.trim();
    const password = $('#adminPass').value;
    const display_name = ($('#adminNick')?.value || '').trim() || null;
    const houses = getCheckedHouses($('#adminHouses'));

    if (!email || !password) { alert('Укажите email и пароль'); return; }
    if (!houses.length)     { alert('Выберите хотя бы один дом'); return; }

    const r = await window._auth.apiFetch(`${API}/users/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name, scope: { houses } })
    });

    if (r.ok) {
      alert('Админ создан');
      await loadUsers();
    } else {
      let msg = `Ошибка: ${r.status}`;
      try { const data = await r.json(); if (data?.error) msg += ` — ${data.error}`; } catch {}
      alert(msg);
    }
  });

  // Перезагрузка списка
  $('#btnReload').addEventListener('click', loadUsers);

  // Действия по строкам таблицы
  $('#usersTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const tr = btn.closest('tr');
    if (!tr) return;
    const userId = Number(tr.dataset.id);

    // Подтянуть справочники один раз при первом клике
    const { roles, perms } = await loadPermsAndRoles();

    if (btn.classList.contains('act-role')) {
      const resH = await window._auth.apiFetch(`${API}/houses`);
      const houses = resH.ok ? await resH.json() : [];
      showRoleForm(tr, roles, houses);
      return;
    }
    if (btn.classList.contains('act-boosts')) {
      showBoostsForm(tr, perms);
      return;
    }
    if (btn.classList.contains('act-cap')) {
      let isSuper = false;
      try {
        const t = window._auth.getAccessToken();
        const payload = t ? JSON.parse(atob(t.split('.')[1])) : null;
        isSuper = !!(payload?.scope?.all);
      } catch {}
      showCapForm(tr, perms, isSuper);
      return;
    }

    // data-action
    const action = btn.dataset.action;
    if (action === 'disable') {
      const r = await window._auth.apiFetch(`${API}/users/${userId}/disable`, { method: 'POST' });
      alert(r.ok ? 'Пользователь отключен' : `Ошибка: ${r.status}`);
      await loadUsers();
      return;
    }
    if (action === 'enable') {
      const r = await window._auth.apiFetch(`${API}/users/${userId}/enable`, { method: 'POST' });
      alert(r.ok ? 'Пользователь включен' : `Ошибка: ${r.status}`);
      await loadUsers();
      return;
    }
    if (action === 'delete') {
      if (!confirm('Удалить пользователя?')) return;
      const r = await window._auth.apiFetch(`${API}/users/${userId}`, { method: 'DELETE' });
      alert(r.ok ? 'Пользователь удалён' : `Ошибка: ${r.status}`);
      await loadUsers();
      return;
    }
  });

  // Кнопки внутри форм (сохранение скоупа/бустов/кэпа)
  $('#usersTable').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-do]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const userId = Number(tr.dataset.id);
    const kind = btn.dataset.do;

    if (kind === 'save-role') {
      const houses = Array.from(tr.querySelectorAll(`[id^="role-${userId}-house-"]:checked`)).map(i => Number(i.value));
      const r = await window._auth.apiFetch(`${API}/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', scope: { houses } })
      });
      alert(r.ok ? 'Скоуп обновлён' : `Ошибка: ${r.status}`);
      await loadUsers();
      return;
    }

    if (kind === 'save-boosts') {
      const codes = Array.from(tr.querySelectorAll('[data-form="boosts"] input[type=checkbox]:checked')).map(i => i.value);
      const r = await window._auth.apiFetch(`${API}/users/${userId}/boosts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: codes })
      });
      alert(r.ok ? 'Бусты сохранены' : `Ошибка: ${r.status}`);
      return;
    }

    if (kind === 'cap-all') {
      const r = await window._auth.apiFetch(`${API}/users/${userId}/delegation-cap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: 'all' })
      });
      alert(r.ok ? 'ALL установлен' : `Ошибка: ${r.status}`);
      return;
    }

    if (kind === 'save-cap') {
      const codes = Array.from(tr.querySelectorAll('[data-form="cap"] input[type=checkbox]:checked')).map(i => i.value);
      const r = await window._auth.apiFetch(`${API}/users/${userId}/delegation-cap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: codes })
      });
      alert(r.ok ? 'Кэп сохранён' : `Ошибка: ${r.status}`);
      return;
    }
  });

  // ⬇️ Авто-логин при загрузке: если нет access — попробуем refresh по cookie
  const ok = await window._auth.ensureAuthOnLoad();
  if (ok) {
    await Promise.all([loadHouses(), loadUsers()]);
    s.textContent = 'Авторизован';
  } else {
    s.textContent = 'Не авторизован. Войдите, пожалуйста.';
    // На всякий случай очистим таблицу
    $('#usersTable').innerHTML = '<div class="muted">Нет данных</div>';
  }
});

