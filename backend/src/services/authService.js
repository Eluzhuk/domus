/**
 * Auth-сервис: hash/verify паролей, выдача/проверка JWT, извлечение профиля.
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { computeEffectivePermissions, getUserScope } = require('./rbacService');

const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME || 'domus_refresh';

/** Хэширует пароль. @param {string} plain @returns {Promise<string>} */
function hashPassword(plain) { return bcrypt.hash(plain, 10); }

/** Проверяет пароль. @param {string} plain @param {string} hash @returns {Promise<boolean>} */
function verifyPassword(plain, hash) { return bcrypt.compare(plain, hash); }

/**
 * Выдаёт пару токенов: access (короткий) + refresh (длинный в cookie)
 * @param {object} res - express res (для установки cookie)
 * @param {number} userId
 */
async function issueTokens(res, userId) {
  const perms = await computeEffectivePermissions(userId);
  const scope = await getUserScope(userId);
  const access = jwt.sign(
    { sub: userId, perms: Array.from(perms), scope },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.ACCESS_TTL || '15m' }
  );
  const refresh = jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.REFRESH_TTL || '7d' }
  );
  // httpOnly cookie для refresh
  res.cookie(REFRESH_COOKIE_NAME, refresh, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // включите true на проде с HTTPS
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/api/auth',
  });
  return access;
}

/** Обновляет access по refresh-cookie. @param {object} req @param {object} res */
async function refreshAccess(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch {
    return null;
  }
  return issueTokens(res, payload.sub);
}

/** Гасит refresh-cookie. @param {object} res */
function clearRefresh(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
}

/** Загружает активного пользователя. @param {string} email */
async function findActiveUserByEmail(email) {
  return User.findOne({ where: { email, is_active: true } });
}

module.exports = {
  hashPassword, verifyPassword, issueTokens, refreshAccess, clearRefresh, findActiveUserByEmail
};
