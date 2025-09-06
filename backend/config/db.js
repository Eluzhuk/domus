const { Sequelize } = require('sequelize');

// Подключение к базе данных PostgreSQL
const sequelize = new Sequelize(
process.env.DB_NAME,  // Имя базы данных
process.env.DB_USER,  // Пользователь
process.env.DB_PASS,  // Пароль
{
	host: process.env.DB_HOST,
	dialect: 'postgres', // Указываем, что используем PostgreSQL
	logging: false,      // Отключаем логи SQL запросов
}
);

module.exports = sequelize;