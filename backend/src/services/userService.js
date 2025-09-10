/**
 * userService: операции над пользователями/ролями/правами с проверками делегирования.
 * Использует raw SQL через sequelize.query (надёжнее с учётом существующей структуры).
 */

const bcrypt = require('bcryptjs');
const { sequelize } = require('../models');
const { computeEffectivePermissions, getUserScope } = require('./rbacService');
const { getDelegationCap, isPermSubset, isScopeSubset } = require('./delegationService');

/** Хелперы */

/**
 * Возвращает ID роли по имени.
 * @param {string} roleName
 * @returns {Promise<number|null>}
 */
async function getRoleId(roleName) {
  const [rows] = await sequelize.query(
    `SELECT id FROM roles WHERE name = :name`,
    { replacements: { name: roleName } }
  );
  return rows?.[0]?.id || null;
}

/**
 * Возвращает карту { code -> id } для массива кодов прав.
 * @param {string[]} codes
 * @returns {Promise<Map<string, number>>}
 */
async function getPermissionIdMap(codes) {
  // Возвратим пустую карту, если codes не массив или пустой
  if (!Array.isArray(codes) || codes.length === 0) return new Map();

  // ВАЖНО: используем IN (:codes), т.к. Sequelize корректно подставляет массивы для IN
  const [rows] = await sequelize.query(
    `SELECT id, code FROM permissions WHERE code IN (:codes)`,
    { replacements: { codes } }
  );

  // Собираем Map code -> id
  const m = new Map();
  for (const r of rows) m.set(r.code, r.id);
  return m;
}

/**
 * Возвращает роли + скоуп пользователя.
 * @param {number} userId
 */
async function getUserRolesWithScope(userId) {
  const [rows] = await sequelize.query(
    `SELECT r.name AS role, ur.scope
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = :userId`,
    { replacements: { userId } }
  );
  return rows || [];
}

/** Списки / чтение */

/**
 * Возвращает список пользователей, видимых текущему пользователю по его scope.
 * @param {number} viewerId
 * @returns {Promise<Array>}
 */
async function listUsersVisibleFor(viewerId) {
  const viewerScope = await getUserScope(viewerId);
  const [users] = await sequelize.query(
    `SELECT id, email, is_active
     FROM users
     ORDER BY id DESC`
  );

  const result = [];
  for (const u of users) {
    const roles = await getUserRolesWithScope(u.id);
    // фильтруем по scope
    let visible = false;
    if (viewerScope?.all) visible = true;
    else {
      // видим если есть пересечение scope домов
      outer: for (const rr of roles) {
        const s = rr.scope || {};
        if (s.all === true) { visible = true; break; }
        const setA = new Set((viewerScope.houses || []).map(Number));
        const setB = new Set((s.houses || []).map(Number));
        for (const h of setB) if (setA.has(Number(h))) { visible = true; break outer; }
      }
    }
    if (!visible) continue;

    result.push({
      id: u.id,
      email: u.email,
      is_active: u.is_active,
      roles: roles.map(r => ({ role: r.role, scope: r.scope })),
    });
  }
  return result;
}

/** Создание / изменение */

/**
 * Создаёт пользователя с ролью (admin/manager) и заданным scope (подмножество grantorScope).
 * Пароль — обязателен.
 * @param {number} grantorId
 * @param {{email:string, password:string, role:'admin'|'manager', scope:{houses:number[]}}} payload
 */
async function createUserWithRole(grantorId, payload) {
  const { email, password, role, scope } = payload;
  if (!email || !password || !role) throw new Error('VALIDATION_ERROR');

  // Проверка scope
  const grantorScope = await getUserScope(grantorId);
  if (!isScopeSubset(grantorScope, scope)) throw new Error('SCOPE_FORBIDDEN');

  // Создать пользователя
  const [exist] = await sequelize.query(`SELECT id FROM users WHERE email = :email`, { replacements: { email } });
  if (exist?.length) throw new Error('EMAIL_EXISTS');

  const hash = await bcrypt.hash(password, 10);
  const [ins] = await sequelize.query(
    `INSERT INTO users (email, password_hash, is_active) VALUES (:email, :hash, true) RETURNING id`,
    { replacements: { email, hash } }
  );
  const userId = ins[0].id;

  // Назначить роль + scope
  const roleId = await getRoleId(role);
  if (!roleId) throw new Error('ROLE_NOT_FOUND');
  await sequelize.query(
    `INSERT INTO user_roles (user_id, role_id, scope)
     VALUES (:userId, :roleId, :scope::jsonb)
     ON CONFLICT (user_id, role_id) DO UPDATE SET scope = EXCLUDED.scope`,
    { replacements: { userId, roleId, scope: JSON.stringify(scope) } }
  );

  // По умолчанию кэп для нового пользователя — пустой (не может делегировать),
  // суперадмин/админ позже настроит:
  await sequelize.query(
    `INSERT INTO user_delegation_caps (user_id, permissions) VALUES (:userId, '[]'::jsonb)
     ON CONFLICT (user_id) DO NOTHING`,
    { replacements: { userId } }
  );

  return { userId };
}

/**
 * Обновляет данные менеджера (email/password/scope).
 * Проверки: grantorScope ⊇ newScope, нельзя расширять сверх скоупа делегирующего.
 * @param {number} grantorId
 * @param {number} managerId
 * @param {{email?:string,password?:string,scope?:{houses:number[]}}} updates
 */
async function updateManager(grantorId, managerId, updates) {
  const grantorScope = await getUserScope(grantorId);
  if (updates.scope && !isScopeSubset(grantorScope, updates.scope)) throw new Error('SCOPE_FORBIDDEN');

  if (updates.email) {
    await sequelize.query(
      `UPDATE users SET email = :email WHERE id = :id`,
      { replacements: { email: updates.email, id: managerId } }
    );
  }
  if (updates.password) {
    const hash = await bcrypt.hash(updates.password, 10);
    await sequelize.query(
      `UPDATE users SET password_hash = :hash WHERE id = :id`,
      { replacements: { hash, id: managerId } }
    );
  }
  if (updates.scope) {
    const roleId = await getRoleId('manager');
    await sequelize.query(
      `UPDATE user_roles SET scope = :scope::jsonb WHERE user_id = :id AND role_id = :roleId`,
      { replacements: { scope: JSON.stringify(updates.scope), id: managerId, roleId } }
    );
  }
  return { ok: true };
}

/**
 * Отключает пользователя (is_active=false). Нельзя отключить superadmin.
 * Проверка: scope делегирующего ⊇ scope цели (хотя бы пересечение? — требуем подмножество).
 * @param {number} grantorId
 * @param {number} targetUserId
 */
async function disableUser(grantorId, targetUserId) {
  // Защитим superadmin
  const [sr] = await sequelize.query(
    `SELECT 1
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = :uid AND r.name = 'superadmin'`,
    { replacements: { uid: targetUserId } }
  );
  if (sr?.length) throw new Error('FORBIDDEN_SUPERADMIN');

  // Проверим scope подмножество
  const grantorScope = await getUserScope(grantorId);
  const roles = await getUserRolesWithScope(targetUserId);
  for (const rr of roles) {
    if (!isScopeSubset(grantorScope, rr.scope || {})) throw new Error('SCOPE_FORBIDDEN');
  }

  await sequelize.query(
    `UPDATE users SET is_active = false WHERE id = :id`,
    { replacements: { id: targetUserId } }
  );
  return { ok: true };
}

/**
 * Удаляет пользователя полностью. Нельзя удалить superadmin.
 * @param {number} grantorId
 * @param {number} targetUserId
 */
async function deleteUser(grantorId, targetUserId) {
  // Запрет на superadmin
  const [sr] = await sequelize.query(
    `SELECT 1
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = :uid AND r.name = 'superadmin'`,
    { replacements: { uid: targetUserId } }
  );
  if (sr?.length) throw new Error('FORBIDDEN_SUPERADMIN');

  // Scope check как и при disable
  const grantorScope = await getUserScope(grantorId);
  const roles = await getUserRolesWithScope(targetUserId);
  for (const rr of roles) {
    if (!isScopeSubset(grantorScope, rr.scope || {})) throw new Error('SCOPE_FORBIDDEN');
  }

  await sequelize.query(`DELETE FROM users WHERE id = :id`, { replacements: { id: targetUserId } });
  return { ok: true };
}

/**
 * Назначает пользователю роль (admin/manager) и scope (upsert).
 * Требует role.assign_permissions у делегирующего и проверки scope.
 * @param {number} grantorId
 * @param {number} userId
 * @param {{role:'admin'|'manager', scope:{houses:number[]}}} body
 */
async function setUserRole(grantorId, userId, body) {
  const { role, scope } = body;
  if (role === 'superadmin') throw new Error('FORBIDDEN_SUPERADMIN_ROLE');
  const grantorScope = await getUserScope(grantorId);
  if (!isScopeSubset(grantorScope, scope)) throw new Error('SCOPE_FORBIDDEN');

  const roleId = await getRoleId(role);
  if (!roleId) throw new Error('ROLE_NOT_FOUND');

  await sequelize.query(
    `INSERT INTO user_roles (user_id, role_id, scope)
     VALUES (:userId, :roleId, :scope::jsonb)
     ON CONFLICT (user_id, role_id) DO UPDATE SET scope = EXCLUDED.scope`,
    { replacements: { userId, roleId, scope: JSON.stringify(scope) } }
  );

  // (опционально) очищать другие роли admin/manager — по желанию. Пока оставим как есть.
  return { ok: true };
}

/**
 * Заменяет персональные надбавки прав пользователя (полный список).
 * Валидация: requested ⊆ (grantor.effective ∩ grantor.cap).
 * @param {number} grantorId
 * @param {number} userId
 * @param {{permissions: string[]}} body
 */
async function setUserBoosts(grantorId, userId, body) {
  const requested = body?.permissions || [];
  const grantorPerms = await computeEffectivePermissions(grantorId);
  const grantorCap = await getDelegationCap(grantorId);

  if (!isPermSubset(grantorPerms, grantorCap, requested)) throw new Error('PERMISSION_FORBIDDEN');

  // заменить набор: удалим все и вставим новые
  await sequelize.query(`DELETE FROM user_permission_boosts WHERE user_id = :uid`, { replacements: { uid: userId } });

  if (requested.length) {
    const map = await getPermissionIdMap(requested);
    for (const code of requested) {
      const pid = map.get(code);
      if (!pid) continue;
      await sequelize.query(
        `INSERT INTO user_permission_boosts (user_id, permission_id)
         VALUES (:uid, :pid)
         ON CONFLICT (user_id, permission_id) DO NOTHING`,
        { replacements: { uid: userId, pid } }
      );
    }
  }
  return { ok: true };
}

/**
 * Устанавливает кап делегирования пользователю.
 * Только superadmin может ставить {"all": true}. Иначе — список ⊆ (grantor.cap ∩ grantor.effective).
 * @param {number} grantorId
 * @param {number} userId
 * @param {{permissions:'all'|string[]}} body
 */
async function setUserDelegationCap(grantorId, userId, body) {
  const grantorPerms = await computeEffectivePermissions(grantorId);
  const grantorCap = await getDelegationCap(grantorId);

  let payload;
  if (body?.permissions === 'all') {
    // Разрешим только супер-админу
    const [sr] = await sequelize.query(
      `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = :uid AND r.name = 'superadmin'`,
      { replacements: { uid: grantorId } }
    );
    if (!sr?.length) throw new Error('FORBIDDEN_ALL_CAP');
    payload = { all: true };
  } else {
    const requested = Array.isArray(body?.permissions) ? body.permissions : [];
    if (!isPermSubset(grantorPerms, grantorCap, requested)) throw new Error('PERMISSION_FORBIDDEN');
    payload = requested;
  }

  await sequelize.query(
    `INSERT INTO user_delegation_caps (user_id, permissions)
     VALUES (:uid, :p::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET permissions = EXCLUDED.permissions`,
    { replacements: { uid: userId, p: JSON.stringify(payload) } }
  );

  return { ok: true };
}

module.exports = {
  listUsersVisibleFor,
  createUserWithRole,
  updateManager,
  disableUser,
  deleteUser,
  setUserRole,
  setUserBoosts,
  setUserDelegationCap,
};
