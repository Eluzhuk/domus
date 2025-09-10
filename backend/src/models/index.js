const Sequelize = require('sequelize'); // можно оставить, если где-то используется
const { sequelize, DataTypes } = require('../db');

const House = require('./House');
const Entrance = require('./Entrance');
const Apartment = require('./Apartment');
const Parking = require('./Parking');
const StorageUnit = require('./StorageUnit');
const Resident = require('./Resident');
const ResidentApartment = require('./ResidentApartment');
const ResidentParking = require('./ResidentParking');
const ResidentStorage = require('./ResidentStorage');
const ResidentPrivacy = require('./ResidentPrivacy');
const Role = require('./Role')(sequelize, DataTypes);
const Permission = require('./Permission')(sequelize, DataTypes);
const RolePermission = require('./RolePermission')(sequelize, DataTypes);
const User = require('./User')(sequelize, DataTypes);
const UserRole = require('./UserRole')(sequelize, DataTypes);
const UserPermissionBoost = require('./UserPermissionBoost')(sequelize, DataTypes);
const UserDelegationCap = require('./UserDelegationCap')(sequelize, DataTypes);

// Связи для домов
House.hasMany(Entrance, { foreignKey: 'house_id', onDelete: 'CASCADE' });
Entrance.belongsTo(House, { foreignKey: 'house_id' });

House.hasMany(Parking, { foreignKey: 'house_id', onDelete: 'CASCADE' });
Parking.belongsTo(House, { foreignKey: 'house_id' });

House.hasMany(StorageUnit, { foreignKey: 'house_id', onDelete: 'CASCADE' });
StorageUnit.belongsTo(House, { foreignKey: 'house_id' });

// Связи для жильцов
Entrance.hasMany(Apartment, { foreignKey: 'entrance_id', onDelete: 'CASCADE' });
Apartment.belongsTo(Entrance, { foreignKey: 'entrance_id' });

Resident.belongsToMany(Apartment, { through: ResidentApartment, foreignKey: 'resident_id' });
Apartment.belongsToMany(Resident, { through: ResidentApartment, foreignKey: 'apartment_id' });

Resident.belongsToMany(Parking, { through: ResidentParking, foreignKey: 'resident_id' });
Parking.belongsToMany(Resident, { through: ResidentParking, foreignKey: 'parking_id' });

Resident.belongsToMany(StorageUnit, { through: ResidentStorage, foreignKey: 'resident_id' });
StorageUnit.belongsToMany(Resident, { through: ResidentStorage, foreignKey: 'storage_id' });

// Привязка жильцов через подъезды
House.hasMany(Resident, { foreignKey: 'house_id', onDelete: 'CASCADE' });
Resident.belongsTo(House, { foreignKey: 'house_id' });

ResidentApartment.belongsTo(Resident, { foreignKey: 'resident_id' });
Resident.hasMany(ResidentApartment, { foreignKey: 'resident_id' });

Apartment.hasMany(ResidentApartment, { foreignKey: 'apartment_id', onDelete: 'CASCADE' });
ResidentApartment.belongsTo(Apartment, { foreignKey: 'apartment_id' });

//Связь между жильцами и парковками:
Resident.hasMany(ResidentParking, { foreignKey: 'resident_id', onDelete: 'CASCADE' });
ResidentParking.belongsTo(Resident, { foreignKey: 'resident_id' });

Parking.hasMany(ResidentParking, { foreignKey: 'parking_id', onDelete: 'CASCADE' });
ResidentParking.belongsTo(Parking, { foreignKey: 'parking_id' });

//Связь между жильцами и кладовыми:
Resident.hasMany(ResidentStorage, { foreignKey: 'resident_id', onDelete: 'CASCADE' });
ResidentStorage.belongsTo(Resident, { foreignKey: 'resident_id' });

StorageUnit.hasMany(ResidentStorage, { foreignKey: 'storage_id', onDelete: 'CASCADE' });
ResidentStorage.belongsTo(StorageUnit, { foreignKey: 'storage_id' });

// Приватность: 1–к–1
Resident.hasOne(ResidentPrivacy, { foreignKey: 'resident_id', as: 'privacy', onDelete: 'CASCADE' });
ResidentPrivacy.belongsTo(Resident, { foreignKey: 'resident_id' });

module.exports = {
sequelize,
Sequelize,
House,
Entrance,
Apartment,
Parking,
StorageUnit,
Resident,
ResidentApartment,
ResidentParking,
ResidentStorage,
ResidentPrivacy,
Role,
Permission,
RolePermission,
User,
UserRole,
UserPermissionBoost,
UserDelegationCap
};
