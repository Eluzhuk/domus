const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ResidentApartment = sequelize.define('ResidentApartment', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	resident_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	apartment_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	type: {
		type: DataTypes.ENUM('owner', 'tenant'),
		allowNull: false
	}
}, {
	tableName: 'resident_apartments',
	timestamps: false
});

module.exports = ResidentApartment;
