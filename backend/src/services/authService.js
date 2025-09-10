/**
 * Сервис аутентификации: логин, refresh, logout.
 * Генерирует access/refresh JWT. Хранит refresh в httpOnly cookie 'domus_refresh'.
 * Использует RBAC для вычисления прав и скоупа, чтобы включить их в access-токен.
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../models');
const { computeEffectivePermissions, getUserScope } = require('./rbacService');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
const ACCESS_TTL = process.env.ACCESS_TTL || '15m';   // срок жизни access
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30); // дней

/**
 * Возвращает активного пользователя по email.
 * @param {string} email
 * @returns {Promise<{id:number,email:string,password_hash:string,is_active:boolean}|null>}
 */
async function findActiveUserByEmail(email) {
const [rows] = await sequelize.query(
	`SELECT id, email, password_hash, is_active
	FROM users
	WHERE email = :email`,
	{ replacements: { email } }
);
const u = rows?.[0];
if (!u || u.is_active === false) return null;
return u;
}

/**
 * Сравнивает пароль с хэшем.
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
return bcrypt.compare(password, hash);
}

/**
 * Выдаёт access и ставит refresh-куку.
 * @param {import('express').Response} res
 * @param {number} userId
 * @returns {Promise<string>} access JWT
 */
async function issueTokens(res, userId) {
// Вычислим права и скоуп пользователя для включения в access
const permsSet = await computeEffectivePermissions(userId);
const scope = await getUserScope(userId);
const perms = Array.from(permsSet);

const access = jwt.sign(
	{ sub: userId, perms, scope },
	ACCESS_SECRET,
	{ expiresIn: ACCESS_TTL }
);

// refresh (минимальный payload)
const refresh = jwt.sign(
	{ sub: userId },
	REFRESH_SECRET,
	{ expiresIn: `${REFRESH_TTL_DAYS}d` }
);

// Ставим httpOnly cookie с именем domus_refresh
const isProd = process.env.NODE_ENV === 'production';
res.cookie('domus_refresh', refresh, {
	httpOnly: true,
	secure: isProd,                // в DEV false (http://localhost)
	sameSite: isProd ? 'none' : 'lax',
	path: '/api/auth',             // подходит для /api/auth/refresh
	maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
});

return access;
}

/**
 * Освежает access по refresh-куке. По желанию ротирует refresh.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<string|null>} access или null, если нет/невалиден refresh
 */
async function refreshAccess(req, res) {
// Читаем обе — на случай старого имени
const token = req.cookies?.domus_refresh || req.cookies?.refresh;
if (!token) {
	console.warn('[auth.refresh] нет куки. cookie header =', req.headers?.cookie);
	return null;
}

let payload;
try {
	payload = jwt.verify(token, REFRESH_SECRET);
} catch (e) {
	console.warn('[auth.refresh] invalid refresh:', e.message);
	return null;
}

const userId = payload.sub;
// Права + скоуп для нового access
const permsSet = await computeEffectivePermissions(userId);
const scope = await getUserScope(userId);
const perms = Array.from(permsSet);

const access = jwt.sign(
	{ sub: userId, perms, scope },
	ACCESS_SECRET,
	{ expiresIn: ACCESS_TTL }
);

// (опционально) ротируем refresh — удобно для DEV
const isProd = process.env.NODE_ENV === 'production';
const newRefresh = jwt.sign({ sub: userId }, REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
res.cookie('domus_refresh', newRefresh, {
	httpOnly: true,
	secure: isProd,
	sameSite: isProd ? 'none' : 'lax',
	path: '/api/auth',
	maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
});

return access;
}

/**
 * Чистит refresh-куку.
 * @param {import('express').Response} res
 */
function clearRefresh(res) {
res.clearCookie('domus_refresh', { path: '/api/auth' });
}

module.exports = {
findActiveUserByEmail,
verifyPassword,
issueTokens,
refreshAccess,
clearRefresh,
};
