/**
 * Модель UserPermissionBoost — персональные надбавки прав
 */
module.exports = (sequelize, DataTypes) => {
  const UserPermissionBoost = sequelize.define('UserPermissionBoost', {
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    permission_id: { type: DataTypes.INTEGER, allowNull: false },
  }, {
    tableName: 'user_permission_boosts',
    timestamps: false,
  });
  return UserPermissionBoost;
};
