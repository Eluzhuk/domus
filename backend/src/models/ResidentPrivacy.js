// backend/models/ResidentPrivacy.js
const { sequelize, DataTypes } = require('../db');

/**
 * Настройки приватности для жильца (одна запись на жильца).
 * По умолчанию все поля показываются (true).
 */
const ResidentPrivacy = sequelize.define('ResidentPrivacy', {
id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
resident_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
show_full_name: { type: DataTypes.BOOLEAN, defaultValue: true },
show_phone: { type: DataTypes.BOOLEAN, defaultValue: true },
show_email: { type: DataTypes.BOOLEAN, defaultValue: true },
show_telegram: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
tableName: 'resident_privacy',
timestamps: false,
});

module.exports = ResidentPrivacy;
