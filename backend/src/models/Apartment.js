const { sequelize, DataTypes } = require('../db');

const Apartment = sequelize.define('Apartment', {
	entrance_id: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	floor_number: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	apartment_number: {
		type: DataTypes.INTEGER,
		allowNull: false
	}
}, {
	tableName: 'apartments',
	timestamps: false
});

module.exports = Apartment;
