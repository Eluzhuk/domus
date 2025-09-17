const { sequelize, DataTypes } = require('../db');

// Определение модели дома
const House = sequelize.define('House', {
	name: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	address: {
		type: DataTypes.STRING,
		allowNull: false,
	},
	slug: {
		type: DataTypes.STRING(120),
		allowNull: true, // можно не задавать — сгенерируем
		validate: {
			// Разрешаем только латиницу/цифры/дефис (kebab-case)
			is: /^[a-z0-9]+(?:-[a-z0-9]+)*$/i
		}
	},
	non_residential_first_floor: {
		type: DataTypes.BOOLEAN,
		defaultValue: false,
	},
}, {
	tableName: 'houses',  // Привязка к существующей таблице в PostgreSQL
	timestamps: false,    // Убираем поля createdAt и updatedAt
});

module.exports = House;