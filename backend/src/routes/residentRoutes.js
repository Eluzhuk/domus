//backend\routes\residentRoutes.js
const express = require('express');
const router = express.Router();
const residentController = require('../controllers/residentController');

// Маршрут для добавления жильца
router.post('/houses/:house_id/residents', residentController.addResident);
// Маршрут для получения данных жильца
router.get('/residents/:id', residentController.getResidentById);
// Маршрут для редактирования жильца
router.put('/residents/:id', residentController.updateResident);
// Маршрут для удаления жильца
router.delete('/residents/:id', residentController.deleteResident);
// Отвязать жильца от конкретного объекта (квартиры/парковки/кладовой), не удаляя самого жильца
router.delete('/residents/:id/link', residentController.detachResidentLink);

module.exports = router;
