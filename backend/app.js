require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Маршруты вашего проекта
const houseRoutes = require('./src/routes/houseRoutes');
const residentRoutes = require('./src/routes/residentRoutes');

// Инициализация моделей и Sequelize (один раз)
const { sequelize } = require('./src/models');

// Новые маршруты Этапа 1 (Auth + Публичная шахматка)
const authRoutes = require('./src/routes/auth.routes');
const publicRoutes = require('./src/routes/public.routes');

const app = express();

/**
 * Настройка CORS.
 * ВАЖНО: для cookie (refresh) нужен credentials: true и НЕ можно '*' в origin.
 * Задайте CORS_ORIGIN в .env при необходимости (по умолчанию localhost:5173).
 */
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
origin: ALLOWED_ORIGIN,
credentials: true,
methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
allowedHeaders: ['Content-Type', 'Authorization']
}));

// Парсинг JSON и cookie (refresh хранится в httpOnly cookie)
app.use(express.json());
app.use(cookieParser());

// Подключаем существующие маршруты
app.use('/api', houseRoutes);
app.use('/api', residentRoutes);

// Новые маршруты: аутентификация и публичная шахматка
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);

const usersRoutes = require('./src/routes/users.routes');
app.use('/api', usersRoutes);

// Middleware для обработки ошибок (на самый конец цепочки)
app.use((err, req, res, next) => {
console.error(err.stack);
res.status(500).send({ error: 'Что-то пошло не так!' });
});

const PORT = process.env.PORT || 5000;

// Запуск сервера
sequelize.authenticate()
.then(async () => {
	console.log('Подключение к базе данных успешно');
	app.listen(PORT, () => {
		console.log(`Сервер запущен на http://localhost:${PORT}`);
		console.log(`CORS ORIGIN: ${ALLOWED_ORIGIN} (credentials: true)`);
	});
})
.catch((err) => {
	console.error('Ошибка подключения к базе данных:', err);
});
