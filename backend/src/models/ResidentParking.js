const { sequelize, DataTypes } = require('../db');

const ResidentParking = sequelize.define('ResidentParking', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},
	resident_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	parking_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	spot_number: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	type: {
		type: DataTypes.ENUM('owner', 'tenant'),
		allowNull: false
	}
}, {
	tableName: 'resident_parkings',
	timestamps: false
});

module.exports = ResidentParking;
