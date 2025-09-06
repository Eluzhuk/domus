require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const houseRoutes = require('./routes/houseRoutes');
const sequelize = require('./models').sequelize;
const residentRoutes = require('./routes/residentRoutes');

const app = express();
app.use(bodyParser.json());
app.use(cors({
	origin: '*',  // Разрешить запросы с любого домена
	methods: ['GET', 'POST', 'PUT', 'DELETE'],  // Разрешённые методы
	allowedHeaders: ['Content-Type', 'Authorization']  // Разрешённые заголовки
 }));
app.use('/api', houseRoutes);
app.use('/api', residentRoutes);

// Middleware для обработки ошибок
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send({ error: 'Что-то пошло не так!' });
});

const PORT = process.env.PORT || 5000;

// Запуск сервера
sequelize.authenticate()
.then(() => {
console.log('Подключение к базе данных успешно');

// Создадим таблицу resident_privacy, если её нет
const { sequelize } = require('./models');
sequelize.query(`
	CREATE TABLE IF NOT EXISTS resident_privacy (
		id SERIAL PRIMARY KEY,
		resident_id INTEGER UNIQUE REFERENCES residents(id) ON DELETE CASCADE,
		show_full_name BOOLEAN DEFAULT TRUE,
		show_phone BOOLEAN DEFAULT TRUE,
		show_email BOOLEAN DEFAULT TRUE,
		show_telegram BOOLEAN DEFAULT TRUE
	);
`).then(() => console.log('resident_privacy готова'));

app.listen(PORT, () => {
	console.log(`Сервер запущен на http://localhost:${PORT}`);
});
})
.catch((err) => {
console.error('Ошибка подключения к базе данных:', err);
});