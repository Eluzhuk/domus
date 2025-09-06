const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Resident = sequelize.define('Resident', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	full_name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	phone: {
		type: DataTypes.STRING,
		allowNull: true
	},
	email: {
		type: DataTypes.STRING,
		allowNull: true
	},
	telegram: {
		type: DataTypes.STRING,
		allowNull: true
	}
}, {
	tableName: 'residents',
	timestamps: false
});

module.exports = Resident;
