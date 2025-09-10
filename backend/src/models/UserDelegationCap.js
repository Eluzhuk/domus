/**
 * Модель UserDelegationCap — кэп делегирования
 * permissions: { all: true } ИЛИ ["house.update","user.disable",...]
 */
module.exports = (sequelize, DataTypes) => {
  const UserDelegationCap = sequelize.define('UserDelegationCap', {
    user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    permissions: { type: DataTypes.JSONB, allowNull: false },
  }, {
    tableName: 'user_delegation_caps',
    timestamps: false,
  });
  return UserDelegationCap;
};
