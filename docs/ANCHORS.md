# Domus — Индекс якорей по файлам

Ниже — стабильные якоря (точные строки/фразы) для адресного редактирования. Номера строк могут слегка сдвигаться при вставках выше по файлу — используйте поиск по якорю.

## Бэкенд

### domus/backend/app.js
- [стр   38] `app.use('/api'`
- [стр   39] `app.use('/api'`
- [стр   42] `app.use('/api/auth'`
- [стр   43] `app.use('/api/public'`
- [стр   46] `app.use('/api'`

### domus/backend/src/routes/auth.routes.js
- [стр   12] `router.post('/login'`
- [стр   36] `router.post('/refresh'`
- [стр   46] `router.post('/logout'`
- [стр   51] `module.exports = router`

### domus/backend/src/routes/public.routes.js
- [стр   10] `router.get('/board/:slug'`
- [стр   16] `module.exports = router`

### domus/backend/src/routes/houseRoutes.js
- [стр    6] `router.get('/houses'`
- [стр    7] `router.post('/houses'`
- [стр    8] `router.put('/houses/:id'`
- [стр    9] `router.delete('/houses/:id'`
- [стр   10] `router.get('/houses/:id/structure'`
- [стр   11] `router.get('/:id/visualization'`
- [стр   13] `module.exports = router`

### domus/backend/src/routes/residentRoutes.js
- [стр    7] `router.post('/houses/:house_id/residents'`
- [стр    9] `router.get('/residents/:id'`
- [стр   11] `router.put('/residents/:id'`
- [стр   13] `router.delete('/residents/:id'`
- [стр   15] `router.delete('/residents/:id/link'`
- [стр   17] `module.exports = router`

### domus/backend/src/routes/users.routes.js
- [стр   21] `router.get('/users'`
- [стр   36] `router.post('/users/admins'`
- [стр   52] `router.post('/users/managers'`
- [стр   83] `router.post('/users/:id/disable'`
- [стр   98] `router.delete('/users/:id'`
- [стр  114] `router.post('/users/:id/roles'`
- [стр  130] `router.post('/users/:id/boosts'`
- [стр  146] `router.post('/users/:id/delegation-cap'`
- [стр  164] `router.get('/roles'`
- [стр  174] `router.get('/permissions'`
- [стр  191] `router.post('/users/:id/enable'`
- [стр  218] `module.exports = router`

### domus/backend/src/services/authService.js
- [стр   11] `const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET`
- [стр   12] `const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET`
- [стр   13] `const ACCESS_TTL = process.env.ACCESS_TTL || '15m'`
- [стр   14] `const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TTL_DAYS || 30)`
- [стр  ~XX] `async function issueTokens(`      ← генерация access/refresh и установка cookie `domus_refresh`
- [стр  ~YY] `module.exports = { findActiveUserByEmail, verifyPassword, issueTokens, refreshAccess, clearRefresh }`

### domus/backend/src/services/boardService.js
- [стр    5] `const { sequelize } = require('../models');`
- [стр  ~XX] `function maskResident(`           ← маскирование ПДн
- [стр  ~YY] `module.exports = { getBoardBySlug }`

### domus/backend/src/services/rbacService.js
- [стр    5] `const { sequelize, Role, Permission, RolePermission, UserRole, UserPermissionBoost } = require('../models');`
- [стр  ~XX] `async function computeEffectivePermissions(` 
- [стр  ~YY] `module.exports = { computeEffectivePermissions, getUserScope }`

### domus/backend/src/services/userService.js
- [стр  ~XX] `async function listUsersVisibleFor(`
- [стр  ~XX] `async function createUserWithRole(`
- [стр  ~XX] `async function updateManager(`
- [стр  ~XX] `async function disableUser(`
- [стр  ~XX] `async function enableUser(`
- [стр  ~XX] `async function deleteUser(`
- [стр  ~XX] `async function setUserRole(`
- [стр  ~XX] `async function setUserBoosts(`
- [стр  ~XX] `async function setUserDelegationCap(`
- [стр  ~XX] `async function updateProfile(`
- [стр  ~ZZ] `module.exports = { ... }`

### domus/backend/src/middleware/auth.js
- [стр    7] `function authRequired(req, res, next) {`
- [стр  ~XX] `module.exports = { authRequired }`

### domus/backend/src/middleware/permissions.js
- [стр    1] заголовок файла
- [стр  ~XX] `function requirePermissions(...perms) {`
- [стр  ~YY] `function requireScope(paramName) {`
- [стр  ~ZZ] `module.exports = { requirePermissions, requireScope }`

## Фронтенд

### domus/frontend/scripts/config.js
- [стр    3] `window.DOMUS_API_BASE_URL = ...` ← глобальный базовый URL API

### domus/frontend/scripts/auth.js
- [стр  ~01] `function setAccessToken(`
- [стр  ~XX] `function getAccessToken(`
- [стр  ~XX] `async function refreshAccessToken(`
- [стр  ~XX] `async function apiFetch(`
- [стр  ~XX] `async function login(`
- [стр  ~XX] `async function logout(`
- [стр  ~ZZ] `function ensureAuthOnLoad()`

### domus/frontend/scripts/login.js
- [стр  ~01] `function onSubmit(`
- [стр  ~ZZ] `document.getElementById('loginForm')...addEventListener('submit', onSubmit)`

### domus/frontend/scripts/board.js
- [стр  ~01] `async function loadBoard(`
- [стр  ~XX] `function renderBoard(`
- [стр  ~ZZ] `document.getElementById('loadBtn')...addEventListener('click', loadBoard)`

### domus/frontend/scripts/houses.js
- [стр    8] `const n0 = (v) => ...`
- [стр   15] `const fmt = (x, y) => ...`
- [стр   22] `function initPrivacyIconToggles(`
- [стр   44] `function isPrivacyOn(`
- [стр  104] `function renderHouseCard(`
- [стр  212] `function initHouseSearch(`
