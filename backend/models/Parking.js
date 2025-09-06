const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Parking = sequelize.define('Parking', {
	house_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	level: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	spots_count: {
		type: DataTypes.INTEGER,
		allowNull: false
	}
}, {
	tableName: 'parkings',
	timestamps: false
});

module.exports = Parking;
