/**
 * authRequired: проверяет access-JWT в Authorization: Bearer <token>
 */
const jwt = require('jsonwebtoken');

/** @param {import('express').Request} req @param {import('express').Response} res @param {Function} next */
function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' });

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = {
      id: Number(payload.sub),
      perms: new Set(payload.perms || []),
      scope: payload.scope || { houses: [] },
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'INVALID_TOKEN' });
  }
}

module.exports = { authRequired };
