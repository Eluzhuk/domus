const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const StorageUnit = sequelize.define('StorageUnit', {
	house_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	level: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	units_count: {
		type: DataTypes.INTEGER,
		allowNull: false
	}
}, {
	tableName: 'storages',
	timestamps: false
});

module.exports = StorageUnit;
