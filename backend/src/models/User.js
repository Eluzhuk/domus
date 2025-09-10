/**
 * Модель User
 * Хранит email, password_hash, is_active
 */
module.exports = (sequelize, DataTypes) => {
const User = sequelize.define('User', {
	email: { type: DataTypes.STRING(255), allowNull: false, unique: true },
	password_hash: { type: DataTypes.STRING(255), allowNull: false },
	is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
	created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
	updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
	tableName: 'users',
	timestamps: false,
});
return User;
};
