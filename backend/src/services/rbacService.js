/**
 * RBAC-сервис:
 * - computeEffectivePermissions(userId): собирает права роли + персональные надбавки
 * - getUserScope(userId): возвращает scope (объединяем все роли пользователя)
 */
const { sequelize, Role, Permission, RolePermission, UserRole, UserPermissionBoost } = require('../models');

const PERM_CACHE_SECONDS = 30;
const _cache = new Map(); // простейший кэш в памяти

/**
 * Возвращает Set строк-кодов прав пользователя.
 * @param {number} userId
 * @returns {Promise<Set<string>>}
 */
async function computeEffectivePermissions(userId) {
const cacheKey = `perms:${userId}`;
const cached = _cache.get(cacheKey);
if (cached && (Date.now() - cached.t) < PERM_CACHE_SECONDS * 1000) return cached.v;

// Права по ролям
const [rolePerms] = await sequelize.query(
	`
	SELECT DISTINCT p.code
	FROM user_roles ur
	JOIN role_permissions rp ON rp.role_id = ur.role_id
	JOIN permissions p ON p.id = rp.permission_id
	WHERE ur.user_id = :userId
	`,
	{ replacements: { userId } }
);

// Персональные надбавки
const [boostPerms] = await sequelize.query(
	`
	SELECT DISTINCT p.code
	FROM user_permission_boosts upb
	JOIN permissions p ON p.id = upb.permission_id
	WHERE upb.user_id = :userId
	`,
	{ replacements: { userId } }
);

const set = new Set([...(rolePerms?.map(r => r.code) || []), ...(boostPerms?.map(r => r.code) || [])]);
_cache.set(cacheKey, { t: Date.now(), v: set });
return set;
}

/**
 * Возвращает объединённый scope пользователя.
 * @param {number} userId
 * @returns {Promise<{all?: boolean, houses?: number[]}>}
 */
async function getUserScope(userId) {
const [rows] = await sequelize.query(
	`SELECT scope FROM user_roles WHERE user_id = :userId`,
	{ replacements: { userId } }
);
if (!rows || rows.length === 0) return { houses: [] };
// Объединяем: если есть all=true — возвращаем all; иначе объединяем массивы houses.
const scopes = rows.map(r => r.scope || {});
if (scopes.some(s => s.all === true)) return { all: true };
const set = new Set();
scopes.forEach(s => (s.houses || []).forEach(id => set.add(Number(id))));
return { houses: Array.from(set) };
}

module.exports = { computeEffectivePermissions, getUserScope };
