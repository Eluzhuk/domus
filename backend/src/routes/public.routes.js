/**
 * Публичные маршруты (без JWT)
 */
const { Router } = require('express');
const { getBoardBySlug } = require('../services/boardService');

const router = Router();

/** GET /api/public/board/:slug */
router.get('/board/:slug', async (req, res) => {
  const data = await getBoardBySlug(req.params.slug);
  if (!data) return res.status(404).json({ error: 'NOT_FOUND' });
  res.json(data);
});

module.exports = router;
