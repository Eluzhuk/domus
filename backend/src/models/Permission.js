/**
 * Модель Permission
 * Поля: code (уник), description
 */
module.exports = (sequelize, DataTypes) => {
const Permission = sequelize.define('Permission', {
	code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
	description: { type: DataTypes.TEXT, allowNull: true },
}, {
	tableName: 'permissions',
	timestamps: false,
});
return Permission;
};
