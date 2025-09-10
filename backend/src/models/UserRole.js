/**
 * Модель UserRole — роль пользователя и scope (JSONB)
 * scope: { all: true } ИЛИ { houses: number[] }
 */
module.exports = (sequelize, DataTypes) => {
  const UserRole = sequelize.define('UserRole', {
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role_id: { type: DataTypes.INTEGER, allowNull: false },
    scope: { type: DataTypes.JSONB, allowNull: false },
  }, {
    tableName: 'user_roles',
    timestamps: false,
  });
  return UserRole;
};
