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
  non_residential_first_floor: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'houses',  // Привязка к существующей таблице в PostgreSQL
  timestamps: false,    // Убираем поля createdAt и updatedAt
});

module.exports = House;