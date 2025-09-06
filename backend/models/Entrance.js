const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Entrance = sequelize.define('Entrance', {
    house_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    entrance_number: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    floors_count: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    apartments_per_floor: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    tableName: 'entrances',
    timestamps: false
});

module.exports = Entrance;
