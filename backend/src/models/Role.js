/**
 * Модель Role
 * Поля: name (уник), description
 */
module.exports = (sequelize, DataTypes) => {
const Role = sequelize.define('Role', {
	name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
	description: { type: DataTypes.TEXT, allowNull: true },
}, {
	tableName: 'roles',
	timestamps: false,
	underscored: false,
});
return Role;
};
