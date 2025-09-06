const express = require('express');
const router = express.Router();
const houseController = require('../controllers/houseController');


router.get('/houses', houseController.getAllHouses); // Получения всех домов
router.post('/houses', houseController.createHouse); // Создания нового дома
router.put('/houses/:id', houseController.updateHouse); // Обновление дома
router.delete('/houses/:id', houseController.deleteHouse); // Удаление дома
router.get('/houses/:id/structure', houseController.getHouseStructure); // Шахматка
router.get('/:id/visualization', houseController.getHouseVisualization); // Визуализация

module.exports = router;
