const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    resetToken: Number,
    resetTokenExpiry: Date,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Customer', CustomerSchema);

