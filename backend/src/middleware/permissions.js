/**
 * checkPermission(code): требует конкретное право
 * requireScope(paramName): гарантирует, что запрашиваемый houseId входит в scope пользователя
 */

/** @param {string} code */
function checkPermission(code) {
  /** @param {import('express').Request} req @param {import('express').Response} res @param {Function} next */
  return (req, res, next) => {
    if (!req.user?.perms?.has(code)) return res.status(403).json({ error: 'NO_PERMISSION', code });
    next();
  };
}

/** @param {string} paramName - имя параметра маршрута, содержащего houseId */
function requireScope(paramName) {
  /** @param {import('express').Request} req @param {import('express').Response} res @param {Function} next */
  return (req, res, next) => {
    const scope = req.user?.scope || {};
    if (scope.all === true) return next();
    const houseId = Number(req.params[paramName] || req.body[paramName] || req.query[paramName]);
    if (!houseId) return res.status(400).json({ error: 'NO_HOUSE_ID' });
    const allowed = (scope.houses || []).map(Number);
    if (!allowed.includes(houseId)) return res.status(403).json({ error: 'SCOPE_FORBIDDEN', houseId });
    next();
  };
}

module.exports = { checkPermission, requireScope };
