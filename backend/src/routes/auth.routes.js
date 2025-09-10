/**
 * /api/auth: login, refresh, logout
 */
const { Router } = require('express');
const cookieParser = require('cookie-parser');
const { findActiveUserByEmail, verifyPassword, issueTokens, refreshAccess, clearRefresh } = require('../services/authService');

const router = Router();
router.use(cookieParser());

/** POST /api/auth/login {email, password} -> {access} */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'EMAIL_OR_PASSWORD_REQUIRED' });

  const user = await findActiveUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

  const access = await issueTokens(res, user.id);
  return res.json({ access });
});

/** POST /api/auth/refresh -> {access} */
router.post('/refresh', async (req, res) => {
  const access = await refreshAccess(req, res);
  if (!access) return res.status(401).json({ error: 'INVALID_REFRESH' });
  res.json({ access });
});

/** POST /api/auth/logout */
router.post('/logout', async (req, res) => {
  clearRefresh(res);
  res.json({ ok: true });
});

module.exports = router;
