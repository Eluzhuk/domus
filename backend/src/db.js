// Минимальная инициализация Sequelize (если у вас уже есть свой файл — используйте его, см. примечание ниже)
/**
 * Создает подключение Sequelize к PostgreSQL из .env
 * Экспортирует: sequelize, DataTypes
 */
const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
process.env.DB_NAME || 'domus',
process.env.DB_USER || 'postgres',
process.env.DB_PASS || '',
{
	host: process.env.DB_HOST || '127.0.0.1',
	port: Number(process.env.DB_PORT || 5432),
	dialect: 'postgres',
	logging: false,
}
);

module.exports = { sequelize, DataTypes };
