const {DataTypes} = require('sequelize');
const {sequelize} = require('../config/database');

const SentimentAnalysis = sequelize.define('SentimentAnalysis', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    text: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    sentiment: {
        type: DataTypes.STRING,
        allowNull: true
    },
    score: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = SentimentAnalysis;