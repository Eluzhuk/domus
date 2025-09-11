/**
 * /api/users — управление пользователями/ролями/правами
 * Маршруты защищены: authRequired + checkPermission(...)
 */

const { Router } = require('express');
const { authRequired } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const userService = require('../services/userService');

const router = Router();

// Все ниже — только для авторизованных
router.use(authRequired);

/**
 * GET /api/users
 * Требует: user.read
 * Возвращает: пользователей, видимых по scope текущего пользователя (админ видит своих админов/менеджеров; супер — всех).
 */
router.get('/users', checkPermission('user.read'), async (req, res) => {
  try {
    const data = await userService.listUsersVisibleFor(req.user.id);
    res.json(data);
  } catch (e) {
    console.error('[GET /api/users]', e);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

/**
 * POST /api/users/admins
 * Требует: user.create_admin
 * Body: { email, password, scope: { houses: number[] } }
 */
router.post('/users/admins', checkPermission('user.create_admin'), async (req, res) => {
  try {
    const { email, password, scope } = req.body || {};
    const r = await userService.createUserWithRole(req.user.id, { email, password, role: 'admin', scope });
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code === 'EMAIL_EXISTS' ? 409 : (code.endsWith('_FORBIDDEN') ? 403 : 400)).json({ error: code });
  }
});

/**
 * POST /api/users/managers
 * Требует: user.manager.create
 * Body: { email, password, scope: { houses: number[] } }
 */
router.post('/users/managers', checkPermission('user.manager.create'), async (req, res) => {
  try {
    const { email, password, scope } = req.body || {};
    const r = await userService.createUserWithRole(req.user.id, { email, password, role: 'manager', scope });
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code === 'EMAIL_EXISTS' ? 409 : (code.endsWith('_FORBIDDEN') ? 403 : 400)).json({ error: code });
  }
});

/**
 * PATCH /api/users/managers/:id
 * Требует: user.manager.update
 * Body: { email?, password?, scope? }
 */
router.patch('/users/managers/:id', checkPermission('user.manager.update'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await userService.updateManager(req.user.id, id, req.body || {});
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code.endsWith('_FORBIDDEN') ? 403 : 400).json({ error: code });
  }
});

/**
 * POST /api/users/:id/disable
 * Требует: user.disable
 */
router.post('/users/:id/disable', checkPermission('user.disable'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await userService.disableUser(req.user.id, id);
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code === 'FORBIDDEN_SUPERADMIN' ? 403 : (code.endsWith('_FORBIDDEN') ? 403 : 400)).json({ error: code });
  }
});

/**
 * DELETE /api/users/:id
 * Требует: user.delete
 */
router.delete('/users/:id', checkPermission('user.delete'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await userService.deleteUser(req.user.id, id);
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code === 'FORBIDDEN_SUPERADMIN' ? 403 : (code.endsWith('_FORBIDDEN') ? 403 : 400)).json({ error: code });
  }
});

/**
 * POST /api/users/:id/roles
 * Требует: role.assign_permissions
 * Body: { role: 'admin'|'manager', scope: { houses:number[] } }
 */
router.post('/users/:id/roles', checkPermission('role.assign_permissions'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await userService.setUserRole(req.user.id, id, req.body || {});
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code === 'FORBIDDEN_SUPERADMIN_ROLE' ? 403 : (code.endsWith('_FORBIDDEN') ? 403 : 400)).json({ error: code });
  }
});

/**
 * POST /api/users/:id/boosts
 * Требует: role.assign_permissions
 * Body: { permissions: string[] }
 */
router.post('/users/:id/boosts', checkPermission('role.assign_permissions'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await userService.setUserBoosts(req.user.id, id, req.body || {});
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code.endsWith('_FORBIDDEN') ? 403 : 400).json({ error: code });
  }
});

/**
 * POST /api/users/:id/delegation-cap
 * Требует: role.assign_permissions
 * Body: { permissions: 'all' | string[] }
 */
router.post('/users/:id/delegation-cap', checkPermission('role.assign_permissions'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await userService.setUserDelegationCap(req.user.id, id, req.body || {});
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code === 'FORBIDDEN_ALL_CAP' ? 403 : (code.endsWith('_FORBIDDEN') ? 403 : 400)).json({ error: code });
  }
});

// --- Справочники для UI ---

/**
 * GET /api/roles
 * Требует: user.read
 * Возвращает список ролей для UI.
 */
router.get('/roles', checkPermission('user.read'), async (req, res) => {
// Пока роли фиксированы
res.json(['admin']);
});

/**
 * GET /api/permissions
 * Требует: role.assign_permissions
 * Возвращает все права (code, description) для чекбоксов.
 */
router.get('/permissions', checkPermission('role.assign_permissions'), async (req, res) => {
try {
	const { sequelize } = require('../models');
	const [rows] = await sequelize.query(
		`SELECT code, description FROM permissions ORDER BY code`
	);
	res.json(rows || []);
} catch (e) {
	console.error('[GET /api/permissions]', e);
	res.status(500).json({ error: 'INTERNAL_ERROR' });
}
});

/**
 * POST /api/users/:id/enable
 * Требует: user.disable (то же право, что и на отключение)
 */
router.post('/users/:id/enable', checkPermission('user.disable'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await userService.enableUser(req.user.id, id);
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code === 'FORBIDDEN_SUPERADMIN' ? 403 : (code.endsWith('_FORBIDDEN') ? 403 : 400)).json({ error: code });
  }
});

/**
 * PATCH /api/users/:id/profile
 * Требует: user.manager.update (переиспользуем как "user.update") — при желании переименуем позже.
 * Body: { email?, password?, display_name? }
 */
router.patch('/users/:id/profile', checkPermission('user.manager.update'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const r = await userService.updateProfile(req.user.id, id, req.body || {});
    res.json(r);
  } catch (e) {
    const code = e.message || 'ERROR';
    res.status(code === 'EMAIL_EXISTS' ? 409 : (code.endsWith('_FORBIDDEN') ? 403 : 400)).json({ error: code });
  }
});

module.exports = router;
