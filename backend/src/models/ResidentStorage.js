const { sequelize, DataTypes } = require('../db');

const ResidentStorage = sequelize.define('ResidentStorage', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	resident_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	storage_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	unit_number: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	type: {
		type: DataTypes.ENUM('owner', 'tenant'),
		allowNull: false
	}
}, {
	tableName: 'resident_storage',
	timestamps: false
});

module.exports = ResidentStorage;
